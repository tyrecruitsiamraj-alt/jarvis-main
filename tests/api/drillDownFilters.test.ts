import { describe, it, expect } from 'vitest';
import { filterJobsClosedInPeriod, filterJobsForRemainingKpi } from '../../src/lib/dashboard/drillDownFilters';
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

describe('filterJobsClosedInPeriod', () => {
  it('includes jobs closed in range regardless of request date', () => {
    const jobs = [
      job({
        id: 'backlog',
        unit_name: 'A',
        status: 'closed',
        request_date: '2026-06-01',
        required_date: '2026-06-01',
        closed_date: '2026-07-05',
      }),
      job({
        id: 'same',
        unit_name: 'B',
        status: 'closed',
        request_date: '2026-07-02',
        required_date: '2026-07-20',
        closed_date: '2026-07-10',
      }),
      job({ id: 'open', unit_name: 'C', request_date: '2026-07-03' }),
      job({
        id: 'outside',
        unit_name: 'D',
        status: 'closed',
        request_date: '2026-05-01',
        required_date: '2026-05-01',
        closed_date: '2026-06-15',
      }),
    ];
    const list = filterJobsClosedInPeriod(jobs, '2026-07-01', '2026-07-31');
    expect(list.map((j) => j.id).sort()).toEqual(['backlog', 'same']);
  });
});

describe('filterJobsForRemainingKpi', () => {
  it('returns all open jobs when no period', () => {
    const jobs = [
      job({ id: 'a', unit_name: 'A', position_units: 2, request_date: '2026-05-01', required_date: '2026-05-01' }),
      job({ id: 'b', unit_name: 'B', position_units: 3, request_date: '2026-07-02', required_date: '2026-07-20' }),
      job({ id: 'c', unit_name: 'C', status: 'closed', position_units: 9, request_date: '2026-07-01', required_date: '2026-07-01' }),
    ];
    const list = filterJobsForRemainingKpi(jobs, null, new Date('2026-07-15'));
    expect(list.map((j) => j.id).sort()).toEqual(['a', 'b']);
  });

  it('scopes open jobs to selected period by effective request date', () => {
    const jobs = [
      job({ id: 'old', unit_name: 'A', position_units: 52, request_date: '2026-05-01', required_date: '2026-05-01' }),
      job({ id: 'new', unit_name: 'B', position_units: 45, request_date: '2026-07-02', required_date: '2026-07-20' }),
    ];
    const list = filterJobsForRemainingKpi(
      jobs,
      { from: '2026-07-01', to: '2026-07-31' },
      new Date('2026-07-15'),
    );
    expect(list.map((j) => j.id)).toEqual(['new']);
  });
});
