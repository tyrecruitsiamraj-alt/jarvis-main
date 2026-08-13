import { dbQuery, isPgUndefinedTable } from './postgres.js';
import { toE164Thai } from './thaiPhone.js';

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
