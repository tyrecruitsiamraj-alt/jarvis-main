/**
 * หน้าภาพรวมโฉมใหม่วาดจริง (jsdom) — ใบติดตรงไหน · ติดที่ใคร · พื้นที่ · เทียบเดือน · เหตุผล · กดเลขแล้วมีรายการ/รายชื่อ
 * (4 พ.ย. 2569 — ทดสอบหน้าจอในเบราว์เซอร์ติดป๊อปอัปที่ปิดเองไม่ได้ จึงวาดด้วย jsdom ก่อน)
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { RecruitOverviewResponse } from '@/lib/recruitOverviewTypes';
import type { StuckRequest } from '@/lib/recruitStuck';

const fetchRecruitStuck = vi.fn();
vi.mock('@/lib/recruitStuckApi', () => ({ fetchRecruitStuck: (...a: unknown[]) => fetchRecruitStuck(...a) }));
const { default: RecruitStuckBody } = await import('./RecruitStuckBody');

afterEach(cleanup);
// jsdom ไม่มี ResizeObserver/scrollIntoView (ป๊อปเลือกเจ้าหน้าที่ · เลื่อนไปรายการ) — แบบเดียวกับ BoardPublishSheet.test
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView = () => {};

const counts = { apps: 0, aiCalled: 0, aiYes: 0, aiNo: 0, aiOutOfArea: 0, aiNoPickup: 0, aiOther: 0, staffCalled: 0, staffFollowed: 0, staffReached: 0, aiYesNoStaff: 0, interested: 0, notInterested: 0, appointed: 0, apptFailed: 0, showed: 0, noShow: 0, passed: 0, notPassed: 0, followStarts: 0, aftercare: 0 };
const row = (no: string, p: Partial<StuckRequest>): StuckRequest => ({
  requestNo: no, jobId: `siamraj-sql:${no}`, day: '2026-11-01', unitName: `หน่วย ${no}`, position: 'ขับรถ', siteCode: `S${no}`, siteName: `หน่วย ${no}`, sector: 'private',
  province: 'กรุงเทพมหานคร', district: 'ปทุมวัน', subdistrict: null, leadKind: null, subtype: null, requested: 1, filled: 0, cancelled: 0, remaining: 1,
  released: true, applications: 0, recruiter: 'แบงค์', ageDays: 5, bu: 'LBD', screener: null,
  signals: { released: true, links: 1, post: null, counts, uncalled: 0, queued: 0 }, reason: 'no_apps', releasedAt: null, releasedBy: null, ...p,
});
const REQS = [
  row('A', { reason: 'not_released', released: false, signals: { released: false, links: 0, post: null, counts, uncalled: 0, queued: 0 }, ageDays: 30 }),
  row('B', {}),
  row('C', { reason: 'staff_not_calling', recruiter: 'หมิว', province: 'ชลบุรี', district: 'ศรีราชา', signals: { released: true, links: 1, post: 'posted', counts: { ...counts, apps: 4, aiCalled: 4, aiYes: 2 }, uncalled: 0, queued: 0 } }),
];
const data = {
  version: 1, generatedAt: '2026-11-04T10:00:00Z', today: '2026-11-04', bu: null,
  window: { month: '2026-11', from: '2026-10-29', to: '2026-11-04', prevFrom: '2026-10-22', prevTo: '2026-10-28', isCurrent: true, range: true },
  firstDay: '2026-09-01', apps: [], backlog: null, staff: [], ai: null, attendanceEverRecorded: false, errors: {}, appJobs: {},
} as unknown as RecruitOverviewResponse;

const renderBody = () =>
  render(
    <MemoryRouter>
      <RecruitStuckBody data={data} win={data.window} onOpenNames={() => {}} onPickMonth={() => {}} />
    </MemoryRouter>,
  );

describe('หน้าภาพรวมโฉมใหม่', () => {
  it('6 ส่วนขึ้นครบ · 4 ช่วงรวมเท่าทั้งหมด · กดเหตุแล้วขึ้นรายการใบ · กดใบแล้วเห็นเส้นทาง + ขั้นที่ติด', async () => {
    fetchRecruitStuck.mockResolvedValue({ generatedAt: '', today: '2026-11-04', bu: null, requests: REQS, monthly: [{ month: '2026-10', jobId: 'siamraj-sql:A', requests: 2, apps: 5, booked: 1, informed: 0 }, { month: '2026-11', jobId: 'siamraj-sql:B', requests: 1, apps: 3, booked: 0, informed: 0 }], errors: {} });
    renderBody();
    expect((await screen.findByTestId('stuck-total')).textContent).toContain('3');
    const phases = screen.getByTestId('stuck-phases');
    const nums = ['before', 'uncalled', 'calling', 'closing'].map((k) => Number(within(phases).getByTestId(`stuck-phase-${k}`).textContent?.match(/\d+/)?.[0]));
    expect(nums).toEqual([2, 1, 0, 0]);
    for (const t of ['ติดที่ใคร', 'รายชื่อมาจากไหน ไปถึงไหน', 'พื้นที่ที่ยังต้องหา', 'เทียบเดือน', 'ทำไมไม่สำเร็จ']) expect(screen.getByText(t)).toBeTruthy();
    // กดเหตุ "ยังไม่ประกาศ" → รายการใบ 1 ใบ → กดใบ → เส้นทาง ขั้นที่ติด = ประกาศ
    fireEvent.click(screen.getByTestId('stuck-reason-not_released'));
    const list = await screen.findByTestId('stuck-list');
    expect(within(list).getAllByTestId('stuck-list-row')).toHaveLength(1);
    fireEvent.click(within(list).getByTestId('stuck-list-row'));
    const steps = await screen.findByTestId('stuck-steps');
    expect(steps.querySelectorAll('[data-stuck="1"]')).toHaveLength(1);
    expect(steps.querySelector('[data-stuck="1"]')?.textContent).toContain('ประกาศ');
    // ติดที่ใคร: แบงค์ 2 · หมิว 1 · กดเลขของหมิว → รายการใบของหมิว
    const owners = screen.getByTestId('stuck-owners');
    expect(within(owners).getAllByTestId('stuck-owner-row').map((r) => [r.querySelector('td')?.textContent, r.querySelectorAll('td')[1]?.textContent])).toEqual([
      ['แบงค์', '2'],
      ['หมิว', '1'],
    ]);
    // พื้นที่: กรุงเทพ 2 · ชลบุรี 1 · กดจังหวัดกางอำเภอ
    const area = screen.getByTestId('stuck-area');
    expect(within(area).getAllByTestId('stuck-area-province')).toHaveLength(2);
    fireEvent.click(within(area).getByRole('button', { name: /ชลบุรี/ }));
    expect(within(area).getByTestId('stuck-area-district').textContent).toContain('ศรีราชา');
    // เทียบเดือน: แท่ง 2 เดือน · สลับไปรายชื่อ
    expect(screen.getByTestId('stuck-trend').querySelectorAll('button')).toHaveLength(2);
    fireEvent.mouseDown(screen.getByTestId('stuck-trend-apps'));
    fireEvent.click(screen.getByTestId('stuck-trend-apps'));
    await waitFor(() => expect(screen.getByTestId('stuck-trend').textContent).toContain('5'));
  });

  it('ตัวกรองเจ้าหน้าที่: เลือกหมิว ทั้งหน้าเหลือของหมิว · อ่านใบไม่ได้ = บอกเหตุ ไม่โชว์ 0', async () => {
    fetchRecruitStuck.mockResolvedValue({ generatedAt: '', today: '2026-11-04', bu: null, requests: REQS, monthly: [], errors: {} });
    renderBody();
    await screen.findByTestId('stuck-total');
    fireEvent.click(screen.getByRole('button', { name: 'เจ้าหน้าที่สรรหา' }));
    fireEvent.click(await screen.findByText(/^หมิว · 1 ใบ/));
    await waitFor(() => expect(screen.getByTestId('stuck-total').textContent).toContain('1'));
    expect(within(screen.getByTestId('stuck-owners')).getAllByTestId('stuck-owner-row')).toHaveLength(1);
    cleanup();
    fetchRecruitStuck.mockRejectedValue(new Error('ล่ม'));
    renderBody();
    expect((await screen.findAllByText(/โหลดใบขอที่ยังต้องหาไม่ได้|ล่ม/)).length).toBeGreaterThan(0); // ขึ้นทั้งส่วนใบขอและเทียบเดือน
    expect(screen.queryByTestId('stuck-total')).toBeNull();
  });
});
