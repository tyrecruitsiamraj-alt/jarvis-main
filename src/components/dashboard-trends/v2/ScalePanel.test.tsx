/**
 * แท็บ "Scale ลง" (เจ้าของ 20 พ.ย. 2569 "กล่องมันต้องกดได้ทั้งหมดสิ่" · "วันที่ 20 ใครทำอะไรบ้าง") — วาดจริงใน jsdom
 * 🔴 ด่าน: กดกล่อง → เลขนั้นแยกตามชั้นถัดไป → กดแถวลงต่อ (ทางเดินขึ้นตาม) · กดแท่งวัน → ใครทำอะไร → งานของคนนั้นวันนั้น
 * ยังโหลดไม่ได้ / อ่านไม่ได้ = กล่องขึ้น — และกดไม่ได้ (ไม่ใช่ 0) · หน้าเลือก BU ไว้ = เริ่มที่ชั้น BU นั้น
 * ก้อนสอง ("ทำที่เหลือต่อเลย"): ทุกกล่องเทียบช่วงก่อน (อ่านไม่ได้ = เทียบไม่ได้ ไม่ใช่ 0) · ตรงเกณฑ์ใบขอ · เทียบเดือน
 * · ใบขอ 4 ตัวของสมการ → รายใบ + งานที่ทำไปแล้ว → กดเลขที่ใบ = ใบนี้ทำอะไรไปแล้ว ไล่ตามวัน
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { emptyStaffPersonDay, type StaffActivityRow, type StaffPersonDay, type StaffRosterRow } from '@/lib/staffActivity';
import type { RecruitAppFact, RecruitAppJob } from '@/lib/recruitOverviewTypes';
import type { RequestTimelineJob } from '@/lib/requestTimeline';
import type { StuckRequest } from '@/lib/recruitStuck';
import type { MoneyRequest } from '@/lib/homeMoney';
import { friendlyErrorText } from '@/lib/friendlyError';

(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const Q = '5f4b2fcd-7f64-4bb8-92cf-7c118d9a0bef';
const FORD = '0a8f0b5e-11d2-4c7e-9a61-2b1f6f0f9c01';
const moneyRow = {
  requestNo: 'OPL6911006',
  bu: 'LBD',
  unit: 'บริษัท ตัวอย่างการเงิน จำกัด',
  position: 'ขับรถ',
  clocked: false,
  speedDays: null,
  lateDays: null,
  amount: { need: { days: 15, personDays: 15, fine: 15000, deduct: 7500, coveredPersonDays: 0 }, key: { days: 0, personDays: 0, fine: 0, deduct: 0, coveredPersonDays: 0 } },
} as unknown as MoneyRequest;
const fetchHomeMoney = vi.fn(async (_q?: { from: string | null }): Promise<{ requests: MoneyRequest[] }> => ({ requests: [moneyRow] }));
const personDay = (day: string): StaffPersonDay => {
  const base = emptyStaffPersonDay('2026-11-14', '2026-11-20', day);
  return {
    ...base,
    channels: { ...base.channels, links: [{ label: 'Facebook · Facebook Group', n: 5 }], scrap: [{ label: 'สำเร็จ', n: 1 }, { label: 'ไม่สำเร็จ', n: 1 }] },
    jobs: [{ jobId: 'siamraj-sql:OPL6911006', label: 'OPL6911006', autopost: 0, scrap: 2, links: 5, manualPosted: 0, clicks: 41, applicants: 3 }],
  };
};
const fetchStaffPersonDay = vi.fn(async (q: { day: string }) => personDay(q.day));
// ช่วงก่อน (งาน · ใบขอ) · คนที่มีงานใน 60 วัน · งานของใบขอ — ค่าเริ่ม = ว่าง แต่ละเทสต์ตั้งเอง
const fetchStaffActivity = vi.fn(async (): Promise<StaffActivityRow[]> => []);
const fetchStaffRoster = vi.fn(async (): Promise<StaffRosterRow[]> => []);
const fetchRecruitStuck = vi.fn(async (): Promise<{ requests: StuckRequest[] }> => ({ requests: [] }));
const timelineJob = (events: boolean): RequestTimelineJob => ({
  done: { work: { links: 3, manualPosted: 2, autopost: 1, scrap: 0, contacts: 4, appts: 1 }, chain: [12, 10, 4, 2, 1, 1, 0] },
  events: events
    ? [
        { day: '2026-11-05', kind: 'names', who: null, detail: 'Facebook · Facebook Group', n: 12 },
        { day: '2026-11-04', kind: 'links', who: 'เจมส์', detail: 'Facebook · Facebook Group', n: 3 },
      ]
    : null,
});
const fetchRequestTimeline = vi.fn(async (ids: readonly string[], events = false): Promise<Record<string, RequestTimelineJob | null>> => Object.fromEntries(ids.map((id) => [id, timelineJob(events)])));
vi.mock('@/lib/homeMoneyApi', () => ({ fetchHomeMoney: (...a: unknown[]) => fetchHomeMoney(...(a as [{ from: string | null }])) }));
vi.mock('@/lib/staffActivityApi', () => ({
  fetchStaffPersonDay: (...a: unknown[]) => fetchStaffPersonDay(...(a as [{ day: string }])),
  fetchStaffActivity: (...a: unknown[]) => fetchStaffActivity(...(a as [])),
  fetchStaffRoster: (...a: unknown[]) => fetchStaffRoster(...(a as [])),
}));
vi.mock('@/lib/recruitStuckApi', () => ({ fetchRecruitStuck: (...a: unknown[]) => fetchRecruitStuck(...(a as [])) }));
vi.mock('@/lib/requestTimelineApi', () => ({ fetchRequestTimeline: (...a: unknown[]) => fetchRequestTimeline(...(a as [string[], boolean])) }));
const { default: ScalePanel } = await import('./ScalePanel');

const fact = (id: string, over: Partial<RecruitAppFact> = {}): RecruitAppFact => ({
  id,
  createdAt: '2026-11-10T00:30:00.000Z',
  jobId: 'siamraj-sql:OPL6911006',
  bu: 'LBD',
  channelLabel: 'Facebook · Facebook Group · หางานขับรถ กทม',
  referralSource: 'facebook',
  position: 'พนักงานขับรถ',
  phoneOk: true,
  calledByAi: false,
  calledByStaff: false,
  firstCalledAt: null,
  aiAnswer: null,
  aiAnswerAt: null,
  staffAnswer: null,
  staffAnswerAt: null,
  staffLastAt: null,
  contact: null,
  contactBy: null,
  logOk: null,
  logReason: null,
  logAt: null,
  appointmentAt: null,
  attendance: null,
  onBoard: false,
  informed: false,
  bringer: 'คิว',
  postSource: 'manual',
  ...over,
});
const COHORT: RecruitAppFact[] = [
  fact('app-9f1c0a11', { calledByAi: true, aiAnswer: 'said_yes', logOk: true, claimedBy: 'แป๋ม', claimedAt: '2026-11-10T02:00:00.000Z' }),
  fact('app-9f1c0a16', { calledByAi: true, aiAnswer: 'said_yes', channelLabel: 'Tiktok · Tiktok Live' }),
  fact('app-9f1c0a14'),
  fact('app-77b20b19', { bu: 'LBA', jobId: 'siamraj-sql:LAO6911027', calledByAi: true, aiAnswer: 'no_pickup', channelLabel: 'Webjob · Jobthai', bringer: 'ฟอร์ด' }),
];
const row = (userId: string, name: string, bu: string, day: string, o: Partial<StaffActivityRow> = {}): StaffActivityRow => ({ userId, name, bu, day, autopost: 0, scrap: 0, links: 0, manualPosted: 0, contacts: 0, appts: 0, ...o });
const STAFF: StaffActivityRow[] = [row(Q, 'คิว', 'LBD', '2026-11-19', { links: 3 }), row(Q, 'คิว', 'LBD', '2026-11-20', { links: 5, scrap: 2 }), row(FORD, 'ฟอร์ด', 'LBA', '2026-11-20', { links: 4 })];
const req = (no: string, bu: string, recruiter: string, flow: [number, number, number, number, number], o: Record<string, unknown> = {}): StuckRequest =>
  ({
    requestNo: no,
    jobId: `siamraj-sql:${no}`,
    bu,
    unitName: 'ธนาคารตัวอย่าง  จำกัด (มหาชน)',
    position: 'ขับรถ',
    recruiter,
    requested: flow[1],
    filled: flow[2],
    cancelled: flow[3],
    remaining: flow[4],
    applications: 2,
    ageDays: 12,
    signals: { post: 'posted', released: true, links: 1 },
    flow: { carryIn: flow[0], new: flow[1], filled: flow[2], cancelled: flow[3], remaining: flow[4], fillDays: [], cancelDays: [] },
    ...o,
  }) as unknown as StuckRequest;
const REQUESTS = [req('OPL6911006', 'LBD', 'คิว', [0, 3, 1, 0, 2]), req('LAO6911027', 'LBA', 'ฟอร์ด', [0, 5, 0, 0, 5])];
/** เกณฑ์ของใบขอ: ใบขับรถกำหนดที่ตั้ง + อายุ · ใบของ LBA รู้แค่จังหวัด */
const JOBS: Record<string, RecruitAppJob> = {
  'siamraj-sql:OPL6911006': { requestNo: 'OPL6911006', unitName: 'ธนาคารตัวอย่าง  จำกัด (มหาชน)', position: 'ขับรถ', recruiter: 'คิว', area: { province: 'กรุงเทพมหานคร', district: 'บางรัก' }, ageMin: 25, ageMax: 45, gender: null },
  'siamraj-sql:LAO6911027': { requestNo: 'LAO6911027', unitName: 'บริษัท ตัวอย่างค้าปลีก จำกัด', position: 'ช่างซ่อมบำรุง', recruiter: 'ฟอร์ด', area: { province: 'ชลบุรี', district: null }, ageMin: null, ageMax: null, gender: null },
};

const onNames = vi.fn();
const onOpenRequest = vi.fn();
type Over = Partial<React.ComponentProps<typeof ScalePanel>>;
const show = (over: Over = {}, url = '/jobs/board?view=dashboard&ov=scale') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <ScalePanel cohort={COHORT} staff={STAFF} staffError={null} requests={REQUESTS} requestsError={null} jobs={JOBS} prev={null} from="2026-11-01" to="2026-11-20" today="2026-11-20" bu={null} onNames={onNames} onOpenRequest={onOpenRequest} {...over} />
    </MemoryRouter>,
  );
const box = (key: string) => screen.getByTestId(`scale-box-${key}`);
const crumbs = () => within(screen.getByTestId('scale-crumbs')).getAllByRole('button').map((b) => b.textContent);
/** ข้อความทีละช่องของแถว (ช่องที่ไม่มีตัวหนังสือ เช่น แถบ/ลูกศร ไม่นับ) */
const parts = (el: Element) => [...el.children].map((c) => c.textContent?.trim() ?? '').filter(Boolean);
const rankRows = () => screen.getAllByTestId('scale-rank-row').map(parts);
/** รอค่าปรับโหลดเสร็จ (กล่องกดได้) — ไม่ทิ้งงานค้างไว้หลังจบเทสต์ */
const settled = () => waitFor(() => expect(screen.getByTestId('scale-box-fine').tagName).toBe('BUTTON'));
const cells = (r: Element) => [...r.querySelectorAll('th,td')].map((c) => c.textContent?.trim() ?? '');

const trend = (key: string) => screen.getByTestId(`scale-trend-${key}`).textContent?.trim() ?? '';
const tableRows = (id: string) => within(screen.getByTestId(id)).getAllByRole('row').map(cells);

beforeEach(() => {
  fetchHomeMoney.mockClear();
  fetchStaffPersonDay.mockClear();
  for (const f of [fetchStaffActivity, fetchStaffRoster, fetchRecruitStuck, fetchRequestTimeline]) f.mockClear();
  onNames.mockClear();
  onOpenRequest.mockClear();
});
afterEach(() => cleanup());

describe('แท็บ Scale ลง', () => {
  it('ชั้นทั้งหมด: กล่องเลขทุกแถว + สมการใบขอ + ค่าปรับจากเส้นของหน้าหลัก', async () => {
    show();
    expect(crumbs()).toEqual(['ทั้งหมด']);
    expect(within(box('reqPos')).getByText('7')).toBeTruthy();
    expect(screen.getByTestId('scale-equation').textContent).toBe('ยกมา 0 + ขอใหม่ 8 − หาได้แล้ว 1 − ยกเลิก 0 = เหลือหา 7 อัตรา');
    expect(within(box('wSum')).getByText('14')).toBeTruthy();
    expect(within(box('cNames')).getByText('4')).toBeTruthy();
    expect(within(box('cAiYes')).getByText('2')).toBeTruthy();
    expect(within(box('cAiYes')).getByText('67% ของที่ AI โทร')).toBeTruthy();
    // ค่าปรับยังไม่มา = — และกดไม่ได้
    expect(box('fine').tagName).toBe('DIV');
    await waitFor(() => expect(within(box('fine')).getByText('15,000.00')).toBeTruthy());
    expect(box('fine').tagName).toBe('BUTTON');
    expect(fetchHomeMoney).toHaveBeenCalledWith({ from: '2026-11-01', to: '2026-11-20', bu: null });
    expect(screen.getByTestId('scale-bu-table')).toBeTruthy();
    expect(screen.getByTestId('scale-chart')).toBeTruthy();
  });

  it('กดกล่อง = เลขนั้นแยกตาม BU → กดแถวลงไปชั้น BU (ยังถือกล่องเดิม) → กดกล่องซ้ำกลับตารางปกติ', async () => {
    show();
    await settled();
    fireEvent.click(box('cAiYes'));
    expect(box('cAiYes').getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByTestId('scale-bu-table')).toBeNull();
    expect(rankRows()).toEqual([['LBD', '2', '100%']]);
    expect(parts(screen.getByTestId('scale-rank-total'))).toEqual(['รวม', '2', '100%']);
    fireEvent.click(screen.getByTestId('scale-rank-row'));
    expect(crumbs()).toEqual(['ทั้งหมด', 'LBD']);
    expect(rankRows()).toEqual([['คิว', '2', '100%']]);
    fireEvent.click(box('cAiYes'));
    expect(screen.queryByTestId('scale-detail')).toBeNull();
    expect(screen.getByTestId('scale-people-table')).toBeTruthy();
    expect(screen.getByTestId('scale-hold-table')).toBeTruthy();
  });

  it('กล่องใบขอที่ชั้น BU: แยกตามเจ้าหน้าที่สรรหา + รายใบพร้อมงานที่ทำไปแล้ว', async () => {
    show({}, '/jobs/board?ov=scale&sbu=LBD&box=reqPos');
    await settled();
    expect(rankRows()).toEqual([['คิว', '2', '100%']]);
    await waitFor(() => expect(fetchRequestTimeline).toHaveBeenCalledWith(['siamraj-sql:OPL6911006']));
    await waitFor(() =>
      expect(tableRows('scale-requests')).toEqual([
        ['เลขที่ใบขอ', 'ตำแหน่ง', 'หน่วยงาน', 'เหลือหา', 'ค้าง (วัน)', 'เริ่มหา', 'งานที่ทำ', 'รายชื่อ', 'นัดได้', 'มา', 'เจ้าหน้าที่สรรหา'],
        ['OPL6911006', 'ขับรถ', 'ธนาคารตัวอย่าง  จำกัด (มหาชน)', '2', '12', 'เริ่มแล้ว', '10', '12', '1', '1', 'คิว'],
      ]),
    );
  });

  it('ลงถึงช่องทาง: กดเลขในตารางแล้วเปิดรายชื่อชุดนั้น', async () => {
    show({}, '/jobs/board?ov=scale&sbu=LBD');
    await settled();
    fireEvent.click(within(screen.getByTestId('scale-people-table')).getByRole('button', { name: 'คิว' }));
    expect(crumbs()).toEqual(['ทั้งหมด', 'LBD', 'คิว']);
    const table = screen.getByTestId('scale-chain-table');
    expect(within(table).getAllByRole('row')).toHaveLength(4); // หัว + 2 ช่องทาง + รวม
    fireEvent.click(within(table).getAllByRole('button', { name: '3' })[0]);
    expect(onNames).toHaveBeenCalledTimes(1);
    expect(onNames.mock.calls[0][1]).toEqual(['app-9f1c0a11', 'app-9f1c0a16', 'app-9f1c0a14']);
  });

  it('กดแท่งวัน → ใครทำอะไรวันนั้น → กดคน → งานของคนนั้นวันนั้น ช่องทาง และใบขอ', async () => {
    show();
    await settled();
    expect(screen.getByTestId('scale-days-compare').textContent).toBe('19 พ.ย. 3 · 20 พ.ย. 11 · มากกว่าวันก่อน 8');
    fireEvent.click(screen.getByTestId('scale-day-2026-11-20'));
    expect(crumbs()).toEqual(['ทั้งหมด', '20 พ.ย.']);
    expect(within(box('wSum')).getByText('11')).toBeTruthy();
    const dayTable = screen.getByTestId('scale-day-table');
    expect(within(dayTable).getAllByRole('row').map(cells)).toEqual([
      ['คน', 'BU', 'รวม', 'Gen link', 'โพสต์แล้ว', 'Scrap', 'Autopost', 'ลงผลติดต่อ', 'ลงนัด'],
      ['คิว', 'LBD', '7', '5', '0', '2', '0', '0', '0'],
      ['ฟอร์ด', 'LBA', '4', '4', '0', '0', '0', '0', '0'],
      ['รวม', '', '11', '9', '0', '2', '0', '0', '0'],
    ]);
    fireEvent.click(within(dayTable).getByRole('button', { name: 'คิว' }));
    expect(crumbs()).toEqual(['ทั้งหมด', 'LBD', 'คิว', '20 พ.ย.']);
    await waitFor(() => expect(screen.getByTestId('scale-person-day-jobs')).toBeTruthy());
    expect(fetchStaffPersonDay).toHaveBeenCalledWith({ from: '2026-11-14', to: '2026-11-20', day: '2026-11-20', user: Q, bu: null });
    const card = screen.getByTestId('scale-person-day');
    expect(within(card).getByText('Facebook · Facebook Group 5')).toBeTruthy();
    expect(within(card).getByText('สำเร็จ 1 · ไม่สำเร็จ 1')).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: 'OPL6911006' }));
    expect(onOpenRequest).toHaveBeenCalledWith('siamraj-sql:OPL6911006');
    // กดแท่งเดิมซ้ำ = ออกจากวันนั้น
    fireEvent.click(screen.getByTestId('scale-day-2026-11-20'));
    expect(crumbs()).toEqual(['ทั้งหมด', 'LBD', 'คิว']);
  });

  it('ยังโหลดงานไม่ได้ = กล่องขึ้น — กดไม่ได้ · อ่านค่าปรับไม่ได้ = บอกเหตุ ไม่ขึ้น 0', async () => {
    const err = new Error('เชื่อมต่อไม่ได้');
    fetchHomeMoney.mockRejectedValueOnce(err);
    show({ staff: null, staffError: 'อ่านงานรายคนไม่ได้' });
    expect(box('wSum').tagName).toBe('DIV');
    expect(within(box('wSum')).getByText('—')).toBeTruthy();
    expect(screen.getAllByText('อ่านงานรายคนไม่ได้').length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByText(friendlyErrorText(err, 'อ่านค่าปรับไม่ได้'))).toBeTruthy());
    expect(box('fine').tagName).toBe('DIV');
    expect(within(box('fine')).getByText('—')).toBeTruthy();
  });

  it('หน้าเลือก BU ไว้ = เริ่มที่ชั้น BU นั้น ไม่มีชั้น "ทั้งหมด"', async () => {
    show({ bu: 'LBD' });
    await settled();
    expect(crumbs()).toEqual(['LBD']);
    expect(within(box('cNames')).getByText('3')).toBeTruthy();
    expect(screen.getByTestId('scale-people-table')).toBeTruthy();
    expect(screen.queryByTestId('scale-bu-table')).toBeNull();
  });
});

describe('แท็บ Scale ลง — เทียบช่วงก่อน (เจ้าของ 20 พ.ย. 2569 "เดือนที่แล้วทำอะไร เดือนนี้เพิ่มหรือลด")', () => {
  const TON = '7c1e2d3f-5a6b-4c8d-9e0f-1a2b3c4d5e6f';
  const PREV = { from: '2026-10-12', to: '2026-10-31', cohort: [fact('app-55aa0c01', { createdAt: '2026-10-20T03:00:00.000Z' })] };
  const prevStaff = () => [row(Q, 'คิว', 'LBD', '2026-10-20', { links: 2, contacts: 1 }), row(TON, 'ต้น', 'LM', '2026-10-21', { links: 5, contacts: 5 })];
  /** ช่วงนี้: คิว (LBD) ลงผลติดต่อ 4 · ฟอร์ด (LBA) 2 */
  const CONTACTS = [...STAFF, row(Q, 'คิว', 'LBD', '2026-11-18', { contacts: 4 }), row(FORD, 'ฟอร์ด', 'LBA', '2026-11-18', { contacts: 2 })];

  it('ทุกกล่องมีป้ายเทียบ: รายชื่อเทียบทันที · งาน/ใบขอรอช่วงก่อนโหลด · เลขที่เพิ่งเริ่มนับ = เทียบไม่ได้ · สถานะ ณ ตอนนี้ไม่มีป้าย', async () => {
    fetchStaffActivity.mockResolvedValueOnce(prevStaff());
    fetchRecruitStuck.mockResolvedValueOnce({ requests: [req('OPL6910100', 'LBD', 'คิว', [9, 0, 0, 0, 9])] });
    show({ prev: PREV, staff: CONTACTS });
    expect(screen.getByTestId('scale-compare').textContent).toBe('เทียบกับ 12–31 ต.ค. 2569');
    expect(trend('cNames')).toBe('▲ เพิ่มขึ้น 3');
    // ช่วงก่อนของงานยังไม่มา = ยังไม่ขึ้นป้าย (ไม่ขึ้น "เพิ่มขึ้น" จาก 0 ปลอม)
    expect(trend('wContacts')).toBe('');
    await waitFor(() => expect(trend('wContacts')).toBe('ทรงตัว'));
    expect(fetchStaffActivity).toHaveBeenCalledWith({ from: '2026-10-12', to: '2026-10-31', bu: null });
    expect(fetchRecruitStuck).toHaveBeenCalledWith(null, { from: '2026-10-12', to: '2026-10-31' });
    expect(fetchHomeMoney).toHaveBeenCalledWith({ from: '2026-10-12', to: '2026-10-31', bu: null });
    expect(trend('reqPos')).toBe('▼ ลดลง 2');
    // "โพสต์แล้ว" เริ่มแยกนับ 13 พ.ย. · ลิงก์เริ่มจำคนสร้าง 28 ต.ค. — ช่วงก่อนเริ่มก่อนวันนั้น = เทียบไม่ได้ (ไม่ใช่เพิ่มขึ้นจาก 0)
    expect([trend('wSum'), trend('wPosted'), trend('wLinks')]).toEqual(['เทียบไม่ได้', 'เทียบไม่ได้', 'เทียบไม่ได้']);
    expect([trend('reqIdle'), trend('hAll'), trend('eta')]).toEqual(['', '', '']);
    await waitFor(() => expect(trend('fine')).toBe('ทรงตัว'));
  });

  it('รายชื่อช่วงก่อนไม่ครบ / อ่านช่วงก่อนไม่ได้ = เทียบไม่ได้ · ไม่มีช่วงก่อน (ปุ่ม "ทั้งหมด") = ไม่มีป้ายและไม่ถามช่วงก่อน', async () => {
    fetchStaffActivity.mockRejectedValueOnce(new Error('เชื่อมต่อไม่ได้'));
    show({ prev: { ...PREV, cohort: null } });
    expect(trend('cNames')).toBe('เทียบไม่ได้');
    await waitFor(() => expect(trend('wContacts')).toBe('เทียบไม่ได้'));
    await settled();
    cleanup();
    fetchStaffActivity.mockClear();
    fetchRecruitStuck.mockClear();
    show();
    expect(screen.queryByTestId('scale-compare')).toBeNull();
    expect(trend('cNames')).toBe('');
    await settled();
    expect(fetchStaffActivity).not.toHaveBeenCalled();
    expect(fetchRecruitStuck).not.toHaveBeenCalled();
  });

  it('กดกล่อง: แต่ละแถวเทียบช่วงก่อน · แถวที่ช่วงก่อนมีแต่ช่วงนี้ไม่มี ขึ้นเป็น 0 พร้อมบอกว่าลดลง', async () => {
    fetchStaffActivity.mockResolvedValueOnce(prevStaff());
    show({ prev: PREV, staff: CONTACTS }, '/jobs/board?ov=scale&box=wContacts');
    await waitFor(() =>
      expect(rankRows()).toEqual([
        ['LBD', '4', '67%', '▲ เพิ่มขึ้น 3'],
        ['LBA', '2', '33%', '▲ เพิ่มขึ้น 2'],
        ['LM', '0', '0%', '▼ ลดลง 5'],
      ]),
    );
    expect(parts(screen.getByTestId('scale-rank-total'))).toEqual(['รวม', '6', '100%']);
    await settled();
  });

  it('ชั้นวัน = เทียบกับวันก่อน (ข้อมูลชุดเดียวกัน ไม่ต้องถามเพิ่ม)', async () => {
    show({}, '/jobs/board?ov=scale&day=2026-11-20');
    // ชั้นวันไม่มีแถวค่าปรับ — รอให้คำตอบที่ยิงตอนเปิดแท็บลงจอก่อน
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId('scale-compare').textContent).toBe('เทียบกับ 19 พ.ย.');
    expect([trend('wSum'), trend('wLinks'), trend('wScrap'), trend('cNames')]).toEqual(['▲ เพิ่มขึ้น 8', '▲ เพิ่มขึ้น 6', '▲ เพิ่มขึ้น 2', 'ทรงตัว']);
    expect(fetchStaffActivity).not.toHaveBeenCalled();
  });
});

describe('แท็บ Scale ลง — ตรงเกณฑ์ใบขอ · ไปไหนต่อ · แจ้งเข้า', () => {
  const FIT_COHORT = [
    fact('app-9f1c0a11', { calledByAi: true, aiAnswer: 'said_yes', logOk: true, appointmentAt: '2026-11-12T03:00:00.000Z', homeProvince: 'กรุงเทพมหานคร', homeDistrict: 'บางรัก', age: 30, informed: true, informedAt: '2026-11-18' }),
    fact('app-9f1c0a12', { calledByAi: true, aiAnswer: 'said_yes', homeProvince: 'กรุงเทพมหานคร', homeDistrict: 'ดินแดง', age: 50 }),
    fact('app-9f1c0a13', { homeProvince: 'เชียงใหม่', bringer: 'iRecruit', channelLabel: 'iRecruit', postSource: null, informed: true, informedAt: '2026-03-20' }),
  ];

  it('แถวตรงเกณฑ์ใบขอ: กดกล่อง = แยกตาม BU + ตารางไล่ตามขั้น กดเลขเปิดรายชื่อชุดนั้น', async () => {
    show({ cohort: FIT_COHORT }, '/jobs/board?ov=scale&box=fitProvince');
    await settled();
    expect((['fitDistrict', 'fitProvince', 'fitRegion', 'fitFar', 'fitUnknown', 'fitAgeOut', 'fitGenderOut'] as const).map((k) => within(box(k)).getAllByText(/^\d+$/)[0].textContent)).toEqual(['1', '1', '0', '1', '0', '1', '0']);
    expect(rankRows()).toEqual([['LBD', '1', '100%']]);
    expect(tableRows('scale-fit-table')).toEqual([
      ['ขั้น', 'ทั้งหมด', 'อำเภอเดียวกับงาน', 'จังหวัดเดียวกับงาน', 'ภาคเดียวกับงาน', 'คนละภาคกับงาน', 'เทียบพื้นที่ไม่ได้', 'อายุไม่เข้าเกณฑ์', 'เพศไม่ตรงใบขอ'],
      ['รายชื่อ', '3', '1', '1', '0', '1', '0', '1', '0'],
      ['AI โทรแล้ว', '2', '1', '1', '0', '0', '0', '1', '0'],
      ['AI สนใจ', '2', '1', '1', '0', '0', '0', '1', '0'],
      ['คนโทรต่อ ติดต่อได้', '1', '1', '0', '0', '0', '0', '0', '0'],
      ['นัดได้', '1', '1', '0', '0', '0', '0', '0', '0'],
      ['มา', '0', '0', '0', '0', '0', '0', '0', '0'],
      ['แจ้งเข้า', '2', '1', '0', '0', '1', '0', '0', '0'],
    ]);
    const stage = within(screen.getByTestId('scale-fit-table')).getAllByRole('row')[3];
    fireEvent.click(within(stage).getAllByRole('button', { name: '1' })[1]);
    expect(onNames).toHaveBeenCalledWith('AI สนใจ · จังหวัดเดียวกับงาน', ['app-9f1c0a12']);
  });

  it('เทียบพื้นที่ไม่ได้ = บอกเหตุครบ 4 แบบ รวมกัน = กล่อง กดเหตุไหนเปิดรายชื่อชุดนั้น', async () => {
    // ค่าเริ่มของชุดทดสอบ: ไม่มีใครกรอกที่อยู่ (ใบขอของ LBA รู้แค่จังหวัด) + ใบหนึ่งไม่ผูกใบขอ
    show({ cohort: [...COHORT, fact('app-0c33d21b', { jobId: null, bu: null, bringer: null })] }, '/jobs/board?ov=scale&box=fitUnknown');
    await settled();
    expect(within(box('fitUnknown')).getByText('5')).toBeTruthy();
    const why = screen.getAllByTestId('scale-unknown-row');
    expect(why.map(parts)).toEqual([['ใบสมัครไม่ผูกใบขอ', '1', '20%'], ['ไม่มีรายละเอียดใบขอ', '0', '0%'], ['ใบขอไม่ระบุที่ตั้งงาน', '0', '0%'], ['ผู้สมัครไม่กรอกที่อยู่', '4', '80%']]);
    expect(parts(screen.getByTestId('scale-unknown-total'))).toEqual(['รวม', '5', '100%']);
    fireEvent.click(why[0]);
    expect(onNames).toHaveBeenCalledWith('เทียบพื้นที่ไม่ได้ · ใบสมัครไม่ผูกใบขอ', ['app-0c33d21b']);
  });

  it('ยังไม่รู้เกณฑ์ของใบขอ = แถวตรงเกณฑ์ขึ้น — กดไม่ได้', async () => {
    show({ jobs: null });
    await settled();
    expect(box('fitDistrict').tagName).toBe('DIV');
    expect(within(box('fitDistrict')).getByText('—')).toBeTruthy();
  });

  it('กดกล่องรายชื่อ = คนในกล่องไปไหนต่อ (ช่องรวมกัน = กล่อง) กดช่องเปิดรายชื่อ', async () => {
    show({}, '/jobs/board?ov=scale&box=cAiYes');
    await settled();
    expect(within(screen.getByTestId('scale-detail')).getByText('AI สนใจ 2 คน ไปไหนต่อ')).toBeTruthy();
    const next = screen.getAllByTestId('scale-next-row');
    expect(next.map(parts)).toEqual([['ติดต่อได้', '1', '50%'], ['ติดต่อไม่ได้', '0', '0%'], ['รอโทร', '1', '50%']]);
    expect(parts(screen.getByTestId('scale-next-total'))).toEqual(['รวม', '2', '100%']);
    fireEvent.click(next[2]);
    expect(onNames).toHaveBeenCalledWith('AI สนใจ · รอโทร', ['app-9f1c0a16']);
  });

  it('กดแจ้งเข้า = ใครหามา ช่องทางไหน กรอกใบถึงแจ้งเข้ากี่วัน · แจ้งเข้าก่อนกรอกใบบอกตรง ๆ', async () => {
    show({ cohort: FIT_COHORT }, '/jobs/board?ov=scale&box=cInformed');
    await settled();
    const rows = tableRows('scale-informed');
    expect(rows[0]).toEqual(['BU', 'ช่องทาง', 'ใครหามา', 'กรอกใบ', 'แจ้งเข้า', 'ใช้กี่วัน']);
    expect(rows.slice(1).map((r) => [r[0], r[2], r[3], r[4], r[5]])).toEqual([
      ['LBD', 'คิว', '10 พ.ย. 2569', '18 พ.ย. 2569', '8 วัน'],
      ['LBD', 'ดึงจาก iRecruit', '10 พ.ย. 2569', '20 มี.ค. 2569', 'แจ้งเข้าก่อนกรอกใบ'],
    ]);
  });
});

describe('แท็บ Scale ลง — ใบขอ: หาได้แล้ว · ยกเลิก · ใบนี้ทำอะไรไปแล้ว', () => {
  const CLOSED = req('OPL6911006', 'LBD', 'คิว', [0, 3, 1, 0, 2], {
    day: '2026-11-03',
    releasedAt: '2026-11-03T17:30:00.000Z',
    // ทะเบียนประกาศจดอีเมลไว้ — จอต้องขึ้นชื่อเล่นของคนนั้น ไม่ใช่อีเมล
    releasedBy: 'kiw.s@example.com',
    flow: { carryIn: 0, new: 3, filled: 1, cancelled: 0, remaining: 2, fillDays: [['2026-11-12', 1]], cancelDays: [] },
  });
  const WITH_LOGIN = STAFF.map((r) => (r.userId === Q ? { ...r, login: 'kiw.s' } : r));

  it('หาได้แล้ว → รายใบ + งานที่ทำไปแล้ว → กดเลขที่ใบ = ไล่ตามวัน (ทางเดินมีใบขอ) → เปิดใบขอ / กลับรายการ', async () => {
    show({ requests: [CLOSED, REQUESTS[1]], staff: WITH_LOGIN }, '/jobs/board?ov=scale&sbu=LBD&box=reqFilled');
    await settled();
    await waitFor(() =>
      expect(tableRows('scale-requests')).toEqual([
        ['เลขที่ใบขอ', 'ตำแหน่ง', 'หน่วยงาน', 'หาได้แล้ว', 'งานที่ทำ', 'รายชื่อ', 'นัดได้', 'มา', 'เจ้าหน้าที่สรรหา'],
        ['OPL6911006', 'ขับรถ', 'ธนาคารตัวอย่าง  จำกัด (มหาชน)', '1', '10', '12', '1', '1', 'คิว'],
      ]),
    );
    fireEvent.click(within(screen.getByTestId('scale-requests')).getByRole('button', { name: 'OPL6911006' }));
    expect(crumbs()).toEqual(['ทั้งหมด', 'LBD', 'OPL6911006']);
    expect(screen.queryByTestId('scale-detail')).toBeNull();
    expect(onOpenRequest).not.toHaveBeenCalled();
    await waitFor(() => expect(fetchRequestTimeline).toHaveBeenCalledWith(['siamraj-sql:OPL6911006'], true));
    await waitFor(() =>
      expect(tableRows('scale-request-timeline')).toEqual([
        ['วันที่', 'ทำอะไร', 'จำนวน', 'ใคร', 'รายละเอียด'],
        ['3 พ.ย. 2569', 'ขอมา', '3 อัตรา', '—', '—'],
        ['4 พ.ย. 2569', 'ประกาศ', '—', 'คิว', '—'],
        ['4 พ.ย. 2569', 'Gen link', '3 ลิงก์', 'เจมส์', 'Facebook · Facebook Group'],
        ['5 พ.ย. 2569', 'รายชื่อเข้า', '12 คน', '—', 'Facebook · Facebook Group'],
        ['12 พ.ย. 2569', 'หาได้แล้ว', '1 อัตรา', '—', '—'],
      ]),
    );
    expect(parts(screen.getByTestId('scale-request-work'))).toEqual(['รวม10', 'Gen link3', 'โพสต์แล้ว2', 'Scrap0', 'Autopost1', 'ลงผลติดต่อ4', 'ลงนัด1']);
    expect(parts(screen.getByTestId('scale-request-chain'))).toEqual(['รายชื่อ12', 'AI โทรแล้ว10', 'AI สนใจ4', 'คนโทรต่อ ติดต่อได้2', 'นัดได้1', 'มา1', 'แจ้งเข้า0']);
    fireEvent.click(screen.getByTestId('scale-request-open'));
    expect(onOpenRequest).toHaveBeenCalledWith('siamraj-sql:OPL6911006');
    // กดชั้นในทางเดิน = กลับไปรายการใบขอเดิม
    fireEvent.click(screen.getByTestId('scale-crumb-1'));
    expect(screen.queryByTestId('scale-request')).toBeNull();
    expect(screen.getByTestId('scale-requests')).toBeTruthy();
    expect(box('reqFilled').getAttribute('aria-pressed')).toBe('true');
  });

  it('อ่านงานของใบไม่ได้ = บอกเหตุ · หลักของใบ (ขอมา · หาได้แล้ว) ยังขึ้น', async () => {
    const err = new Error('เชื่อมต่อไม่ได้');
    fetchRequestTimeline.mockRejectedValueOnce(err);
    show({ requests: [CLOSED] }, '/jobs/board?ov=scale&sbu=LBD&rq=siamraj-sql%3AOPL6911006');
    await waitFor(() => expect(within(screen.getByTestId('scale-request')).getByText(friendlyErrorText(err, 'อ่านงานของใบขอไม่ได้'))).toBeTruthy());
    expect(tableRows('scale-request-timeline').map((r) => r[1])).toEqual(['ทำอะไร', 'ขอมา', 'ประกาศ', 'หาได้แล้ว']);
    // คนประกาศที่ไม่มีงานในช่วง (ไม่รู้ชื่อเล่น) = ส่วนหน้า @ ไม่โชว์อีเมลเต็ม
    expect(tableRows('scale-request-timeline')[2][3]).toBe('kiw.s');
    await settled();
  });

  it('ยกเลิก → ยกเลิกเพราะอะไร (รวมกัน = กล่อง) + รายใบมีเหตุผล', async () => {
    const requests = [REQUESTS[0], req('OPL6910100', 'LBD', 'คิว', [2, 0, 0, 2, 0]), req('OPL6910101', 'LBD', 'คิว', [1, 0, 0, 1, 0])];
    fetchHomeMoney.mockResolvedValueOnce({ requests: [moneyRow, { ...moneyRow, requestNo: 'OPL6910100', stopReason: 'ลูกค้าหาคนเองได้' } as MoneyRequest] });
    show({ requests }, '/jobs/board?ov=scale&sbu=LBD&box=reqCancelled');
    await settled();
    expect(within(box('reqCancelled')).getByText('3')).toBeTruthy();
    expect(screen.getAllByTestId('scale-reasons-row').map(parts)).toEqual([['ลูกค้าหาคนเองได้1 ใบ', '2', '67%'], ['ไม่ได้กรอกเหตุผล1 ใบ', '1', '33%']]);
    expect(parts(screen.getByTestId('scale-reasons-total'))).toEqual(['รวม', '3', '100%']);
    await waitFor(() => expect(tableRows('scale-requests').map((r) => [r[0], r[3], r[8]])).toEqual([['เลขที่ใบขอ', 'ยกเลิก', 'ยกเลิกเพราะ'], ['OPL6910100', '2', 'ลูกค้าหาคนเองได้'], ['OPL6910101', '1', '—']]));
  });
});

describe('แท็บ Scale ลง — เทียบเดือน · คนที่หายไป', () => {
  it('ช่วงที่ครอบหลายเดือน: ตารางเทียบเดือน รวมทุกเดือน = กล่อง · กดเดือน = กราฟรายวันของเดือนนั้น · ช่วงเดือนเดียวไม่มีตารางนี้', async () => {
    const cohort = [...COHORT, fact('app-55aa0c01', { createdAt: '2026-10-20T03:00:00.000Z' })];
    const staff = [...STAFF, row(Q, 'คิว', 'LBD', '2026-10-20', { links: 3 })];
    show({ cohort, staff, from: '2026-10-15' });
    await settled();
    expect(tableRows('scale-months')).toEqual([
      ['เดือน', 'งานที่ทำ', 'รายชื่อ', 'AI โทรแล้ว', 'AI สนใจ', 'คนโทรต่อ ติดต่อได้', 'นัดได้', 'มา', 'แจ้งเข้า'],
      ['ต.ค. 69 · 15–31', '3', '1', '0', '0', '0', '0', '0', '0'],
      ['พ.ย. 69 · 1–20', '14เทียบไม่ได้', '4▲ เพิ่มขึ้น 3', '3▲ เพิ่มขึ้น 3', '2▲ เพิ่มขึ้น 2', '1▲ เพิ่มขึ้น 1', '0ทรงตัว', '0ทรงตัว', '0ทรงตัว'],
      ['รวม', '17', '5', '3', '2', '1', '0', '0', '0'],
    ]);
    expect(within(box('wSum')).getByText('17')).toBeTruthy();
    expect(screen.getByTestId('scale-day-2026-11-20')).toBeTruthy();
    fireEvent.click(within(screen.getByTestId('scale-months')).getByRole('button', { name: 'ต.ค. 69 · 15–31' }));
    expect(screen.queryByTestId('scale-day-2026-11-20')).toBeNull();
    expect(within(screen.getByTestId('scale-days')).getAllByRole('button')).toHaveLength(17);
    // กดวันของเดือนนั้น — กราฟยังเป็นเดือนเดิม
    fireEvent.click(screen.getByTestId('scale-day-2026-10-20'));
    expect(crumbs()).toEqual(['ทั้งหมด', '20 ต.ค.']);
    expect(screen.getByTestId('scale-day-2026-10-21')).toBeTruthy();
    expect(screen.queryByTestId('scale-day-2026-11-20')).toBeNull();
    cleanup();
    show();
    await settled();
    expect(screen.queryByTestId('scale-months')).toBeNull();
  });

  it('ชั้น BU: คนที่มีงานใน 60 วันล่าสุดแต่ช่วงนี้ไม่มี ขึ้นแถวด้วยงาน 0 + บอกว่าไม่มีงานมากี่วัน', async () => {
    fetchStaffRoster.mockResolvedValueOnce([{ userId: 'a1f0c7d2-3b4e-4f5a-8c6d-7e8f9a0b1c2d', name: 'โอ๊ต', bu: 'LBD', lastDay: '2026-10-28' }]);
    show({}, '/jobs/board?ov=scale&sbu=LBD');
    await settled();
    const table = screen.getByTestId('scale-people-table');
    // นับวันเต็มที่ผ่านไปแล้ว (29 ต.ค. – 19 พ.ย.) วันนี้ที่ยังไม่จบไม่นับ
    await waitFor(() => expect(within(table).getByText('ไม่มีงานมา 22 วัน')).toBeTruthy());
    expect(fetchStaffRoster).toHaveBeenCalledWith({ to: '2026-11-20', bu: null });
    const oat = within(table).getAllByRole('row').map(cells).find((r) => r[0] === 'โอ๊ต');
    expect(oat?.slice(1, 4)).toEqual(['28 ต.ค.ไม่มีงานมา 22 วัน', '0', '0']);
    // คนที่ทำงานเมื่อวาน (19 พ.ย.) หรือวันนี้ ไม่ขึ้นป้าย
    expect(within(table).getAllByRole('row').map(cells).find((r) => r[0] === 'คิว')?.[1]).toBe('20 พ.ย.');
  });
});
