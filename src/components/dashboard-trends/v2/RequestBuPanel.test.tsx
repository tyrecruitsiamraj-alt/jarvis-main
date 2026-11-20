/**
 * ก้อนใบขอของภาพรวม (เจ้าของ 19 พ.ย. 2569 "เอาขึ้นระบบเลย") — วาดจริงใน jsdom ด้วยใบรูปเดียวกับของจริง ไม่แตะฐาน
 * เลือกเรื่อง (ค่าเริ่ม กำลังดำเนินการสรรหา) · ตัวกรอง สรรหา/คัดสรร/ชนิดใบ · กด BU = ตารางเหลือ BU นั้น · หน้าละ 10 · AI สนใจ/นัดได้ กดแล้วเปิดรายชื่อ
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { StuckMonthBlock, StuckRequest } from '@/lib/recruitStuck';
import type { JobRequest } from '@/types';

(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
const { default: RequestBuPanel } = await import('./RequestBuPanel');

afterEach(() => cleanup());

function req(no: string, o: Partial<StuckRequest> = {}): StuckRequest {
  return {
    requestNo: no,
    jobId: `siamraj-sql:${no}`,
    day: '2026-11-03',
    bu: 'LBD',
    requested: 1,
    filled: 0,
    cancelled: 0,
    remaining: 1,
    unitName: 'ธนาคารกรุงศรีอยุธยา  จำกัด (มหาชน)',
    recruiter: 'คิว',
    screener: 'อ้อแอ้',
    leadKind: 'advance',
    ageDays: 12,
    state: 'open',
    inRange: true,
    aiYesIds: [],
    apptIds: [],
    ...o,
  } as unknown as StuckRequest;
}
const job = (no: string, work_status: string) => ({ id: `siamraj-sql:${no}`, work_status }) as unknown as JobRequest;

const rows: StuckRequest[] = [
  ...Array.from({ length: 12 }, (_, i) => req(`OPL69110${String(10 + i)}`, { ageDays: 30 - i })),
  req('LAO6911003', { bu: 'LBA', recruiter: 'ฟอร์ด', screener: 'แป๋ม', leadKind: 'urgent', aiYesIds: ['app-9f1c', 'app-77b2'], apptIds: ['app-77b2'] }),
  req('LMO6911016', { bu: 'LM', recruiter: null, screener: null, leadKind: 'retroactive', remaining: 2, requested: 2 }),
  req('OPL6910024', { state: 'cancelled', remaining: 0, cancelled: 1, inRange: false, leadKind: 'urgent' }),
];
const jobs = [...rows.filter((r) => r.state === 'open').map((r) => job(r.requestNo, 'in_progress')), job('LMO6911016', 'waiting_inform')];

/** ช่วง 1 ต.ค. – 19 พ.ย.: ต.ค. เต็มเดือน · พ.ย. ถึงวันที่ 19 (ใบของเดือนท้าย = ใบของทั้งช่วง) */
const TODAY = '2026-11-19';
const months: StuckMonthBlock[] = [
  {
    month: '2026-10',
    from: '2026-10-01',
    to: '2026-10-31',
    rows: [
      ...Array.from({ length: 9 }, (_, i) => req(`OPL69100${String(10 + i)}`)),
      req('LAO6910002', { bu: 'LBA', recruiter: 'ฟอร์ด' }),
      req('OPL6909031', { inRange: false, state: 'filled', remaining: 0, filled: 1 }),
    ],
  },
  { month: '2026-11', from: '2026-11-01', to: '2026-11-19', rows },
];

function draw(onNames = vi.fn()) {
  render(
    <RequestBuPanel
      rows={rows}
      jobs={jobs}
      bus={['LBD', 'LBA', 'LM', 'SN', 'DS']}
      rangeText="1–19 พ.ย."
      months={months}
      today={TODAY}
      error={null}
      onOpenRequest={vi.fn()}
      onNames={onNames}
      resetKey="k"
    />,
  );
  return onNames;
}

describe('RequestBuPanel', () => {
  it('ค่าเริ่ม = กำลังดำเนินการสรรหา · เลขรวมเท่าผลรวมแท่ง BU · หน้าละ 10 แถว', () => {
    draw();
    expect(screen.getByTestId('req-bu-topic').textContent).toContain('กำลังดำเนินการสรรหา');
    // ใบเปิดสถานะดำเนินการ 13 ใบ (LBD 12 + LBA 1) · LM อยู่รอแจ้งเข้า
    expect(screen.getByTestId('req-bu-total').textContent).toBe('13');
    expect(within(screen.getByTestId('req-bu-bar-LBD')).getByText('12')).toBeTruthy();
    expect(within(screen.getByTestId('req-bu-bar-SN')).getByText('0')).toBeTruthy();
    const list = screen.getByTestId('req-bu-list');
    expect(within(list).getAllByRole('row').length).toBe(11); // หัว + 10
    expect(screen.getByTestId('req-bu-pager').textContent).toContain('1–10 จาก 13');
    // ตัวเลขทุกเรื่องข้างกราฟแท่ง (แทนโดนัท 20 พ.ย. 2569) · กดแถว = เลือกเรื่อง
    expect(screen.getByTestId('req-bu-number-work_status_in_progress').textContent).toContain('13');
    fireEvent.click(screen.getByTestId('req-bu-number-remaining'));
    expect(screen.getByTestId('req-bu-total').textContent).toBe('15');
    // ทุกแถวบอก "อัตรา · ใบ" แบบเดียวกัน — ไม่มีปิดครบ/ยกเลิกทั้งใบปน (เจ้าของ 20 พ.ย. 2569 "เอาแค่ ปิดได้กี่อัตรา กี่ใบพอ")
    expect(screen.getByTestId('req-bu-number-cancelled').textContent).toBe('ยกเลิก1 · 1 ใบ');
    expect(screen.getByTestId('req-bu-numbers').textContent).not.toMatch(/ปิดครบ|ยกเลิกทั้งใบ/);
  });

  it('แท่ง BU เรียง LBD ซ้ายสุดเสมอ ไม่ตามลำดับที่ส่งมา', () => {
    render(<RequestBuPanel rows={rows} jobs={jobs} bus={['SN', 'DS', 'LM', 'LBA', 'LBD']} rangeText="" months={null} today={TODAY} error={null} onOpenRequest={vi.fn()} onNames={vi.fn()} resetKey="k" />);
    expect(screen.getAllByTestId(/^req-bu-bar-/).map((b) => b.getAttribute('data-testid'))).toEqual(['req-bu-bar-LBD', 'req-bu-bar-LBA', 'req-bu-bar-LM', 'req-bu-bar-SN', 'req-bu-bar-DS']);
  });

  it('กดแท่ง BU = ตารางเหลือ BU นั้น · กดซ้ำ = ทุก BU', () => {
    draw();
    fireEvent.click(screen.getByTestId('req-bu-bar-LBA'));
    expect(screen.getByTestId('req-bu-list').textContent).toContain('LAO6911003');
    expect(screen.getByTestId('req-bu-list').textContent).not.toContain('OPL6911010');
    fireEvent.click(screen.getByTestId('req-bu-bar-LBA'));
    expect(screen.getByTestId('req-bu-pager').textContent).toContain('จาก 13');
  });

  it('AI สนใจ / นัดได้ กดแล้วเปิดรายชื่อชุดของใบนั้น', () => {
    const onNames = draw();
    fireEvent.click(screen.getByTestId('req-bu-bar-LBA'));
    fireEvent.click(screen.getByTestId('req-bu-names-yes'));
    expect(onNames).toHaveBeenCalledWith(expect.stringContaining('LAO6911003'), ['app-9f1c', 'app-77b2']);
    fireEvent.click(screen.getByTestId('req-bu-names-appt'));
    expect(onNames).toHaveBeenLastCalledWith(expect.stringContaining('นัดได้'), ['app-77b2']);
  });

  it('ตัวกรองชนิดใบ / เจ้าหน้าที่สรรหา คัดใบก่อนทุกอย่าง', () => {
    draw();
    fireEvent.click(screen.getByTestId('req-bu-filter-kind'));
    const opts = screen.getAllByTestId('req-bu-opt-kind');
    fireEvent.click(opts[1]); // ฉุกเฉิน
    expect(screen.getByTestId('req-bu-total').textContent).toBe('1');
    expect(screen.getByTestId('req-bu-list').textContent).toContain('LAO6911003');
  });
  it('รายเดือน — แท่งของเดือน = เลขของเรื่องนั้นในเดือนนั้น · บอกเพิ่มขึ้น/ลดลงจากเดือนก่อน · ป้ายเดือนไม่เต็มบอกช่วงวัน', () => {
    draw();
    fireEvent.click(screen.getByTestId('req-bu-number-new'));
    const oct = screen.getByTestId('req-bu-month-2026-10');
    const nov = screen.getByTestId('req-bu-month-2026-11');
    // ขอใหม่ ต.ค. 10 อัตรา (ใบยกมาไม่นับ) · พ.ย. 15 = เลขใหญ่ของช่วง (ใบชุดเดียวกัน)
    expect(within(oct).getByText('10')).toBeTruthy();
    expect(within(oct).getByText('ต.ค.')).toBeTruthy();
    expect(within(nov).getByText('15')).toBeTruthy();
    expect(within(nov).getByText('1–19 พ.ย.')).toBeTruthy();
    expect(nov.textContent).toContain('เพิ่มขึ้น 5');
    expect(oct.querySelector('[data-trend]')).toBeNull();
    // หาได้แล้ว: ต.ค. 1 → พ.ย. 0
    fireEvent.click(screen.getByTestId('req-bu-number-filled'));
    expect(screen.getByTestId('req-bu-month-2026-11').textContent).toContain('ลดลง 1');
  });

  it('รายเดือนตามตัวกรองและ BU ที่กด — เลขเดือนท้ายเท่าแท่ง BU', () => {
    draw();
    fireEvent.click(screen.getByTestId('req-bu-number-new'));
    fireEvent.click(screen.getByTestId('req-bu-bar-LBA'));
    expect(screen.getByTestId('req-bu-months').textContent).toContain('รายเดือน · LBA');
    expect(within(screen.getByTestId('req-bu-month-2026-10')).getByText('1')).toBeTruthy();
    expect(within(screen.getByTestId('req-bu-month-2026-11')).getByText('1')).toBeTruthy();
    expect(screen.getByTestId('req-bu-month-2026-11').textContent).toContain('ทรงตัว');
  });

  it('สถานะทำงานของเดือนที่จบไปแล้ว = ไม่มีข้อมูล (ไม่ยุบเป็น 0) · เดือนที่ยังไม่จบมีเลข', () => {
    draw();
    const oct = screen.getByTestId('req-bu-month-2026-10');
    const nov = screen.getByTestId('req-bu-month-2026-11');
    expect(oct.textContent).toContain('ไม่มีข้อมูล');
    expect(within(nov).getByText('13')).toBeTruthy();
    expect(nov.textContent).toContain('เทียบไม่ได้');
  });

  it('รายเดือนยังโหลด = ที่ว่างรอ ไม่หาย', () => {
    render(<RequestBuPanel rows={rows} jobs={jobs} bus={['LBD']} rangeText="" months={null} today={TODAY} error={null} onOpenRequest={vi.fn()} onNames={vi.fn()} resetKey="k" />);
    expect(screen.getByTestId('req-bu-months')).toBeTruthy();
    expect(screen.queryByTestId('req-bu-month-2026-11')).toBeNull();
  });
});
