/**
 * การประกาศรับสมัคร (เจ้าของ 19 พ.ย. 2569 "ทำเป็น Dropdown กราฟแท่งอยู่ซ้ายแล้ว รายชื่อใบขอมาอยู่ขวา แล้วถ้าเลือกประกาศแล้ว
 * ในกราฟแท่งของแต่ละ Bu บอกด้วยว่ามีคนสมัคร ไม่มีคนสมัคร อย่างละกี่ใบ") — วาดจริงใน jsdom ใบรูปเดียวกับของจริง
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { StuckRequest } from '@/lib/recruitStuck';

(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
const { default: PostingProgress } = await import('./PostingProgress');
afterEach(() => cleanup());

const req = (no: string, o: Partial<StuckRequest>): StuckRequest =>
  ({ requestNo: no, jobId: `siamraj-sql:${no}`, bu: 'LBD', remaining: 1, requested: 1, filled: 0, cancelled: 0, unitName: 'ธนาคาร  ไทยพาณิชย์  จำกัด (มหาชน)', recruiter: 'แบงค์', ageDays: 9, state: 'open', released: true, applications: 0, sourcing: true, people: {}, ...o }) as unknown as StuckRequest;
const open: StuckRequest[] = [
  req('OPL6911018', { applications: 3, people: { queued: ['app-1', 'app-2', 'app-3'] } as StuckRequest['people'] }),
  req('OPL6911023', {}),
  req('OPL6911045', { applications: 1, people: { queued: ['app-4'] } as StuckRequest['people'] }),
  req('LAO6911012', { bu: 'LBA', recruiter: 'ฟอร์ด', applications: 0 }),
  req('LMO6911016', { bu: 'LM', released: false, sourcing: false }),
];

function draw(view: 'released' | 'unreleased' = 'released') {
  const onView = vi.fn();
  const onNames = vi.fn();
  render(<PostingProgress view={view} open={open} onView={onView} onOpenRequest={vi.fn()} onNames={onNames} resetKey="k" />);
  return { onView, onNames };
}

describe('PostingProgress — Dropdown · กราฟ BU ซ้อนมีคนกรอก/ยังไม่มีคนกรอก · รายการใบขวา', () => {
  it('ประกาศแล้ว: แท่ง LBD แยก มีคนกรอก 2 ใบ / ยังไม่มีคนกรอก 1 ใบ · LBA ยังไม่มีคนกรอก 1', () => {
    draw();
    expect(screen.getByTestId('v2-post-seg-LBD-applied').getAttribute('title')).toContain('2 ใบ');
    expect(screen.getByTestId('v2-post-seg-LBD-silent').getAttribute('title')).toContain('1 ใบ');
    expect(screen.getByTestId('v2-post-seg-LBA-silent')).toBeTruthy();
    expect(screen.queryByTestId('v2-post-seg-LBA-applied')).toBeNull();
    expect(within(screen.getByTestId('v2-post-list')).getAllByRole('row').length).toBe(5); // หัว + 4 ใบประกาศแล้ว
  });
  it('กดส่วนมีคนกรอกของ LBD = รายการขวาเหลือ 2 ใบ · กดคนสมัครเปิดรายชื่อ', () => {
    const { onNames } = draw();
    fireEvent.click(screen.getByTestId('v2-post-seg-LBD-applied'));
    const list = screen.getByTestId('v2-post-list');
    expect(within(list).getAllByRole('row').length).toBe(3);
    fireEvent.click(within(list).getByText('3 คน'));
    expect(onNames).toHaveBeenCalledWith(expect.stringContaining('OPL6911018'), ['app-1', 'app-2', 'app-3'], expect.any(Object));
  });
  it('รายการเลือกสลับเป็นยังไม่ประกาศ', () => {
    const { onView } = draw();
    fireEvent.click(screen.getByTestId('v2-post-view'));
    fireEvent.click(screen.getByTestId('v2-post-unreleased'));
    expect(onView).toHaveBeenCalledWith('unreleased');
  });
});
