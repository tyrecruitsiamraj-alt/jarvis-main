/**
 * GET /api/matching/flow-summary — สรุป "การไหลของงาน" สำหรับหน้าแรก (read-only)
 *
 * ตอบ 3 คำถาม: งานเข้ามาเท่าไหร่ · ส่งไปไหนเท่าไหร่ · อะไรสำเร็จ/อะไรต้องติดตาม
 * ช่วงเวลา: ตัวเลขการเคลื่อนไหว = เดือนนี้ · ของค้าง (รอโทร/รอจอง/ใบด่วนไม่มีคน) = ทั้งหมด
 *
 * ⚠️ ตัวเลขที่นี่เป็นสถานะ "การทำงานของทีม Matching" เท่านั้น — ไม่ใช่ "หาได้แล้ว/ปิดครบใบขอ"
 * ทางการจาก ERP (นิยาม Control Tower ห้ามปนกัน)
 */
import {
  withRbac,
  handleApiError,
  sendError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { listSiamrajUnitRequests } from '../_lib/siamrajUnitRequests.js';
import { loadUserDepartmentScope } from '../_lib/departmentScope.js';
import { loadBoardMatchTierMap } from '../_lib/boardMatchStore.js';
import { loadBoardAvailabilityContext } from '../_lib/boardAvailability.js';
import { isBoardCandidateAvailable } from '@/lib/boardMatchAvailability';
import { enrichJobsWithUrgency } from '@/lib/jobUrgency';
import type { JobRequest } from '@/types';

const queueTable = tableInAppSchema('lumos_dispatch_queue');
const proposalsTable = tableInAppSchema('candidate_proposals');
const postingsTable = tableInAppSchema('job_posting_requests');

/** 'card-12' → board/12 · 'ir-7' → irecruit/7 — ต้องตรงกับ unique key ของ proposals */
export function personRefToProposal(personRef: string): { source: 'board' | 'irecruit'; ref: string } | null {
  if (personRef.startsWith('card-')) return { source: 'board', ref: personRef.slice(5) };
  if (personRef.startsWith('ir-')) return { source: 'irecruit', ref: personRef.slice(3) };
  return null;
}

/** 'siamraj-sql:OPL6907125' → 'OPL6907125' สำหรับแสดงผล */
export function jobRefDisplay(jobRef: string): string {
  const i = jobRef.lastIndexOf(':');
  return i >= 0 ? jobRef.slice(i + 1) : jobRef;
}

export type FlowFollowUpItem = {
  job_ref: string;
  request_no: string;
  person_ref: string;
  channel: string;
  name: string | null;
  summary: string | null;
  updated_at: string;
};

type FollowUpSqlRow = {
  job_ref: string;
  person_ref: string;
  channel: string;
  name: string | null;
  summary: string | null;
  updated_at: string | Date;
};

const iso = (v: string | Date): string => (v instanceof Date ? v.toISOString() : String(v));

function toFollowUp(r: FollowUpSqlRow): FlowFollowUpItem {
  return {
    job_ref: r.job_ref,
    request_no: jobRefDisplay(r.job_ref),
    person_ref: r.person_ref,
    channel: r.channel,
    name: r.name,
    summary: r.summary,
    updated_at: iso(r.updated_at),
  };
}

/**
 * คนที่ Lumos โทรแล้วได้ outcome ตามที่ระบุ และยังไม่มีใครรับช่วงต่อ (ไม่มี proposal
 * ติดต่อ/จอง/ลงงานของคนนั้นในใบนั้น) — คือรายการ "ต้องติดตาม" ตัวจริง
 */
async function listCallsAwaitingAction(
  outcomes: string[],
  jobIds: string[],
  limit: number,
): Promise<FlowFollowUpItem[]> {
  const { rows } = await dbQuery<FollowUpSqlRow>(
    `select q.job_ref, q.person_ref, q.channel, q.updated_at,
            coalesce(q.payload->>'recipient_name', q.payload->>'candidate_name') as name,
            q.result->>'summary' as summary
       from ${queueTable} q
      where q.job_ref = any($3)
        and q.result->>'outcome' = any($1)
        and not exists (
          select 1 from ${proposalsTable} p
           where p.job_id = q.job_ref
             and p.source = case when q.person_ref like 'card-%' then 'board' else 'irecruit' end
             and p.candidate_ref = regexp_replace(q.person_ref, '^(card|ir)-', '')
             and p.status in ('contacted', 'reserved', 'placed')
        )
      order by q.updated_at desc
      limit $2`,
    [outcomes, limit, jobIds],
  );
  return rows.map(toFollowUp);
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') return sendError(res, 405, 'Method not allowed', 'Read-only summary');

  try {
    const departmentScope = await loadUserDepartmentScope(req.user);

    // ── ใบขอเปิดอยู่ (ท่อเดียวกับหน้า Matching — จำกัดตามแผนกเหมือนกัน)
    const raw = (await listSiamrajUnitRequests({ limit: 500, departmentScope })) as unknown[];
    const jobs = enrichJobsWithUrgency(raw as JobRequest[]);
    // ⚠️ ทุกตัวเลขบนหน้านี้จำกัดที่ "ใบขอเปิดอยู่ของ BU ตัวเอง" เท่านั้น (คิวโทร/จอง/โพส
    // scope ตามรายการนี้ทั้งหมด) — staff ต่างแผนกเปิดหน้าแรกต้องไม่เห็นเลขของ BU อื่น
    const scopedJobIds = jobs.map((j) => j.id);

    const [tierMap, availCtx] = await Promise.all([
      loadBoardMatchTierMap(),
      loadBoardAvailabilityContext(),
    ]);
    for (const [jobId, entry] of tierMap) {
      entry.tiers = entry.tiers.filter((t) => isBoardCandidateAvailable(t.cardId, jobId, availCtx));
    }

    const analyzed = jobs.filter((j) => tierMap.has(j.id));
    const withRecommend = analyzed.filter((j) =>
      (tierMap.get(j.id)?.tiers ?? []).some((t) => t.tier === 'green' || t.tier === 'yellow'),
    );

    // ใบด่วนที่ AI ประเมินแล้วไม่มีคนแนะนำ และยังไม่ได้ส่งโพสหาคนใหม่ → ค้างจริง ต้องมีคนตัดสินใจ
    const { rows: activePostingRows } = await dbQuery<{ job_id: string }>(
      `select job_id from ${postingsTable}
        where status in ('pending', 'in_progress', 'posted') and job_id = any($1)`,
      [scopedJobIds],
    );
    const postedJobIds = new Set(activePostingRows.map((r) => r.job_id));
    const urgentStuck = jobs.filter(
      (j) =>
        j.urgency === 'urgent' &&
        tierMap.has(j.id) &&
        !(tierMap.get(j.id)?.tiers ?? []).some((t) => t.tier === 'green' || t.tier === 'yellow') &&
        !postedJobIds.has(j.id),
    );

    // ── คิว AI โทร (เฉพาะใบขอของ BU ตัวเอง ไม่รวมหน้า Follow) — เดือนนี้ + ของค้างทั้งหมด
    const { rows: lumosAgg } = await dbQuery<{
      sent_month: string;
      waiting_call: string;
      delivered_waiting: string;
      stale_delivered: string;
    }>(
      `select
         count(*) filter (where created_at >= date_trunc('month', now()))                        as sent_month,
         count(*) filter (where status = 'pending' and result is null)                           as waiting_call,
         count(*) filter (where status = 'delivered' and result is null)                         as delivered_waiting,
         count(*) filter (where status = 'delivered' and result is null
                            and delivered_at < now() - interval '2 days')                        as stale_delivered
       from ${queueTable}
      where job_ref = any($1)`,
      [scopedJobIds],
    );

    const { rows: outcomeRows } = await dbQuery<{ outcome: string; n: string }>(
      `select result->>'outcome' as outcome, count(*) as n
         from ${queueTable}
        where job_ref = any($1) and result is not null
          and updated_at >= date_trunc('month', now())
        group by 1`,
      [scopedJobIds],
    );
    const outcomesMonth: Record<string, number> = {};
    for (const r of outcomeRows) {
      if (r.outcome) outcomesMonth[r.outcome] = Number(r.n) || 0;
    }

    // ── ต้องติดตาม: สนใจแล้วยังไม่มีใครจอง / ไม่รับสาย (เฉพาะใบขอเปิดของ BU ตัวเอง)
    const [confirmedWaiting, noAnswerWaiting] = await Promise.all([
      listCallsAwaitingAction(['confirmed'], scopedJobIds, 20),
      listCallsAwaitingAction(['no_answer', 'unresponsive'], scopedJobIds, 20),
    ]);

    // ── การเสนอ/จอง/ลงงาน (สถานะทีม Matching — ไม่ใช่ตัวเลขทางการ ERP)
    const { rows: propAgg } = await dbQuery<{
      contacted_month: string;
      reserved_active: string;
      placed_month: string;
    }>(
      `select
         count(*) filter (where status = 'contacted' and updated_at >= date_trunc('month', now())) as contacted_month,
         count(*) filter (where status = 'reserved')                                               as reserved_active,
         count(*) filter (where status = 'placed' and updated_at >= date_trunc('month', now()))    as placed_month
       from ${proposalsTable}
      where job_id = any($1)`,
      [scopedJobIds],
    );

    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json({
      month: new Date().toISOString().slice(0, 7),
      jobs: {
        open_total: jobs.length,
        urgent: jobs.filter((j) => j.urgency === 'urgent').length,
        analyzed: analyzed.length,
        with_recommend: withRecommend.length,
        urgent_stuck: urgentStuck.length,
      },
      lumos: {
        sent_month: Number(lumosAgg[0]?.sent_month) || 0,
        waiting_call: Number(lumosAgg[0]?.waiting_call) || 0,
        delivered_waiting: Number(lumosAgg[0]?.delivered_waiting) || 0,
        stale_delivered: Number(lumosAgg[0]?.stale_delivered) || 0,
        outcomes_month: outcomesMonth,
      },
      proposals: {
        contacted_month: Number(propAgg[0]?.contacted_month) || 0,
        reserved_active: Number(propAgg[0]?.reserved_active) || 0,
        placed_month: Number(propAgg[0]?.placed_month) || 0,
      },
      postings: { active: postedJobIds.size },
      follow_ups: {
        confirmed_waiting: confirmedWaiting,
        no_answer: noAnswerWaiting,
      },
    });
  } catch (e) {
    return handleApiError(res, e, 'matching-flow-summary');
  }
}

export default withRbac(handler, 'matching-flow-summary');
