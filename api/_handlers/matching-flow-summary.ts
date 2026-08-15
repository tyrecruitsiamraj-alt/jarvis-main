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
import { loadMatchingBuScope } from '../_lib/departmentScope.js';
import { loadBoardMatchTierMap } from '../_lib/boardMatchStore.js';
import { jobPositionLabel } from '../_lib/lumosDispatch.js';
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
  phone: string | null;
  summary: string | null;
  outcome: string | null;
  updated_at: string;
  /** ตำแหน่ง+หน่วยงานของใบขอที่คนนี้ถูกแมทไป — โชว์ใน dialog รายละเอียดบนหน้าแรก */
  job_position: string | null;
  job_unit: string | null;
  /** เฉพาะรายการ "ส่งไปแล้วรอผล": ค้างเกิน 2 วัน = ควรเช็คกับทีม Lumos */
  stale?: boolean;
};

type FollowUpSqlRow = {
  job_ref: string;
  person_ref: string;
  channel: string;
  name: string | null;
  phone: string | null;
  summary: string | null;
  outcome: string | null;
  updated_at: string | Date;
  stale?: boolean;
};

const iso = (v: string | Date): string => (v instanceof Date ? v.toISOString() : String(v));

function toFollowUp(r: FollowUpSqlRow): FlowFollowUpItem {
  return {
    job_ref: r.job_ref,
    request_no: jobRefDisplay(r.job_ref),
    person_ref: r.person_ref,
    channel: r.channel,
    name: r.name,
    phone: r.phone,
    summary: r.summary,
    outcome: r.outcome,
    updated_at: iso(r.updated_at),
    job_position: null,
    job_unit: null,
    ...(r.stale !== undefined ? { stale: r.stale === true } : {}),
  };
}

/** คอลัมน์ชื่อ/เบอร์จาก payload — ชื่อคีย์ต่างกันตามช่อง (reminder ↔ interview) เหมือน PAYLOAD_PHONE_KEYS */
const PERSON_COLS = `
  coalesce(q.payload->>'recipient_name', q.payload->>'candidate_name') as name,
  coalesce(q.payload->>'recipient_phone', q.payload->>'phone') as phone
`;

/**
 * รายชื่อที่ "ส่ง AI โทรแล้ว ยังไม่มีผลกลับ" — กดจากขั้น "ส่ง AI โทร" บนหน้าแรก
 * แถวที่ค้างเกิน 2 วันติดธง `stale` (นิยามเดียวกับตัวเลข `stale_delivered`)
 */
async function listActiveCalls(jobIds: string[], limit: number): Promise<FlowFollowUpItem[]> {
  const { rows } = await dbQuery<FollowUpSqlRow>(
    `select q.job_ref, q.person_ref, q.channel, q.updated_at, ${PERSON_COLS},
            null as summary,
            q.last_outcome as outcome,
            (q.status = 'delivered' and q.delivered_at < now() - interval '2 days') as stale
       from ${queueTable} q
      where q.job_ref = any($1)
        and q.result is null
        and q.status in ('pending', 'delivered')
      order by (q.status = 'delivered' and q.delivered_at < now() - interval '2 days') desc,
               q.updated_at desc
      limit $2`,
    [jobIds, limit],
  );
  return rows.map(toFollowUp);
}

/**
 * รายชื่อตามสถานะลูปโทรซ้ำ — 'retry_scheduled' = รอ AI โทรซ้ำ · 'needs_human' = ต้องคนเร่งจัดการ
 * (ค่าตาม CHECK ของ migration 070 · ธงถูกตั้งโดย applyLumosResult/applyHumanCallFollowup)
 */
async function listByFollowupState(
  state: 'retry_scheduled' | 'needs_human',
  jobIds: string[],
  limit: number,
): Promise<FlowFollowUpItem[]> {
  const { rows } = await dbQuery<FollowUpSqlRow>(
    `select q.job_ref, q.person_ref, q.channel, q.updated_at, ${PERSON_COLS},
            q.result->>'summary' as summary,
            coalesce(q.last_outcome, q.result->>'outcome') as outcome
       from ${queueTable} q
      where q.job_ref = any($1) and q.followup_state = $3
      order by q.updated_at desc
      limit $2`,
    [jobIds, limit, state],
  );
  return rows.map(toFollowUp);
}

/** รายชื่อ "ไม่สนใจงาน" เดือนนี้ — ไว้ให้เห็นว่าใครปฏิเสธ (ไม่มีงานต้องทำต่อ แค่รู้ไว้) */
async function listDeclinedThisMonth(jobIds: string[], limit: number): Promise<FlowFollowUpItem[]> {
  // อ่าน outcome ด้วย coalesce(last_outcome, result->>'outcome') — ผลที่คนบันทึกเขียนแค่
  // last_outcome และตอนตั้งโทรซ้ำระบบล้าง result ทิ้ง (กับดักเดียวกับ outcomesMonth ด้านล่าง)
  const { rows } = await dbQuery<FollowUpSqlRow>(
    `select q.job_ref, q.person_ref, q.channel, q.updated_at, ${PERSON_COLS},
            q.result->>'summary' as summary,
            coalesce(q.last_outcome, q.result->>'outcome') as outcome
       from ${queueTable} q
      where q.job_ref = any($1)
        and coalesce(q.last_outcome, q.result->>'outcome') = 'declined'
        and q.updated_at >= date_trunc('month', now())
      order by q.updated_at desc
      limit $2`,
    [jobIds, limit],
  );
  return rows.map(toFollowUp);
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
            coalesce(q.payload->>'recipient_phone', q.payload->>'phone') as phone,
            q.result->>'summary' as summary,
            coalesce(q.last_outcome, q.result->>'outcome') as outcome
       from ${queueTable} q
      where q.job_ref = any($3)
        and coalesce(q.last_outcome, q.result->>'outcome') = any($1)
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
    const departmentScope = await loadMatchingBuScope(req.user);

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
    // (ดึง status มาด้วย — การ์ด Content/Scraping บนหน้าแรกต้องบอกว่าไปถึงขั้นไหนแล้ว
    //  เจ้าของสั่ง 13 ส.ค. 2569)
    const { rows: activePostingRows } = await dbQuery<{
      job_id: string;
      request_type: string;
      status: string;
    }>(
      `select job_id, request_type, status from ${postingsTable}
        where status in ('pending', 'in_progress', 'posted') and job_id = any($1)`,
      [scopedJobIds],
    );
    const postedJobIds = new Set(activePostingRows.map((r) => r.job_id));
    // แยกตามประเภทคำขอ — หน้าแรกโชว์ "ส่งคิด Content" กับ "ส่ง Scraping" เป็นสองก้อน
    const contentJobIds = new Set(
      activePostingRows.filter((r) => r.request_type !== 'scraping').map((r) => r.job_id),
    );
    const scrapingJobIds = new Set(
      activePostingRows.filter((r) => r.request_type === 'scraping').map((r) => r.job_id),
    );
    // สถานะของคำขอแต่ละประเภท — บอกว่า "ไปถึงขั้นไหนแล้ว" (รอดำเนินการ/กำลังทำ/โพสแล้ว)
    // นับเป็นรายคำขอ ไม่ใช่รายใบขอ (ใบเดียวมีได้หลายคำขอ — เลขต้องตรงกับหน้าคำขอโพส)
    const postingStages = (type: 'content' | 'scraping') => {
      const rows = activePostingRows.filter((r) =>
        type === 'scraping' ? r.request_type === 'scraping' : r.request_type !== 'scraping',
      );
      const by = (s: string) => rows.filter((r) => r.status === s).length;
      return { pending: by('pending'), in_progress: by('in_progress'), posted: by('posted') };
    };
    const urgentStuck = jobs.filter(
      (j) =>
        j.urgency === 'urgent' &&
        tierMap.has(j.id) &&
        !(tierMap.get(j.id)?.tiers ?? []).some((t) => t.tier === 'green' || t.tier === 'yellow') &&
        !postedJobIds.has(j.id),
    );

    // ── คิว AI โทร (เฉพาะใบขอของ BU ตัวเอง ไม่รวมหน้า Follow) — เดือนนี้ + ของค้างทั้งหมด
    //
    // ⚠️ **นับ "แถว" กับนับ "หัวคน" ไม่เท่ากัน** — คนเดียวอยู่ในผลแมทได้หลายใบ
    // (วัดจริง: 2,816 แถวถึงคิว = 126 คน เฉลี่ยคนละ ~22 ใบ) เจ้าหน้าที่ถามว่า
    // "ส่งไปกี่คน" ต้องตอบด้วย distinct เบอร์ ไม่ใช่จำนวนแถว
    // คีย์เบอร์ต่างกันตามช่อง (reminder=recipient_phone · interview=phone)
    // — แพตเทิร์นเดียวกับ PAYLOAD_PHONE_KEYS ใน lumosDispatch.ts
    const phoneExpr = `coalesce(payload->>'recipient_phone', payload->>'phone')`;
    const { rows: lumosAgg } = await dbQuery<{
      sent_month: string;
      sent_month_people: string;
      waiting_call: string;
      delivered_waiting: string;
      stale_delivered: string;
      stale_pending: string;
      retry_scheduled: string;
      attempts_total: string;
      last_result_at: string | null;
      last_sent_at: string | null;
    }>(
      `select
         count(*) filter (where created_at >= date_trunc('month', now()))                        as sent_month,
         count(distinct ${phoneExpr}) filter (where created_at >= date_trunc('month', now()))    as sent_month_people,
         count(*) filter (where status = 'pending' and result is null)                           as waiting_call,
         count(*) filter (where status = 'delivered' and result is null)                         as delivered_waiting,
         count(*) filter (where status = 'delivered' and result is null
                            and delivered_at < now() - interval '2 days')                        as stale_delivered,
         count(*) filter (where status = 'pending' and result is null
                            and coalesce(next_attempt_at, created_at) < now() - interval '2 days')
                                                                                                 as stale_pending,
         count(*) filter (where followup_state = 'retry_scheduled')                              as retry_scheduled,
         coalesce(sum(attempt_count) filter (where updated_at >= date_trunc('month', now())), 0) as attempts_total,
         max(updated_at) filter (where coalesce(last_outcome, result->>'outcome') is not null)   as last_result_at,
         max(created_at)                                                                          as last_sent_at
       from ${queueTable}
      where job_ref = any($1)`,
      [scopedJobIds],
    );

    // ⚠️ **อ่าน outcome ด้วย coalesce(last_outcome, result->>'outcome')** — กับดักเดิม
    // ที่ไฟล์อื่นแก้ไปแล้วแต่ตกหล่นที่นี่: ผลที่ **คน** บันทึกเขียนแค่ last_outcome
    // และตอนตั้งโทรซ้ำระบบ **ล้าง result ทิ้ง** → อ่าน result อย่างเดียวจะนับหายเงียบ ๆ
    // ⚠️ ตัด cancelled ออก — ไม่ใช่ผลการโทร (คนกดยกเลิกเอง) กติกาเดียวกับ resolvedCallBase()
    const { rows: outcomeRows } = await dbQuery<{ outcome: string; n: string }>(
      `select coalesce(last_outcome, result->>'outcome') as outcome, count(*) as n
         from ${queueTable}
        where job_ref = any($1)
          and coalesce(last_outcome, result->>'outcome') is not null
          and coalesce(last_outcome, result->>'outcome') <> 'cancelled'
          and updated_at >= date_trunc('month', now())
        group by 1`,
      [scopedJobIds],
    );
    const outcomesMonth: Record<string, number> = {};
    for (const r of outcomeRows) {
      if (r.outcome) outcomesMonth[r.outcome] = Number(r.n) || 0;
    }

    // ── 4 กล่องผลโทร (เจ้าของกำหนด 12 ส.ค. 2569 — กดขั้น "ผลจากการโทร" แล้วเห็นชื่อคน):
    //    สนใจ (ยังไม่มีคนรับช่วง) · รอ AI โทรซ้ำ · ต้องเร่งจัดการ · ไม่สนใจงาน
    //    + รายชื่อที่ส่ง AI โทรค้างอยู่ (กดขั้น "ส่ง AI โทร")
    const [confirmedRaw, retryRaw, needsHumanRaw, declinedRaw, activeCallsRaw] = await Promise.all([
      listCallsAwaitingAction(['confirmed'], scopedJobIds, 50),
      listByFollowupState('retry_scheduled', scopedJobIds, 50),
      listByFollowupState('needs_human', scopedJobIds, 50),
      listDeclinedThisMonth(scopedJobIds, 50),
      listActiveCalls(scopedJobIds, 100),
    ]);
    // เติมว่าแมทกับงานอะไร (ตำแหน่ง+หน่วยงาน) จากใบขอในลิสต์ที่โหลดมาแล้ว
    const jobById = new Map(jobs.map((j) => [j.id, j as unknown as Record<string, unknown>]));
    const enrich = (item: FlowFollowUpItem): FlowFollowUpItem => {
      const job = jobById.get(item.job_ref);
      if (!job) return item;
      return {
        ...item,
        job_position: jobPositionLabel(job),
        job_unit: typeof job.unit_name === 'string' ? job.unit_name : null,
      };
    };
    const callBoxes = {
      confirmed: confirmedRaw.map(enrich),
      retry: retryRaw.map(enrich),
      needs_human: needsHumanRaw.map(enrich),
      declined: declinedRaw.map(enrich),
    };
    const activeCalls = activeCallsRaw.map(enrich);

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
        /** ส่งไปกี่ "คน" (distinct เบอร์) — ต่างจาก sent_month ที่นับแถว = คน × ใบขอ */
        sent_month_people: Number(lumosAgg[0]?.sent_month_people) || 0,
        waiting_call: Number(lumosAgg[0]?.waiting_call) || 0,
        delivered_waiting: Number(lumosAgg[0]?.delivered_waiting) || 0,
        stale_delivered: Number(lumosAgg[0]?.stale_delivered) || 0,
        /** ค้างในคิวเกิน 2 วันโดยยังไม่ถูกหยิบไปโทรเลย — เดิมไม่มีใครเห็นเคสนี้ */
        stale_pending: Number(lumosAgg[0]?.stale_pending) || 0,
        /** ตั้งโทรซ้ำไว้แล้ว รอถึงเวลานัด */
        retry_scheduled: Number(lumosAgg[0]?.retry_scheduled) || 0,
        /** จำนวนสายที่โทรออกจริงเดือนนี้ (รวมโทรซ้ำ) — ต่างจากจำนวนคน */
        attempts_month: Number(lumosAgg[0]?.attempts_total) || 0,
        /** ผลกลับล่าสุดที่ Lumos ส่งเข้ามา — ใช้ตอบ "เขาส่งผลมาไหม" */
        last_result_at: lumosAgg[0]?.last_result_at ?? null,
        /** เข้าคิวล่าสุดเมื่อไหร่ — คู่กับตัวบน ทำให้แยกออกว่า "เงียบเพราะไม่มีงาน" หรือ "เงียบเพราะสายไม่เดิน" */
        last_sent_at: lumosAgg[0]?.last_sent_at ?? null,
        outcomes_month: outcomesMonth,
      },
      proposals: {
        contacted_month: Number(propAgg[0]?.contacted_month) || 0,
        reserved_active: Number(propAgg[0]?.reserved_active) || 0,
        placed_month: Number(propAgg[0]?.placed_month) || 0,
      },
      postings: {
        active: postedJobIds.size,
        content: contentJobIds.size,
        scraping: scrapingJobIds.size,
        content_stages: postingStages('content'),
        scraping_stages: postingStages('scraping'),
      },
      call_boxes: callBoxes,
      active_calls: activeCalls,
    });
  } catch (e) {
    return handleApiError(res, e, 'matching-flow-summary');
  }
}

export default withRbac(handler, 'matching-flow-summary');
