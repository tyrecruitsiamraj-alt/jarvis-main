/**
 * รายงานผลโทรของ งานสรรหา · จับคู่งาน · ดูแลหลังเริ่มงาน (หน้าหลัก `?report=<ก้อน>` · 7 ต.ค. 2569)
 * แถว = โหมด `report` ของตัวนับกล่อง (ชุดเดียวกับกล่อง ทั้งหมด/AI/คน) · นับต่อที่ `src/lib/homeTopicReport.ts` (pure)
 * ประกาศ = ใบขอที่ประกาศ (`job_public_releases.released_at`) ในช่วง — ⚠️ ประกาศซ้ำเขียนทับเวลา ⇒ นับตามครั้งล่าสุด
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { buildApplicantAiShareSql, buildFollowAiShareSql, buildMatchingAiShareSql } from './homeAiShareSql.js';
import { AFTERCARE_TOPIC } from '../../src/lib/aftercareRounds.js';
import { listSiamrajUnitRequests } from './siamrajUnitRequests.js';
import { loadBoardMatchTierMap } from './boardMatchStore.js';
import { loadBoardAvailabilityContext } from './boardAvailability.js';
import type { DepartmentScope } from './departmentScope.js';
import { isBoardCandidateAvailable } from '../../src/lib/boardMatchAvailability.js';
import { enrichJobsWithUrgency } from '../../src/lib/jobUrgency.js';
import { trendBuFromSiteCode } from '../../src/lib/trends/bu.js';
import { toYmdBangkok } from '../../src/lib/dateTh.js';
import { onlineRequestYmdRange } from '../../src/lib/homeAiShare.js';
import { loadOnlineRequestCounts } from './homeOnlineSql.js';
import type { JobRequest } from '../../src/types/index.js';
import {
  buildAftercareReport,
  buildApplicantsReport,
  buildMatchingReport,
  emptyMatchingFlow,
  type MatchingFlow,
  type ReportSourceRow,
  type TopicReport,
  type TopicReportBlock,
} from '../../src/lib/homeTopicReport.js';

const QUEUE = tableInAppSchema('lumos_dispatch_queue');
const HOLDS = tableInAppSchema('candidate_call_holds');
const PROPOSALS = tableInAppSchema('candidate_proposals');
const POSTINGS = tableInAppSchema('job_posting_requests');

const bool = (v: unknown) => v === true || v === 't' || v === 'true';

function toRow(r: Record<string, unknown>): ReportSourceRow {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
  return {
    ai: bool(r.ai),
    staff: bool(r.staff),
    bu: str(r.bu),
    ai_outcome: str(r.ai_outcome),
    ai_summary: str(r.ai_summary),
    ai_reply: str(r.ai_reply),
    ai_at: (r.ai_at as string | Date | null) ?? null,
    staff_outcome: str(r.staff_outcome),
    staff_at: (r.staff_at as string | Date | null) ?? null,
    age: r.age == null ? null : Number(r.age),
    created_at: (r.created_at as string | Date | null) ?? null,
    ai_queued_at: (r.ai_queued_at as string | Date | null) ?? null,
    first_ai_at: (r.first_ai_at as string | Date | null) ?? null,
    first_staff_at: (r.first_staff_at as string | Date | null) ?? null,
    appointment: r.appointment == null ? null : bool(r.appointment),
    attendance: str(r.attendance),
    log_ok: r.log_ok == null ? null : bool(r.log_ok),
    log_at: (r.log_at as string | Date | null) ?? null,
    in_queue: bool(r.in_queue),
    held: bool(r.held),
    waiting_ai: bool(r.waiting_ai),
    holding: bool(r.holding),
    waiting_staff: bool(r.waiting_staff),
  };
}

export async function loadTopicReport(block: TopicReportBlock, start: Date | null, end: Date, bu: string | null): Promise<TopicReport> {
  const params = [start ? start.toISOString() : null, end.toISOString(), bu];
  if (block === 'applicants') {
    // 🔴 ใบขอเข้ามา · ประกาศแล้ว = ตัวเดียวกับแท็บทีม Online (QA 10 ต.ค. 2569 · เจ้าของเลือก "ใช้นิยามเดียวทั้งสองแท็บ")
    //    เดิม = ใบที่ยังเปิด + ใบขอล่วงหน้า และการกดประกาศในช่วง (รวมใบเก่า) ⇒ 55 · 44 ขณะที่ทีม Online 54 · 4
    const [{ rows }, reqs] = await Promise.all([
      dbQuery<Record<string, unknown>>(buildApplicantAiShareSql('report'), params),
      loadOnlineRequestCounts({ ...onlineRequestYmdRange(start, end), bu, departmentScope: { mode: 'all' } as DepartmentScope }),
    ]);
    return buildApplicantsReport(rows.map(toRow), reqs.released, reqs.total);
  }
  if (block === 'matching') {
    const [{ rows }, flow] = await Promise.all([
      dbQuery<Record<string, unknown>>(buildMatchingAiShareSql('report'), params),
      loadMatchingFlow(start, end, bu),
    ]);
    return buildMatchingReport(rows.map(toRow), flow);
  }
  const { rows } = await dbQuery<Record<string, unknown>>(buildFollowAiShareSql(true, 'aftercare', 'report'), [...params, AFTERCARE_TOPIC]);
  return buildAftercareReport(rows.map(toRow));
}

/**
 * เส้นทางจับคู่งาน — ใบขอที่เข้ามาในช่วง (ใบที่ยังเปิด · ท่อเดียวกับหน้าจับคู่งาน `listSiamrajUnitRequests`)
 * ผลจับคู่ = `loadBoardMatchTierMap` (คนที่ยังว่าง = `isBoardCandidateAvailable` ตัวเดียวกับ `matching-flow-summary`)
 * ⚠️ ใบที่เข้ามาแล้วปิดไปแล้วไม่อยู่ในรายการใบเปิด ⇒ ไม่นับ
 */
/** ใบที่ยังเปิดที่ส่งเข้ามาในช่วง (ตามวันส่งใบ) — จับคู่งานใช้ (ต้องเป็นใบเปิด) · งานสรรหาใช้ `loadOnlineRequestCounts` แล้ว (10 ต.ค. 2569) */
async function loadJobsInWindow(start: Date | null, end: Date, bu: string | null): Promise<JobRequest[]> {
  const raw = (await listSiamrajUnitRequests({ limit: 500, departmentScope: { mode: 'all' } as DepartmentScope })) as unknown[];
  const fromYmd = start ? toYmdBangkok(start) : null;
  const toYmd = toYmdBangkok(new Date(end.getTime() - 1));
  return enrichJobsWithUrgency(raw as JobRequest[]).filter((j) => {
    if (bu && trendBuFromSiteCode(j.site_code) !== bu) return false;
    const rec = j as unknown as Record<string, unknown>;
    const d = String(rec.submittedAt || rec.request_date || rec.created_at || '').slice(0, 10);
    return !!d && (!fromYmd || d >= fromYmd) && d <= toYmd;
  });
}

async function loadMatchingFlow(start: Date | null, end: Date, bu: string | null): Promise<MatchingFlow> {
  const f = emptyMatchingFlow();
  const jobs = await loadJobsInWindow(start, end, bu);
  f.jobsIn = jobs.length;
  if (!jobs.length) return f;
  const ids = jobs.map((j) => j.id);
  const [tierMap, ctx, posted, touched, prop] = await Promise.all([
    loadBoardMatchTierMap(),
    loadBoardAvailabilityContext(),
    dbQuery<{ job_id: string }>(
      `select distinct job_id from ${POSTINGS} where status in ('pending', 'in_progress', 'posted') and job_id = any($1)`,
      [ids],
    ),
    // คู่ (บัตร × ใบขอ) ที่มีคนแตะแล้ว — ส่ง AI หรือมีคนรับไปโทร
    dbQuery<{ job_id: string; card: string }>(
      `select q.job_ref as job_id, substring(q.person_ref from 6) as card
         from ${QUEUE} q where q.job_ref = any($1) and q.person_ref like 'card-%'
       union
       select h.job_id, h.candidate_ref from ${HOLDS} h where h.source = 'board' and h.job_id = any($1)`,
      [ids],
    ),
    dbQuery<{ reserved: number; placed: number }>(
      `select count(*) filter (where status = 'reserved')::int as reserved,
              count(*) filter (where status = 'placed')::int as placed
         from ${PROPOSALS} where job_id = any($1)`,
      [ids],
    ),
  ]);
  const postedIds = new Set(posted.rows.map((r) => r.job_id));
  const touchedSet = new Set(touched.rows.map((r) => `${r.job_id}|${r.card}`));
  for (const j of jobs) {
    const entry = tierMap.get(j.id);
    if (!entry) continue;
    f.jobsMatched += 1;
    const avail = entry.tiers.filter((t) => isBoardCandidateAvailable(t.cardId, j.id, ctx));
    const recommend = avail.some((t) => t.tier === 'green' || t.tier === 'yellow');
    if (recommend) f.jobsRecommend += 1;
    else {
      f.jobsNone += 1;
      if (j.urgency === 'urgent' && !postedIds.has(j.id)) f.urgentStuck += 1;
    }
    for (const t of entry.tiers) {
      f.matched += 1;
      if (t.tier === 'green') f.green += 1;
      else if (t.tier === 'yellow') f.yellow += 1;
      else f.red += 1;
    }
    for (const t of avail) {
      if (t.tier !== 'green') continue;
      f.greenAvailable += 1;
      if (!touchedSet.has(`${j.id}|${t.cardId}`)) f.greenUncontacted += 1;
    }
  }
  f.reserved = Number(prop.rows[0]?.reserved ?? 0);
  f.placed = Number(prop.rows[0]?.placed ?? 0);
  return f;
}
