import { describe, it, expect } from 'vitest';
import { computeJobUrgency, countAgeDaysBreakdown, getJobRequestAgeLabel, matchesUrgencyFilter } from '../../src/lib/jobUrgency';
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

describe('computeJobUrgency', () => {
  const today = new Date('2026-07-08T12:00:00');

  it('retroactive when required before submitted', () => {
    const meta = computeJobUrgency(
      job({ submittedAt: '2026-07-03', required_date: '2026-07-02' }),
      today,
    );
    expect(meta.kind).toBe('retroactive');
  });

  it('urgent when lead under 7 days', () => {
    const meta = computeJobUrgency(
      job({ submittedAt: '2026-07-01', required_date: '2026-07-05' }),
      today,
    );
    expect(meta.kind).toBe('urgent');
  });

  it('advance when lead 7+ and not past required', () => {
    const meta = computeJobUrgency(
      job({ submittedAt: '2026-07-01', required_date: '2026-07-20' }),
      today,
    );
    expect(meta.kind).toBe('advance');
  });

  it('advance when lead 7+ even if past required date', () => {
    const meta = computeJobUrgency(
      job({ submittedAt: '2026-06-01', required_date: '2026-07-05' }),
      today,
    );
    expect(meta.kind).toBe('advance');
    expect(meta.daysPastRequired).toBeGreaterThanOrEqual(1);
  });

  it('age label shows ล่วงหน้าก่อน for advance', () => {
    const label = getJobRequestAgeLabel(
      job({ submittedAt: '2026-07-01', required_date: '2026-07-20' }),
      today,
    );
    expect(label).toBe('ล่วงหน้าก่อน');
  });

  it('age label shows ล่วงหน้าก่อน for advance past required', () => {
    const label = getJobRequestAgeLabel(
      job({ submittedAt: '2026-06-01', required_date: '2026-07-05' }),
      today,
    );
    expect(label).toBe('ล่วงหน้าก่อน');
  });

  it('filters by status kind', () => {
    const retro = job({ submittedAt: '2026-07-03', required_date: '2026-07-02' });
    expect(matchesUrgencyFilter(retro, 'retroactive')).toBe(true);
    expect(matchesUrgencyFilter(retro, 'urgent')).toBe(false);
  });
});

describe('countAgeDaysBreakdown', () => {
  const today = new Date('2026-07-15');

  it('buckets urgent/retroactive jobs by days since submitted', () => {
    const counts = countAgeDaysBreakdown(
      [
        job({ submittedAt: '2026-07-14', required_date: '2026-07-15' }), // retroactive, 1 day
        job({ submittedAt: '2026-07-10', required_date: '2026-07-12' }), // retroactive, 5 days
        job({ submittedAt: '2026-07-01', required_date: '2026-07-02' }), // retroactive, 14 days
        job({ submittedAt: '2026-06-20', required_date: '2026-06-21' }), // retroactive, 25 days
        job({ submittedAt: '2026-05-01', required_date: '2026-05-02' }), // retroactive, 30+
        job({ submittedAt: '2026-07-01', required_date: '2026-08-01' }), // advance — skip
      ],
      today,
    );
    expect(counts['1-7']).toBe(2);
    expect(counts['8-14']).toBe(1);
    expect(counts['15-30']).toBe(1);
    expect(counts['30+']).toBe(1);
  });
});
