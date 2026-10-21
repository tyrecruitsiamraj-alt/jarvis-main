/**
 * ═══ แก้ "ติดตามครั้งที่" ในป๊อปแก้ไข (เจ้าของ 21 ต.ค. 2569 "แก้ไขครั้งที่ติดตามไม่ได้อะ") ═══
 * เดิมป๊อปแก้ไขไม่อ่านค่าเดิม (ขึ้น 1 เสมอ) และตอนบันทึกไม่ส่งค่านี้ ⇒ เลือกแล้วไม่มีผล
 *
 * ช่องเดียว = ครั้งที่ของวันแรกในสายที่ยังแก้ได้ · เปลี่ยนแล้วขยับทุกวันไปเท่ากัน (ครั้งที่ 2,3 → เลือก 4 = 4,5)
 * เลือกขั้นที่มีชื่อ (ประเมิน/เบิกเบี้ยเลี้ยง/…) = ทุกสายเป็นขั้นนั้น (กติกาเดียวกับตอนเพิ่ม — ชื่อไม่นับต่อ)
 * ตรรกะล้วน (มีเทสต์)
 */
import { isFollowNamedDay } from './followDayNo';

export type EditDayBase = { ids: string[]; days: number[]; first: number };

/** ค่าเดิมของสายที่ยังแก้ได้ — `call_day` ที่หน้าจอโชว์อยู่ (ไม่มี = 1) */
export function editDayBaseOf(rows: ReadonlyArray<{ id: string; call_day?: number | null }>): EditDayBase {
  const days = rows.map((r) => (typeof r.call_day === 'number' && r.call_day >= 1 ? r.call_day : 1));
  return { ids: rows.map((r) => r.id), days, first: days[0] ?? 1 };
}

/** ค่าใหม่รายสายเมื่อเลือก `next` · ไม่เปลี่ยน/ไม่มีสาย = [] (ไม่ต้องส่ง) */
export function editDayNosOf(base: EditDayBase | null, next: number): Array<{ id: string; no: number }> {
  if (!base || base.ids.length === 0 || next === base.first) return [];
  if (isFollowNamedDay(next)) return base.ids.map((id) => ({ id, no: next }));
  const delta = next - base.first;
  return base.ids.map((id, i) => {
    const d = base.days[i];
    const no = isFollowNamedDay(d) ? next : d + delta;
    return { id, no: Math.min(99, Math.max(1, no)) };
  });
}
