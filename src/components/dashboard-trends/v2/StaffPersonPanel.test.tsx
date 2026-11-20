/**
 * แท็บงานรายคน (เจ้าของ 20 พ.ย. 2569 "เจมส์ทำไรไปบ้างวันนี้ เมื่อวาน วันนี้กะเมื่อวานเจมส์ทำไรเยอะกว่า" ·
 * "ทำอะไร แล้วทำไปช่องทางไหน") — วาดจริงใน jsdom ด้วยตัวเลขรูปเดียวกับของจริง (เจมส์ 19–20 พ.ย. 2569) ไม่แตะฐาน
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { emptyStaffKinds, emptyStaffPersonDay, type StaffActivityRow, type StaffPersonDay } from '@/lib/staffActivity';

(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const JAMES = '5f4b2fcd-7f64-4bb8-92cf-7c118d9a0bef';
const MAI = 'd3d2bc64-fbc1-48da-8411-f7e789596a04';
const dayOf = (day: string): StaffPersonDay => {
  const base = emptyStaffPersonDay('2026-11-14', '2026-11-20', day);
  const week = base.week.map((w) =>
    w.day === '2026-11-20' ? { ...w, autopost: 2, scrap: 80, links: 161, manualPosted: 125 } : w.day === '2026-11-19' ? { ...w, scrap: 6, links: 11 } : w.day === '2026-11-18' ? { ...w, scrap: 16, links: 17, manualPosted: 12 } : w,
  );
  const of = (d: string) => week.find((w) => w.day === d) ?? { day: d, ...emptyStaffKinds() };
  return {
    ...base,
    week,
    cur: of(day),
    prev: of(base.prevDay),
    channels:
      day === '2026-11-20'
        ? {
            ...base.channels,
            links: [
              { label: 'Facebook · Facebook Group', n: 158 },
              { label: 'ไม่ระบุช่องทาง', n: 3 },
            ],
            manualPosted: [{ label: 'Facebook · Facebook Group', n: 125 }],
            scrap: [
              { label: 'สำเร็จ', n: 6 },
              { label: 'ไม่สำเร็จ', n: 74 },
            ],
            autopost: [{ label: 'Clarissa Glady · 5 กลุ่ม', n: 2 }],
          }
        : base.channels,
    results: day === '2026-11-20' ? { clicks: 819, clicksPrev: 897, applicants: 42, applicantsPrev: 52 } : base.results,
    jobs:
      day === '2026-11-20'
        ? [
            { jobId: 'siamraj-sql:LMO6911008', label: 'LMO6911008', autopost: 2, scrap: 0, links: 161, manualPosted: 105, clicks: 65, applicants: 0 },
            { jobId: 'siamraj-sql:OPL6910061', label: 'OPL6910061', autopost: 0, scrap: 80, links: 0, manualPosted: 20, clicks: 451, applicants: 12 },
            { jobId: 'standalone:thai_executive', label: 'กล่องลอย · ผู้บริหารคนไทย', autopost: 0, scrap: 0, links: 0, manualPosted: 0, clicks: 303, applicants: 30 },
          ]
        : [],
  };
};
const fetchStaffPersonDay = vi.fn(async (q: { day: string }) => dayOf(q.day));
const fetchStaffActivityItems = vi.fn(async () => [
  { day: '2026-11-20', title: 'OPL6910061', sub: 'Facebook · Facebook Group · FIJOB', applicationId: null, requestNo: 'OPL6910061', at: '2026-11-20T02:31:19Z', jobId: 'siamraj-sql:OPL6910061' },
  { day: '2026-11-20', title: 'LMO6911008', sub: 'Facebook · Facebook Group · งานสวน', applicationId: null, requestNo: 'LMO6911008', at: '2026-11-20T06:13:23Z', jobId: 'siamraj-sql:LMO6911008' },
]);
vi.mock('@/lib/staffActivityApi', () => ({
  fetchStaffPersonDay: (q: { day: string }) => fetchStaffPersonDay(q),
  fetchStaffActivityItems: () => fetchStaffActivityItems(),
}));
const { default: StaffPersonPanel } = await import('./StaffPersonPanel');

const row = (userId: string, name: string, day: string, o: Partial<StaffActivityRow>): StaffActivityRow => ({ userId, name, bu: 'LBD', day, login: name === 'เจมส์' ? 'pakkorn.k' : 'kanyanat.y', ...emptyStaffKinds(), ...o });
const rows = [row(JAMES, 'เจมส์', '2026-11-20', { links: 161, manualPosted: 125, scrap: 80, autopost: 2 }), row(JAMES, 'เจมส์', '2026-11-19', { links: 11, scrap: 6 }), row(MAI, 'ใหม่', '2026-11-20', { scrap: 3, manualPosted: 2 })];

function draw(p: Partial<React.ComponentProps<typeof StaffPersonPanel>> = {}) {
  const onWho = vi.fn();
  const onOpenRequest = vi.fn();
  render(<StaffPersonPanel rows={rows} error={null} anchor="2026-11-20" bu={null} who={null} onWho={onWho} onOpenRequest={onOpenRequest} onNames={vi.fn()} {...p} />);
  return { onWho, onOpenRequest };
}
beforeEach(() => {
  fetchStaffPersonDay.mockClear();
  fetchStaffActivityItems.mockClear();
});
afterEach(() => cleanup());

describe('StaffPersonPanel', () => {
  it('คนเริ่มต้น = งานมากสุดของวันที่ดู · วันนี้เทียบเมื่อวานทุกแถว · งานทั้งหมด = ผลรวมชนิดงาน', async () => {
    draw();
    await waitFor(() => expect(screen.getByTestId('staff-person-row-total').textContent).toContain('368'));
    expect(fetchStaffPersonDay).toHaveBeenCalledWith(expect.objectContaining({ user: JAMES, day: '2026-11-20', from: '2026-11-14', to: '2026-11-20' }));
    expect(screen.getByTestId('staff-person-caption').textContent).toBe('20 พ.ย. เทียบ 19 พ.ย.');
    const total = screen.getByTestId('staff-person-row-total');
    expect(total.textContent).toContain('17');
    expect(total.textContent).toContain('เพิ่มขึ้น 351');
    // 368 = 161 + 125 + 80 + 2
    expect(screen.getByTestId('staff-person-row-links').textContent).toContain('เพิ่มขึ้น 150');
    // เมื่อวาน 0 → บอกเพิ่มขึ้นเป็นจำนวน ไม่ใช่ "ใหม่"
    expect(screen.getByTestId('staff-person-row-manualPosted').textContent).toContain('เพิ่มขึ้น 125');
    expect(screen.getByTestId('staff-person-row-contacts').textContent).toContain('ทรงตัว');
  });

  it('ช่องทาง/ผล อยู่ใต้ชนิดงาน · ได้อะไรกลับมาบอกลดลง', async () => {
    draw();
    await waitFor(() => expect(screen.getByTestId('staff-person-row-links').textContent).toContain('Facebook · Facebook Group 158 · ไม่ระบุช่องทาง 3'));
    expect(screen.getByTestId('staff-person-row-scrap').textContent).toContain('สำเร็จ 6 · ไม่สำเร็จ 74');
    const res = screen.getByTestId('staff-person-results');
    expect(res.textContent).toContain('819');
    expect(res.textContent).toContain('ลดลง 78');
    expect(res.textContent).toContain('ลดลง 10');
  });

  it('ทำกับใบไหน: แถวรวมเท่าแถวแม่ทุกคอลัมน์ · ใบขอกดเปิดได้ กล่องลอยเป็นข้อความ', async () => {
    const { onOpenRequest } = draw();
    await waitFor(() => expect(screen.getAllByTestId('staff-person-job')).toHaveLength(3));
    const total = screen.getByTestId('staff-person-jobs-total');
    expect([...total.querySelectorAll('td')].map((c) => c.textContent)).toEqual(['รวม 3 ใบ', '2', '80', '161', '125', '819', '42']);
    fireEvent.click(screen.getByRole('button', { name: 'OPL6910061' }));
    expect(onOpenRequest).toHaveBeenCalledWith('siamraj-sql:OPL6910061');
    expect(screen.queryByRole('button', { name: 'กล่องลอย · ผู้บริหารคนไทย' })).toBeNull();
  });

  it('กดแท่งวัน = ดูวันนั้นเทียบวันก่อนหน้า · แท่ง 7 วันอยู่ครบ', async () => {
    draw();
    await waitFor(() => expect(screen.getByTestId('staff-person-row-total').textContent).toContain('368'));
    expect(screen.getAllByTestId(/^staff-person-day-/)).toHaveLength(7);
    fireEvent.click(screen.getByTestId('staff-person-day-2026-11-19'));
    await waitFor(() => expect(screen.getByTestId('staff-person-caption').textContent).toBe('19 พ.ย. เทียบ 18 พ.ย.'));
    await waitFor(() => expect(screen.getByTestId('staff-person-row-total').textContent).toContain('ลดลง 28'));
    // วันที่ไม่มีใบ: ตารางใบยังอยู่ ขึ้นแถวว่าง + รวม 0
    expect(screen.getByTestId('staff-person-jobs').textContent).toContain('ไม่มีงานในวันนี้');
    expect(screen.getByTestId('staff-person-jobs-total').textContent).toContain('รวม 0 ใบ');
  });

  it('กดเลขงาน = รายการเรียงตามเวลา ล่าสุดก่อน · กดจากแถวใบ = เฉพาะใบนั้น', async () => {
    draw();
    await waitFor(() => expect(screen.getAllByTestId('staff-person-job')).toHaveLength(3));
    fireEvent.click(within(screen.getByTestId('staff-person-row-manualPosted')).getByRole('button', { name: '125' }));
    await waitFor(() => expect(within(screen.getByTestId('staff-person-items')).getAllByRole('listitem')).toHaveLength(2));
    expect(within(screen.getByTestId('staff-person-items')).getAllByRole('listitem')[0].textContent).toContain('LMO6911008');
    fireEvent.click(within(screen.getAllByTestId('staff-person-job')[1]).getByRole('button', { name: '20' }));
    await waitFor(() => expect(within(screen.getByTestId('staff-person-items')).getAllByRole('listitem')).toHaveLength(1));
    expect(screen.getByTestId('staff-person-items').textContent).toContain('OPL6910061');
  });

  it('เลือกคนจากข้างนอก (กดชื่อในตารางรายคน) = คนนั้น · ไม่มีงานเลย = ทุกช่อง 0 ตารางไม่หาย ไม่ยิง API', async () => {
    draw({ who: MAI });
    await waitFor(() => expect(fetchStaffPersonDay).toHaveBeenCalledWith(expect.objectContaining({ user: MAI })));
    cleanup();
    fetchStaffPersonDay.mockClear();
    draw({ rows: [] });
    expect(screen.getByTestId('staff-person-row-total').textContent).toContain('0');
    expect(screen.getByTestId('staff-person-jobs-total').textContent).toContain('รวม 0 ใบ');
    expect(screen.getAllByTestId(/^staff-person-day-/)).toHaveLength(7);
    expect(fetchStaffPersonDay).not.toHaveBeenCalled();
  });
});
