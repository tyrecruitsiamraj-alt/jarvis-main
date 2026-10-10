/**
 * "ติดตามครั้งที่" 1–7 + ขั้นที่มีชื่อ (เจ้าของ 9 ต.ค. 2569 *"ครั้งที่ 8-10 เปลี่ยนเป็น ประเมิน · เบิกเบี้ยเลี้ยง · เรียนงาน · ยกยอด"*)
 * 🔴 ด่าน: ชื่อเก็บเป็นรหัส 91–94 · เลข 8+ ของตารางยาวยังเป็น "วันที่ N" ไม่กลายเป็นชื่อ ·
 *    ชุดที่วันแรกเป็นขั้นมีชื่อ ทุกวันใช้ชื่อเดียว (ไม่นับต่อจนกลายเป็นขั้นถัดไป)
 */
import { describe, expect, it } from 'vitest';
import type { FollowEntry } from '@/lib/followApi';
import { followDayNoOptions, followDayNoText, followNamedDayLabel } from '@/lib/followDayNo';
import { followDayCallLabel, withFollowDayCalls } from '@/lib/followDayCall';

const at = (d: number, hh: number) => new Date(`2026-10-${String(d).padStart(2, '0')}T${String(hh).padStart(2, '0')}:00:00+07:00`).toISOString();
const row = (over: Partial<FollowEntry>): FollowEntry =>
  ({ id: 'x', group_id: 'g', scheduled_at: at(1, 9), call_round: null, cancelled: false, ...over }) as FollowEntry;

describe('followDayNo', () => {
  it('ตัวเลือก = 1–7 แล้ว ประเมิน · เบิกเบี้ยเลี้ยง · เรียนงาน · ยกยอด', () => {
    expect(followDayNoOptions().map((o) => o.label)).toEqual(['1', '2', '3', '4', '5', '6', '7', 'ประเมิน', 'เบิกเบี้ยเลี้ยง', 'เรียนงาน', 'ยกยอด']);
    expect(followDayNoOptions().map((o) => o.value).slice(7)).toEqual(['91', '92', '93', '94']);
  });
  it('ค่าปัจจุบันเป็นวันที่ 8+ ของตารางยาว ⇒ ใส่ไว้ในตัวเลือกด้วย (ช่องไม่ว่าง)', () => {
    expect(followDayNoOptions(12).map((o) => o.label)).toContain('12');
  });
  it('🔴 เลข 8–12 ยังเป็นเลข ไม่ใช่ชื่อขั้น', () => {
    expect(followNamedDayLabel(8)).toBeNull();
    expect(followDayNoText(10)).toBe('10');
    expect(followDayNoText(93)).toBe('เรียนงาน');
  });
  it('ป้ายบนรายการ: ขั้นที่มีชื่อขึ้นชื่อแทน "วันที่"', () => {
    expect(followDayCallLabel({ day: 92, call: 1 })).toBe('เบิกเบี้ยเลี้ยง · สายที่ 1');
    expect(followDayCallLabel({ day: 9, call: 2 })).toBe('ครั้งที่ 9 · สายที่ 2');
  });
  it('🔴 เลือกขั้นที่มีชื่อรายวัน (plan_day_no) ⇒ วันนั้นขึ้นชื่อ · วันอื่นเป็นเลขตามเดิม', () => {
    const rows = [
      row({ id: 'a', scheduled_at: at(1, 9), plan_day_no: 1 }),
      row({ id: 'b', scheduled_at: at(2, 9), plan_day_no: 91 }),
    ];
    const out = withFollowDayCalls(rows);
    expect(out.map((e) => followDayCallLabel({ day: e.call_day, call: e.call_of_day }))).toEqual([
      'ครั้งที่ 1 · สายที่ 1',
      'ประเมิน · สายที่ 1',
    ]);
  });
  it('🔴 วันแรกของชุดเป็นขั้นที่มีชื่อ (plan_day_start) ⇒ ทุกวันใช้ชื่อนั้น ไม่นับต่อเป็นขั้นถัดไป', () => {
    const rows = [
      row({ id: 'a', scheduled_at: at(1, 9), plan_day_start: 93 }),
      row({ id: 'b', scheduled_at: at(2, 9), plan_day_start: 93 }),
    ];
    const out = withFollowDayCalls(rows);
    expect(out.map((e) => e.call_day)).toEqual([93, 93]);
  });
});
