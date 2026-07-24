import {
  withRbac,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { listSiamrajUnitRequests } from '../_lib/siamrajUnitRequests.js';
import { loadUserDepartmentScope } from '../_lib/departmentScope.js';
import { listProposalsForJobs } from '../_lib/candidateProposals.js';
import { loadBoardMatchTierMap } from '../_lib/boardMatchStore.js';
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
  type MatchingWorkflowFilter,
} from '@/lib/matchingListFilter';
import { recommendedCandidateCount } from '@/lib/matchingProgress';
import type { JobRequest } from '@/types';

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

const WORKFLOWS: MatchingWorkflowFilter[] = ['all', 'sla', 'green', 'yellow', 'none', 'reserved'];

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
    const departmentScope = await loadUserDepartmentScope(req.user);

    // ท่อเดียวกับ feed หลักของหน้า Matching เดิม: ใบขอเปิด + ผู้รับผิดชอบ/หมายเหตุ/สถานะทำงาน + urgency
    const raw = (await listSiamrajUnitRequests({ limit: 2000, departmentScope })) as unknown[];
    await attachAssignments(raw);
    await attachNotes(raw);
    await attachWorkStatus(raw);
    const jobs = enrichJobsWithUrgency(raw as JobRequest[]);

    // ข้อมูลประกอบตัวกรองจาก PG: การจองตัว + ผล AI ที่เคยคิดเก็บไว้
    const [proposalMap, tierMap] = await Promise.all([
      listProposalsForJobs(jobs.map((j) => j.id)),
      loadBoardMatchTierMap(),
    ]);

    const query = {
      search: getQuery(req, 'q'),
      urgentOnly: getQuery(req, 'urgent') === '1',
      unitFilter: getQuery(req, 'unit'),
      workflowFilter: normalizeWorkflow(getQuery(req, 'workflow')),
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

    // facet/summary จากชุดเต็ม (ก่อนแบ่งหน้า) — ให้ dropdown หน่วยงานและสรุปงานด่วนไม่ผูกกับหน้า
    const unitOptions = Array.from(
      new Set(jobs.map((j) => j.unit_name?.trim()).filter((u): u is string => Boolean(u))),
    ).sort((a, b) => a.localeCompare(b, 'th'));
    const urgentJobs = jobs.filter((j) => j.urgency === 'urgent');
    const summary = {
      urgentTotal: urgentJobs.length,
      urgentAnalyzed: urgentJobs.filter((j) => tierMap.has(j.id)).length,
      urgentWithGreen: urgentJobs.filter((j) =>
        (tierMap.get(j.id)?.tiers ?? []).some((t) => t.tier === 'green'),
      ).length,
    };

    // ป้าย "AI แนะนำ N" บนการ์ด: ผลที่เก็บไว้ของใบในหน้านี้
    const storedMatches: Record<string, { recommended: number; computedAt: string }> = {};
    for (const j of items) {
      const entry = tierMap.get(j.id);
      if (entry) {
        storedMatches[j.id] = {
          recommended: recommendedCandidateCount(entry.tiers),
          computedAt: entry.computedAt,
        };
      }
    }

    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json({
      items,
      total: rows.length,
      page,
      pageSize,
      unitOptions,
      summary,
      storedMatches,
    });
  } catch (e) {
    return handleApiError(res, e, 'matching-list GET', { userId: req.user.sub });
  }
}

export default withRbac(handler, 'siamraj-unit-requests');
