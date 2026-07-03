import { describe, expect, it } from 'vitest';
import type { JobRequest } from '@/types';
import { diffUnitRequestFeedNotifications } from '@/lib/unitRequestFeedNotifications';

function job(partial: Partial<JobRequest> & { id: string; request_no?: string }): JobRequest {
  return {
    unit_name: 'Unit A',
    job_type: 'driver',
    job_category: 'replacement',
    gender_requirement: 'any',
    age_range_min: 18,
    age_range_max: 60,
    location_address: 'Bangkok',
    total_income: 0,
    total_penalty: 0,
    status: 'open',
    ...partial,
  } as JobRequest;
}

describe('diffUnitRequestFeedNotifications', () => {
  it('does not notify on first snapshot', () => {
    const jobs = [job({ id: '1', request_no: 'R001', status: 'open' })];
    const { events, next } = diffUnitRequestFeedNotifications(null, jobs);
    expect(events).toEqual([]);
    expect(next.get('R001')).toBe('open');
  });

  it('notifies for new request', () => {
    const prev = new Map([['R001', 'open']]);
    const jobs = [
      job({ id: '1', request_no: 'R001', status: 'open' }),
      job({ id: '2', request_no: 'R002', status: 'open' }),
    ];
    const { events } = diffUnitRequestFeedNotifications(prev, jobs);
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('new_job');
    expect(events[0]?.job.request_no).toBe('R002');
  });

  it('notifies when status becomes closed', () => {
    const prev = new Map([['R001', 'open']]);
    const jobs = [job({ id: '1', request_no: 'R001', status: 'closed' })];
    const { events } = diffUnitRequestFeedNotifications(prev, jobs);
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('job_closed');
  });

  it('does not notify for other status changes', () => {
    const prev = new Map([['R001', 'closed']]);
    const jobs = [job({ id: '1', request_no: 'R001', status: 'open' })];
    const { events } = diffUnitRequestFeedNotifications(prev, jobs);
    expect(events).toEqual([]);
  });

  it('keeps snapshot when feed is temporarily empty', () => {
    const prev = new Map([['R001', 'open']]);
    const { events, next } = diffUnitRequestFeedNotifications(prev, []);
    expect(events).toEqual([]);
    expect(next).toBe(prev);
  });
});
