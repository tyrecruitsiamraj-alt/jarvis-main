import { describe, it, expect } from 'vitest';
import { buildLifecycleBoardFromStockSources } from '../../src/lib/dashboard/lifecycle';
import type { ThroughputRecord } from '../../src/lib/dashboard/throughput';
import { sumCohortStockByRequestDate } from '../../src/lib/dashboard/throughput';
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

describe('buildLifecycleBoardFromStockSources', () => {
  it('matches cohort stock totals for เข้ามา/ปิดแล้ว/ยกเลิก and open remaining for คงเหลือ', () => {
    const records: ThroughputRecord[] = [
      {
        requestNo: 'A',
        requestDate: '2026-03-01',
        closureDate: null,
        positionUnits: 10,
        isOpen: false,
        kind: 'filled',
        requestActionName: 'ลาออก',
        lifecycleKind: 'resignation',
      },
      {
        requestNo: 'A',
        requestDate: '2026-03-01',
        closureDate: null,
        positionUnits: 6,
        isOpen: true,
        kind: 'remaining',
        requestActionName: 'ลาออก',
        lifecycleKind: 'resignation',
      },
      {
        requestNo: 'B',
        requestDate: '2026-04-01',
        closureDate: null,
        positionUnits: 5,
        isOpen: false,
        kind: 'cancelled',
        requestActionName: 'เปลี่ยนตัว',
        lifecycleKind: 'replacement',
      },
      {
        requestNo: 'C',
        requestDate: '2026-05-01',
        closureDate: null,
        positionUnits: 3,
        isOpen: false,
        kind: 'filled',
        requestActionName: 'เพิ่มอัตรา',
        lifecycleKind: 'increase_headcount',
      },
      {
        requestNo: 'D',
        requestDate: '2025-12-01',
        closureDate: null,
        positionUnits: 99,
        isOpen: false,
        kind: 'cancelled',
        requestActionName: 'ลาออก',
        lifecycleKind: 'resignation',
      },
    ];
    const remainingJobs = [
      job({
        id: 'A',
        request_no: 'A',
        unit_name: 'A',
        request_action_name: 'ลาออก',
        request_positions: 16,
        filled_positions: 10,
        cancelled_positions: 0,
        position_units: 6,
        request_date: '2026-03-01',
      }),
    ];
    const from = '2026-01-01';
    const to = '2026-12-31';
    const cohort = sumCohortStockByRequestDate(records, from, to);
    const board = buildLifecycleBoardFromStockSources({
      throughputRecords: records,
      from,
      to,
      remainingJobs,
    });
    const requested = board.rows.find((r) => r.id === 'requested')!;
    const filled = board.rows.find((r) => r.id === 'filled')!;
    const cancelled = board.rows.find((r) => r.id === 'cancelled')!;
    const remaining = board.rows.find((r) => r.id === 'remaining')!;
    expect(requested.total.positions).toBe(cohort.requestPositions);
    expect(filled.total.positions).toBe(cohort.filledPositions);
    expect(cancelled.total.positions).toBe(cohort.cancelledPositions);
    expect(remaining.total.positions).toBe(6);
    expect(requested.resignation.positions).toBe(16);
    expect(cancelled.replacement.positions).toBe(5);
    expect(filled.increaseHeadcount.positions).toBe(3);
  });
});
