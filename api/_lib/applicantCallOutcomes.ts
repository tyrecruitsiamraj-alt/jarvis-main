import { dbQuery, isPgUndefinedTable } from './postgres.js';
import { toE164Thai } from './thaiPhone.js';
import { tableInAppSchema } from './schema.js';
import { LATEST_AI_RESULT_LATERAL } from './applicantOverviewSql.js';
import { INTEREST_VOCAB, classifyCallMicro, type CallMicroOutcome } from '../../src/lib/callMicroOutcome.js';

/**
 * ผลโทรล่าสุดของ "หลายเบอร์" ในคิวรีเดียว — ใช้ทำแท็บ "รายชื่อที่สนใจ" ของกล่องงาน
 * (เจ้าของเคาะ 13 ส.ค. 2569: ที่สนใจ = คนที่ตอบสนใจ **ตอนโทร** ไม่ใช่สถานะใบสมัคร)
 *
 * ⚠️ **คีย์คือเบอร์ E.164 ไม่ใช่ id** — คนคนเดียวมีหลายรหัสตามต้นทาง (ใบสมัคร / บอร์ด /
 * iRecruit) แต่เบอร์ที่ดังมีเบอร์เดียว · กติกาเดียวกับล็อก "รับไปโทรเอง"
 *
 * ⚠️ **ต้องรวมสองแหล่ง**: ผลจาก AI (คิว Lumos) กับผลที่ **คน** บันทึกหลังโทรเอง
 * (candidate_call_holds) — ดูแค่แหล่งเดียวจะตกหล่นครึ่งหนึ่งของงานจริง
 * และอ่าน outcome ของคิวด้วย `coalesce(last_outcome, result->>'outcome')` เสมอ
 * (ผลที่คนบันทึกเขียนแค่ last_outcome · ตอนตั้งโทรซ้ำระบบล้าง result ทิ้ง)
 */

export type ApplicantCallOutcome = { outcome: string | null; at: string | null };

/** ชื่อคีย์เบอร์ใน payload ต่างกันตามช่อง — ชุดเดียวกับ PAYLOAD_PHONE_KEYS ใน lumosDispatch */
const QUEUE_PHONE_EXPR = `coalesce(payload->>'recipient_phone', payload->>'phone')`;

export async function loadLatestCallOutcomeByPhone(
  phones: Array<string | null | undefined>,
): Promise<Map<string, ApplicantCallOutcome>> {
  const keys = [...new Set(phones.map((p) => toE164Thai(p || '')).filter((p): p is string => !!p))];
  const out = new Map<string, ApplicantCallOutcome>();
  if (keys.length === 0) return out;

  const take = (phone: string, outcome: string | null, at: string | null) => {
    if (!outcome || !at) return;
    const prev = out.get(phone);
    // ผลล่าสุดชนะ — เทียบเวลาเสมอ ไม่ใช่ "แหล่งไหนมาก่อน" (คนกับ AI ส่งไม้ต่อกันได้)
    if (!prev || !prev.at || at > prev.at) out.set(phone, { outcome, at });
  };

  // ฝั่ง AI — คิว Lumos
  try {
    const { rows } = await dbQuery<{ phone: string; outcome: string | null; at: string }>(
      `select ${QUEUE_PHONE_EXPR} as phone,
              coalesce(last_outcome, result->>'outcome') as outcome,
              updated_at as at
         from lumos_dispatch_queue
        where ${QUEUE_PHONE_EXPR} = any($1::text[])
          and coalesce(last_outcome, result->>'outcome') is not null`,
      [keys],
    );
    for (const r of rows) take(r.phone, r.outcome, r.at);
  } catch (e) {
    // ตารางยังไม่ migrate = ไม่มีผลจาก AI ให้แสดง ไม่ใช่เหตุให้ทั้งลิสต์พัง
    if (!isPgUndefinedTable(e)) throw e;
  }

  // ฝั่งคน — ผลที่บันทึกหลังโทรเอง
  try {
    const { rows } = await dbQuery<{ phone: string; outcome: string | null; at: string }>(
      // ⚠️ ตารางนี้ไม่มีคอลัมน์ "เวลาที่บันทึกผล" แยกต่างหาก — `updated_at` ขยับตอนบันทึกผล
      // จึงเป็นตัวแทนที่ใกล้ที่สุด (ถอยไป held_at ถ้าค่าเพี้ยน)
      `select phone_e164 as phone, result_outcome as outcome,
              coalesce(updated_at, released_at, held_at) as at
         from candidate_call_holds
        where phone_e164 = any($1::text[]) and result_outcome is not null`,
      [keys],
    );
    for (const r of rows) take(r.phone, r.outcome, r.at);
  } catch (e) {
    if (!isPgUndefinedTable(e)) throw e;
  }

  return out;
}

/**
 * ═══ สถานะสายล่าสุดของ "หลายเบอร์" (21 ก.ย. 2569) ═══
 *
 * เจ้าของสั่งให้แท็บ "รายชื่อ" ในกล่องงาน *"บอกสถานะว่า กำลังโทร โทรแล้ว หรืออะไรต่าง ๆ
 * รายงานแบบหน้าการติดตาม"*
 *
 * ต่างจาก `loadLatestCallOutcomeByPhone` ตรงที่ตัวนั้นเอาเฉพาะแถวที่ **มีผลแล้ว**
 * ⇒ คนที่ยังอยู่ในคิว/AI เพิ่งรับไปโทร จะไม่มีอะไรบอกเลย ซึ่งคือช่องที่เจ้าของทัก
 *
 * ⚠️ คีย์เป็นเบอร์ E.164 เหมือนกัน · แถวล่าสุดของเบอร์นั้นชนะ (เทียบ `updated_at`)
 */
export type ApplicantCallState = { status: string | null; at: string | null };

export async function loadLatestCallStateByPhone(
  phones: Array<string | null | undefined>,
): Promise<Map<string, ApplicantCallState>> {
  const keys = [...new Set(phones.map((p) => toE164Thai(p || '')).filter((p): p is string => !!p))];
  const out = new Map<string, ApplicantCallState>();
  if (keys.length === 0) return out;

  try {
    const { rows } = await dbQuery<{ phone: string; status: string | null; at: string }>(
      `select distinct on (${QUEUE_PHONE_EXPR})
              ${QUEUE_PHONE_EXPR} as phone, status, updated_at as at
         from lumos_dispatch_queue
        where ${QUEUE_PHONE_EXPR} = any($1::text[])
        order by ${QUEUE_PHONE_EXPR}, updated_at desc`,
      [keys],
    );
    for (const r of rows) out.set(r.phone, { status: r.status, at: r.at });
  } catch (e) {
    // ตารางยังไม่ migrate = ไม่มีสถานะให้แสดง ไม่ใช่เหตุให้ทั้งลิสต์พัง
    if (!isPgUndefinedTable(e)) throw e;
  }
  return out;
}

/**
 * วันนัดสัมภาษณ์ล่าสุดของ "หลายเบอร์" — แท็บติดตามนัดหมายใช้ตัวนี้
 *
 * ⚠️ **จงใจไม่อ่านจาก `candidate_interviews`** — ตารางนั้นผูกด้วย `candidate_id`
 * (ตาราง `candidates` ซึ่งบนฐานมีแถวเดียว) ส่วนแถวในแท็บคือ **ใบสมัคร** ที่ไม่มี
 * คอลัมน์ `candidate_id` เลย ต่อกันไม่ได้จริง ๆ · วันนัดจึงเก็บที่แถวผลโทร
 * (migration 085) แล้วจับคู่ด้วยเบอร์ เหมือนผลโทรด้านบน
 *
 * ⚠️ คีย์เป็นเบอร์ **ไม่ใช่ id ใบสมัคร** — คนเดียวถูกดึงไปโทรได้จากหลายต้นทาง
 * (source `application` / `board` / `irecruit`) นัดที่เกิดจากต้นทางไหนก็ต้องเห็น
 */
export async function loadAppointmentByPhone(
  phones: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const keys = [...new Set(phones.map((p) => toE164Thai(p || '')).filter((p): p is string => !!p))];
  const out = new Map<string, string>();
  if (keys.length === 0) return out;

  try {
    const { rows } = await dbQuery<{ phone: string; at: string }>(
      `select phone_e164 as phone, appointment_at as at
         from candidate_call_holds
        where phone_e164 = any($1::text[]) and appointment_at is not null`,
      [keys],
    );
    // นัดล่าสุดชนะ — นัดใหม่ทับนัดเก่าเสมอ (เลื่อนนัดคือเรื่องปกติของงานนี้)
    for (const r of rows) {
      const prev = out.get(r.phone);
      if (!prev || r.at > prev) out.set(r.phone, r.at);
    }
  } catch (e) {
    // ตาราง/คอลัมน์ยังไม่ migrate = ยังไม่มีวันนัดให้แสดง ไม่ใช่เหตุให้ทั้งลิสต์พัง
    if (!isPgUndefinedTable(e) && !isUndefinedColumn(e)) throw e;
  }

  return out;
}

/** 42703 undefined_column — ยังไม่รัน migration 085 (กติกาข้อ 9: กลืนเฉพาะเคสนี้) */
function isUndefinedColumn(e: unknown): boolean {
  return (
    typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42703'
  );
}

/**
 * ═══ คำตอบล่าสุดที่ผู้สมัครตอบ AI ต่อใบ — แท็บผู้สมัครคอลัมน์ "คำตอบกับ AI" (เจ้าของสั่ง 30 ก.ย. 2569) ═══
 *
 * > *"ตรงรายชื่อ โชว์ … คำตอบที่ตอบกับ Ai มา"* → Choice "ผลสั้น ๆ + วันที่โทร"
 * 🔴 หลักฐานชุดเดียวกับแผงผลโทรหน้าหลัก (`LATEST_AI_RESULT_LATERAL` — คิวของใบ + เบอร์เดียวกันหลังกรอกใบ) ·
 *    จัดถังด้วยคลังคำ "ถามความสนใจ" (`classifyCallMicro` + `INTEREST_VOCAB`) ตัวเดียวกัน ⇒ คำบนตารางตรงกับหน้าหลัก
 * 🔴 สรุป/ถอดเสียงใช้จัดถังในนี้เท่านั้น — ส่งออกแค่ถังกับเวลา
 * คีย์ = id ใบสมัคร (ไม่ใช่เบอร์ — คำตอบเป็นของใบนี้ ไม่ใช่ของเลนอื่นก่อนกรอกใบ)
 */
export type ApplicantAiAnswer = { micro: CallMicroOutcome; at: string | null };

export async function loadLatestAiAnswerByApplication(ids: readonly string[]): Promise<Map<string, ApplicantAiAnswer>> {
  const out = new Map<string, ApplicantAiAnswer>();
  const keys = [...new Set(ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)))];
  if (keys.length === 0) return out;
  try {
    const { rows } = await dbQuery<{
      id: string;
      outcome: string | null;
      summary: string | null;
      reply: string | null;
      at: string | Date | null;
    }>(
      `select a.id::text as id, air.outcome, air.summary, air.reply, air.at
         from ${tableInAppSchema('public_job_applications')} a
         ${LATEST_AI_RESULT_LATERAL}
        where a.id = any($1::uuid[]) and air.outcome is not null`,
      [keys],
    );
    for (const r of rows) {
      const micro = classifyCallMicro({ outcome: r.outcome, summary: r.summary, reply: r.reply }, INTEREST_VOCAB);
      if (!micro) continue; // จัดถังไม่ได้ = ไม่ขึ้นคำตอบ (ห้ามเดา) — ตารางถอยไปบอกสถานะคิว
      const at = r.at ? new Date(r.at) : null;
      out.set(r.id, { micro, at: at && !Number.isNaN(at.getTime()) ? at.toISOString() : null });
    }
  } catch (e) {
    // ตารางคิวยังไม่ migrate = ไม่มีคำตอบให้แสดง ไม่ใช่เหตุให้ทั้งลิสต์พัง
    if (!isPgUndefinedTable(e)) throw e;
  }
  return out;
}
