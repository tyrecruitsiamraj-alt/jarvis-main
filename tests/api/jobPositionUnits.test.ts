import { describe, it, expect } from 'vitest';
import { jobPositionUnits, sumJobPositionUnits } from '../../src/lib/jobPositionUnits';
import type { JobRequest } from '../../src/types';

function job(partial: Partial<JobRequest>): JobRequest {
  return {
    id: 'test',
    unit_name: 'Unit',
    request_date: '2026-07-01',
    required_date: '2026-07-10',
    urgency: 'advance',
    total_income: 0,
    location_address: '',
    job_type: 'central',
    job_category: 'private',
    penalty_per_day: 0,
    days_without_worker: 0,
    total_penalty: 0,
    status: 'active',
    created_at: '2026-07-01',
    ...partial,
  };
}

describe('jobPositionUnits', () => {
  it('uses position_units when set', () => {
    expect(jobPositionUnits(job({ position_units: 6 }))).toBe(6);
  });

  it('defaults to 1 when missing', () => {
    expect(jobPositionUnits(job({}))).toBe(1);
  });

  it('sums across jobs', () => {
    expect(sumJobPositionUnits([job({ position_units: 2 }), job({ position_units: 3 })])).toBe(5);
  });
});
