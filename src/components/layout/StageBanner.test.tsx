/**
 * แถบบนหน้า (StageBanner) — 🔴 หน้าติดตามเหลือแค่ชื่อหน้า + "ต่อไป: …"
 * (เจ้าของสั่ง 1 ต.ค. 2569: *"เอาอิโมจิตรง ติดตาม … ออก คำนี้ก็เอาออก"* → Choice "เฉพาะหน้าติดตาม")
 * หน้าอื่นบนลำดับงานยังมีไอคอน + ประโยคอธิบายเหมือนเดิม
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StageBanner from './StageBanner';
import { CONVEYOR_STEPS } from '@/lib/soRecruitNav';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <StageBanner />
    </MemoryRouter>,
  );

describe('StageBanner', () => {
  it('🔴 หน้าติดตาม: ไม่มีไอคอน ไม่มีประโยค "ตามคนที่รับปากแล้ว…" · ยังมีชื่อหน้า + ต่อไป', () => {
    const { container } = renderAt('/follow?view=replace');
    expect(screen.getByText('ติดตามคนเริ่มงาน / ติดตามส่งคนแทน')).toBeTruthy();
    expect(screen.queryByText('ตามคนที่รับปากแล้ว จนถึงวันเริ่มงานจริง')).toBeNull();
    expect(screen.getByText(/ต่อไป: ดูแลหลังเริ่มงาน/)).toBeTruthy();
    // ไอคอนที่เหลือมีตัวเดียว = ลูกศรในลิงก์ "ต่อไป"
    expect(container.querySelectorAll('svg').length).toBe(1);
    expect(container.querySelector('a svg')).toBeTruthy();
  });

  it('หน้าอื่นยังมีไอคอน + ประโยคอธิบาย (เจ้าของเลือกเฉพาะหน้าติดตาม)', () => {
    const matching = CONVEYOR_STEPS.find((s) => s.key === 'matching')!;
    const { container } = renderAt(matching.path);
    expect(screen.getByText(matching.blurb)).toBeTruthy();
    expect(container.querySelectorAll('svg').length).toBe(2);
  });

  it('มีแค่หน้าติดตามที่เป็นแถบเปล่า · ประโยคของหน้าติดตามยังเก็บไว้ให้หน้าอื่นใช้', () => {
    expect(CONVEYOR_STEPS.filter((s) => s.bannerPlain).map((s) => s.key)).toEqual(['follow']);
    expect(CONVEYOR_STEPS.find((s) => s.key === 'follow')?.blurb.trim()).toBeTruthy();
  });
});
