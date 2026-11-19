/**
 * ก้อนใบขอของภาพรวม (เจ้าของ 19 พ.ย. 2569 "เอาขึ้นระบบเลย") — วาดจริงใน jsdom ด้วยใบรูปเดียวกับของจริง ไม่แตะฐาน
 * เลือกเรื่อง (ค่าเริ่ม กำลังดำเนินการสรรหา) · ตัวกรอง สรรหา/คัดสรร/ชนิดใบ · กด BU = ตารางเหลือ BU นั้น · หน้าละ 10 · AI สนใจ/นัดได้ กดแล้วเปิดรายชื่อ
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { StuckRequest } from '@/lib/recruitStuck';
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

function draw(onNames = vi.fn()) {
  render(
    <RequestBuPanel rows={rows} jobs={jobs} bus={['LBD', 'LBA', 'LM', 'SN', 'DS']} rangeText="1–19 พ.ย." error={null} onOpenRequest={vi.fn()} onNames={onNames} resetKey="k" />,
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
});
