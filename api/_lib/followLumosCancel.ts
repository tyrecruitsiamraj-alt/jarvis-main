/**
 * ═══ ยกเลิกแผนติดตามที่ Lumos — **ห้ามยกเลิกแผนที่จบไปแล้วซ้ำ** (เจ้าของ 9 ต.ค. 2569 "ถ้ามันผิดที่เราก็ต้องแก้ที่เรา") ═══
 *
 * เคสจริง 9 ต.ค. 2569 — Lumos ขึ้น "ยกเลิก" แต่ฐานเรายัง "รอโทร" ทั้ง 3 เคส มีจังหวะเดียวกัน:
 *   ส่ง DELETE รหัสแผนที่ **จบไปแล้ว** (ตอบไม่ไป / เคยยกเลิกไปแล้ว) ⇒ แผนใหม่ที่ยังวิ่งอยู่ของ **เบอร์เดียวกัน** ถูกยกเลิกตาม
 *   - อิทธิชัย: DELETE แผนวันที่ 8 (ตายแล้ว) → แผนวันที่ 9 หาย
 *   - ณัฐพล: DELETE แผนวันที่ 8 (ตายตั้งแต่ตอบไม่ไป 5 ต.ค.) → แผนวันที่ 9 หาย
 *   - สมชัย: DELETE แผนเก่าที่เพิ่งยกเลิกไป 8 วินาทีก่อน (รหัสค้างอยู่ที่แถวสาย 07:45) → แผน 07:00 หาย
 *   ยกเลิกแผนที่ยังวิ่งอยู่ ไม่เคยพลาด (ยกเลิกตรงแผน) — พังเฉพาะยกเลิกแผนที่จบแล้วซ้ำ
 *
 * ⇒ ทุกคำสั่งยกเลิกแผนติดตามผ่านตัวนี้ตัวเดียว:
 *   ข้าม (ไม่ส่ง) เมื่อ ① หัวขบวนของแผนถูกทำเครื่องหมายว่าจบแล้ว (`lumos_plan_closed_at` · migration 141)
 *                    หรือ ② ทุกสายในแผนได้ผลครบแล้ว (completed/failed — Lumos โทรจบแผนแล้ว)
 *   ส่งแล้ว (สำเร็จ/404) ⇒ ทำเครื่องหมายว่าจบ · ส่งแผนรหัสเดิมใหม่ ⇒ `recordPushAck` ล้างเครื่องหมาย
 * 🔴 ยังไม่ migrate 141 = ทำแบบเดิม (ส่งทุกครั้ง) · อ่านฐานไม่ได้อย่างอื่น = ส่งตามเดิม (ไม่ยกเลิกเลยแย่กว่า: คนที่ยกเลิกแล้วโดนโทร)
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { cancelPushedReminder } from './lumosPushClient.js';
import { logInfo, logWarn } from './logger.js';

const queueTable = tableInAppSchema('lumos_dispatch_queue');

function isUndefinedColumn(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42703';
}

export type FollowPlanCancelOutcome = 'cancelled' | 'missing' | 'skipped_closed';

/** แผนนี้จบที่ Lumos แล้วหรือยัง — `null` = ตอบไม่ได้ (ยังไม่ migrate) */
export async function isFollowPlanClosed(ref: string): Promise<boolean | null> {
  try {
    const { rows } = await dbQuery<{ closed: boolean }>(
      `select (
          exists (
            select 1 from ${queueTable} l
             where l.channel = 'reminder' and l.job_ref = 'follow'
               and l.person_ref = $1 and l.lumos_plan_closed_at is not null)
          or (
            exists (
              select 1 from ${queueTable} y
               where y.channel = 'reminder' and y.job_ref = 'follow'
                 and coalesce(y.plan_ref, y.person_ref) = $1)
            and not exists (
              select 1 from ${queueTable} y
               where y.channel = 'reminder' and y.job_ref = 'follow'
                 and coalesce(y.plan_ref, y.person_ref) = $1
                 and y.status not in ('completed', 'failed'))
          )
        ) as closed`,
      [ref],
    );
    return rows[0]?.closed === true;
  } catch (e) {
    if (isUndefinedColumn(e)) return null;
    logWarn('lumos.follow.cancel: อ่านสถานะแผนไม่ได้ — ส่งยกเลิกตามเดิม', { ref, reason: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

/** ทำเครื่องหมายว่าแผนจบที่ Lumos แล้ว (ที่แถวหัวขบวน) — กลืน error (ไม่ให้งานหลักล้ม) */
export async function markFollowPlansClosed(refs: readonly string[]): Promise<void> {
  if (refs.length === 0) return;
  try {
    await dbQuery(
      `update ${queueTable} set lumos_plan_closed_at = now()
        where channel = 'reminder' and job_ref = 'follow' and person_ref = any($1::text[])`,
      [[...refs]],
    );
  } catch (e) {
    if (!isUndefinedColumn(e)) {
      logWarn('lumos.follow.cancel: จดว่าแผนจบไม่สำเร็จ', { refs, reason: e instanceof Error ? e.message : String(e) });
    }
  }
}

/**
 * ยกเลิกแผนติดตามที่ Lumos (รหัสแผน = รหัสหัวขบวน) — แผนที่จบแล้วไม่ส่ง · 404 = ไม่มีของค้าง (ถือว่าสำเร็จ)
 * error อื่นโยนต่อ (ผู้เรียกตัดสินว่าจะส่งแผนใหม่ต่อไหม)
 */
export async function cancelFollowPlanAtLumos(ref: string): Promise<FollowPlanCancelOutcome> {
  if ((await isFollowPlanClosed(ref)) === true) {
    logInfo('lumos.follow.cancel.skipClosed', { ref });
    return 'skipped_closed';
  }
  let outcome: FollowPlanCancelOutcome = 'cancelled';
  try {
    await cancelPushedReminder(ref);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/404|not found/i.test(msg)) throw e;
    outcome = 'missing';
  }
  await markFollowPlansClosed([ref]);
  return outcome;
}
