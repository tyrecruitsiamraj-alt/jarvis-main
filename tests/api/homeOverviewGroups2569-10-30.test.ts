/**
 * หน้าหลัก แยก 3 เรื่องให้ชัด (เจ้าของ 30 ต.ค. 2569 "มันดูกลมกลืน … แยกให้ชัดเจนหน่อย" → เลือกแบบร่าง A · "เอาสมการไว้")
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('หน้าหลัก แบบ A', () => {
  const page = readFileSync('src/pages/HomeOverviewPage.tsx', 'utf8');
  it('3 เรื่องเรียง ใบขอ → ผู้สมัคร → หลังได้คน มีหัวเรื่องนอกการ์ด', () => {
    const order = ['<OverviewGroup no={1} title="ใบขอ"', '<OverviewGroup no={2} title="ผู้สมัคร"', '<OverviewGroup no={3} title="หลังได้คน"'].map((s) => page.indexOf(s));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const parts = readFileSync('src/components/home-overview/OverviewParts.tsx', 'utf8');
    expect(parts).toContain('border-b-2 border-foreground');
  });
  it('สมการใต้การ์ดยังอยู่ครบ (เจ้าของ "เอาสมการไว้")', () => {
    for (const id of ['overview-req-sum', 'overview-follow-people-sum', 'overview-follow-calls-sum']) expect(page).toContain(`data-testid="${id}"`);
    expect(page).toContain('= เหลือหา ${NUM.format(flow.remainingRequests)} ใบ');
    expect(page).toContain('ประกาศแล้ว ${NUM.format(req.released)} + ยังไม่ประกาศ');
  });
});
