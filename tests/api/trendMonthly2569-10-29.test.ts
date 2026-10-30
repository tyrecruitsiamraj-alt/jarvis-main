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

describe('แนวโน้มใบขอ ช่วงทั้งหมด = เดือนละแท่งแบ่ง 4 สี (เจ้าของ 30 ต.ค. 2569 แบบร่าง "ทำเลย")', () => {
  const page = readFileSync('src/components/dashboard-trends/RecruitOverview.tsx', 'utf8');
  const card = readFileSync('src/components/dashboard-trends/TrendLinesCard.tsx', 'utf8');
  it('ส่วนของแท่ง = ปิดไปแล้ว · ยังไม่ประกาศ · ไม่มีคนสมัคร · มีคนสมัคร รวมกัน = ใบขอเข้ามา', () => {
    const at = page.indexOf('const REQUEST_STACK');
    const block = page.slice(at, page.indexOf('};', at));
    expect(block).toContain("total: 'total'");
    expect([...block.matchAll(/key: '(\w+)'/g)].map((m) => m[1])).toEqual(['notReleasedClosed', 'notReleasedOpen', 'releasedNoApps', 'releasedWithApps']);
    expect(page).toContain('stack: REQUEST_STACK');
    expect(card).toContain('stackId="month"');
    expect(card).toContain('data-testid="trend-stack-legend"');
    expect(card).toContain('data-testid="trend-stack-sum"');
  });
  it('ช่วงทั้งหมดไม่เทียบ % ช่วงก่อน', () => {
    expect(card).toContain('{monthly ? null : (');
  });
});
