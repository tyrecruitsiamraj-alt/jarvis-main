/**
 * หน้าทีม Online — render จริงทั้งหน้า (ตัดเน็ต) · 29 ก.ย. 2569
 * 🔴 ด่าน: การ์ด 5 ใบพูดตรงภาพต้นแบบ · ช่วงก่อนที่ยังไม่มีข้อมูลห้ามขึ้นว่า "เพิ่ม" · ERP มีแต่วันที่ต้องติดธง ·
 *    ผู้ใช้ถูกล็อกแผนกไม่มีตัวเลือก BU และคิวโทรได้ BU ที่เซิร์ฟเวอร์บังคับ · ?period= ส่งถึงเส้น API
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { teamOnlineWindow, type TeamOnlineResponse } from '@/lib/teamOnline';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'admin', full_name: 'ทดสอบ', username: 'test' }, hasPermission: () => true }),
}));

const W = teamOnlineWindow('today', new Date('2026-09-29T12:00:00+07:00'));
const flat = (len: number, v = 0) => Array.from({ length: len }, () => v);
const cov = { since: '2026-07-01T02:11:13.595Z', cur: 'full', prev: 'full' } as const;

const DATA: TeamOnlineResponse = {
  generated_at: '2026-09-29T05:00:00.000Z',
  period: 'today',
  scope: 'all',
  forced_bu: null,
  bu: null,
  window: W,
  bu_options: [
    { bu: 'LBD', label: 'LBD · พนักงานขับรถ / Valet' },
    { bu: 'LM', label: 'LM · ดูแลสวน / ภูมิทัศน์' },
  ],
  users: { cur: 54, prev: 68, series: flat(W.buckets.length, 3), prevSeries: flat(W.buckets.length, 4), coverage: cov },
  requestsIn: { cur: 7, prev: 6, series: [], prevSeries: [], dateOnly: true, coverage: cov, stale: false },
  lumos: {
    called: { cur: 11, prev: 0, series: flat(W.buckets.length, 1), prevSeries: flat(W.buckets.length) },
    reached: { cur: 3, prev: 0 },
    interested: { cur: 2, prev: 0 },
    noAnswer: { cur: 5, prev: 0 },
    coverage: { since: '2026-09-29T00:00:00Z', cur: 'full', prev: 'none' },
  },
  postings: {
    published: { cur: 5, prev: 5, series: flat(W.buckets.length), prevSeries: flat(W.buckets.length) },
    withApplicants: { cur: 2, prev: 2 },
    applicants: { cur: 9, prev: 4 },
    coverage: cov,
  },
  byBu: [
    { bu: 'LBD', label: 'LBD · พนักงานขับรถ / Valet', requestsIn: 5, published: 4, withApplicants: 2, applicants: 9, called: 11, reached: 3, interested: 2, noAnswer: 5, openNow: 185, openWithoutLink: 173, remaining: 225, staleNoApplicants: 2 },
    { bu: 'LM', label: 'LM · ดูแลสวน / ภูมิทัศน์', requestsIn: 2, published: 1, withApplicants: 0, applicants: 0, called: 0, reached: 0, interested: 0, noAnswer: 0, openNow: 92, openWithoutLink: 89, remaining: 126, staleNoApplicants: 0 },
    { bu: '', label: 'ไม่ระบุ BU', requestsIn: 0, published: 0, withApplicants: 0, applicants: 0, called: 0, reached: 0, interested: 0, noAnswer: 0, openNow: 11, openWithoutLink: 11, remaining: 26, staleNoApplicants: 0 },
  ],
  errors: {},
};

const fetchTeamOnline = vi.fn(async (_p: string, _bu?: string | null) => DATA);
const fetchFlowSummary = vi.fn(async (_bu?: string | null) => ({
  lumos: { waiting_call: 1, delivered_waiting: 2 },
  active_calls: [],
  call_boxes: { confirmed: [], retry: [], needs_human: [], declined: [] },
}));
vi.mock('@/lib/teamOnlineApi', () => ({ fetchTeamOnline: (p: string, bu?: string | null) => fetchTeamOnline(p, bu) }));
vi.mock('@/lib/flowSummaryApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/flowSummaryApi')>()),
  fetchFlowSummary: (bu?: string | null) => fetchFlowSummary(bu),
}));

const { default: TeamOnlinePage } = await import('./TeamOnlinePage');

const renderAt = (url = '/?home=online') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <TeamOnlinePage />
    </MemoryRouter>,
  );

beforeAll(() => {
  // recharts ResponsiveContainer ต้องมี ResizeObserver — jsdom ไม่มี
  if (!('ResizeObserver' in globalThis)) {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});
beforeEach(() => {
  fetchTeamOnline.mockClear().mockResolvedValue(DATA);
  fetchFlowSummary.mockClear();
});
afterEach(() => cleanup());

const text = () => document.body.textContent ?? '';

describe('หน้าทีม Online', () => {
  it('🔴 การ์ด 5 ใบพูดตรงภาพต้นแบบ (ลด 14 คน (20.6%) · เพิ่ม 1 ใบ (16.7%) · 2 / 5 ใบ)', async () => {
    renderAt();
    await screen.findByText('ทีม Online');
    await waitFor(() => expect(text()).toContain('ลด 14 คน (20.6%)'));
    expect(text()).toContain('ช่วงก่อน 68 คน');
    expect(text()).toContain('เพิ่ม 1 ใบ (16.7%)');
    expect(text()).toContain('2 / 5 ใบที่ Gen link');
    expect(text()).toContain('40.0%');
    expect(text()).toContain('เพิ่ม 0.0 จุดเปอร์เซ็นต์');
    expect(text()).toContain('2 / 3 คนที่ติดต่อได้');
    expect(text()).toContain('66.7%');
  });

  it('🔴 ช่วงก่อนยังไม่มีข้อมูล = บอกตรง ๆ ห้ามขึ้น "เพิ่ม 11 คน (ช่วงก่อนไม่มี)"', async () => {
    renderAt();
    await screen.findByText('ทีม Online');
    await waitFor(() => expect(text()).toContain('ช่วงก่อนยังไม่มีข้อมูล'));
    expect(text()).not.toContain('เพิ่ม 11 คน');
  });

  it('ใบขอเข้า (ERP มีแต่วันที่) ต้องติดธง · แถบจับตาสรุปจากตัวเลข · ปุ่มตรวจคิวโทรใช้ยอดเดียวกับป๊อป', async () => {
    renderAt();
    await screen.findByText('ทีม Online');
    await waitFor(() => expect(text()).toContain('ระบบงานหลักมีแต่วันที่ · เทียบเมื่อวานทั้งวัน'));
    expect(text()).toContain('คนใช้งานลด 14 คน (20.6%)');
    expect(text()).toContain('ใบเปิดยังไม่ Gen link 273 ใบ');
    await waitFor(() => expect(text()).toContain('ตรวจคิวโทร 3 สาย'));
    expect(text()).toContain('29 ก.ย. ถึง 12:00 เทียบ 28 ก.ย. ถึง 12:00 · ทุก BU');
  });

  it('ตาราง Success ประกาศตามภาพ + แถวรวม · แถวไม่ระบุ BU อยู่ในตาราง', async () => {
    renderAt();
    await screen.findByText('Success ประกาศ · มีผู้สมัครอย่างน้อย 1 คน');
    await waitFor(() => expect(text()).toContain('รวม'));
    expect(text()).toContain('ไม่ระบุ BU');
    expect(text()).toContain('“ไม่มีผู้สมัคร” ยังไม่ใช่ข้อสรุปว่าล้มเหลว');
    expect(text()).toContain('ตัวเลขคนกับใบแยกหน่วย');
  });

  it('?period= กับ ?bu= ส่งถึงเส้น API (BU แปลงเป็นชุดแผนก)', async () => {
    renderAt('/?home=online&period=week&bu=lml');
    await waitFor(() => expect(fetchTeamOnline).toHaveBeenCalled());
    expect(fetchTeamOnline).toHaveBeenCalledWith('week', 'LM');
  });

  it('🔴 ผู้ใช้ถูกล็อกแผนก: ไม่มีตัวเลือก BU · คิวโทรได้ BU ที่เซิร์ฟเวอร์บังคับ', async () => {
    fetchTeamOnline.mockResolvedValue({ ...DATA, scope: 'code', forced_bu: 'LM', bu: 'LM', byBu: [DATA.byBu![1]] });
    renderAt();
    await waitFor(() => expect(fetchFlowSummary).toHaveBeenCalled());
    expect(fetchFlowSummary).toHaveBeenCalledWith('LM');
    expect(screen.queryByLabelText('รายละเอียด BU')).toBeNull();
    expect(text()).toContain('LM · ดูแลสวน / ภูมิทัศน์');
  });
});
