/**
 * หน้าหลัก แยก 3 เรื่องให้ชัด (เจ้าของ 30 ต.ค. 2569 "มันดูกลมกลืน … แยกให้ชัดเจนหน่อย" → เลือกแบบร่าง A · "เอาสมการไว้")
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('หน้าหลัก แบบ A', () => {
  const page = readFileSync('src/pages/HomeOverviewPage.tsx', 'utf8');
  it('เรื่องเรียง ใบขอ → ผู้สมัคร มีหัวเรื่องนอกการ์ด (9 พ.ย. 2569 หลังได้คนย้ายไปหน้าติดตาม)', () => {
    expect(page).not.toContain('<OverviewGroup no={3} title="หลังได้คน"');
    const order = ['<OverviewGroup no={1} title="ใบขอ"', '<OverviewGroup no={2} title="ผู้สมัคร"'].map((s) => page.indexOf(s));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const parts = readFileSync('src/components/home-overview/OverviewParts.tsx', 'utf8');
    // แบบร่าง B (เจ้าของเลือก 2 พ.ย. 2569): หัวเรื่องคอลัมน์ซ้าย เนื้อหา 4 ส่วน
    expect(parts).toContain('lg:grid-cols-5');
    expect(parts).toContain('lg:col-span-4');
  });
  it('สมการใต้การ์ดยังอยู่ครบ (เจ้าของ "เอาสมการไว้")', () => {
    expect(page).toContain('data-testid="overview-req-sum"');
    expect(page).toContain('= เหลือหา ${NUM.format(flow.remainingRequests)} ใบ');
    // การ์ดประกาศย้ายไปหน้าภาพรวม (สมการตามไปด้วย · ReleaseProgressCard)
    expect(readFileSync('src/components/dashboard-trends/stuck/ReleaseProgressCard.tsx', 'utf8')).toContain('data-testid="release-sum"');
  });
});
