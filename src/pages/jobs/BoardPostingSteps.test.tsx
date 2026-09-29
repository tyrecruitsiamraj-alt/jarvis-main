/**
 * ป๊อปไล่งานบนกล่องงาน — ปุ่ม "ดึงลงจากหน้าสาธารณะ" บนหัวป๊อป (เจ้าของเคาะ 29 ก.ย. 2569)
 * *"ถ้าอันไหนต้องการเอาออกจากหน้าสาธารณะต้องมีปุ่มให้ย้อนกลับมาได้"* → Choice "บนหัวป๊อป ข้างป้าย ปล่อยแล้ว"
 * 🔴 ด่าน: ใบที่ปล่อยแล้วเห็นปุ่มทันทีที่เปิด (ไม่ต้องไล่ไปขั้น 4) · กดแล้วดึงลงใบนั้นใบเดียว · ใบที่ยังไม่ปล่อยไม่มีปุ่มนี้
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  location_address: 'กรุงเทพมหานคร',
} as unknown as JobRequest;

const fetchJobReleases = vi.fn();
const unreleaseJobsFromPublic = vi.fn(async (_ids: string[]) => 1);
const releaseJobsToPublic = vi.fn(async (_ids: string[]) => 1);

vi.mock('@/lib/siamrajUnitRequestsApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/siamrajUnitRequestsApi')>()),
  fetchSiamrajUnitRequest: vi.fn(async () => JOB),
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
// ป๊อปอ่านสิทธิ์แค่ว่าเห็นประวัติการแก้ไขไหม (admin) — เจ้าหน้าที่ทั่วไปพอ
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => false }) }));
// กล่องลูก (อัตราจ้าง/คนลาออก ฯลฯ) ยิงของตัวเอง — ตอบว่างให้หมด ไม่ต้องออกเน็ต
vi.mock('@/lib/apiFetch', async (orig) => ({
  ...(await orig<typeof import('@/lib/apiFetch')>()),
  apiFetch: vi.fn(async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })),
}));

const { BoardPostingSteps } = await import('./BoardPostingPage');

const released = [{ job_id: JOB_ID, request_no: 'OPL6909999', released_at: '2026-08-25T03:30:00Z', released_by_name: null, note: null }];

const renderSteps = () =>
  render(
    <MemoryRouter>
      <BoardPostingSteps id={JOB_ID} chrome={false} onDone={() => {}} />
    </MemoryRouter>,
  );

beforeEach(() => {
  fetchJobReleases.mockReset();
  unreleaseJobsFromPublic.mockClear();
  releaseJobsToPublic.mockClear();
});
afterEach(() => cleanup());

describe('ป๊อปไล่งาน — ดึงลงจากหน้าสาธารณะบนหัวป๊อป', () => {
  it('🔴 ใบที่ปล่อยแล้ว: เปิดมาเห็นปุ่มข้างป้ายเลย · กดแล้วดึงลงใบนี้ใบเดียว (ไม่ปล่อยซ้ำ)', async () => {
    fetchJobReleases.mockResolvedValue(released);
    renderSteps();
    const button = await screen.findByRole('button', { name: 'ดึงลงจากหน้าสาธารณะ' });
    expect(screen.getByText('✓ ปล่อยขึ้นหน้าสาธารณะแล้ว')).toBeTruthy();
    fetchJobReleases.mockResolvedValue([]);
    fireEvent.click(button);
    await waitFor(() => expect(unreleaseJobsFromPublic).toHaveBeenCalledWith([JOB_ID]));
    expect(releaseJobsToPublic).not.toHaveBeenCalled();
    // ทะเบียนโหลดใหม่แล้วไม่มีใบนี้ ⇒ ป้าย + ปุ่มหายไปเอง
    await waitFor(() => expect(screen.queryByRole('button', { name: 'ดึงลงจากหน้าสาธารณะ' })).toBeNull());
  });

  it('ใบที่ยังไม่ปล่อย: ไม่มีปุ่มดึงลงบนหัวป๊อป', async () => {
    fetchJobReleases.mockResolvedValue([]);
    renderSteps();
    await screen.findByRole('navigation', { name: 'ขั้นตอนของงานประกาศ' });
    await waitFor(() => expect(fetchJobReleases).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'ดึงลงจากหน้าสาธารณะ' })).toBeNull();
  });
});
