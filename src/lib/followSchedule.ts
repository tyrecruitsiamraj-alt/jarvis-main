/**
 * ═══ ถังตามเวลานัดของหน้าติดตาม — นิยามเดียวกับที่หน้าแรกใช้ ═══
 *
 * 🔴 **ทำไมถึงต้องมี** (audit มุมพนักงานใหม่ 26 ส.ค. 2569):
 * หน้าแรกขึ้นพาดหัวว่า *"โทรติดตามที่เลยเวลานัดแล้ว N ราย"* พร้อมปุ่มใหญ่
 * "เปิดหน้าติดตาม" — กดแล้วมาถึงหน้านี้ **ซึ่งไม่มีคำว่า "เลยเวลานัด" อยู่เลยสักที่**
 * แถมกล่องรอบที่ 1 ยังเขียนว่า *"ไม่มีของค้าง"* ⇒ งานด่วนที่สุดของวันหายไปตรงปลายทาง
 * (จุดที่ทำร้ายคนใหม่หนักที่สุดจากทั้งหมด 9 จุดที่วัดได้)
 *
 * 🔴 **นิยามต้องตรงกับ `FOLLOW_SQL` ใน `api/_handlers/office-floor.ts` เป๊ะ**
 * ไม่งั้นหน้าแรกกับหน้านี้จะเถียงกันอีกรอบ:
 * - `today`    = ยังไม่ยกเลิก **และ** เวลานัดอยู่ในวันนี้ (ถึงยังไม่ถึงเวลาก็นับ)
 * - `pastDue`  = ยังไม่ยกเลิก **และ** เวลานัดผ่านมาแล้ว **และ** ยังไม่มีผลการโทรกลับ
 * - `upcoming` = ยังไม่ยกเลิก **และ** เวลานัดเป็นอนาคต
 * ⚠️ `today` กับ `pastDue` **ซ้อนกันได้** (นัดตอนเช้าวันนี้แล้วเลยเวลา นับทั้งสองช่อง)
 *    — ตั้งใจให้ตรงกับ SQL เดิม · จอต้องเขียนกำกับ ไม่ใช่ปล่อยให้คนบวกเอง
 * ⚠️ "มีผลแล้ว" ฝั่งนี้อ่านจาก `call_outcome` ซึ่ง API ประกอบมาด้วย
 *    `coalesce(last_outcome, result->>'outcome')` แล้ว — ตรงกับ `_lib/lumosQueueDefs`
 */
import type { FollowEntry } from '@/lib/followApi';

export type FollowScheduleCounts = {
  today: number;
  pastDue: number;
  upcoming: number;
};

/** เวลานัดที่อ่านได้จริง — `null`/ค่าเสียถือว่า "ไม่ได้ตั้งเวลา" ไม่ตกถังไหนเลย */
function scheduledMs(entry: FollowEntry): number | null {
  if (!entry.scheduled_at) return null;
  const ms = new Date(entry.scheduled_at).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** มีผลการโทรกลับมาแล้วหรือยัง — ว่าง/`null` = ยังไม่มี */
function hasResult(entry: FollowEntry): boolean {
  return Boolean(entry.call_outcome);
}

export function followScheduleCounts(
  entries: readonly FollowEntry[],
  now: Date = new Date(),
): FollowScheduleCounts {
  const nowMs = now.getTime();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayStartMs = dayStart.getTime();
  const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;

  let today = 0;
  let pastDue = 0;
  let upcoming = 0;
  for (const e of entries) {
    if (e.cancelled) continue;
    const at = scheduledMs(e);
    if (at === null) continue;
    if (at >= dayStartMs && at < dayEndMs) today += 1;
    if (at < nowMs && !hasResult(e)) pastDue += 1;
    if (at > nowMs) upcoming += 1;
  }
  return { today, pastDue, upcoming };
}
