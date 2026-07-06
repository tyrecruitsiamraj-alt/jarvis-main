import { describe, it, expect } from 'vitest';
import { buildDateRangeYmd } from '../../src/lib/dateTh';
import {
  buildWlCoverageByUnit,
  countPenaltyDays,
  enrichJobsWithPenalty,
} from '../../src/lib/jobPenalty';
import type { JobRequest, WorkCalendarEntry } from '@/types';

function job(partial: Partial<JobRequest> & { unit_name: string }): JobRequest {
  return {
    id: 'j1',
    job_type: 'thai_executive',
    job_category: 'private',
    status: 'open',
    urgency: 'advance',
    total_income: 1000,
    location_address: 'BKK',
    request_date: '2026-07-01',
    required_date: '2026-07-07',
    penalty_per_day: 500,
    days_without_worker: 0,
    total_penalty: 0,
    created_at: '2026-07-01',
    ...partial,
  };
}

function wl(unit: string, date: string): WorkCalendarEntry {
  return {
    id: `wl-${unit}-${date}`,
    employee_id: 'e1',
    work_date: date,
    client_name: unit,
    status: 'normal_work',
    created_at: '2026-07-01',
    updated_at: '2026-07-01',
  };
}

describe('jobPenalty', () => {
  it('matches example: 07 WL ok, 08 miss, 09-end month WL ok → 1 penalty day', () => {
    const unit = 'ศูนย์ A';
    const calendar = [
      wl(unit, '2026-07-07'),
      ...buildDateRangeYmd('2026-07-09', '2026-07-31').map((d) => wl(unit, d)),
    ];
    const coverage = buildWlCoverageByUnit(calendar);
    const j = job({ unit_name: unit, required_date: '2026-07-07', penalty_per_day: 500 });

    expect(countPenaltyDays(j, coverage, new Date('2026-07-31'))).toBe(1);

    const enriched = enrichJobsWithPenalty([j], calendar, new Date('2026-07-31'))[0];
    expect(enriched?.days_without_worker).toBe(1);
    expect(enriched?.total_penalty).toBe(500);
  });

  it('ignores non-normal_work WL entries', () => {
    const unit = 'Unit X';
    const coverage = buildWlCoverageByUnit([
      { ...wl(unit, '2026-07-07'), status: 'no_show' },
    ]);
    expect(countPenaltyDays(job({ unit_name: unit }), coverage, new Date('2026-07-07'))).toBe(1);
  });

  it('returns zero for cancelled jobs', () => {
    const enriched = enrichJobsWithPenalty(
      [job({ unit_name: 'U', status: 'cancelled' })],
      [],
      new Date('2026-07-10'),
    )[0];
    expect(enriched?.days_without_worker).toBe(0);
    expect(enriched?.total_penalty).toBe(0);
  });
});
