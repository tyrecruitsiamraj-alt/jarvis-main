/**
 * "รับไปโทรเอง" — ล็อกสิทธิ์โทรผู้สมัคร กันคนโทรชนกัน และกัน AI โทรทับ
 *
 * ล็อกผูกกับ **เบอร์ E.164** ไม่ใช่ candidate_ref (คนเดียวมีหลายรหัสได้ แต่เบอร์มีเบอร์เดียว)
 * ดู migrations/068_candidate_call_holds.sql
 *
 * กติกา:
 *   - หนึ่งเบอร์ = ล็อกที่ยังไม่ปล่อยได้ทีเดียว (partial unique index เป็นคนตัดสิน ไม่ใช่โค้ด)
 *     → 2 คนกดพร้อมกัน คนแรกชนะเสมอแม้จะยิงมาห่างกันเสี้ยววินาที
 *   - อายุ 1 วัน · หมดอายุแล้วถือว่าว่าง (กวาดก่อนทุกครั้งที่จะจับหรืออ่าน)
 *   - ผลโทรใช้ศัพท์ชุดเดียวกับ Lumos outcome → funnel รวมกันได้
 */
import { dbQuery, isPgUniqueViolation, isPgUndefinedTable } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { toE164Thai } from './thaiPhone.js';
import {
  isDeclinedScope,
  resolveAppointment,
  type CallResultScope as ResultScope,
} from '../../src/lib/callAppointment.js';

const table = tableInAppSchema('candidate_call_holds');

const MAX_TEXT = 200;
const MAX_NOTE = 2000;

/** 'application' = ใบสมัครจากบอร์ดรับสมัคร (public_job_applications) — เพิ่ม 11 ส.ค. 2569 รอบหก */
export type CallHoldSource = 'board' | 'irecruit' | 'application';

/** ศัพท์เดียวกับ Lumos outcome — เพิ่มใหม่ต้องแก้ CHECK ใน migration ด้วย */
export const CALL_RESULT_OUTCOMES = [
  'confirmed',
  'declined',
  'reschedule_requested',
  'no_answer',
  'wrong_person',
] as const;
export type CallResultOutcome = (typeof CALL_RESULT_OUTCOMES)[number];

/**
 * รายละเอียดของผลโทร — ความหมายทั้งชุดอยู่ที่ `src/lib/callAppointment.ts` ที่เดียว
 * ไม่สนใจ: `job` = ไม่เอางานนี้ · `all` = ไม่หางานแล้ว (พักเบอร์)
 * สนใจ: `scheduled` = นัดวันสัมภาษณ์ได้แล้ว · `unscheduled` = สนใจแต่ยังนัดไม่ได้
 */
export type { CallResultScope } from '../../src/lib/callAppointment.js';

export type CallHold = {
  id: string;
  phone: string;
  source: CallHoldSource;
  candidateRef: string;
  candidateName: string | null;
  jobId: string;
  requestNo: string | null;
  heldByUserId: string | null;
  heldByName: string | null;
  heldAt: string;
  expiresAt: string;
  releasedAt: string | null;
  releaseReason: string | null;
  resultOutcome: CallResultOutcome | null;
  resultScope: ResultScope | null;
  resultNote: string | null;
  /** วันนัดสัมภาษณ์ที่ตกลงได้ตอนโทร (ISO) — มีเฉพาะผล "สนใจ + นัดได้เลย" */
  appointmentAt: string | null;
};

type Row = {
  id: string;
  phone_e164: string;
  source: string;
  candidate_ref: string;
  candidate_name: string | null;
  job_id: string;
  request_no: string | null;
  held_by_user_id: string | null;
  held_by_name: string | null;
  held_at: string;
  expires_at: string;
  released_at: string | null;
  release_reason: string | null;
  result_outcome: string | null;
  result_scope: string | null;
  result_note: string | null;
  appointment_at?: string | null;
};

const COLS_BASE = `id, phone_e164, source, candidate_ref, candidate_name, job_id, request_no,
  held_by_user_id, held_by_name, held_at, expires_at, released_at, release_reason,
  result_outcome, result_scope, result_note`;

/**
 * ⚠️ `appointment_at` มาทีหลัง (migration 085) — ฐานที่ยังไม่รันต้องอ่านได้เหมือนเดิม
 * ไม่งั้นหน้า "โทรของฉัน" ตายทั้งหน้าเพราะคอลัมน์เสริมตัวเดียว
 */
const COLS = `${COLS_BASE}, appointment_at`;

export function isCallResultOutcome(v: unknown): v is CallResultOutcome {
  return typeof v === 'string' && (CALL_RESULT_OUTCOMES as readonly string[]).includes(v);
}

export function isCallHoldSource(v: unknown): v is CallHoldSource {
  return v === 'board' || v === 'irecruit' || v === 'application';
}

function trimTo(v: unknown, max: number): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s.slice(0, max) : null;
}

/** 42703 undefined_column — ยังไม่รัน migration 085 (กติกาข้อ 9: กลืนเฉพาะเคสนี้) */
function isUndefinedColumn(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42703';
}

/**
 * ยิงคิวรีด้วยชุดคอลัมน์ใหม่ก่อน เจอ `42703` ค่อยถอยไปชุดเดิม (แพตเทิร์นเดียวกับ
 * `LIST_COLUMNS_LEGACY` ของ job-applications) — ฐานที่ยังไม่รัน 085 ต้องใช้งานได้ครบ
 * ทุกอย่างยกเว้นวันนัด · **ห้ามปล่อยให้ทั้งหน้าพังเพราะคอลัมน์เสริมตัวเดียว**
 */
async function queryHolds(build: (cols: string) => string, params?: unknown[]) {
  try {
    return await dbQuery<Row>(build(COLS), params);
  } catch (e) {
    if (!isUndefinedColumn(e)) throw e;
    return await dbQuery<Row>(build(COLS_BASE), params);
  }
}

function isResultScope(v: unknown): v is ResultScope {
  return isDeclinedScope(v) || v === 'scheduled' || v === 'unscheduled';
}

function mapRow(r: Row): CallHold {
  return {
    id: r.id,
    phone: r.phone_e164,
    source: isCallHoldSource(r.source) ? r.source : 'board',
    candidateRef: r.candidate_ref,
    candidateName: r.candidate_name,
    jobId: r.job_id,
    requestNo: r.request_no,
    heldByUserId: r.held_by_user_id,
    heldByName: r.held_by_name,
    heldAt: r.held_at,
    expiresAt: r.expires_at,
    releasedAt: r.released_at,
    releaseReason: r.release_reason,
    resultOutcome: isCallResultOutcome(r.result_outcome) ? r.result_outcome : null,
    resultScope: isResultScope(r.result_scope) ? r.result_scope : null,
    resultNote: r.result_note,
    appointmentAt: r.appointment_at ?? null,
  };
}

/** เบอร์ที่แปลงเป็น E.164 ไม่ได้ = ล็อกไม่ได้ (โทรไม่ได้อยู่แล้ว) */
export function callHoldKey(rawPhone: string | null | undefined): string | null {
  return toE164Thai(rawPhone);
}

/**
 * กวาดล็อกที่หมดอายุให้กลายเป็น "ปล่อยแล้ว" — เรียกก่อนจับ/อ่านทุกครั้ง
 * ทำแบบ lazy ไม่ต้องมี cron · partial unique index จะปล่อยให้จับใหม่ได้ทันทีหลังกวาด
 */
export async function releaseExpiredCallHolds(): Promise<number> {
  try {
    const { rows } = await dbQuery<{ id: string }>(
      `update ${table}
          set released_at = now(), release_reason = 'expired', updated_at = now()
        where released_at is null and expires_at <= now()
        returning id`,
    );
    return rows.length;
  } catch (e) {
    if (isPgUndefinedTable(e)) return 0;
    throw e;
  }
}

/** ล็อกที่ยังถืออยู่ของเบอร์ชุดนี้ — คืน map เบอร์ → ล็อก (ใช้วาดการ์ดหน้า Matching) */
export async function getActiveCallHoldsByPhones(
  phones: Array<string | null | undefined>,
): Promise<Map<string, CallHold>> {
  const keys = [...new Set(phones.map(callHoldKey).filter((p): p is string => !!p))];
  const map = new Map<string, CallHold>();
  if (keys.length === 0) return map;
  try {
    await releaseExpiredCallHolds();
    const { rows } = await queryHolds(
      (c) => `select ${c} from ${table}
        where released_at is null and phone_e164 = any($1::text[])`,
      [keys],
    );
    for (const r of rows) map.set(r.phone_e164, mapRow(r));
  } catch (e) {
    if (isPgUndefinedTable(e)) return map;
    throw e;
  }
  return map;
}

/** เบอร์ที่คน "ถืออยู่" ตอนนี้ — ตัว enqueue ของ AI ใช้ข้ามเบอร์เหล่านี้ */
export async function listHeldPhones(): Promise<Set<string>> {
  try {
    await releaseExpiredCallHolds();
    const { rows } = await dbQuery<{ phone_e164: string }>(
      `select phone_e164 from ${table} where released_at is null`,
    );
    return new Set(rows.map((r) => r.phone_e164));
  } catch (e) {
    if (isPgUndefinedTable(e)) return new Set();
    throw e;
  }
}

export type AcquireInput = {
  phone: string;
  source: CallHoldSource;
  candidateRef: string;
  candidateName?: unknown;
  jobId: string;
  requestNo?: unknown;
  userId?: string | null;
  userName?: string | null;
};

export type AcquireOutcome =
  | { ok: true; hold: CallHold }
  | { ok: false; reason: 'no_phone' }
  | { ok: false; reason: 'taken'; hold: CallHold };

/**
 * จับล็อก — คนแรกชนะ
 *
 * ไม่เช็คก่อนแล้วค่อย insert (race กันได้) แต่ยิง insert ตรง ๆ แล้วอ่าน unique violation
 * เป็นคำตอบว่า "มีคนถืออยู่แล้ว" — DB เป็นคนตัดสิน ไม่ใช่ลำดับของโค้ด
 */
export async function acquireCallHold(input: AcquireInput): Promise<AcquireOutcome> {
  const phone = callHoldKey(input.phone);
  if (!phone) return { ok: false, reason: 'no_phone' };
  const ref = (input.candidateRef || '').trim();
  const jobId = (input.jobId || '').trim();
  if (!ref) throw new Error('ต้องระบุผู้สมัคร');
  if (!jobId) throw new Error('ต้องระบุใบขอ');

  await releaseExpiredCallHolds();

  try {
    const { rows } = await queryHolds(
      (c) => `insert into ${table}
         (phone_e164, source, candidate_ref, candidate_name, job_id, request_no,
          held_by_user_id, held_by_name)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       returning ${c}`,
      [
        phone,
        input.source,
        ref,
        trimTo(input.candidateName, MAX_TEXT),
        jobId,
        trimTo(input.requestNo, MAX_TEXT),
        trimTo(input.userId, 64),
        trimTo(input.userName, MAX_TEXT),
      ],
    );
    return { ok: true, hold: mapRow(rows[0]) };
  } catch (e) {
    if (!isPgUniqueViolation(e)) throw e;
    // มีคนถือไปแล้ว — คืนข้อมูลว่าใครถือ ให้หน้าเว็บโชว์ได้เลย
    const { rows } = await queryHolds(
      (c) => `select ${c} from ${table} where phone_e164 = $1 and released_at is null limit 1`,
      [phone],
    );
    if (!rows[0]) {
      // แข่งกันจนแถวที่ชนถูกปล่อยไปแล้วในเสี้ยววินาที — ให้ลองใหม่ได้
      return { ok: false, reason: 'taken', hold: mapRow({
        id: '', phone_e164: phone, source: input.source, candidate_ref: ref,
        candidate_name: null, job_id: jobId, request_no: null,
        held_by_user_id: null, held_by_name: null,
        held_at: new Date().toISOString(), expires_at: new Date().toISOString(),
        released_at: null, release_reason: null,
        result_outcome: null, result_scope: null, result_note: null,
      }) };
    }
    return { ok: false, reason: 'taken', hold: mapRow(rows[0]) };
  }
}

/** คืนล็อกโดยไม่บันทึกผล (กด "คืนงาน" / หัวหน้าโอน / คืนให้ AI) */
export async function releaseCallHold(
  holdId: string,
  reason: 'manual' | 'transferred' | 'to_ai',
): Promise<CallHold | null> {
  const { rows } = await queryHolds(
    (c) => `update ${table}
        set released_at = now(), release_reason = $2, updated_at = now()
      where id = $1 and released_at is null
      returning ${c}`,
    [holdId, reason],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export type RecordResultInput = {
  holdId: string;
  outcome: CallResultOutcome;
  scope?: ResultScope | null;
  /** วันนัดสัมภาษณ์ (`YYYY-MM-DD` หรือ ISO) — ใช้เฉพาะ "สนใจ + นัดได้เลย" */
  appointmentAt?: unknown;
  note?: unknown;
  detail?: unknown;
  /** เวลาอ้างอิงตอนตรวจวันนัด — ไม่ส่ง = now() (เทสต์ส่งเข้ามาเพื่อคุมผล) */
  now?: string;
};

export type RecordResultOutcome =
  | { ok: true; hold: CallHold | null }
  | { ok: false; reason: string };

/**
 * บันทึกผลโทร + ปล่อยล็อก (ผลโทรจบ = ไม่ต้องถือต่อ)
 *
 * ความหมายของ scope/วันนัดทั้งชุดตัดสินที่ `resolveAppointment()` ที่เดียว
 * (ใช้ร่วมกับฝั่งฟอร์ม จึงไม่มีทางที่หน้าเว็บกับ API เข้าใจกติกาต่างกัน)
 */
export async function recordCallResult(input: RecordResultInput): Promise<RecordResultOutcome> {
  const decided = resolveAppointment({
    outcome: input.outcome,
    scope: input.scope,
    appointmentAt: input.appointmentAt,
    now: input.now ?? new Date().toISOString(),
  });
  // ⚠️ invariant ของ resolveAppointment: ok === (reason === null) — ตกที่นี่ต้องมีเหตุผลเสมอ
  if (!decided.ok) return { ok: false, reason: decided.reason ?? 'ผลโทรไม่ถูกต้อง' };

  const params = [
    input.holdId,
    input.outcome,
    decided.scope,
    trimTo(input.note, MAX_NOTE),
    input.detail === undefined ? null : JSON.stringify(input.detail),
  ];
  const setBase = `result_outcome = $2,
            result_scope   = $3,
            result_note    = $4,
            result_detail  = $5::jsonb,
            released_at    = now(),
            release_reason = 'result',
            updated_at     = now()`;

  try {
    const { rows } = await dbQuery<Row>(
      `update ${table}
          set ${setBase}, appointment_at = $6
        where id = $1 and released_at is null
        returning ${COLS}`,
      [...params, decided.appointmentAt],
    );
    return { ok: true, hold: rows[0] ? mapRow(rows[0]) : null };
  } catch (e) {
    if (!isUndefinedColumn(e)) throw e;
    /**
     * ⚠️ ยังไม่รัน 085 — ถอยได้เฉพาะเมื่อ **ไม่มีวันนัดจะเสีย**
     * มีวันนัดแล้วถอยเงียบ ๆ = เจ้าหน้าที่เห็นว่า "บันทึกแล้ว" แต่วันนัดหายไปเฉย ๆ
     * (แพตเทิร์นเดียวกับฟอร์มเพิ่มผู้สมัครที่เลือกคืน 503 แทนการบันทึกแบบทิ้งฟิลด์)
     */
    if (decided.appointmentAt) {
      return {
        ok: false,
        reason: 'ฐานข้อมูลยังไม่มีช่องวันนัด — รัน migration 085 ก่อน (ผลโทรยังไม่ถูกบันทึก)',
      };
    }
    const { rows } = await dbQuery<Row>(
      `update ${table}
          set ${setBase}
        where id = $1 and released_at is null
        returning ${COLS_BASE}`,
      params,
    );
    return { ok: true, hold: rows[0] ? mapRow(rows[0]) : null };
  }
}

/** ล็อกที่คนนี้ถืออยู่ — หน้า "โทรของฉัน" (เรียงใกล้หมดอายุก่อน) */
export async function listCallHoldsForUser(userId: string): Promise<CallHold[]> {
  try {
    await releaseExpiredCallHolds();
    const { rows } = await queryHolds(
      (c) => `select ${c} from ${table}
        where released_at is null and held_by_user_id = $1
        order by expires_at asc`,
      [userId],
    );
    return rows.map(mapRow);
  } catch (e) {
    if (isPgUndefinedTable(e)) return [];
    throw e;
  }
}

/** ล็อกที่ยังถืออยู่ทั้งหมด — บอร์ดหัวหน้า (เรียงใกล้หมดอายุก่อน) */
export async function listAllActiveCallHolds(): Promise<CallHold[]> {
  try {
    await releaseExpiredCallHolds();
    const { rows } = await queryHolds(
      (c) => `select ${c} from ${table}
        where released_at is null
        order by expires_at asc`,
    );
    return rows.map(mapRow);
  } catch (e) {
    if (isPgUndefinedTable(e)) return [];
    throw e;
  }
}

export type CallResultTally = {
  /** ผลโทรที่คนบันทึกวันนี้ แยกตามชนิด */
  byOutcome: Record<CallResultOutcome, number>;
  /** ปฏิเสธแบบไหน — job = ไม่เอางานนี้ · all = ไม่หางานแล้ว */
  declinedByScope: { job: number; all: number };
  total: number;
};

function emptyTally(): CallResultTally {
  const byOutcome = {} as Record<CallResultOutcome, number>;
  for (const key of CALL_RESULT_OUTCOMES) byOutcome[key] = 0;
  return { byOutcome, declinedByScope: { job: 0, all: 0 }, total: 0 };
}

/**
 * สรุปผลโทร "ที่คนบันทึก" ตั้งแต่วันที่ระบุ (ตามปฏิทินกรุงเทพ)
 * ส่ง userId มา = เฉพาะของคนนั้น · ไม่ส่ง = ทั้งทีม
 *
 * นับจากตารางนี้เท่านั้น — ยอดของ AI อยู่ที่ lumos_dispatch_queue
 * หน้าเว็บเอาสองชุดมาต่อกันเป็น funnel เดียว (ศัพท์ outcome ตรงกันอยู่แล้ว)
 */
export async function tallyCallResultsSince(
  sinceYmd: string,
  userId?: string | null,
): Promise<CallResultTally> {
  const tally = emptyTally();
  try {
    const params: unknown[] = [`${sinceYmd}T00:00:00+07:00`];
    let userClause = '';
    if (userId) {
      params.push(userId);
      userClause = `and held_by_user_id = $${params.length}`;
    }
    const { rows } = await dbQuery<{ result_outcome: string; result_scope: string | null; n: string }>(
      `select result_outcome, result_scope, count(*)::text as n
         from ${table}
        where result_outcome is not null
          and updated_at >= $1::timestamptz
          ${userClause}
        group by result_outcome, result_scope`,
      params,
    );
    for (const r of rows) {
      if (!isCallResultOutcome(r.result_outcome)) continue;
      const n = Number(r.n) || 0;
      tally.byOutcome[r.result_outcome] += n;
      tally.total += n;
      if (r.result_outcome === 'declined') {
        if (r.result_scope === 'all') tally.declinedByScope.all += n;
        else tally.declinedByScope.job += n;
      }
    }
  } catch (e) {
    if (isPgUndefinedTable(e)) return tally;
    throw e;
  }
  return tally;
}

/**
 * โอนล็อกให้คนอื่น (หัวหน้าใช้) — ปล่อยแถวเดิมเป็น 'transferred' แล้วสร้างแถวใหม่ให้คนรับ
 *
 * ทำเป็น 2 แถวไม่ใช่ update ผู้ถือ เพื่อให้ timeline เห็นว่าเคยอยู่มือใครมาก่อน
 * นับอายุใหม่ 1 วันจากตอนโอน — คนรับควรได้เวลาเต็ม ไม่ใช่รับเศษเวลาของคนเดิม
 */
export async function transferCallHold(input: {
  holdId: string;
  toUserId: string;
  toName: string | null;
}): Promise<CallHold | null> {
  const current = await getCallHoldById(input.holdId);
  if (!current || current.releasedAt) return null;

  await dbQuery(
    `update ${table}
        set released_at = now(), release_reason = 'transferred', updated_at = now()
      where id = $1 and released_at is null`,
    [input.holdId],
  );

  const { rows } = await queryHolds(
    (c) => `insert into ${table}
       (phone_e164, source, candidate_ref, candidate_name, job_id, request_no,
        held_by_user_id, held_by_name, expires_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8, now() + interval '1 day')
     returning ${c}`,
    [
      current.phone,
      current.source,
      current.candidateRef,
      current.candidateName,
      current.jobId,
      current.requestNo,
      input.toUserId,
      input.toName,
    ],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

/**
 * เทกองของคนคนหนึ่งทั้งหมด (หัวหน้าใช้ตอนลูกทีมลาป่วย/ลาออก)
 * `to_ai` = คืนให้ AI โทรต่อ · `manual` = คืนเข้าถังกลางให้คนอื่นกดรับ
 * คืนจำนวนที่ปล่อยจริง
 */
export async function releaseAllCallHoldsForUser(
  userId: string,
  reason: 'manual' | 'to_ai',
): Promise<number> {
  try {
    const { rows } = await dbQuery<{ id: string }>(
      `update ${table}
          set released_at = now(), release_reason = $2, updated_at = now()
        where held_by_user_id = $1 and released_at is null
        returning id`,
      [userId, reason],
    );
    return rows.length;
  } catch (e) {
    if (isPgUndefinedTable(e)) return 0;
    throw e;
  }
}

/** ล็อกเดียวด้วย id — ใช้เช็คสิทธิ์ก่อนบันทึกผล/คืนงาน */
export async function getCallHoldById(id: string): Promise<CallHold | null> {
  try {
    const { rows } = await queryHolds((c) => `select ${c} from ${table} where id = $1`, [id]);
    return rows[0] ? mapRow(rows[0]) : null;
  } catch (e) {
    if (isPgUndefinedTable(e)) return null;
    throw e;
  }
}
