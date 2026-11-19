/**
 * แผงข้างของการ์ด "ต้องทำ" (เจ้าของ 19 พ.ย. 2569 "กดแล้วให้ทำจากหน้านี้เลย") — วาดจริงใน jsdom · เส้นเขียนเป็นตัวปลอม ไม่แตะฐาน
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const fetchTodoPeople = vi.fn();
const fetchApplicantNames = vi.fn();
const chooseApplicationCall = vi.fn();
const recordAppointmentAttendance = vi.fn();
vi.mock('@/lib/recruitOverviewApi', () => ({
  fetchTodoPeople: (...a: unknown[]) => fetchTodoPeople(...a),
  fetchApplicantNames: (...a: unknown[]) => fetchApplicantNames(...a),
}));
vi.mock('@/lib/publicApplicationsApi', () => ({
  chooseApplicationCall: (...a: unknown[]) => chooseApplicationCall(...a),
  recordAppointmentAttendance: (...a: unknown[]) => recordAppointmentAttendance(...a),
}));
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
const { default: TodoPane } = await import('./TodoPane');

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const A = '0b6e1a52-1c2d-4e3f-8a9b-0c1d2e3f4a5b';
const B = '1c7f2b63-2d3e-4f40-9b0c-1d2e3f4a5b6c';
const C = '2d803c74-3e4f-4051-8c1d-2e3f4a5b6c7d';
const names = [
  { id: A, full_name: 'สมชาย ใจดี', phone: null, unit_name: 'ธนาคารกรุงศรีอยุธยา จำกัด (มหาชน)', job_title: null, position_interest: null, created_at: null, job_id: 'siamraj-sql:OPL6911063', appointment_at: '2026-11-15T03:00:00Z' },
  { id: B, full_name: 'วิภา สุขใจ', phone: null, unit_name: null, job_title: null, position_interest: null, created_at: null, job_id: null, appointment_at: null },
  { id: C, full_name: 'นคร ปาระมี', phone: null, unit_name: 'การท่าเรือแห่งประเทศไทย', job_title: null, position_interest: null, created_at: null, job_id: 'siamraj-sql:LMO6911010', appointment_at: null },
];
const view = (todo: 'waiting_staff' | 'overdue_now') =>
  render(
    <MemoryRouter>
      <TodoPane todo={todo} bu={null} listHref={`/jobs/board?view=list&bucket=${todo}`} />
    </MemoryRouter>,
  );

describe('แผงข้างการ์ดต้องทำ', () => {
  it('รวมก่อน · กด BU = เหลือ BU นั้น · ปุ่มเก็บไปโทรเองยิงเส้นเดิมทีละคน แล้วแถวขึ้นผลที่เดิม', async () => {
    fetchTodoPeople.mockResolvedValue([{ id: A, bu: 'LBD' }, { id: B, bu: 'LBA' }, { id: C, bu: 'LM' }]);
    fetchApplicantNames.mockImplementation(async (ids: string[]) => names.filter((n) => ids.includes(n.id)));
    chooseApplicationCall.mockResolvedValue({ choice: 'manual', done: 1, skipped: [] });
    view('waiting_staff');
    await screen.findByText('สมชาย ใจดี');
    expect(screen.getByText('3 คน · แยกตาม BU')).toBeTruthy();
    expect(screen.getByText('วิภา สุขใจ')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'LBA 1' }));
    await waitFor(() => expect(screen.queryByText('สมชาย ใจดี')).toBeNull());
    expect(screen.getByText('วิภา สุขใจ')).toBeTruthy();
    // ใบไม่ผูกใบขอ = ไม่มีปุ่มส่ง AI
    expect(screen.queryByRole('button', { name: 'ส่ง AI โทร' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'เก็บไปโทรเอง' }));
    await screen.findByText('เก็บไปโทรเองแล้ว');
    expect(chooseApplicationCall).toHaveBeenCalledWith([B], 'manual');
  });

  it('ส่ง AI โทร ต้องกดยืนยันในแถวก่อนยิงสายจริง', async () => {
    fetchTodoPeople.mockResolvedValue([{ id: A, bu: 'LBD' }]);
    fetchApplicantNames.mockResolvedValue([names[0]]);
    chooseApplicationCall.mockResolvedValue({ choice: 'ai', done: 1, skipped: [] });
    view('waiting_staff');
    await screen.findByText('สมชาย ใจดี');
    fireEvent.click(screen.getByRole('button', { name: 'ส่ง AI โทร' }));
    expect(chooseApplicationCall).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'ยืนยันส่ง AI โทร' }));
    await screen.findByText('ส่ง AI โทรแล้ว');
    expect(chooseApplicationCall).toHaveBeenCalledWith([A], 'ai');
  });

  it('นัดเลยวัน: ปุ่ม มา / ไม่มา ส่งวันนัดของคนนั้น', async () => {
    fetchTodoPeople.mockResolvedValue([{ id: A, bu: 'LBD' }]);
    fetchApplicantNames.mockResolvedValue([names[0]]);
    recordAppointmentAttendance.mockResolvedValue(undefined);
    view('overdue_now');
    await screen.findByText('สมชาย ใจดี');
    fireEvent.click(screen.getByRole('button', { name: 'ไม่มา' }));
    await screen.findByText('บันทึก ไม่มา แล้ว');
    expect(recordAppointmentAttendance).toHaveBeenCalledWith({ applicationId: A, appointmentAt: '2026-11-15T03:00:00Z', result: 'no_show' });
  });
});
