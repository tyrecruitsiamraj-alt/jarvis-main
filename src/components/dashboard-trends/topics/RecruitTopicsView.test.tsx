/**
 * ภาพรวม 8 เรื่อง เทียบ BU วาดจริง (jsdom) — เจ้าของ 16 พ.ย. 2569 เคาะจากตัวอย่าง แล้ว "ทำมาก่อน"
 * ปุ่มเรื่อง · กราฟ BU กดแล้วรายละเอียดเปลี่ยน · สมการบวกลงตัว · กดแท่งเดือน = ทั้งหน้าเป็นเดือนนั้น · กดวัน = ป๊อปแยกก้อน
 */
import React from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { RecruitAppFact, RecruitOverviewResponse } from '@/lib/recruitOverviewTypes';
import type { StuckRequest } from '@/lib/recruitStuck';

const fetchRecruitStuck = vi.fn();
const fetchComparison = vi.fn();
vi.mock('@/lib/recruitStuckApi', () => ({ fetchRecruitStuck: (...a: unknown[]) => fetchRecruitStuck(...a) }));
vi.mock('@/lib/soPostGroupsApi', () => ({ fetchRecruitPostComparison: (...a: unknown[]) => fetchComparison(...a), fetchSoPostGroups: vi.fn(async () => ({ total: 0, counts: {}, rows: [], statuses: [], reasonGroups: [], page: 1, pages: 1 })) }));
const LINKS = [
  { linkId: 'l1', jobId: 'siamraj-sql:OPL6911001', day: '2026-11-13', place: 'Facebook · Facebook Group · กลุ่มคนขับรถ', by: 'เจมส์', posted: true, clicks: 30, applicants: 1 },
  { linkId: 'l2', jobId: 'siamraj-sql:OPL6911001', day: '2026-11-14', place: 'ไม่ระบุช่องทาง', by: 'ไอซ์', posted: false, clicks: 10, applicants: 4 },
  { linkId: 'l3', jobId: 'siamraj-sql:OPL6911002', day: '2026-11-14', place: 'Facebook · Facebook Group · กลุ่มคนขับรถ', by: 'เจมส์', posted: true, clicks: 5, applicants: 0 },
];
vi.mock('@/lib/jobPostActionsApi', () => ({ fetchManualLinks: vi.fn(async ({ bu }: { bu: string }) => (bu === 'LBD' ? LINKS : [])) }));
const { default: RecruitTopicsView } = await import('./RecruitTopicsView');

beforeEach(() => {
  fetchComparison.mockReset().mockResolvedValue(Object.fromEntries(['LBD', 'LBA', 'LM', 'DS', 'SN'].map((bu) => [bu, { fb: { total: 0, counts: {}, rows: [], statuses: [], page: 1, pages: 1 }, links: bu === 'LBD' ? LINKS : [] }])));
});
afterEach(cleanup);
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const counts = { apps: 0, aiCalled: 0, aiYes: 0, aiNo: 0, aiOutOfArea: 0, aiNoPickup: 0, aiOther: 0, staffCalled: 0, staffFollowed: 0, staffReached: 0, aiYesNoStaff: 0, interested: 0, notInterested: 0, appointed: 0, apptFailed: 0, showed: 0, noShow: 0, passed: 0, notPassed: 0, followStarts: 0, aftercare: 0 };
const row = (no: string, bu: string, p: Partial<StuckRequest> = {}): StuckRequest =>
  ({
    requestNo: no, jobId: `siamraj-sql:${no}`, day: '2026-11-03', unitName: `หน่วย ${no}`, position: 'ขับรถ', siteCode: `S${no}`, siteName: `หน่วย ${no}`, sector: 'private',
    province: 'กรุงเทพมหานคร', district: null, subdistrict: null, leadKind: null, subtype: null, requested: 1, filled: 0, cancelled: 0, remaining: 1,
    released: true, applications: 0, recruiter: 'แบงค์', ageDays: 5, bu, screener: null, state: 'open', inRange: true,
    signals: { released: true, links: 1, post: null, counts, uncalled: 0, queued: 0 }, reason: 'no_apps', releasedAt: null, releasedBy: null, ...p,
  }) as StuckRequest;
const REQS = [
  row('OPL6911001', 'LBD'),
  row('OPL6911002', 'LBD', { reason: 'not_released', released: false, signals: { released: false, links: 0, post: null, counts, uncalled: 0, queued: 0 } }),
  row('LAO6911003', 'LBA', { reason: 'staff_not_calling' }),
];
const fact = (id: string, bu: string, p: Partial<RecruitAppFact> = {}): RecruitAppFact =>
  ({ id, createdAt: '2026-11-03T03:00:00.000Z', jobId: 'siamraj-sql:OPL6911001', bu, channelLabel: 'Facebook · Facebook Group', referralSource: null, phoneOk: true, calledByAi: false, calledByStaff: false, ...p }) as RecruitAppFact;
const APPS = [
  fact('a1', 'LBD', { calledByAi: true, aiAnswer: 'said_yes' }),
  fact('a2', 'LBD', { calledByAi: true, aiAnswer: 'said_no' }),
  fact('a3', 'LBD', { aiQueued: true }),
  fact('a4', 'LBD', { aiBlock: 'income' }),
  fact('a5', 'LBA', { calledByAi: true, aiAnswer: 'no_pickup', createdAt: '2026-11-05T03:00:00.000Z' }),
];
const data = {
  version: 1, generatedAt: '2026-11-16T10:00:00Z', today: '2026-11-16', bu: null, buChoices: ['SN', 'DS', 'LM', 'LBA', 'LBD'],
  window: { month: '2026-11', from: '2026-11-01', to: '2026-11-16', prevFrom: '2026-10-01', prevTo: '2026-10-16', isCurrent: true, range: false },
  firstDay: '2026-10-01', apps: APPS, errors: {}, appJobs: {},
} as unknown as RecruitOverviewResponse;

const onPickMonth = vi.fn();
const renderView = (path = '/', viewData = data) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <RecruitTopicsView
        data={viewData}
        win={data.window}
        cohort={APPS}
        prevCohort={[fact('p1', 'LBD', { createdAt: '2026-10-03T03:00:00.000Z' })]}
        openRows={REQS}
        requestRows={REQS}
        requestsReady
        jobOk={() => true}
        onOpenNames={() => {}}
        onPickMonth={onPickMonth}
      />
    </MemoryRouter>,
  );

describe('ภาพรวม 8 เรื่อง เทียบ BU', () => {
  it('ใบขอเหลือหา: แท่งทุก BU (ว่าง = 0 ห้ามหาย) · สมการของ BU ที่กดบวกลงตัว · กด BU แล้วขวาเปลี่ยน', async () => {
    fetchRecruitStuck.mockResolvedValue({ monthly: [{ month: '2026-11', jobId: 'siamraj-sql:OPL6911001', requests: 2, apps: 4, booked: 0, informed: 0 }], errors: {} });
    renderView();
    for (const bu of ['LBD', 'LBA', 'LM', 'DS', 'SN']) expect(screen.getByTestId(`topic-bu-${bu}`)).toBeTruthy();
    // LBD ขึ้นก่อน (ตามตัวอย่าง) แม้สิทธิ์จะเรียง SN ก่อน
    expect([...document.querySelectorAll('button[data-testid^="topic-bu-"]')].map((b) => b.getAttribute('data-testid'))).toEqual(['topic-bu-LBD', 'topic-bu-LBA', 'topic-bu-LM', 'topic-bu-DS', 'topic-bu-SN']);
    expect(screen.getByTestId('topic-bu-LBD').textContent).toContain('2');
    const eq = screen.getAllByTestId('topic-equation')[0];
    expect(eq.textContent).toContain('ใบขอเหลือหา 2');
    expect(eq.textContent).not.toContain('ไม่ลงตัว');
    fireEvent.click(screen.getByTestId('topic-bu-LBA'));
    await waitFor(() => expect(screen.getAllByTestId('topic-equation')[0].textContent).toContain('ใบขอเหลือหา 1'));
  });

  it('รายชื่อ → ลงงาน: ทุกขั้นบวกลงตัว · ยังไม่มีใครโทร แตกเหตุ (ใบขอยังไม่ตั้งรายได้)', async () => {
    fetchRecruitStuck.mockResolvedValue({ monthly: [], errors: {} });
    renderView('/?topic=people');
    const eqs = await screen.findAllByTestId('topic-equation');
    expect(eqs[0].textContent).toContain('กรอกเข้ามา 4');
    for (const e of eqs) expect(e.textContent).not.toContain('ไม่ลงตัว');
    expect(eqs.map((e) => e.textContent).join(' ')).toContain('ใบขอยังไม่ตั้งรายได้ 1');
    // แท่ง BU ซ้าย: LBD 4 · LBA 1 · เทียบช่วงก่อน
    expect(screen.getByTestId('topic-bu-LBD').textContent).toContain('4');
    expect(screen.getByTestId('topic-bu-LBA').textContent).toContain('1');
  });

  it('กดแท่งเดือน = ทั้งหน้าเป็นเดือนนั้น · กดแท่งวัน = ป๊อปแยกก้อนของวันนั้น', async () => {
    fetchRecruitStuck.mockResolvedValue({ monthly: [{ month: '2026-10', jobId: 'x', requests: 0, apps: 7, booked: 0, informed: 0 }], errors: {} });
    renderView('/?topic=people');
    const oct = await screen.findByTestId('topic-month-2026-10');
    await waitFor(() => expect(oct.textContent).toContain('7'));
    fireEvent.click(oct);
    expect(onPickMonth).toHaveBeenCalledWith('2026-10');
    fireEvent.click(screen.getByTestId('topic-day-2026-11-03'));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByTestId('topic-equation').textContent).toContain('4');
  });

  it('โพสต์เอง: ลิงก์ = โพสต์แล้ว + Gen link · คลิก/กรอกแยกกอง · ย้อนกลับจากคนที่กรอก · ปุ่มเฉพาะโพสต์แล้ว', async () => {
    fetchRecruitStuck.mockResolvedValue({ monthly: [], errors: {} });
    renderView('/?topic=self');
    const panel = await screen.findByTestId('self-links');
    const eqs = within(panel).getAllByTestId('topic-equation').map((e) => e.textContent ?? '');
    expect(eqs[0]).toContain('ลิงก์ทั้งหมด 3');
    expect(eqs[1]).toContain('คลิก 45');
    expect(eqs[2]).toContain('กรอก 5');
    for (const e of eqs) expect(e).not.toContain('ไม่ลงตัว');
    expect(within(screen.getByTestId('self-links-back')).getAllByRole('row')).toHaveLength(3); // หัว + 2 ลิงก์ที่มีคนกรอก
    fireEvent.click(screen.getByTestId('self-filter-posted'));
    expect(within(screen.getByTestId('self-links-back')).getAllByRole('row')).toHaveLength(2);
    // แท่ง BU = จำนวนลิงก์ · รายวันรวมเท่ายอด
    expect(screen.getByTestId('topic-bu-LBD').textContent).toContain('3');
  });

  it('ใบขอเหลือหา: มียอดที่จดไว้ = กราฟเป็นยอด ณ สิ้นวัน · วันที่ยังไม่จด = ขีด กดไม่ได้ · ป๊อปแยกขั้นที่ติด', async () => {
    fetchRecruitStuck.mockImplementation(async (_bu: unknown, _r: unknown, part?: string) =>
      part === 'daily'
        ? { daily: [
            { day: '2026-11-16', bu: 'LBD', phase: 'before', started: false, requests: 5, positions: 6 },
            { day: '2026-11-16', bu: 'LBD', phase: 'calling', started: true, requests: 2, positions: 2 },
          ], errors: {} }
        : { monthly: [], errors: {} },
    );
    renderView('/?topic=req');
    const day16 = await screen.findByTestId('topic-day-2026-11-16');
    await waitFor(() => expect(day16.textContent).toContain('7'));
    expect((screen.getByTestId('topic-day-2026-11-15') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('topic-day-2026-11-15').textContent).toContain('—');
    expect(screen.getByTestId('topic-month-2026-11').textContent).toContain('7');
    expect(screen.getByTestId('topic-month-2026-10').textContent).toContain('—');
    fireEvent.click(day16);
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByTestId('topic-equation').textContent).toContain('7');
    expect(within(dlg).getByTestId('topic-equation').textContent).not.toContain('ไม่ลงตัว');
  });
});


describe('สิทธิ์และคำตอบที่โหลดไม่สำเร็จ', () => {
  it('Supervisor BU เดียว: URL ขอ BU อื่นไม่ได้ และลิงก์เป็นของ BU ตัวเอง', async () => {
    fetchRecruitStuck.mockResolvedValue({ monthly: [], errors: {} });
    renderView('/?topic=self&tbu=LBD', { ...data, bu: 'LBA', buChoices: null });
    await screen.findByTestId('self-links');
    expect(screen.getByTestId('topic-bu-LBA').textContent).toContain('รวม 0');
    expect(screen.queryByTestId('topic-bu-LBD')).toBeNull();
    expect(fetchComparison).toHaveBeenCalledWith({ from: data.window.from, to: data.window.to, bu: 'LBA' });
    expect(screen.getByTestId('self-links').textContent).not.toContain('เจมส์');
  });
  it('API พังต้องบอกว่าอ่านไม่ได้ ห้ามเปลี่ยนเป็นยอด 0', async () => {
    fetchRecruitStuck.mockResolvedValue({ monthly: [], errors: {} });
    fetchComparison.mockRejectedValue(new Error('offline'));
    renderView('/?topic=self');
    await waitFor(() => expect(screen.getByTestId('topic-bu-LBD').textContent).toContain('โหลดข้อมูลไม่ได้'));
    expect(screen.getByTestId('topic-bu-LBD').textContent).not.toContain('รวม 0');
    expect(screen.queryByTestId('self-links')).toBeNull();
  });
  it('สลับ Facebook/โพสต์เองไม่โหลดเปรียบเทียบซ้ำ', async () => {
    fetchRecruitStuck.mockResolvedValue({ monthly: [], errors: {} });
    renderView('/?topic=self');
    await screen.findByTestId('self-links');
    fireEvent.click(screen.getByTestId('topic-fb'));
    await screen.findByTestId('so-post-groups-counts');
    fireEvent.click(screen.getByTestId('topic-self'));
    await screen.findByTestId('self-links');
    expect(fetchComparison).toHaveBeenCalledTimes(1);
  });
});
