import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// เจ้าของ 28 ต.ค. 2569 "เอาเป็นตัวเลขให้เลือก มีไว้แค่นี้ — เดือน · วันที่เป็นตัวเลข · 7 วันล่าสุด 30 วันล่าสุด"
describe('ปุ่มช่วงเวลาภาพรวม = เดือน · ปฏิทินตัวเลข · 7/30 วันล่าสุด', () => {
  const src = readFileSync('src/components/dashboard-trends/RecruitOverview.tsx', 'utf8');
  it('มีปฏิทินตัวเลขในป๊อป + ปุ่ม 7 และ 30 วันล่าสุด', () => {
    expect(src).toContain('data-testid="recruit-days"');
    expect(src).toContain('mode="range"');
    expect(src).toContain('data-testid="recruit-last7"');
    expect(src).toContain('data-testid="recruit-last30"');
  });
  it('ถอด "เฉพาะวัน" จ.–อา. ออกหมด (UI + state)', () => {
    expect(src).not.toContain('recruit-weekdays');
    expect(src).not.toContain('setWeekdays');
    expect(src).not.toContain('DateRangeCalendarPicker\n');
    expect(readFileSync('src/lib/recruitJourney.ts', 'utf8')).not.toContain('filterByWeekdays');
  });
});
