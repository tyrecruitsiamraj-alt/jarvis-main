import {
  withRbac,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { listSiamrajUnitRequests } from '../_lib/siamrajUnitRequests.js';
import { loadMatchingBuScope } from '../_lib/departmentScope.js';
import { listProposalsForJobs } from '../_lib/candidateProposals.js';
import { loadBoardMatchTierMap } from '../_lib/boardMatchStore.js';
import { loadLumosJobCallSummaryMap, type LumosJobCallSummary } from '../_lib/lumosDispatch.js';
import { loadBoardAvailabilityContext } from '../_lib/boardAvailability.js';
import { isBoardCandidateAvailable } from '@/lib/boardMatchAvailability';
import {
  attachAssignments,
  attachNotes,
  attachWorkStatus,
} from './siamraj-unit-requests.js';
// ⚠ server-side pagination แบบ zero-drift: ใช้ฟังก์ชันกรอง/เรียง "ตัวเดียวกับหน้า Matching"
// (src/lib/matchingListFilter) — โค้ดชุดเดียว รันทั้งสองฝั่ง ผลจึงตรงกันโดยโครงสร้าง
import { enrichJobsWithUrgency } from '@/lib/jobUrgency';
import {
  filterAndSortMatchingJobs,
  normalizeMatchingListSort,
  type MatchingWorkflowFilter,
} from '@/lib/matchingListFilter';
import { recommendedCandidateCount } from '@/lib/matchingProgress';
import { jobPositionUnits } from '@/lib/jobPositionUnits';
import type { JobRequest } from '@/types';
import { enqueuePrecomputeJobs } from '../_lib/matchPrecomputeWorker.js';

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

const WORKFLOWS: MatchingWorkflowFilter[] = [
  'all',
  'sla',
  'green',
  'yellow',
  'recommended',
  'none',
  'reserved',
];

function normalizeWorkflow(v: string): MatchingWorkflowFilter {
  return (WORKFLOWS as string[]).includes(v) ? (v as MatchingWorkflowFilter) : 'all';
}

/**
 * GET /api/matching/list — server-side pagination ของลิสต์ใบขอหน้า Matching
 * params: page, pageSize, q, unit, urgent=1, workflow=all|sla|green|yellow|none|reserved
 * คืน { items, total, page, pageSize, unitOptions, summary, storedMatches }
 */
async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const departmentScope = await loadMatchingBuScope(req.user);

    // ท่อเดียวกับ feed หลักของหน้า Matching เดิม: ใบขอเปิด + ผู้รับผิดชอบ/หมายเหตุ/สถานะทำงาน + urgency
    const raw = (await listSiamrajUnitRequests({ limit: 500, departmentScope })) as unknown[];
    await Promise.all([attachAssignments(raw), attachNotes(raw), attachWorkStatus(raw)]);
    const jobs = enrichJobsWithUrgency(raw as JobRequest[]);

    // Push ให้ precompute worker ทำ AI match ล่วงหน้า — ลำดับ priority (SLA/urgent ก่อน)
    enqueuePrecomputeJobs(jobs);

    // ข้อมูลประกอบตัวกรองจาก PG: การจองตัว + ผล AI ที่เคยคิดเก็บไว้ + ความพร้อมของคนของเรา
    // + สรุปผลโทร Lumos ต่อใบ (โชว์ข้างการ์ด)
    const [proposalMap, tierMap, availCtx, lumosMap] = await Promise.all([
      listProposalsForJobs(jobs.map((j) => j.id)),
      loadBoardMatchTierMap(),
      loadBoardAvailabilityContext(),
      loadLumosJobCallSummaryMap().catch(() => new Map<string, LumosJobCallSummary>()),
    ]);

    // กรองผลที่เก็บไว้ให้เหลือเฉพาะ "คนที่ยังพร้อม" ก่อนนับป้าย/summary/workflow filter
    // (คนที่ถูกดึงไปใบอื่น/หลุด pool จะไม่ถูกนับ — ตรงกับที่หน้า detail แสดง)
    for (const [jobId, entry] of tierMap) {
      entry.tiers = entry.tiers.filter((t) => isBoardCandidateAvailable(t.cardId, jobId, availCtx));
    }

    const query = {
      search: getQuery(req, 'q'),
      urgentOnly: getQuery(req, 'urgent') === '1',
      unitFilter: getQuery(req, 'unit'),
      workflowFilter: normalizeWorkflow(getQuery(req, 'workflow')),
      buFilter: getQuery(req, 'bu'),
      sort: normalizeMatchingListSort(getQuery(req, 'sort')),
    };

    const rows = filterAndSortMatchingJobs(jobs, query, {
      hasReserved: (jobId) =>
        (proposalMap.get(jobId) ?? []).some((item) => item.status === 'reserved'),
      matchesFor: (jobId) => tierMap.get(jobId)?.tiers,
    });

    const page = Math.max(1, Number(getQuery(req, 'page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(getQuery(req, 'pageSize')) || 60));
    const start = (page - 1) * pageSize;
    const items = rows.slice(start, start + pageSize);

    // ยอดใบขอเปิดต่อ BU — นับจากชุดเต็มตามสิทธิ์ผู้ใช้ ไม่ผูกกับตัวกรองใด (ป้ายบนชิป "แยกดูตาม BU"
    // ต้องคงที่ ไม่หายไปเมื่อเลือก BU อื่น)
    const buCounts: Record<string, number> = {};
    for (const j of jobs) {
      const code = (j.department_code || '').trim().toUpperCase();
      if (code) buCounts[code] = (buCounts[code] ?? 0) + 1;
    }

    // BU = ขอบเขตการดู ไม่ใช่ตัวกรองย่อย → dropdown หน่วยงาน + สรุปงานด่วนต้องอยู่ใน BU ที่เลือก
    const buScope = query.buFilter.trim().toUpperCase();
    const scopedJobs = buScope
      ? jobs.filter((j) => (j.department_code || '').trim().toUpperCase() === buScope)
      : jobs;

    // facet/summary จากชุดเต็มของ BU นั้น (ก่อนแบ่งหน้า) — ไม่ผูกกับหน้าที่กำลังดู
    const unitOptions = Array.from(
      new Set(scopedJobs.map((j) => j.unit_name?.trim()).filter((u): u is string => Boolean(u))),
    ).sort((a, b) => a.localeCompare(b, 'th'));
    const urgentJobs = scopedJobs.filter((j) => j.urgency === 'urgent');
    // นับตามชุดเต็มของ BU ที่เลือก (ก่อนตัวกรองย่อย) — กล่องสรุปกดแล้วต้องพาไปเจอตามจำนวนที่โชว์
    const tiersOf = (id: string) => tierMap.get(id)?.tiers ?? [];
    const hasGreen = (id: string) => tiersOf(id).some((t) => t.tier === 'green');
    // "เหลือง" = มีเหลืองแต่ไม่มีเขียว (นิยามเดียวกับตัวกรอง workflow=yellow ไม่ให้นับซ้อนกับเขียว)
    const hasYellowOnly = (id: string) =>
      !hasGreen(id) && tiersOf(id).some((t) => t.tier === 'yellow');
    /**
     * แบ่งใบขอเป็น 3 ถังที่ **ครอบคลุมทุกใบและไม่ซ้อนกัน** — เขียว + เหลือง + ยังไม่มีคน = ทั้งหมดเสมอ
     *
     * เดิม "ยังไม่มีคน" นับเฉพาะใบที่ AI ประเมินแล้วไม่พบ (ต้องมีใน tierMap)
     * ใบที่ AI ยังไม่ได้ประเมินจึงตกนอกทั้ง 3 ถัง → สามตัวรวมกันไม่เท่ายอดรวม
     * (ตอนนี้บังเอิญเท่าเพราะทุกใบถูกประเมินหมดพอดี — พังทันทีที่มีใบใหม่เข้ามา)
     * เจ้าของสั่ง 10 ส.ค. 2569: "แบ่งไปเป็นอะไรก็ได้ แต่รวมกันต้องได้ยอดรวม"
     * จึงให้ถังที่ 3 = "ที่เหลือทั้งหมด" แล้วแยกรายละเอียดในบรรทัดย่อยแทน
     */
    const isGreen = (j: (typeof scopedJobs)[number]) => hasGreen(j.id);
    const isYellow = (j: (typeof scopedJobs)[number]) => hasYellowOnly(j.id);
    const noneJobs = scopedJobs.filter((j) => !isGreen(j) && !isYellow(j));
    const greenJobs = scopedJobs.filter(isGreen);
    const yellowJobs = scopedJobs.filter(isYellow);
    /** ในถัง "ยังไม่มีคน" — แยกว่า AI ดูแล้วไม่เจอ vs ยังไม่ได้ดู (คนละงานที่ต้องทำต่อ) */
    const analyzedNoneJobs = noneJobs.filter((j) => tierMap.has(j.id));

    /** อัตราคงเหลือของชุดใบขอ — หน่วยที่เจ้าของใช้คิดงาน (1 ใบขออาจหลายอัตรา) */
    const posOf = (list: typeof scopedJobs) => list.reduce((sum, j) => sum + jobPositionUnits(j), 0);

    const summary = {
      urgentTotal: urgentJobs.length,
      urgentAnalyzed: urgentJobs.filter((j) => tierMap.has(j.id)).length,
      urgentWithGreen: urgentJobs.filter((j) => hasGreen(j.id)).length,
      // ยอดทั้งชุด (ตาม BU) สำหรับกล่องสรุปที่กดเพื่อกรองได้ — นับเป็น "ใบขอ"
      scopedTotal: scopedJobs.length,
      withGreen: greenJobs.length,
      withYellow: yellowJobs.length,
      noRecommend: noneJobs.length,
      /** ในถังยังไม่มีคน: AI ประเมินแล้วไม่พบ vs ยังไม่ได้ประเมิน */
      noneAnalyzed: analyzedNoneJobs.length,
      noneUnanalyzed: noneJobs.length - analyzedNoneJobs.length,
      // ยอดเดียวกันในหน่วย "อัตรา" — การ์ดสรุปโชว์อัตราเป็นเลขหลัก
      positionsTotal: posOf(scopedJobs),
      positionsUrgent: posOf(urgentJobs),
      positionsGreen: posOf(greenJobs),
      positionsYellow: posOf(yellowJobs),
      positionsNone: posOf(noneJobs),
    };

    // ป้าย "AI แนะนำ N" บนการ์ด: ผลที่เก็บไว้ของใบในหน้านี้
    // `green` แยกออกมาด้วย (14 ส.ค. 2569) — คู่กับ sort green_desc และเผื่อโชว์บนการ์ด
    const storedMatches: Record<string, { recommended: number; green: number; computedAt: string }> = {};
    for (const j of items) {
      const entry = tierMap.get(j.id);
      if (entry) {
        storedMatches[j.id] = {
          recommended: recommendedCandidateCount(entry.tiers),
          green: entry.tiers.filter((t) => t.tier === 'green').length,
          computedAt: entry.computedAt,
        };
      }
    }

    // สรุปผลโทร Lumos ต่อใบในหน้านี้: รออนุมัติ/ส่งโทร/โทรแล้ว/สนใจ/ไม่สนใจ/ไม่รับสาย/ขอเลื่อน/ต้องคนตาม
    // ⚠️ เงื่อนไขต้องรวม `pendingApproval` ด้วย ไม่ใช่ `sent > 0` อย่างเดียว —
    // ใบที่เพิ่งตั้งชุดรออนุมัติยังไม่เคยเข้าคิว `sent` เป็น 0 ถ้ากรองด้วย sent อย่างเดียว
    // แถบตัวเลขจะไม่ขึ้นเลยทั้งที่มีคนรอให้กดอนุมัติอยู่ (เจอตอนตรวจกับฐานจริง 10 ส.ค. 2569)
    const lumosSummary: Record<string, LumosJobCallSummary> = {};
    for (const j of items) {
      const entry = lumosMap.get(j.id);
      if (entry && (entry.sent > 0 || entry.pendingApproval > 0)) lumosSummary[j.id] = entry;
    }

    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json({
      items,
      total: rows.length,
      page,
      pageSize,
      unitOptions,
      buCounts,
      summary,
      storedMatches,
      lumosSummary,
    });
  } catch (e) {
    return handleApiError(res, e, 'matching-list GET', { userId: req.user.sub });
  }
}

export default withRbac(handler, 'siamraj-unit-requests');
