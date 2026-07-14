import { describe, it, expect } from 'vitest';
import { buildLifecycleBoardSummary } from '../../src/lib/dashboard/lifecycle';
import type { JobRequest } from '@/types';

function job(partial: Partial<JobRequest> & { unit_name: string }): JobRequest {
  return {
    id: partial.id ?? 'j1',
    job_type: 'thai_executive',
    job_category: 'private',
    status: 'open',
    urgency: 'advance',
    total_income: 0,
    location_address: 'Bangkok',
    penalty_per_day: 0,
    days_without_worker: 0,
    total_penalty: 0,
    request_date: '2026-07-01',
    required_date: '2026-07-20',
    created_at: '2026-07-01',
    ...partial,
  };
}

describe('buildLifecycleBoardSummary', () => {
  it('splits intake filled cancelled remaining by lifecycle kind', () => {
    const open = [
      job({
        id: 'r1',
        unit_name: 'A',
        request_action_name: 'ลาออก',
        request_positions: 10,
        filled_positions: 4,
        cancelled_positions: 0,
        position_units: 6,
      }),
      job({
        id: 'p1',
        unit_name: 'B',
        request_action_name: 'เปลี่ยนตัว',
        request_positions: 5,
        filled_positions: 0,
        cancelled_positions: 0,
        position_units: 5,
      }),
    ];
    const closed = [
      job({
        id: 'c1',
        unit_name: 'C',
        status: 'closed',
        request_action_name: 'เพิ่มอัตรา',
        request_positions: 3,
        filled_positions: 3,
        cancelled_positions: 0,
        position_units: 0,
        closed_date: '2026-07-10',
      }),
    ];
    const board = buildLifecycleBoardSummary([...open, ...closed], open);
    const requested = board.rows.find((r) => r.id === 'requested')!;
    const filled = board.rows.find((r) => r.id === 'filled')!;
    const remaining = board.rows.find((r) => r.id === 'remaining')!;
    expect(requested.total.positions).toBe(18);
    expect(requested.resignation.positions).toBe(10);
    expect(requested.replacement.positions).toBe(5);
    expect(requested.increaseHeadcount.positions).toBe(3);
    expect(filled.total.positions).toBe(7);
    expect(filled.increaseHeadcount.positions).toBe(3);
    expect(remaining.total.positions).toBe(11);
    expect(remaining.resignation.positions).toBe(6);
    expect(remaining.replacement.positions).toBe(5);
    expect(board.fillRateByKind.increase_headcount).toBe(100);
  });
});
