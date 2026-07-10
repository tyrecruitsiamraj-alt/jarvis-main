import { describe, it, expect } from 'vitest';
import {
  jobToRequestControlRecord,
  positionBreakdownFromJob,
  resolveRequestControlStatus,
} from '../../src/lib/requestControl';
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

describe('requestControl', () => {
  it('treats partial fill as not fully closed but counts filled positions', () => {
    const partial = job({
      unit_name: 'U',
      request_positions: 5,
      filled_positions: 2,
      cancelled_positions: 0,
      position_units: 3,
    });
    const breakdown = positionBreakdownFromJob(partial);
    expect(breakdown).toEqual({
      requestPositions: 5,
      filledPositions: 2,
      cancelledPositions: 0,
      remainingPositions: 3,
    });
    expect(resolveRequestControlStatus(breakdown)).toBe('partial');
    const rec = jobToRequestControlRecord(partial);
    expect(rec.isFullyClosed).toBe(false);
    expect(rec.isPartial).toBe(true);
    expect(rec.filledPositions).toBe(2);
    expect(rec.remainingPositions).toBe(3);
  });

  it('counts fully closed only when filled meets request', () => {
    const full = job({
      unit_name: 'U',
      status: 'closed',
      closed_date: '2026-07-10',
      request_positions: 5,
      filled_positions: 5,
      position_units: 5,
    });
    expect(resolveRequestControlStatus(positionBreakdownFromJob(full))).toBe('fully_closed');
    expect(jobToRequestControlRecord(full).isFullyClosed).toBe(true);
  });

  it('counts cancelled remaining separately from full request', () => {
    const mixed = job({
      unit_name: 'U',
      status: 'cancelled',
      request_positions: 5,
      filled_positions: 2,
      cancelled_positions: 3,
      position_units: 0,
    });
    const breakdown = positionBreakdownFromJob(mixed);
    expect(breakdown.cancelledPositions).toBe(3);
    expect(breakdown.remainingPositions).toBe(0);
    expect(resolveRequestControlStatus(breakdown)).toBe('partially_filled_cancelled_remaining');
  });

  it('full cancel without fill counts all positions as cancelled', () => {
    const cancelled = job({
      unit_name: 'U',
      status: 'cancelled',
      request_positions: 5,
      filled_positions: 0,
      cancelled_positions: 5,
    });
    expect(resolveRequestControlStatus(positionBreakdownFromJob(cancelled))).toBe('cancelled_full');
  });
});
