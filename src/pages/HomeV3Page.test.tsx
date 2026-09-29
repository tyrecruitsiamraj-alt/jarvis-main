/**
 * หน้าหลักโฉม 3 ก้อน — render จริงทั้งหน้า (ตัดเน็ต) · 29 ก.ย. 2569
 * 🔴 ด่าน: ลำดับก้อนตามคนเปิด · BU ของผู้ใช้ที่ถูกล็อกแผนกไปถึงทุกเส้น · ตัวเลขก้อนผลงานบวกลบลงตัวบนจอ
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { HomeOverview } from '@/lib/homeOverview';

let role: 'admin' | 'staff' = 'admin';
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role, full_name: 'ทดสอบ', username: 'test' }, hasPermission: () => role === 'admin' }),
}));

const OVERVIEW: HomeOverview = {
  generated_at: '2026-09-29T03:00:00.000Z',
  scope: 'all',
  forced_bu: null,
  bu: null,
  bu_options: [
    { bu: 'LBD', label: 'LBD · ลาดกระบัง', remaining: 225, openJobs: 185 },
    { bu: 'LM', label: 'LM', remaining: 126, openJobs: 92 },
  ],
  unknown_bu_jobs: 11,
  result: {
    monthFrom: '2026-09-01',
    today: '2026-09-29',
    carried: 381,
    added: 213,
    informed: 140,
    cancelled: 58,
    equationEnd: 396,
    undatedFilled: 4,
    erpOpenNow: 392,
    boardOpen: 418,
    boardPre: 26,
    unexplained: 0,
    source: 'snapshot',
    ageSeconds: 120,
  },
  today: {
    day: '2026-09-29',
    yesterday: '2026-09-28',
    steps: [
      { key: 'applied', today: 6, yesterday: 28 },
      { key: 'called', today: 9, yesterday: 28 },
      { key: 'connected', today: 6, yesterday: 19 },
      { key: 'interested', today: 4, yesterday: 18 },
      { key: 'appointed', today: 0, yesterday: 0 },
      { key: 'arrived', today: 16, yesterday: 8 },
    ],
  },
  errors: {},
};

const fetchHomeOverview = vi.fn(async (_bu?: string | null) => OVERVIEW);
const fetchOfficeFloor = vi.fn(async (_bu?: string | null) => {
  throw new Error('skip');
});
const fetchOfficeTeam = vi.fn(async (_bu?: string | null) => {
  throw new Error('skip');
});
const fetchFlowSummary = vi.fn(async (_bu?: string | null) => {
  throw new Error('skip');
});
vi.mock('@/lib/homeOverviewApi', () => ({ fetchHomeOverview: (bu?: string | null) => fetchHomeOverview(bu) }));
vi.mock('@/lib/officeFloorApi', () => ({ fetchOfficeFloor: (bu?: string | null) => fetchOfficeFloor(bu) }));
vi.mock('@/lib/officeTeamApi', () => ({ fetchOfficeTeam: (bu?: string | null) => fetchOfficeTeam(bu) }));
vi.mock('@/lib/flowSummaryApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/flowSummaryApi')>()),
  fetchFlowSummary: (bu?: string | null) => fetchFlowSummary(bu),
}));
vi.mock('@/lib/callFunnelApi', () => ({ fetchCallRateSeries: vi.fn(async () => null) }));

const { default: HomeV3Page } = await import('./HomeV3Page');

const renderAt = (url = '/') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <HomeV3Page />
    </MemoryRouter>,
  );

beforeEach(() => {
  role = 'admin';
  fetchHomeOverview.mockClear().mockResolvedValue(OVERVIEW);
  fetchOfficeFloor.mockClear();
  fetchOfficeTeam.mockClear();
  fetchFlowSummary.mockClear();
});
afterEach(() => cleanup());

const headingOrder = (texts: string[]) => {
  const all = document.body.textContent ?? '';
  return texts.map((t) => all.indexOf(t));
};

describe('หน้าหลักโฉม 3 ก้อน', () => {
  it('🔴 หัวหน้า/ผู้บริหาร: ผลงานเดือนนี้ → ของค้าง → วันนี้ · ก้อนผลงานบวกลบลงตัวถึงหัวกล่องงาน', async () => {
    renderAt();
    await screen.findByText('ผลงานเดือนนี้');
    // หัวก้อนขึ้นก่อนตัวเลข (โครงรอโหลด) — รอเลขมาจริงก่อนตรวจ (เคยแดงตอนรันทั้งชุดเครื่องหนัก)
    await waitFor(() => expect(screen.getByText('418')).toBeTruthy());
    const [result, stuck, today] = headingOrder(['ผลงานเดือนนี้', 'ของค้างที่ต้องจัดการตอนนี้', 'วันนี้ท่อเดินแค่ไหน']);
    expect(result).toBeGreaterThan(-1);
    expect(result).toBeLessThan(stuck);
    expect(stuck).toBeLessThan(today);
    expect(screen.getByText('418')).toBeTruthy();
    expect(document.body.textContent).toContain('381 + 213 − 140 − 58 = 396');
    expect(document.body.textContent).toContain('หาได้แล้วที่ไม่มีวันแจ้งเข้า −4 (ประมาณการ)');
    expect(document.body.textContent).toContain('ใบขอล่วงหน้าฝั่งเรา +26');
    expect(document.body.textContent).toContain('= 418');
    // ก้อนวันนี้นับเป็นคน + เทียบเมื่อวาน
    expect(screen.getByText('ไปถึงงาน')).toBeTruthy();
    expect(document.body.textContent).toContain('เมื่อวาน 28');
    // ใบที่ไม่รู้ BU ต้องบอก ไม่หายเงียบ
    expect(document.body.textContent).toContain('ไม่รู้ BU 11 ใบ');
  });

  it('เจ้าหน้าที่: งานของฉันก่อน แล้วค่อยผลงาน', async () => {
    role = 'staff';
    renderAt();
    await screen.findByText('ผลงานเดือนนี้');
    const all = document.body.textContent ?? '';
    // การ์ดงานของฉัน (HomeDeckV2) ทักทายอยู่บนสุด · ไม่มีรายการของค้างแบบย่อของหัวหน้า
    expect(all.indexOf('ทดสอบ')).toBeLessThan(all.indexOf('ผลงานเดือนนี้'));
    expect(all).not.toContain('ของค้างที่ต้องจัดการตอนนี้');
  });

  it('🔴 ผู้ใช้ถูกล็อกแผนก: เส้นอื่นทุกเส้นได้ BU ที่เซิร์ฟเวอร์บังคับ (ไม่ใช่ทั้งบริษัท) · ไม่มีตัวเลือก BU', async () => {
    fetchHomeOverview.mockResolvedValue({ ...OVERVIEW, scope: 'code', forced_bu: 'LM', bu: 'LM', bu_options: [OVERVIEW.bu_options[1]] });
    renderAt();
    await waitFor(() => expect(fetchOfficeFloor).toHaveBeenCalled());
    expect(fetchOfficeFloor).toHaveBeenCalledWith('LM');
    expect(fetchOfficeTeam).toHaveBeenCalledWith('LM');
    expect(fetchFlowSummary).toHaveBeenCalledWith('LM');
    expect(screen.queryByText('สายธุรกิจ')).toBeNull();
  });

  it('เลือก BU ผ่าน URL (?bu=) ⇒ ส่งต่อทุกเส้นเป็น BU กลาง', async () => {
    fetchHomeOverview.mockImplementation(async (bu?: string | null) => ({ ...OVERVIEW, bu: bu ?? null }));
    renderAt('/?bu=lml');
    await waitFor(() => expect(fetchOfficeFloor).toHaveBeenCalled());
    expect(fetchHomeOverview).toHaveBeenCalledWith('LM');
    expect(fetchOfficeFloor).toHaveBeenCalledWith('LM');
  });
});
