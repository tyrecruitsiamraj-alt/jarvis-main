/**
 * ช่วง "ทั้งหมด" กราฟแนวโน้มเป็นแท่งรายเดือน · กดเดือน = เส้นรายวันของเดือนนั้น
 * (เจ้าของ 29 ต.ค. 2569 "ถ้ากดทั้งหมดก็ให้ ขึ้นเป็นกราฟแท่ง เปรียบเทียบเป็นรายเดือน … ไม่งั้นยาวเกินไปไม่สวย")
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('กราฟแนวโน้ม ช่วงทั้งหมด', () => {
  it('ภาพรวมส่ง monthly เมื่อเลือกทั้งหมด · การ์ดมีแท่งรายเดือน ปุ่มเดือน และปุ่มกลับ', () => {
    expect(readFileSync('src/components/dashboard-trends/RecruitOverview.tsx', 'utf8')).toContain('monthly={Boolean(win.all)}');
    const card = readFileSync('src/components/dashboard-trends/TrendLinesCard.tsx', 'utf8');
    expect(card).toContain('data-testid="trend-months"');
    expect(card).toContain('data-testid="trend-month"');
    expect(card).toContain('data-testid="trend-back-months"');
    expect(card).toContain("String(d.day).startsWith(month)");
  });
});
