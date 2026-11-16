/**
 * ภาพรวมแบบ Scale ลง วาดจริง (jsdom · เจ้าของ 13 พ.ย. 2569) — แถบ 6 ช่องมีเพิ่มขึ้น/ลดลง · กดช่องแล้วข้อนั้นขึ้นโซนเดียว · ตารางมีแถวเทียบช่วงก่อน
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { RecruitOverviewResponse } from '@/lib/recruitOverviewTypes';
import type { StuckRequest } from '@/lib/recruitStuck';

const fetchRecruitStuck = vi.fn();
const fetchSoPostGroups = vi.fn();
const fetchManualPostDays = vi.fn();
vi.mock('@/lib/recruitStuckApi', () => ({ fetchRecruitStuck: (...a: unknown[]) => fetchRecruitStuck(...a) }));
vi.mock('@/lib/soPostGroupsApi', () => ({ fetchSoPostGroups: (...a: unknown[]) => fetchSoPostGroups(...a) }));
vi.mock('@/lib/jobPostActionsApi', () => ({ fetchManualPostDays: (...a: unknown[]) => fetchManualPostDays(...a) }));
const { default: RecruitStuckBody } = await import('./RecruitStuckBody');

afterEach(cleanup);
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
const REQS = [row('LBD6911001', {}), row('LBD6911002', { recruiter: 'หมิว', reason: 'not_released', released: false }), row('LBD6911003', {})];
const apps = [
  { id: 'c1', createdAt: '2026-11-02T03:00:00.000Z', jobId: 'siamraj-sql:LBD6911001', calledByAi: true, aiAnswer: 'said_yes', aiAnswerAt: '2026-11-02T04:00:00.000Z', claimedBy: 'อ้น', phoneOk: true },
  { id: 'c2', createdAt: '2026-11-03T03:00:00.000Z', jobId: 'siamraj-sql:LBD6911003', calledByAi: true, aiAnswer: 'no_pickup', phoneOk: true },
  { id: 'p1', createdAt: '2026-10-25T03:00:00.000Z', jobId: 'siamraj-sql:LBD6911001', calledByAi: true, aiAnswer: 'said_yes', aiAnswerAt: '2026-10-25T04:00:00.000Z', claimedBy: 'อ้น', phoneOk: true },
];
const data = {
  version: 1, generatedAt: '2026-11-04T10:00:00Z', today: '2026-11-04', bu: null,
  window: { month: '2026-11', from: '2026-10-29', to: '2026-11-04', prevFrom: '2026-10-22', prevTo: '2026-10-28', isCurrent: true, range: true },
  firstDay: '2026-09-01', apps, backlog: null, staff: [], ai: null, attendanceEverRecorded: false, errors: {}, appJobs: {},
} as unknown as RecruitOverviewResponse;

const renderScale = (url = '/jobs/board?view=dashboard') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <RecruitStuckBody layout="scale" data={data} win={data.window} onOpenNames={() => {}} onPickMonth={() => {}} />
    </MemoryRouter>,
  );

describe('ภาพรวมแบบ Scale ลง', () => {
  it('แถบ 6 ช่องบอกเลข + เพิ่มขึ้น/ลดลง · ใบที่เหลือหา = เทียบไม่ได้ · ค่าเริ่มเปิดข้อ 1', async () => {
    fetchRecruitStuck.mockResolvedValue({ generatedAt: '', today: '2026-11-04', bu: null, requests: REQS, monthly: [], errors: {} });
    fetchSoPostGroups.mockImplementation(async (q: { from: string }) => ({ total: q.from === '2026-10-29' ? 5 : 0, counts: { posted: q.from === '2026-10-29' ? 3 : 0 }, statuses: [{ key: 'posted', label: 'เผยแพร่แล้ว' }], rows: [], page: 1, pages: 1 }));
    fetchManualPostDays.mockImplementation(async (q: { from: string }) => ({ days: [], total: q.from === '2026-10-29' ? { jobs: 4, places: 6, posted: 1, clicks: 9, applicants: 2 } : { jobs: 6, places: 6, posted: 0, clicks: 0, applicants: 3 } }));
    renderScale();
    const cell = async (k: string) => (await screen.findByTestId(`scale-cell-${k}`)).textContent ?? '';
    await screen.findByTestId('scale-zone-todo');
    expect(await screen.findByTestId('stuck-todo')).toBeTruthy();
    expect(await cell('todo')).toMatch(/3.*ใบที่เหลือหา.*เทียบไม่ได้/);
    expect(await cell('src')).toContain('▲ เพิ่มขึ้น 1 จาก 1');
    expect(await cell('done')).toMatch(/1.*เก็บไป.*ทรงตัว/);
    await screen.findByText('ใหม่ ช่วงก่อน 0');
    expect(await cell('fb')).toMatch(/5.*ที่สั่ง.*ใหม่ ช่วงก่อน 0/);
    // ข้อ 6 นับตั้งแต่ 13 พ.ย. 2569 (Choice 16 พ.ย.) — ช่วงนี้ทั้งช่วงอยู่ก่อนวันนั้น = 0 · ช่วงก่อนเทียบไม่ได้
    expect(await cell('self')).toContain('0ลิงก์ทั้งหมดเทียบไม่ได้');
    // ช่วงก่อนดึงด้วยช่วงวันเท่ากัน
    expect(fetchManualPostDays).toHaveBeenCalledWith({ from: '2026-10-22', to: '2026-10-28', bu: null });
  });

  it('กดช่องข้อ 2 = ตารางคนโทรมีแถวช่วงก่อน + เทียบช่วงก่อน · กดปุ่มเหตุผล = โซนเปลี่ยน แถบอยู่ที่เดิม', async () => {
    renderScale();
    fireEvent.click(await screen.findByTestId('scale-cell-done'));
    await screen.findByTestId('scale-zone-done');
    expect(screen.getByTestId('scale-cell-done').getAttribute('aria-pressed')).toBe('true');
    expect(within(screen.getByTestId('caller-results-prev')).getAllByRole('cell')[0].textContent).toBe('22–28 ต.ค. 2569');
    expect(screen.getByTestId('caller-results-delta').textContent).toContain('เทียบช่วงก่อน');
    expect(screen.getByTestId('person-stage-apps').textContent).toContain('▲ เพิ่มขึ้น 1');
    fireEvent.click(screen.getByTestId('scale-more-why'));
    await screen.findByTestId('scale-zone-why');
    expect(screen.getByTestId('scale-cell-todo')).toBeTruthy();
  });

  it('เปิดลิงก์ที่มี ?sec=ch = เปิดข้อ 4 · ตารางช่องทางมีช่องเทียบช่วงก่อน', async () => {
    renderScale('/jobs/board?view=dashboard&sec=ch');
    await screen.findByTestId('scale-zone-ch');
    expect(screen.getByTestId('channel-funnel-prev')).toBeTruthy();
    expect(screen.getByTestId('channel-funnel-delta')).toBeTruthy();
    expect(screen.getAllByText('เทียบช่วงก่อน').length).toBeGreaterThan(1);
  });
});
