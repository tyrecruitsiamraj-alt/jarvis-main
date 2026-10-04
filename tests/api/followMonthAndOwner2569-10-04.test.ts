/**
 * หน้าการติดตาม (เจ้าของ 4 ต.ค. 2569):
 *  1) ป๊อปแก้ไข "เพิ่มสาย" เคยได้แค่ 5 → ลงได้ทั้งเดือน (เพิ่มเป็นช่วงวัน วันละ 1 สาย)
 *  2) ตัวกรอง "เจ้าของงาน" = เจ้าหน้าที่ที่ติดตาม (staff_phone) — เห็นทุกรายชื่อที่คนนั้นลงแผน
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EXTRA_RANGE_MAX_DAYS, EXTRA_ROUNDS_MAX, extraRangeInputs } from '@/lib/followExtraRounds';
import { FOLLOW_STAFF_NONE, filterFollowEntries, followStaffKey, followStaffOptions } from '@/lib/followListFilter';
import type { FollowEntry } from '@/lib/followApi';

describe('เพิ่มเป็นช่วงวัน', () => {
  it('ทั้งเดือน ต.ค. = 31 ช่อง วันละสาย ตามเวลาที่เลือก', () => {
    const out = extraRangeInputs('2026-10-01', '2026-10-31', '09:30');
    expect(out).toHaveLength(31);
    expect(out[0]).toBe('2026-10-01T09:30');
    expect(out[30]).toBe('2026-10-31T09:30');
  });
  it('ช่วงผิด/ว่าง = [] · ยาวเกินตัดที่ 31 วัน', () => {
    expect(extraRangeInputs('2026-10-05', '2026-10-01', '09:00')).toEqual([]);
    expect(extraRangeInputs('', '2026-10-01', '09:00')).toEqual([]);
    expect(extraRangeInputs('2026-10-01', '2026-12-31', '09:00')).toHaveLength(EXTRA_RANGE_MAX_DAYS);
  });
  it('🔴 ป๊อปแก้ไขไม่ล็อก 5 สายแล้ว', () => {
    expect(EXTRA_ROUNDS_MAX).toBeGreaterThanOrEqual(31);
    const src = readFileSync('src/components/follow/FollowEditDialog.tsx', 'utf8');
    expect(src).not.toMatch(/length >= 5/);
    expect(src).toContain('เพิ่มเป็นช่วงวัน');
  });
});

describe('ตัวกรองเจ้าของงาน (เจ้าหน้าที่ที่ติดตาม)', () => {
  const e = (id: string, staff: string | null) => ({ id, staff_phone: staff, scheduled_at: '2026-10-04T02:00:00Z' }) as unknown as FollowEntry;
  const rows = [e('a', '081-111-1111'), e('b', '0811111111'), e('c', '0822222222'), e('d', null)];
  it('🔴 คนเดียวหลายเบอร์ = แถวเดียว (จับด้วยชื่อ) · +66 = 0 · ไม่ระบุอยู่ท้าย · ไม่มีชื่อ = เบอร์', () => {
    const rows2 = [...rows, e('e', '+66833333333')];
    const nameOf = (p: string) => (p === '0811111111' || p === '0833333333' ? 'แบงค์' : null);
    expect(followStaffOptions(rows2, nameOf)).toEqual([
      { value: '0822222222', label: '0822222222', count: 1 },
      { value: 'name:แบงค์', label: 'แบงค์', count: 3 },
      { value: FOLLOW_STAFF_NONE, label: 'ไม่ระบุเจ้าหน้าที่', count: 1 },
    ]);
    expect(
      filterFollowEntries(rows2, { date: '', band: '', staff: 'name:แบงค์', staffNameOf: nameOf }).map((x) => x.id),
    ).toEqual(['a', 'b', 'e']);
  });
  it('กรองได้ทั้งคนและไม่ระบุ', () => {
    expect(filterFollowEntries(rows, { date: '', band: '', staff: '0811111111' }).map((x) => x.id)).toEqual(['a', 'b']);
    expect(filterFollowEntries(rows, { date: '', band: '', staff: FOLLOW_STAFF_NONE }).map((x) => x.id)).toEqual(['d']);
    expect(followStaffKey({ staff_phone: ' ' })).toBe(FOLLOW_STAFF_NONE);
  });
  it('หน้าการติดตามมีตัวเลือกเจ้าของงานข้างใครโทร', () => {
    const src = readFileSync('src/pages/follow/FollowPage.tsx', 'utf8');
    expect(src).toContain('ariaLabel="เจ้าของงาน"');
  });
});
