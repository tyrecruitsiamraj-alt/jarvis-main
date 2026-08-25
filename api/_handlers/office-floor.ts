/**
 * GET /api/office-floor — เลขดิบของฉาก "ห้องทำงาน" บนหน้าแรก (read-only)
 *
 * เจ้าของสั่ง 22 ส.ค. 2569: *"อยากให้หน้าหลักมีตัวละครแทนแต่ละแผนก มีโต๊ะทำงาน
 * บอกว่าแต่ละคนตอนนี้กำลังทำอะไร"* — เส้นนี้ตอบว่า **แต่ละโต๊ะมีของอยู่ในมือเท่าไหร่**
 * ส่วนการแปลเป็นสถานะ/ประโยคอยู่ที่ `src/lib/officeFloor.ts` (pure · มีเทสต์)
 *
 * 🔴 กติกาของเส้นนี้:
 * 1. **ไม่แตะ ERP (MSSQL)** — หน้าแรกต้องเบา · เลขฝั่งใบขอ (เปิดกี่ใบ · AI คิดแล้วกี่ใบ)
 *    หน้าแรกได้จาก `/api/matching/flow-summary` อยู่แล้ว แล้วประกอบกันที่ฝั่งหน้าเว็บ
 * 2. **ใช้นิยามเดิมที่เดียว** — ถังของใบสมัครดึงจาก `OVERVIEW_BUCKETS`
 *    (ไฟล์เดียวกับที่ศูนย์คุมงานสรรหาใช้) ห้ามเขียนเงื่อนไข "โทรแล้ว/ยังไม่โทร" ใหม่
 *    ไม่งั้นหน้าแรกกับหน้าบอร์ดจะตอบไม่เท่ากันแบบเงียบ ๆ
 * 3. **ไม่มีข้อมูลบุคคล** — คืนแต่ตัวนับ จึงครอบ `withAuth` (ล็อกอินพอ) เหมือน
 *    `/api/matching/worker-status` ไม่ต้องผูก rbac key เฉพาะ
 * 4. **cache สั้น** — หน้าแรกเปิดพร้อมกันหลายคน คิวรีถังใบสมัครมี EXISTS หลายชั้น
 */
import { sendError, withAuth, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { OVERVIEW_BUCKETS } from '../_lib/applicantOverviewSql.js';
import type { OfficeFloorCounts } from '@/lib/officeFloor';

const APPS = tableInAppSchema('public_job_applications');
const QUEUE = tableInAppSchema('lumos_dispatch_queue');
const HOLDS = tableInAppSchema('candidate_call_holds');
const FOLLOW = tableInAppSchema('follow_entries');
const POSTING_REQ = tableInAppSchema('job_posting_requests');

/** ผลโทรในคิว — reminder เก็บที่ last_outcome · interview บางแถวอยู่ใน result (กับดักซ้ำ) */
const QUEUE_OUTCOME = `coalesce(q.last_outcome, q.result->>'outcome')`;
/** เวลาที่ถูกส่งออก — แถวเก่าก่อน migration 088 ไม่มี first_delivered_at จึง fallback updated_at */
const QUEUE_SENT_AT = `coalesce(q.first_delivered_at, q.updated_at)`;
const QUEUE_RESULT_AT = `coalesce(q.first_result_at, q.updated_at)`;

/** จำนวนวันเต็มจากเวลาหนึ่งถึงเดี๋ยวนี้ */
const daysSince = (expr: string) => `floor(extract(epoch from (now() - ${expr})) / 86400)`;

const INTAKE_SQL = `
select
  count(*) filter (where a.created_at >= date_trunc('day', now()))::int as new_today,
  count(*) filter (where ${OVERVIEW_BUCKETS.untouched})::int as untouched,
  count(*) filter (where ${OVERVIEW_BUCKETS.in_queue})::int as in_queue,
  count(*) filter (where ${OVERVIEW_BUCKETS.held})::int as held,
  count(*) filter (where ${OVERVIEW_BUCKETS.claimed_idle})::int as claimed_idle,
  count(*) filter (where ${OVERVIEW_BUCKETS.over5d})::int as over5d,
  -- GREATEST ข้าม null ให้เอง → ได้อายุของที่ค้างนานสุดจากสองเกณฑ์รวมกัน
  max(greatest(
    case when ${OVERVIEW_BUCKETS.claimed_idle} then ${daysSince('a.claimed_at')} end,
    case when ${OVERVIEW_BUCKETS.over5d} then ${daysSince('a.created_at')} end
  ))::int as oldest_days
from ${APPS} a`;

/** ส่งให้ Lumos แล้วยังไม่มีผลกลับ */
const WAITING = `(q.status = 'delivered' and ${QUEUE_OUTCOME} is null)`;
const STALE = `(${WAITING} and ${QUEUE_SENT_AT} < now() - interval '1 day')`;

const QUEUE_SQL = `
select
  count(*) filter (where q.status = 'pending')::int as pending,
  count(*) filter (where ${WAITING})::int as waiting_result,
  count(*) filter (where ${STALE})::int as stale_over_day,
  count(*) filter (where ${QUEUE_OUTCOME} is not null
                     and ${QUEUE_RESULT_AT} >= date_trunc('day', now()))::int as result_today,
  max(case when ${STALE} then ${daysSince(QUEUE_SENT_AT)} end)::int as oldest_days
from ${QUEUE} q`;

const HOLDS_SQL = `
select
  count(*) filter (where h.released_at is null)::int as holds_active,
  count(*) filter (where h.released_at is null and h.result_outcome is null)::int as holds_no_result,
  max(case when h.released_at is null and h.result_outcome is null
           then ${daysSince('h.held_at')} end)::int as oldest_days
from ${HOLDS} h`;

/**
 * "เลยเวลานัดโทรแล้วยังไม่มีผล" — ผลของ follow อ่านกลับจากคิวด้วย person_ref = 'follow-<id>'
 * (นิยามเดียวกับที่ migration 060 เขียนไว้) · ใบที่ถูกยกเลิกไม่นับทุกช่อง
 */
const FOLLOW_DONE = `exists (
  select 1 from ${QUEUE} q
   where q.person_ref = 'follow-' || f.id::text
     and ${QUEUE_OUTCOME} is not null)`;

const FOLLOW_SQL = `
select
  count(*) filter (where f.cancelled_at is null
                     and f.scheduled_at >= date_trunc('day', now())
                     and f.scheduled_at < date_trunc('day', now()) + interval '1 day')::int as today,
  count(*) filter (where f.cancelled_at is null
                     and f.scheduled_at < now()
                     and not ${FOLLOW_DONE})::int as past_due,
  count(*) filter (where f.cancelled_at is null and f.scheduled_at > now())::int as upcoming,
  max(case when f.cancelled_at is null and f.scheduled_at < now() and not ${FOLLOW_DONE}
           then ${daysSince('f.scheduled_at')} end)::int as oldest_days
from ${FOLLOW} f`;

const CONTENT_SQL = `
select
  count(*) filter (where p.status = 'pending')::int as pending,
  count(*) filter (where p.request_type = 'content'
                     and p.status in ('in_progress', 'posted'))::int as in_progress,
  count(*) filter (where p.request_type = 'scraping'
                     and p.status in ('in_progress', 'posted'))::int as scraping,
  max(case when p.status = 'pending' then ${daysSince('p.created_at')} end)::int as oldest_days
from ${POSTING_REQ} p`;

type Row = Record<string, number | null>;
const n = (v: number | null | undefined): number => (typeof v === 'number' ? v : 0);
const orNull = (v: number | null | undefined): number | null => (typeof v === 'number' ? v : null);

/**
 * cache 30 วินาที — หน้าแรกของทุกคนยิงเส้นนี้ และคิวรีถังใบสมัครมี EXISTS หลายชั้น
 * (ตัวเลขห้องทำงานไม่ต้องเป๊ะระดับวินาที · แถบเวลาบนจอบอกอยู่ว่าอัปเดตเมื่อไหร่)
 */
const CACHE_MS = 30_000;
let cache: { at: number; body: { generated_at: string; counts: OfficeFloorCounts } } | null = null;

/**
 * "รอเลือกวิธีโทร" (104) — ยิงแยกจาก INTAKE_SQL เพราะฐานที่ยังไม่รัน migration จะได้
 * 42703 แล้วทำให้ **ทุกช่องของโต๊ะสรรหาหายไปทั้งโต๊ะ** ไม่ใช่แค่ช่องนี้
 * อ่านไม่ได้ = คืน undefined (ไม่ใช่ 0) → `buildIntake` ซ่อนช่องนี้ให้เอง
 */
async function loadAwaitingChoice(): Promise<number | undefined> {
  try {
    const { rows } = await dbQuery<Row>(
      `select count(*) filter (where ${OVERVIEW_BUCKETS.awaiting_call_choice})::int as n from ${APPS} a`,
    );
    return n(rows[0]?.n);
  } catch {
    return undefined;
  }
}

async function loadCounts(): Promise<OfficeFloorCounts> {
  const [intake, queue, holds, follow, content, awaitingChoice] = await Promise.all([
    dbQuery<Row>(INTAKE_SQL),
    dbQuery<Row>(QUEUE_SQL),
    dbQuery<Row>(HOLDS_SQL),
    dbQuery<Row>(FOLLOW_SQL),
    dbQuery<Row>(CONTENT_SQL),
    loadAwaitingChoice(),
  ]);
  const i = intake.rows[0] ?? {};
  const q = queue.rows[0] ?? {};
  const h = holds.rows[0] ?? {};
  const f = follow.rows[0] ?? {};
  const c = content.rows[0] ?? {};
  return {
    intake: {
      newToday: n(i.new_today),
      untouched: n(i.untouched),
      inQueue: n(i.in_queue),
      held: n(i.held),
      claimedIdle: n(i.claimed_idle),
      over5d: n(i.over5d),
      awaitingChoice,
      oldestDays: orNull(i.oldest_days),
    },
    aiCalls: {
      pending: n(q.pending),
      waitingResult: n(q.waiting_result),
      staleOverDay: n(q.stale_over_day),
      resultToday: n(q.result_today),
      oldestDays: orNull(q.oldest_days),
    },
    selection: {
      holdsActive: n(h.holds_active),
      holdsNoResult: n(h.holds_no_result),
      oldestDays: orNull(h.oldest_days),
    },
    follow: {
      today: n(f.today),
      pastDue: n(f.past_due),
      upcoming: n(f.upcoming),
      oldestDays: orNull(f.oldest_days),
    },
    content: {
      pending: n(c.pending),
      inProgress: n(c.in_progress),
      scraping: n(c.scraping),
      oldestDays: orNull(c.oldest_days),
    },
  };
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') return sendError(res, 405, 'Method not allowed');
  try {
    const now = Date.now();
    if (cache && now - cache.at < CACHE_MS) return res.status(200).json(cache.body);
    const counts = await loadCounts();
    const body = { generated_at: new Date().toISOString(), counts };
    cache = { at: now, body };
    return res.status(200).json(body);
  } catch (err) {
    return handleApiError(res, err, 'office-floor');
  }
}

export default withAuth(handler);
