import { describe, it, expect } from 'vitest';
import { departmentFilterOptions, jobSubtypeFilterOptions } from '../../src/lib/siamrajUnitFilters';
import type { JobRequest } from '@/types';

function job(partial: Partial<JobRequest> & Pick<JobRequest, 'id'>): JobRequest {
  return {
    unit_name: 'Unit',
    location_address: '',
    status: 'open',
    urgency: 'advance',
    total_income: 0,
    job_type: 'driver',
    job_category: 'private',
    penalty_per_day: 0,
    days_without_worker: 0,
    total_penalty: 0,
    request_date: '2026-01-01',
    created_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('siamrajUnitFilters counts', () => {
  it('counts position units per department', () => {
    const jobs = [
      job({ id: '1', department_code: 'LBD', position_units: 4 }),
      job({ id: '2', department_code: 'LBD', position_units: 2 }),
      job({ id: '3', department_code: 'LBA', position_units: 1 }),
    ];

    const options = departmentFilterOptions(jobs);
    expect(options.find((o) => o.value === 'all')?.label).toBe('ทั้งหมด (7)');
    expect(options.find((o) => o.value === 'LBD')?.label).toBe('LBD (6)');
    expect(options.find((o) => o.value === 'LBA')?.label).toBe('LBA (1)');
  });

  it('counts position units per job subtype', () => {
    const jobs = [
      job({ id: '1', job_description_code_2: 'พขร.', position_units: 3 }),
      job({ id: '2', job_description_code_2: 'พขร.', position_units: 1 }),
    ];

    const options = jobSubtypeFilterOptions(jobs);
    expect(options.find((o) => o.value === 'all')?.label).toBe('ทั้งหมด (4)');
    expect(options.find((o) => o.value === 'พขร.')?.label).toBe('พขร. (4)');
  });
});
