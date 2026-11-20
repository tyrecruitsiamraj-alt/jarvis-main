/**
 * แท็บ "Scale ลง" (เจ้าของ 20 พ.ย. 2569 "กล่องมันต้องกดได้ทั้งหมดสิ่" · "วันที่ 20 ใครทำอะไรบ้าง") — วาดจริงใน jsdom
 * 🔴 ด่าน: กดกล่อง → เลขนั้นแยกตามชั้นถัดไป → กดแถวลงต่อ (ทางเดินขึ้นตาม) · กดแท่งวัน → ใครทำอะไร → งานของคนนั้นวันนั้น
 * ยังโหลดไม่ได้ / อ่านไม่ได้ = กล่องขึ้น — และกดไม่ได้ (ไม่ใช่ 0) · หน้าเลือก BU ไว้ = เริ่มที่ชั้น BU นั้น
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { emptyStaffPersonDay, type StaffActivityRow, type StaffPersonDay } from '@/lib/staffActivity';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
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
const fetchHomeMoney = vi.fn(async (): Promise<{ requests: MoneyRequest[] }> => ({ requests: [moneyRow] }));
const personDay = (day: string): StaffPersonDay => {
  const base = emptyStaffPersonDay('2026-11-14', '2026-11-20', day);
  return {
    ...base,
    channels: { ...base.channels, links: [{ label: 'Facebook · Facebook Group', n: 5 }], scrap: [{ label: 'สำเร็จ', n: 1 }, { label: 'ไม่สำเร็จ', n: 1 }] },
    jobs: [{ jobId: 'siamraj-sql:OPL6911006', label: 'OPL6911006', autopost: 0, scrap: 2, links: 5, manualPosted: 0, clicks: 41, applicants: 3 }],
  };
};
const fetchStaffPersonDay = vi.fn(async (q: { day: string }) => personDay(q.day));
vi.mock('@/lib/homeMoneyApi', () => ({ fetchHomeMoney: (...a: unknown[]) => fetchHomeMoney(...(a as [])) }));
vi.mock('@/lib/staffActivityApi', () => ({ fetchStaffPersonDay: (...a: unknown[]) => fetchStaffPersonDay(...(a as [{ day: string }])) }));
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
const req = (no: string, bu: string, recruiter: string, flow: [number, number, number, number, number]): StuckRequest =>
  ({
    requestNo: no,
    jobId: `siamraj-sql:${no}`,
    bu,
    unitName: 'ธนาคารกรุงศรีอยุธยา  จำกัด (มหาชน)',
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
  }) as unknown as StuckRequest;
const REQUESTS = [req('OPL6911006', 'LBD', 'คิว', [0, 3, 1, 0, 2]), req('LAO6911027', 'LBA', 'ฟอร์ด', [0, 5, 0, 0, 5])];

const onNames = vi.fn();
const onOpenRequest = vi.fn();
type Over = Partial<React.ComponentProps<typeof ScalePanel>>;
const show = (over: Over = {}, url = '/jobs/board?view=dashboard&ov=scale') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <ScalePanel cohort={COHORT} staff={STAFF} staffError={null} requests={REQUESTS} requestsError={null} from="2026-11-01" to="2026-11-20" today="2026-11-20" bu={null} onNames={onNames} onOpenRequest={onOpenRequest} {...over} />
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

beforeEach(() => {
  fetchHomeMoney.mockClear();
  fetchStaffPersonDay.mockClear();
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
    await waitFor(() => expect(within(box('fine')).getByText('15,000')).toBeTruthy());
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

  it('กล่องใบขอที่ชั้น BU: แยกตามเจ้าหน้าที่สรรหา + รายใบ กดเลขใบแล้วเปิดใบขอ', async () => {
    show({}, '/jobs/board?ov=scale&sbu=LBD&box=reqPos');
    await settled();
    expect(rankRows()).toEqual([['คิว', '2', '100%']]);
    const table = screen.getByTestId('scale-requests');
    fireEvent.click(within(table).getByRole('button', { name: 'OPL6911006' }));
    expect(onOpenRequest).toHaveBeenCalledWith('siamraj-sql:OPL6911006');
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
