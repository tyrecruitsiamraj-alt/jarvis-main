/**
 * แท็บติดตามนัดหมาย ปุ่ม "ของฉัน / ทุกคน" (QA รอบ 2 ข้อ 4 · เจ้าของ Choice 10 ต.ค. 2569)
 *
 * 🔴 ด่าน (เปลี่ยน 21 ต.ค. 2569 เจ้าของ "ให้เห็นไปหมดเลย" · Choice "ทุกคนเห็นหมด ค่าเริ่ม = ทุกคน"):
 * 1. ค่าเริ่ม "ทุกคน" = ยิงพร้อมธงนัดของทุกคน
 * 2. กด "ของฉัน" = กลับเส้นเดิม · กด "ทุกคน" = ยิงพร้อมธงอีกครั้ง
 * 3. ทุก role เห็นปุ่ม · แท็บอื่นไม่มีปุ่ม
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
// สิทธิ์ฟังก์ชันตามค่าเริ่มของ role (การติดต่อ "ทุกคน" = Admin + Supervisor · 10 พ.ย. 2569)
vi.mock('@/contexts/RolePermissionsContext', async () => {
  const { isFunctionEnabledForRole } = await import('@/lib/roleFunctions');
  return { useRolePermissions: () => ({ isFunctionEnabled: (id: never) => isFunctionEnabledForRole(role, id) }) };
});
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
  it('supervisor: ค่าเริ่ม "ทุกคน" ยิงพร้อมธง · กด "ของฉัน" กลับเส้นเดิม · กดกลับได้', async () => {
    renderTab('appointments');
    await waitFor(() => expect(fetchAll).toHaveBeenCalled());
    expect(lastFlag()).toBe(true);

    const mine = screen.getByRole('radio', { name: 'ของฉัน' });
    const all = screen.getByRole('radio', { name: 'ทุกคน' });
    expect(all).toHaveAttribute('aria-checked', 'true');
    expect(mine).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(mine);
    await waitFor(() => expect(lastFlag()).toBe(false));
    expect(screen.getByRole('radio', { name: 'ของฉัน' })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('radio', { name: 'ทุกคน' }));
    await waitFor(() => expect(lastFlag()).toBe(true));
  });

  it('กดซ้ำตัวที่เลือกอยู่ ไม่หลุดเป็นไม่มีตัวเลือก และไม่ยิงซ้ำ', async () => {
    renderTab('appointments');
    await waitFor(() => expect(fetchAll).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('radio', { name: 'ทุกคน' }));
    expect(screen.getByRole('radio', { name: 'ทุกคน' })).toHaveAttribute('aria-checked', 'true');
    expect(fetchAll).toHaveBeenCalledTimes(1);
  });

  it('admin เห็นปุ่มเหมือน supervisor', async () => {
    role = 'admin';
    renderTab('appointments');
    await waitFor(() => expect(fetchAll).toHaveBeenCalled());
    expect(screen.getByRole('radio', { name: 'ทุกคน' })).toBeInTheDocument();
  });

  it.each<UserRole>(['staff', 'opl'])('%s เห็นปุ่ม ค่าเริ่มทุกคน (21 ต.ค. 2569)', async (r) => {
    role = r;
    renderTab('appointments');
    await waitFor(() => expect(fetchAll).toHaveBeenCalled());
    expect(screen.getByRole('radio', { name: 'ทุกคน' })).toHaveAttribute('aria-checked', 'true');
    expect(lastFlag()).toBe(true);
  });

  it('แท็บ candidates ไม่มีปุ่มนี้', async () => {
    renderTab('candidates');
    await waitFor(() => expect(fetchAll).toHaveBeenCalled());
    expect(screen.queryByRole('radio', { name: 'ทุกคน' })).toBeNull();
    expect(lastFlag()).toBe(false);
  });

  // 10 พ.ย. 2569 เจ้าของ "ใครเก็บไปแล้วยังไม่โทรบ้าง" · Choice "แท็บการติดต่อมีปุ่ม ทุกคน" — ค่าเริ่มยังเป็นของฉัน
  it('แท็บ contact มีปุ่มของตัวเอง ค่าเริ่ม "ของฉัน" · กด "ทุกคน" ยิงธงการติดต่อ (ไม่ใช่ธงนัด)', async () => {
    renderTab('contact');
    await waitFor(() => expect(fetchAll).toHaveBeenCalled());
    expect(screen.getByRole('radio', { name: 'ของฉัน' })).toHaveAttribute('aria-checked', 'true');
    expect(lastFlag()).toBe(false);
    expect(fetchAll.mock.calls.at(-1)?.[4]).toBe(false);
    fireEvent.click(screen.getByRole('radio', { name: 'ทุกคน' }));
    await waitFor(() => expect(fetchAll.mock.calls.at(-1)?.[4]).toBe(true));
    expect(lastFlag()).toBe(false);
  });

  // เจ้าของ 10 พ.ย. 2569 "ที่จะเห็นทุกคนได้เฉพาะคนที่ฉันกำหนดเท่านั้น ตอนนี้ให้เฉพาะ Admin … แล้วก็ Supervisor"
  it.each<UserRole>(['staff', 'opl'])('%s: แท็บการติดต่อไม่มีปุ่ม ทุกคน · เห็นของตัวเอง', async (r) => {
    role = r;
    renderTab('contact');
    await waitFor(() => expect(fetchAll).toHaveBeenCalled());
    expect(screen.queryByRole('radio', { name: 'ทุกคน' })).toBeNull();
    expect(fetchAll.mock.calls.at(-1)?.[4]).toBe(false);
  });
});
