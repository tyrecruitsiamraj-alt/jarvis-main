/**
 * ป๊อปประกาศหน้าเดียว (เจ้าของเลือก B "ป๊อปหน้าเดียว ระบบร่างให้" 2 ต.ค. 2569)
 * 🔴 ด่าน: เปิดมาเห็น "คนนอกจะเห็นแบบนี้" + 5 แถว + สภาพใบ (พร้อม/ขาด) ทันที ไม่มีเลขขั้น ·
 *    ช่องที่ขาดช่องแรกกางให้เอง · ใบขอไม่ระบุเพศ = กดประกาศไม่ได้ · ครบแล้วกดประกาศ = ยิงทะเบียนใบเดียวแล้วปิดป๊อป ·
 *    เก็บร่าง = ปิดโดยไม่ยิง · ประกาศแล้ว = ป้าย + ดึงประกาศลงทันที · กางตัวแก้ได้ทีละช่อง · แท็บรายชื่อยังมีปุ่มหาคนทุกกอง
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { JobRequest } from '@/types';

const JOB_ID = 'siamraj-sql:OPL6909999';
const JOB = {
  id: JOB_ID,
  request_no: 'OPL6909999',
  unit_name: 'หน่วยทดสอบ',
  status: 'open',
  request_date: '2026-09-01',
  required_date: '2026-09-30',
  job_type: 'permanent',
  job_category: 'private',
  location_address: 'ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ',
  // เลขดิบจาก ERP ไม่รู้หน่วย = ขาดรายได้ · ใบขอไม่บอกเพศ = ขาดเพศ
  total_income: 354,
} as unknown as JobRequest;
const READY_JOB = { ...JOB, gender_requirement: 'ชาย', total_income: 400, monthly_income: 12400 } as unknown as JobRequest;

let currentJob: JobRequest = JOB;
const fetchJobReleases = vi.fn();
const unreleaseJobsFromPublic = vi.fn(async (_ids: string[]) => 1);
const releaseJobsToPublic = vi.fn(async (_ids: string[]) => 1);

vi.mock('@/lib/siamrajUnitRequestsApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/siamrajUnitRequestsApi')>()),
  fetchSiamrajUnitRequest: vi.fn(async () => currentJob),
}));
vi.mock('@/lib/recruitPostingsApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/recruitPostingsApi')>()),
  fetchRecruitPostings: vi.fn(async () => []),
}));
vi.mock('@/lib/jobPublicReleaseApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/jobPublicReleaseApi')>()),
  fetchJobReleases: () => fetchJobReleases(),
  unreleaseJobsFromPublic: (ids: string[]) => unreleaseJobsFromPublic(ids),
  releaseJobsToPublic: (ids: string[]) => releaseJobsToPublic(ids),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => false }) }));
// กล่องลูก (ใบขอเต็ม/คนเก่า/รายชื่อ/ทะเบียนไม่ประกาศ) ยิงของตัวเอง — ตอบว่างให้หมด ไม่ต้องออกเน็ต
vi.mock('@/lib/apiFetch', async (orig) => ({
  ...(await orig<typeof import('@/lib/apiFetch')>()),
  apiFetch: vi.fn(async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })),
}));

// jsdom ไม่มี ResizeObserver (Checkbox/Tabs ของ Radix)
if (!('ResizeObserver' in globalThis)) {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const { default: BoardPublishSheet } = await import('./BoardPublishSheet');

const released = [{ job_id: JOB_ID, request_no: 'OPL6909999', released_at: '2026-08-25T03:30:00Z', released_by_name: null, note: null }];

const renderSheet = (onDone: () => void = vi.fn(), onSearchAllPools?: () => void) => {
  render(
    <MemoryRouter>
      <BoardPublishSheet id={JOB_ID} onDone={onDone} onSearchAllPools={onSearchAllPools} />
    </MemoryRouter>,
  );
  return onDone;
};
const status = () => screen.getByTestId('publish-status');

beforeEach(() => {
  currentJob = JOB;
  fetchJobReleases.mockReset();
  unreleaseJobsFromPublic.mockClear();
  releaseJobsToPublic.mockClear();
});
afterEach(() => cleanup());

describe('BoardPublishSheet — ป๊อปประกาศหน้าเดียว', () => {
  it('🔴 เปิดมาเห็นตัวอย่างคนนอก + 5 แถว + "ขาด: รายได้ · เพศ" · ไม่มีเลขขั้น · ช่องที่ขาดช่องแรกกางเอง · ประกาศกดไม่ได้', async () => {
    fetchJobReleases.mockResolvedValue([]);
    renderSheet();
    expect(await screen.findByTestId('public-job-preview')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'คนนอกจะเห็นแบบนี้' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'ของที่จะขึ้นประกาศ' })).toBeTruthy();
    for (const f of ['place', 'income', 'benefits', 'gender', 'visibility']) {
      expect(document.querySelector(`[data-field="${f}"]`)).toBeTruthy();
    }
    await waitFor(() => expect(within(status()).getByText('ขาด: รายได้ · เพศ')).toBeTruthy());
    expect(screen.queryByText(/ถัดไป ขั้น/)).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'ขั้นตอนของงานประกาศ' })).toBeNull();
    // ช่องแรกที่ขาด = รายได้ ⇒ ฟอร์มรายได้ (ตัวเดิม) กางอยู่ · สถานที่ไม่กาง
    expect(await screen.findByRole('group', { name: 'รายได้ที่จะขึ้นประกาศ' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'สถานที่ที่ผู้สมัครจะเห็น' })).toBeNull();
    expect((screen.getByRole('button', { name: 'ประกาศ' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('ใบขอไม่ระบุเพศ เลือกเพศก่อนถึงจะประกาศได้')).toBeTruthy();
  });

  it('🔴 ครบแล้ว = "พร้อมประกาศ" · กดประกาศ = ยิงทะเบียนใบนี้ใบเดียว แล้วปิดป๊อป', async () => {
    currentJob = READY_JOB;
    fetchJobReleases.mockResolvedValue([]);
    const onDone = renderSheet();
    await waitFor(() => expect(within(status()).getByText('พร้อมประกาศ')).toBeTruthy());
    const send = screen.getByRole('button', { name: 'ประกาศ' }) as HTMLButtonElement;
    await waitFor(() => expect(send.disabled).toBe(false));
    fetchJobReleases.mockResolvedValue(released);
    fireEvent.click(send);
    await waitFor(() => expect(releaseJobsToPublic).toHaveBeenCalledWith([JOB_ID]));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('เก็บร่าง = ปิดป๊อปโดยไม่ยิงทะเบียน', async () => {
    fetchJobReleases.mockResolvedValue([]);
    const onDone = renderSheet();
    fireEvent.click(await screen.findByRole('button', { name: 'เก็บร่าง' }));
    expect(onDone).toHaveBeenCalled();
    expect(releaseJobsToPublic).not.toHaveBeenCalled();
  });

  it('🔴 ใบที่ประกาศแล้ว: ✓ ประกาศแล้ว + ดึงประกาศลงทันที · กดแล้วดึงลงใบเดียว · ไม่มีปุ่มประกาศ/เก็บร่าง', async () => {
    currentJob = READY_JOB;
    fetchJobReleases.mockResolvedValue(released);
    renderSheet();
    const pull = await screen.findByRole('button', { name: 'ดึงประกาศลง' });
    expect(screen.getByText('ประกาศแล้ว')).toBeTruthy(); // ไม่มี ✓ (ถอดอิโมจิทั้งระบบ 5 ต.ค. 2569)
    expect(screen.queryByRole('button', { name: 'ประกาศ' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'เก็บร่าง' })).toBeNull();
    fetchJobReleases.mockResolvedValue([]);
    fireEvent.click(pull);
    await waitFor(() => expect(unreleaseJobsFromPublic).toHaveBeenCalledWith([JOB_ID]));
    expect(releaseJobsToPublic).not.toHaveBeenCalled();
  });

  it('แถวที่ไม่ขาดกด "แก้" ถึงกาง · กางได้ทีละช่อง (กางสถานที่แล้วรายได้ปิด)', async () => {
    fetchJobReleases.mockResolvedValue([]);
    renderSheet();
    await screen.findByRole('group', { name: 'รายได้ที่จะขึ้นประกาศ' });
    fireEvent.click(screen.getByRole('button', { name: 'แก้สถานที่' }));
    expect(await screen.findByRole('group', { name: 'สถานที่ที่ผู้สมัครจะเห็น' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'รายได้ที่จะขึ้นประกาศ' })).toBeNull();
  });

  it('แท็บรายชื่อ: ปุ่ม "หาคนทุกกอง + ให้ AI โทร" เมื่อส่งตัวจัดการมา', async () => {
    fetchJobReleases.mockResolvedValue([]);
    const onSearch = vi.fn();
    renderSheet(vi.fn(), onSearch);
    await screen.findByTestId('public-job-preview');
    // Radix Tabs สลับด้วย mousedown
    fireEvent.mouseDown(screen.getByRole('tab', { name: /รายชื่อ/ }), { button: 0 });
    fireEvent.click(await screen.findByRole('button', { name: /หาคนทุกกอง/ }));
    expect(onSearch).toHaveBeenCalled();
  });
});
