/**
 * หน้าหลัก (เจ้าของ 30 ต.ค. 2569 "แยกให้ชัดเจนหน่อย" · "เอาสมการไว้")
 * 9 พ.ย. 2569 เจ้าของเลือกแบบร่าง A "หัวกรมท่า" หลัง "บ้านนอกคอกนาสุดๆ":
 * แถบกรมท่าบนสุด → ใบขอ → ผู้สมัคร · หัวเรื่องคอลัมน์ซ้ายถอดแล้ว
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('หน้าหลัก แบบ A หัวกรมท่า', () => {
  const page = readFileSync('src/pages/HomeOverviewPage.tsx', 'utf8');
  const parts = readFileSync('src/components/home-overview/OverviewParts.tsx', 'utf8');
  it('แถบกรมท่า → ใบขอ → ผู้สมัคร · เหลือหาตัวใหญ่ขึ้นก่อน', () => {
    const order = ['data-testid="overview-kpis"', 'testId="overview-kpi-remain"', 'testId="overview-kpi-money"', 'testId="overview-requests"', 'testId="overview-funnel"'].map((s) =>
      page.indexOf(s),
    );
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(page).toContain('bg-foreground');
    expect(page).toContain('variant="hero"');
  });
  it('หัวเรื่องคอลัมน์ซ้ายถอดหมด (ถอด = เอาออกให้หมด)', () => {
    expect(page).not.toContain('OverviewGroup');
    expect(parts).not.toContain('OverviewGroup');
    expect(parts).not.toContain("'kpi'");
  });
  it('ผลลัพธ์ของสมการพื้นเบอร์กันดีจากตัวแปรธีม ไม่ใช่ hex', () => {
    expect(parts).toContain("variant === 'solid' && 'bg-primary text-primary-foreground");
    expect(parts).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
  it('สมการใต้การ์ดยังอยู่ครบ (เจ้าของ "เอาสมการไว้")', () => {
    expect(page).toContain('data-testid="overview-req-sum"');
    expect(page).toContain('= เหลือหา ${NUM.format(flow.remainingRequests)} ใบ');
    // การ์ดประกาศย้ายไปหน้าภาพรวม (สมการตามไปด้วย · ReleaseProgressCard)
    expect(readFileSync('src/components/dashboard-trends/stuck/ReleaseProgressCard.tsx', 'utf8')).toContain('data-testid="release-sum"');
  });
});
