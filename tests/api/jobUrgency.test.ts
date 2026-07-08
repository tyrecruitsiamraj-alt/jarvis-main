import { describe, it, expect } from 'vitest';
import { computeJobUrgency, countAgeDaysBreakdown, getJobRequestAgeLabel, matchesAgeDaysFilter, matchesUrgencyFilter } from '../../src/lib/jobUrgency';
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

  it('age label shows only ล่วงหน้า before required date', () => {
    const label = getJobRequestAgeLabel(
      job({ submittedAt: '2026-07-01', required_date: '2026-07-20' }),
      today,
    );
    expect(label).toBe('ล่วงหน้า');
  });

  it('age label shows elapsed days from required date for advance after required passes', () => {
    const label = getJobRequestAgeLabel(
      job({ submittedAt: '2026-06-01', required_date: '2026-07-05' }),
      today,
    );
    expect(label).toBe('3 วัน');
  });

  it('urgent past required counts from required date not submit date', () => {
    const label = getJobRequestAgeLabel(
      job({ submittedAt: '2026-06-29', request_date: '2026-06-29', required_date: '2026-07-01' }),
      new Date('2026-07-06T12:00:00+07:00'),
    );
    expect(label).toBe('5 วัน');
  });

  it('opl6905030: advance past required counts days since required date', () => {
    const label = getJobRequestAgeLabel(
      job({
        unit_name: 'opl6905030',
        submittedAt: '2026-05-07',
        request_date: '2026-05-07',
        required_date: '2026-05-16',
      }),
      new Date('2026-07-06T12:00:00+07:00'),
    );
    expect(label).toBe('51 วัน');
  });

  it('retroactive counts from submit date (กรอกวันนี้ = 0, +1 ทุกวัน)', () => {
    const label = getJobRequestAgeLabel(
      job({ submittedAt: '2026-07-03', required_date: '2026-07-02' }),
      today,
    );
    expect(label).toBe('5 วัน');
  });

  it('retroactive submitted today shows 0 วัน', () => {
    const label = getJobRequestAgeLabel(
      job({ submittedAt: '2026-07-08', request_date: '2026-07-08', required_date: '2026-07-05' }),
      new Date('2026-07-08T12:00:00+07:00'),
    );
    expect(label).toBe('0 วัน');
  });

  it('shows ล่วงหน้า for urgent request before required date', () => {
    const label = getJobRequestAgeLabel(
      job({ submittedAt: '2026-07-08', request_date: '2026-07-08', required_date: '2026-07-13' }),
      new Date('2026-07-08T12:00:00+07:00'),
    );
    expect(label).toBe('ล่วงหน้า');
  });

  it('parses ISO timestamps in Bangkok calendar for required-based age', () => {
    const label = getJobRequestAgeLabel(
      job({ submittedAt: '2026-06-30T17:00:00.000Z', required_date: '2026-07-05' }),
      new Date('2026-07-08T12:00:00+07:00'),
    );
    expect(label).toBe('3 วัน');
  });

  it('filters by status kind', () => {
    const retro = job({ submittedAt: '2026-07-03', required_date: '2026-07-02' });
    expect(matchesUrgencyFilter(retro, 'retroactive')).toBe(true);
    expect(matchesUrgencyFilter(retro, 'urgent')).toBe(false);
  });
});

describe('matchesAgeDaysFilter', () => {
  const today = new Date('2026-07-08T12:00:00+07:00');

  it('วันนี้ filter excludes before-required (ล่วงหน้า) jobs', () => {
    const advance = job({ submittedAt: '2026-07-08', request_date: '2026-07-08', required_date: '2026-07-20' });
    const urgent = job({ submittedAt: '2026-07-08', request_date: '2026-07-08', required_date: '2026-07-13' });
    expect(matchesAgeDaysFilter(advance, 'today', today)).toBe(false);
    expect(matchesAgeDaysFilter(urgent, 'today', today)).toBe(false);
    expect(matchesAgeDaysFilter(advance, 'advance', today)).toBe(true);
    expect(matchesAgeDaysFilter(urgent, 'advance', today)).toBe(true);
  });

  it('วันนี้ filter matches jobs due today', () => {
    const dueToday = job({ submittedAt: '2026-07-05', request_date: '2026-07-05', required_date: '2026-07-08' });
    expect(matchesAgeDaysFilter(dueToday, 'today', today)).toBe(true);
    expect(matchesAgeDaysFilter(dueToday, 'advance', today)).toBe(false);
  });
});

describe('countAgeDaysBreakdown', () => {
  const today = new Date('2026-07-15');

  it('puts advance-at-key jobs before required date in advance bucket', () => {
    const jobs = [
      job({ submittedAt: '2026-07-15', required_date: '2026-07-16' }), // urgent → 1-7
      job({ submittedAt: '2026-07-14', required_date: '2026-07-15' }), // urgent → 1-7
      job({ submittedAt: '2026-07-10', required_date: '2026-07-12' }), // urgent → 1-7
      job({ submittedAt: '2026-07-01', required_date: '2026-07-02' }), // retro → 8-14
      job({ submittedAt: '2026-06-20', required_date: '2026-06-21' }), // retro → 15-30
      job({ submittedAt: '2026-05-01', required_date: '2026-05-02' }), // retro → 30+
      job({ submittedAt: '2026-07-01', required_date: '2026-08-01' }), // advance → advance
    ];
    const counts = countAgeDaysBreakdown(jobs, today);
    expect(counts.advance).toBe(1);
    expect(counts['1-7']).toBe(3);
    expect(counts['8-14']).toBe(1);
    expect(counts['15-30']).toBe(1);
    expect(counts['30+']).toBe(1);
    const sum = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(jobs.length);
  });

  it('counts urgent jobs in age buckets even before required date', () => {
    const counts = countAgeDaysBreakdown(
      [job({ submittedAt: '2026-07-12', required_date: '2026-07-18' })],
      today,
    );
    expect(counts.advance).toBe(0);
    expect(counts['1-7']).toBe(1);
  });

  it('moves former advance jobs into age buckets after required date passes', () => {
    const counts = countAgeDaysBreakdown(
      [job({ submittedAt: '2026-06-01', required_date: '2026-07-05' })],
      today,
    );
    expect(counts.advance).toBe(0);
    expect(counts['8-14']).toBe(1);
  });

  it('counts one request per bucket regardless of position_units', () => {
    const counts = countAgeDaysBreakdown(
      [job({ submittedAt: '2026-07-01', required_date: '2026-08-01', position_units: 6 })],
      today,
    );
    expect(counts.advance).toBe(6);
  });

  it('bucket position totals match sumJobPositionUnits', () => {
    const jobs = [
      job({ submittedAt: '2026-07-01', required_date: '2026-08-01', position_units: 3 }),
      job({ submittedAt: '2026-07-10', required_date: '2026-07-12', position_units: 2 }),
    ];
    const counts = countAgeDaysBreakdown(jobs, today);
    const sum = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(5);
  });
});
