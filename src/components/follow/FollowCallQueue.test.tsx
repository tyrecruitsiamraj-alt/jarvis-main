/**
 * 🔴 เจ้าของสั่ง 14 ต.ค. 2569: "ตรง ต้องโทร ไม่แยก Ai กับ คนโทร รวมเลยแต่บอกว่าอันไหนคน ไหน Ai ไว้หน่อยพอ"
 * กองเดียว "ต้องโทร" · ป้าย คน/AI ทุกแถว · ไม่มีหัว "AI จะโทร" แยกแล้ว
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import FollowCallQueue from './FollowCallQueue';
import { groupFollowEntries } from '@/lib/followGrouping';
import { buildFollowDayPeople, buildFollowPlanningRows } from '@/lib/followPlanning';
import type { FollowEntry } from '@/lib/followApi';

afterEach(cleanup);

const NOW = new Date('2026-10-14T00:00:00Z'); // 07:00 ไทย
const entry = (over: Partial<FollowEntry>): FollowEntry =>
  ({
    id: 'e',
    recipient_name: 'ทดสอบ',
    recipient_phone: '0811111111',
    topic: 'ติดตามเริ่มงาน',
    note: null,
    cancelled: false,
    call_status: 'pending',
    call_outcome: null,
    created_at: '2026-10-13T00:00:00Z',
    ...over,
  }) as FollowEntry;

describe('ต้องโทร: คนกับ AI กองเดียว', () => {
  it('สายคนโทร + สาย AI อยู่ในรายการเดียว เรียงตามเวลา · ป้ายบอกใครโทร · ไม่มีกอง AI จะโทร', () => {
    const entries = [
      entry({ id: 'm', recipient_name: 'คนโทร หนึ่ง', recipient_phone: '0811111111', call_mode: 'manual', call_status: null, scheduled_at: '2026-10-14T01:00:00Z' }),
      entry({ id: 'a', recipient_name: 'เอไอ สอง', recipient_phone: '0822222222', call_mode: 'ai', dispatch_state: 'queued', scheduled_at: '2026-10-14T00:30:00Z' }),
    ];
    const rows = buildFollowPlanningRows(groupFollowEntries(entries, NOW), NOW);
    render(<FollowCallQueue people={buildFollowDayPeople(rows, '2026-10-14')} now={NOW} onOpen={() => undefined} />);
    expect(screen.queryByText('AI จะโทร')).toBeNull();
    expect(screen.getByText('ต้องโทร')).toBeTruthy();
    expect(screen.getByTestId('queue-count-todo').textContent).toBe('ต้องโทร 2');
    const persons = screen.getAllByTestId('queue-staff-person');
    // AI 07:30 มาก่อนคน 08:00
    expect(persons.map((p) => within(p).getByTestId('queue-caller').textContent)).toEqual(['AI', 'คน']);
  });
});

describe('สาย AI ที่โทรไม่ติด (เจ้าของ Choice 14 ต.ค. 2569 กรณีกันตพงศ์)', () => {
  it('อยู่ในต้องโทรให้คนตาม แต่ป้ายเป็น AI · นับในตัวเลข AI ไม่ใช่คน', () => {
    const entries = [
      entry({
        id: 'x',
        recipient_name: 'ไม่ติด หนึ่ง',
        recipient_phone: '0833333333',
        call_mode: 'ai',
        dispatch_state: 'queued',
        call_status: 'failed',
        call_outcome: 'no_answer',
        scheduled_at: '2026-10-13T23:30:00Z',
      }),
    ];
    const rows = buildFollowPlanningRows(groupFollowEntries(entries, NOW), NOW);
    render(<FollowCallQueue people={buildFollowDayPeople(rows, '2026-10-14')} now={NOW} onOpen={() => undefined} />);
    const row = screen.getByTestId('queue-staff');
    expect(within(row).getByTestId('queue-caller').textContent).toBe('AI');
    expect(row.textContent).toContain('ให้คนตาม');
    expect(screen.getByTestId('queue-count-ai').textContent).toBe('AI 1');
    expect(screen.getByTestId('queue-count-staff').textContent).toBe('คน 0');
  });
});
