/**
 * แท็บติดตามนัดหมาย ปุ่ม "ของฉัน / ทุกคน" (QA รอบ 2 ข้อ 4 · เจ้าของ Choice 10 ต.ค. 2569)
 *
 * 🔴 ด่าน:
 * 1. ค่าเริ่ม "ของฉัน" = ยิงเส้นเดิม (ไม่มีธงนัดของทุกคน)
 * 2. กด "ทุกคน" = ยิงใหม่พร้อมธง · กดกลับ "ของฉัน" = กลับเส้นเดิม
 * 3. staff / opl ไม่เห็นปุ่ม · แท็บอื่นไม่มีปุ่ม
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import type { UserRole } from '@/types';

const fetchAll = vi.fn();
let role: UserRole = 'supervisor';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'u1@example.com', role } }),
}));
vi.mock('@/lib/publicApplicationsApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/publicApplicationsApi')>()),
  fetchAllJobApplications: (...a: unknown[]) => fetchAll(...a),
}));
vi.mock('@/lib/callHoldsApi', () => ({ fetchCallHoldsByPhones: vi.fn(async () => new Map()) }));
vi.mock('@/pages/matching/MyCallsPage', () => ({ MyCallsSection: () => null }));
vi.mock('@/components/recruit-rm/ApplicantContactDialog', () => ({ default: () => null }));
vi.mock('@/components/recruit-rm/AddApplicantDialog', () => ({ default: () => null }));
vi.mock('@/components/recruit-rm/ImportApplicantsDialog', () => ({ default: () => null }));
vi.mock('@/components/recruit-rm/CallChoiceConfirmDialog', () => ({ default: () => null }));

import RmWorkspace from './RmWorkspace';

const renderTab = (tab: 'appointments' | 'contact' | 'candidates') =>
  render(
    <MemoryRouter>
      <RmWorkspace tab={tab} />
    </MemoryRouter>,
  );

/** ธงตัวที่ 4 ของ fetchAllJobApplications = นัดของทุกคน */
const lastFlag = () => fetchAll.mock.calls.at(-1)?.[3];

beforeEach(() => {
  cleanup();
  fetchAll.mockReset().mockResolvedValue([]);
  role = 'supervisor';
});

describe('ปุ่ม ของฉัน / ทุกคน', () => {
  it('supervisor: ค่าเริ่ม "ของฉัน" ยิงเส้นเดิม · กด "ทุกคน" ยิงใหม่พร้อมธง · กดกลับได้', async () => {
    renderTab('appointments');
    await waitFor(() => expect(fetchAll).toHaveBeenCalled());
    expect(lastFlag()).toBe(false);

    const mine = screen.getByRole('radio', { name: 'ของฉัน' });
    const all = screen.getByRole('radio', { name: 'ทุกคน' });
    expect(mine).toHaveAttribute('aria-checked', 'true');
    expect(all).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(all);
    await waitFor(() => expect(lastFlag()).toBe(true));
    expect(screen.getByRole('radio', { name: 'ทุกคน' })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('radio', { name: 'ของฉัน' }));
    await waitFor(() => expect(lastFlag()).toBe(false));
  });

  it('กดซ้ำตัวที่เลือกอยู่ ไม่หลุดเป็นไม่มีตัวเลือก และไม่ยิงซ้ำ', async () => {
    renderTab('appointments');
    await waitFor(() => expect(fetchAll).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('radio', { name: 'ของฉัน' }));
    expect(screen.getByRole('radio', { name: 'ของฉัน' })).toHaveAttribute('aria-checked', 'true');
    expect(fetchAll).toHaveBeenCalledTimes(1);
  });

  it('admin เห็นปุ่มเหมือน supervisor', async () => {
    role = 'admin';
    renderTab('appointments');
    await waitFor(() => expect(fetchAll).toHaveBeenCalled());
    expect(screen.getByRole('radio', { name: 'ทุกคน' })).toBeInTheDocument();
  });

  it.each<UserRole>(['staff', 'opl'])('%s ไม่เห็นปุ่ม และยิงเส้นเดิมเสมอ', async (r) => {
    role = r;
    renderTab('appointments');
    await waitFor(() => expect(fetchAll).toHaveBeenCalled());
    expect(screen.queryByRole('radio', { name: 'ทุกคน' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'ของฉัน' })).toBeNull();
    expect(lastFlag()).toBe(false);
  });

  it.each(['contact', 'candidates'] as const)('แท็บ %s ไม่มีปุ่มนี้', async (tab) => {
    renderTab(tab);
    await waitFor(() => expect(fetchAll).toHaveBeenCalled());
    expect(screen.queryByRole('radio', { name: 'ทุกคน' })).toBeNull();
    expect(lastFlag()).toBe(false);
  });
});
