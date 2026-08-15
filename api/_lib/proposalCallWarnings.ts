/**
 * ธงเตือนบนหน้าจองตัว — "คนนี้เพิ่งมีผลโทรว่าไม่สนใจ"
 *
 * ที่มา: ผลโทร (จาก AI และจากคน) ไม่เด้งสถานะการจองอัตโนมัติ **โดยตั้งใจ**
 * (auto-ยกเลิกจองจากผลโทรเสี่ยงเกิน — เบอร์ผิด/คนละคนก็มี · กติกาข้อ 8 fail-safe)
 * แต่คนดูหน้าจองตัวต้องเห็นว่ามีสัญญาณนี้อยู่ แล้วตัดสินใจกดโยนกลับเอง
 *
 * คีย์คือเบอร์ E.164 เหตุผลเดียวกับล็อกโทร/ประวัติติดต่อ: คนเดียวมีหลาย ref
 * แหล่งผลโทรมี 2 ที่ — candidate_call_holds (คนโทรเอง) + lumos_dispatch_queue (AI)
 */
import { dbQuery, isPgUndefinedTable } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { toE164Thai } from './thaiPhone.js';

const holdsTable = tableInAppSchema('candidate_call_holds');
const queueTable = tableInAppSchema('lumos_dispatch_queue');

export type ProposalCallWarning = {
  /** ผลล่าสุดของเบอร์นี้ที่เป็นเชิงลบ — ตอนนี้สนใจเฉพาะ declined */
  outcome: 'declined';
  /** job = ไม่เอางานนี้ · all = ไม่หางานแล้ว (แรงกว่า) · null = ฝั่ง AI ไม่มี scope */
  scope: 'job' | 'all' | null;
  /** เวลาไว้เทียบกับเวลาจอง — หน้าเว็บโชว์เฉพาะผลที่ใหม่กว่าการจอง */
  at: string;
  /** ใครเป็นคนได้ผลนั้น (ฝั่งคน) — ฝั่ง AI เป็น null */
  byName: string | null;
};

/**
 * ผล "ไม่สนใจ" ล่าสุดต่อเบอร์ — คิวรีละแหล่ง ไม่วนต่อแถว (แถวจองมีได้หลายสิบ)
 * ตารางไหนยังไม่ migrate = ข้ามแหล่งนั้นเฉย ๆ (ธงเป็นของแถม ห้ามทำให้ลิสต์จองล้ม)
 */
export async function loadDeclinedCallWarnings(
  rawPhones: Array<string | null | undefined>,
): Promise<Map<string, ProposalCallWarning>> {
  const phones = [...new Set(rawPhones.map((p) => toE164Thai(p)).filter((p): p is string => Boolean(p)))];
  const out = new Map<string, ProposalCallWarning>();
  if (phones.length === 0) return out;

  const keep = (phone: string, w: ProposalCallWarning) => {
    const prev = out.get(phone);
    if (!prev || new Date(w.at).getTime() > new Date(prev.at).getTime()) out.set(phone, w);
  };

  // ฝั่งคน — ล็อกโทรที่บันทึกผล declined
  try {
    const { rows } = await dbQuery<{
      phone_e164: string;
      result_scope: string | null;
      held_by_name: string | null;
      released_at: string | null;
      held_at: string;
    }>(
      `select distinct on (phone_e164)
              phone_e164, result_scope, held_by_name, released_at, held_at
         from ${holdsTable}
        where phone_e164 = any($1::text[]) and result_outcome = 'declined'
        order by phone_e164, coalesce(released_at, held_at) desc`,
      [phones],
    );
    for (const r of rows) {
      keep(r.phone_e164, {
        outcome: 'declined',
        scope: r.result_scope === 'all' ? 'all' : r.result_scope === 'job' ? 'job' : null,
        at: r.released_at || r.held_at,
        byName: r.held_by_name,
      });
    }
  } catch (e) {
    if (!isPgUndefinedTable(e)) throw e;
  }

  // ฝั่ง AI — คิว Lumos (อ่าน outcome แบบ coalesce ตามกับดัก migration 070)
  try {
    // เบอร์อยู่คนละคีย์: reminder/board ใช้ recipient_phone · interview/iRecruit ใช้ phone
    // coalesce ทุกจุด (select/distinct on/where/order by) ไม่งั้นธงเตือน "เพิ่งปฏิเสธ"
    // มองไม่เห็นผลฝั่ง iRecruit → จองคนที่ปฏิเสธไปแล้ว
    const { rows } = await dbQuery<{ phone: string; updated_at: string }>(
      `select distinct on (coalesce(payload->>'recipient_phone', payload->>'phone'))
              coalesce(payload->>'recipient_phone', payload->>'phone') as phone, updated_at
         from ${queueTable}
        where coalesce(payload->>'recipient_phone', payload->>'phone') = any($1::text[])
          and coalesce(last_outcome, result->>'outcome') = 'declined'
        order by coalesce(payload->>'recipient_phone', payload->>'phone'), updated_at desc`,
      [phones],
    );
    for (const r of rows) {
      if (!r.phone) continue;
      keep(r.phone, { outcome: 'declined', scope: null, at: r.updated_at, byName: null });
    }
  } catch (e) {
    if (!isPgUndefinedTable(e)) throw e;
  }

  return out;
}
