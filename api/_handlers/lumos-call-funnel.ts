/**
 * GET /api/lumos/call-funnel — funnel การโทรทั้งระบบ + ถัง "ต้องคนตาม" (read-only)
 *
 * ตอบคำถามที่เจ้าของถาม: "ส่งไปให้ Lumos กี่คน · โทรติดกี่คน · ไม่ติดกี่คน ·
 * ไม่รับสายกี่คน" แล้วต่อด้วย "ใครที่ AI เอาไม่อยู่แล้วต้องให้คนตาม"
 *
 * ⚠️ ตัวเลขที่นี่คือ "การทำงานของการโทร" ไม่ใช่ "หาได้แล้ว/ปิดครบใบขอ" ทางการจาก ERP
 * (นิยาม Control Tower ห้ามปนกัน — ดู references/02-dashboard-metric-definitions.md)
 */
import {
  withRbac,
  handleApiError,
  sendError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import {
  CONNECTED_CALL_OUTCOMES,
  UNREACHED_CALL_OUTCOMES,
} from '../../src/lib/callOutcomeBuckets.js';
import { dbQuery, isPgUndefinedTable } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { listNeedsHumanQueueItems } from '../_lib/callFollowup.js';

const queueTable = tableInAppSchema('lumos_dispatch_queue');

/** ผลโทรที่ถือว่า "คุยติด" — ได้คุยกับคนจริง */
const CONNECTED_OUTCOMES: readonly string[] = CONNECTED_CALL_OUTCOMES;
/** ผลโทรที่ถือว่า "ไม่ติด" */
const UNREACHED_OUTCOMES: readonly string[] = UNREACHED_CALL_OUTCOMES;

export type CallFunnel = {
  /** ส่งเข้าคิวทั้งหมด (ยังไม่นับซ้ำการโทรซ้ำ) — **รวมแถวที่ยกเลิก** */
  queued: number;
  /** ส่ง AI โทรจริง = queued ที่ยังไม่ถูกยกเลิก (ตัวเลข "ส่งทั้งหมด" ที่เจ้าของอยากเห็น) */
  queuedActive: number;
  /** Lumos ดึงไปแล้ว */
  delivered: number;
  /** รอโทร (ยังไม่ถูกดึง หรือ นัดโทรซ้ำไว้) */
  waiting: number;
  /** นัดโทรซ้ำไว้ (นับจาก next_attempt_at > now) — ส่วนหนึ่งของ waiting */
  retryScheduled: number;
  /** "ไม่สะดวกคุย รอ AI โทรใหม่" = followup_state='retry_scheduled' (ต่างจาก retryScheduled ที่นับเวลา) */
  retryScheduledState: number;
  /** มีผลกลับมาแล้ว */
  withResult: number;
  connected: number;
  unreached: number;
  /** แยกตามผลโทร */
  byOutcome: Record<string, number>;
  /** AI เอาไม่อยู่ ต้องคนตาม */
  needsHuman: number;
  /** จบแล้ว */
  closed: number;
  /** สรุปรายรอบโทร (รอบ 4 ขึ้นไปรวบเข้ารอบ 3) — นับตามรอบล่าสุดของแต่ละคน */
  byAttempt?: {
    attempt: number;
    total: number;
    connected: number;
    unreached: number;
    pending: number;
    /** ยกเลิกในรอบนั้น — เดิมนับใน total แต่หายจากทุกถังย่อย ทำให้บวกไม่ครบ */
    cancelled: number;
  }[];
  /** ฝั่ง "คนเก็บไปโทรเอง" (candidate_call_holds) — สถานะชุดเดียวกับ AI ในกรอบเดียว */
  human?: HumanCallSummary;
};

/**
 * สรุปงานโทรของ "คน" — คู่กับ funnel ของ AI ในแผงเดียว (เจ้าของสั่ง 14 ส.ค. 2569)
 * ผลที่คนบันทึกมีจริง 5 แบบเท่านั้น (confirmed/declined/reschedule/no_answer/wrong_person)
 * ช่องที่ฝั่ง AI มีแต่ฝั่งคนไม่มี (busy/failed/acknowledged) ปล่อยเป็น 0 บนหน้าจอ
 */
export type HumanCallSummary = {
  /** เก็บไปโทรทั้งหมด (รวมที่ปล่อย/บันทึกผลแล้ว) */
  total: number;
  /** ถืออยู่ตอนนี้ยังไม่บันทึกผล (released_at is null) = "กำลังโทร/รอโทร" ฝั่งคน */
  holding: number;
  /** บันทึกผลแล้วกี่คน (result_outcome is not null) = "มีผล/รับสาย" ฝั่งคน */
  withResult: number;
  /** คืนงานให้ AI โทรต่อ (release_reason='to_ai') */
  toAi: number;
  byOutcome: Record<string, number>;
};

/**
 * ต้นทางของงานโทร — แยกจาก `person_ref` (ดู lumosDispatchApi: card-/ir-/follow-)
 *
 * ทำไมต้องมี: หน้า Follow เคยโชว์ยอดรวมทั้งระบบ (5,307) ทั้งที่หน้านั้นส่งเองแค่ 1 คน
 * เจ้าของทักว่า "ส่ง 1 คนเองทำไมขึ้นตั้ง 5307" — ตัวเลขถูกแต่ตอบคนละคำถาม
 */
export type CallFunnelSource = 'all' | 'follow' | 'board' | 'irecruit';

const SOURCE_WHERE: Record<Exclude<CallFunnelSource, 'all'>, string> = {
  follow: `person_ref like 'follow-%'`,
  board: `person_ref like 'card-%'`,
  irecruit: `person_ref like 'ir-%'`,
};

function isCallFunnelSource(v: string): v is CallFunnelSource {
  return v === 'all' || v === 'follow' || v === 'board' || v === 'irecruit';
}

function emptyFunnel(): CallFunnel {
  return {
    queued: 0,
    queuedActive: 0,
    delivered: 0,
    waiting: 0,
    retryScheduled: 0,
    retryScheduledState: 0,
    withResult: 0,
    connected: 0,
    unreached: 0,
    byOutcome: {},
    needsHuman: 0,
    closed: 0,
  };
}

const holdsTable = tableInAppSchema('candidate_call_holds');

/** funnel source → source ของ candidate_call_holds (board รวม application ที่มาจากบอร์ด) */
const HOLD_SOURCE_WHERE: Record<Exclude<CallFunnelSource, 'all'>, string | null> = {
  board: `source in ('board','application')`,
  irecruit: `source = 'irecruit'`,
  follow: null, // งาน Follow ไม่ผ่านล็อก "รับไปโทรเอง"
};

async function loadHumanCalls(
  sinceYmd: string | null,
  source: CallFunnelSource,
): Promise<HumanCallSummary> {
  const empty: HumanCallSummary = { total: 0, holding: 0, withResult: 0, toAi: 0, byOutcome: {} };
  // Follow ไม่มีล็อกฝั่งคน — ไม่ต้องยิงคิวรี
  if (source === 'follow') return empty;
  const conds: string[] = [];
  const params: unknown[] = [];
  if (sinceYmd) {
    params.push(`${sinceYmd}T00:00:00+07:00`);
    conds.push(`held_at >= $${params.length}::timestamptz`);
  }
  if (source !== 'all') {
    const w = HOLD_SOURCE_WHERE[source];
    if (w) conds.push(w);
  }
  const where = conds.length ? `where ${conds.join(' and ')}` : '';
  try {
    const { rows } = await dbQuery<{
      result_outcome: string | null;
      release_reason: string | null;
      n: string;
    }>(
      `select result_outcome, release_reason, count(*)::text as n
         from ${holdsTable}
         ${where}
        group by result_outcome, release_reason`,
      params,
    );
    const out = { ...empty, byOutcome: {} as Record<string, number> };
    for (const r of rows) {
      const n = Number(r.n) || 0;
      out.total += n;
      if (!r.result_outcome && r.release_reason === null) out.holding += n;
      if (r.result_outcome) {
        out.withResult += n;
        out.byOutcome[r.result_outcome] = (out.byOutcome[r.result_outcome] ?? 0) + n;
      }
      if (r.release_reason === 'to_ai') out.toAi += n;
    }
    return out;
  } catch (e) {
    // ตารางยังไม่ migrate = ไม่มีงานฝั่งคนให้แสดง ไม่ใช่เหตุให้ทั้งแผงพัง
    if (isPgUndefinedTable(e) || isUndefinedColumn(e)) return empty;
    throw e;
  }
}

type StatRow = {
  status: string;
  last_outcome: string | null;
  followup_state: string | null;
  has_result: boolean;
  scheduled_ahead: boolean;
  attempt_no: number;
  n: string;
};

/**
 * นับจากคิวทีเดียวด้วย group by — ไม่ดึงแถวมานับที่ node
 * (คิวมีได้หลายพันแถว · บทเรียนจากเส้นใบขอที่ปิดแล้วที่เคยดึง 2,700 แถวมานับ)
 */
async function loadFunnel(
  sinceYmd: string | null,
  source: CallFunnelSource,
): Promise<CallFunnel> {
  const funnel = emptyFunnel();
  const byAttempt = [1, 2, 3].map((attempt) => ({
    attempt,
    total: 0,
    connected: 0,
    unreached: 0,
    pending: 0,
    cancelled: 0,
  }));
  const params: unknown[] = [];
  const conds: string[] = [];
  if (sinceYmd) {
    params.push(`${sinceYmd}T00:00:00+07:00`);
    conds.push(`created_at >= $${params.length}::timestamptz`);
  }
  // ต้นทางเป็นค่าคงที่จาก allow-list ไม่ใช่ค่าที่ผู้ใช้ส่งมาตรง ๆ (ไม่มีทาง inject)
  if (source !== 'all') conds.push(SOURCE_WHERE[source]);
  const sinceClause = conds.length ? `where ${conds.join(' and ')}` : '';
  try {
    const { rows } = await dbQuery<StatRow>(
      // อ่าน outcome จาก last_outcome ก่อน · ไม่มีก็ถอยไปดู result->>'outcome'
      // เพราะ last_outcome เป็นคอลัมน์ใหม่ (migration 070) แถวที่มีผลอยู่ก่อนหน้าจะว่าง
      // ถ้าไม่ถอยให้ หน้าเว็บจะโชว์ "มีผลกลับ 458 แต่โทรติด 0" ซึ่งดูเหมือนพัง
      `select status,
              coalesce(last_outcome, result->>'outcome') as last_outcome,
              followup_state,
              (result is not null) as has_result,
              (next_attempt_at is not null and next_attempt_at > now()) as scheduled_ahead,
              -- รอบที่โทร — เกิน 3 รวบเป็น 3 เพราะเพดานเริ่มต้นคือ 3 ครั้ง
              least(greatest(coalesce(attempt_count, 1), 1), 3) as attempt_no,
              count(*)::text as n
         from ${queueTable}
         ${sinceClause}
        group by status, coalesce(last_outcome, result->>'outcome'),
                 followup_state, has_result, scheduled_ahead,
                 least(greatest(coalesce(attempt_count, 1), 1), 3)`,
      params,
    );

    for (const r of rows) {
      const n = Number(r.n) || 0;
      const isCancelled = r.status === 'cancelled' || r.last_outcome === 'cancelled';
      funnel.queued += n;
      if (!isCancelled) funnel.queuedActive += n;
      if (r.status === 'delivered') funnel.delivered += n;
      if (r.has_result) funnel.withResult += n;
      else funnel.waiting += n;
      if (r.scheduled_ahead) funnel.retryScheduled += n;
      if (r.followup_state === 'retry_scheduled') funnel.retryScheduledState += n;

      if (r.last_outcome) {
        funnel.byOutcome[r.last_outcome] = (funnel.byOutcome[r.last_outcome] ?? 0) + n;
        if (CONNECTED_OUTCOMES.includes(r.last_outcome)) funnel.connected += n;
        if (UNREACHED_OUTCOMES.includes(r.last_outcome)) funnel.unreached += n;
      }
      if (r.followup_state === 'needs_human') funnel.needsHuman += n;
      if (r.followup_state === 'closed') funnel.closed += n;

      // สรุปรายรอบ (เจ้าของสั่ง 10 ส.ค. 2569: "รอบแรกรับไม่รับกี่คน รอบสอง รอบสามด้วย")
      // ⚠️ `attempt_count` คือรอบ **ล่าสุด** ของแถวนั้น ไม่ใช่ประวัติทุกรอบ — คนที่โทรไปแล้ว
      // 3 รอบจะนับอยู่ในรอบ 3 อย่างเดียว ไม่ได้ถูกนับซ้ำในรอบ 1-2 · ตัวเลขจึงอ่านว่า
      // "ตอนนี้แต่ละคนอยู่รอบไหน และรอบนั้นผลเป็นยังไง"
      const no = Math.min(Math.max(Number(r.attempt_no) || 1, 1), 3);
      const slot = byAttempt[no - 1];
      slot.total += n;
      // ยกเลิกแยกถังของตัวเอง — เดิมตกอยู่ใน pending ทำให้ "รอโทร" โป่งด้วยแถวที่ตายแล้ว
      if (isCancelled) slot.cancelled += n;
      else if (r.last_outcome) {
        if (CONNECTED_OUTCOMES.includes(r.last_outcome)) slot.connected += n;
        else if (UNREACHED_OUTCOMES.includes(r.last_outcome)) slot.unreached += n;
      } else {
        slot.pending += n;
      }
    }
  } catch (e) {
    // คอลัมน์ใหม่ยังไม่ถูก migrate → คืน funnel ว่าง หน้าเว็บโชว์ศูนย์ ไม่พัง
    if (isPgUndefinedTable(e) || isUndefinedColumn(e)) return funnel;
    throw e;
  }
  funnel.byAttempt = byAttempt;
  return funnel;
}

function isUndefinedColumn(e: unknown): boolean {
  return (
    typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42703'
  );
}

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

async function handler(req: AuthedReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return sendError(res, 405, 'Method not allowed');
  }
  try {
    const since = getQuery(req, 'since').trim();
    const sinceYmd = /^\d{4}-\d{2}-\d{2}$/.test(since) ? since : null;
    const rawSource = getQuery(req, 'source').trim() || 'all';
    // ค่าที่ไม่รู้จัก = ทั้งระบบ (พฤติกรรมเดิม) ไม่ใช่ error — ลิงก์เก่ายังใช้ได้
    const source: CallFunnelSource = isCallFunnelSource(rawSource) ? rawSource : 'all';

    const [funnel, human, needsHuman] = await Promise.all([
      loadFunnel(sinceYmd, source),
      loadHumanCalls(sinceYmd, source),
      listNeedsHumanQueueItems(100, source === 'all' ? null : source),
    ]);
    funnel.human = human;

    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json({ funnel, needsHuman, source });
  } catch (e) {
    return handleApiError(res, e, 'lumos-call-funnel', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'follow');
