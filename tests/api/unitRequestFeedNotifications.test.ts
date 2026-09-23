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
    expect(next.get('1')).toBe('open');
  });

  it('notifies for new request', () => {
    const prev = new Map([['1', 'open']]);
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
    const prev = new Map([['1', 'open']]);
    const jobs = [job({ id: '1', request_no: 'R001', status: 'closed' })];
    const { events } = diffUnitRequestFeedNotifications(prev, jobs);
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('job_closed');
  });

  it('does not notify for other status changes', () => {
    const prev = new Map([['1', 'closed']]);
    const jobs = [job({ id: '1', request_no: 'R001', status: 'open' })];
    const { events } = diffUnitRequestFeedNotifications(prev, jobs);
    expect(events).toEqual([]);
  });

  it('keeps snapshot when feed is temporarily empty', () => {
    const prev = new Map([['1', 'open']]);
    const { events, next } = diffUnitRequestFeedNotifications(prev, []);
    expect(events).toEqual([]);
    expect(next).toBe(prev);
  });

  /**
   * 🔴 ใบขอล่วงหน้ากับใบขอจริง **เลขที่ใบซ้ำกันได้** (ชนกัน 27 จาก 42 ใบ · 23 ก.ย. 2569)
   * คีย์ด้วยเลขที่ใบเมื่อไหร่ สองใบยุบเป็นคีย์เดียว แล้วแจ้งเตือนของใบที่ถูกทับหายเงียบ ๆ
   */
  it('ใบล่วงหน้ากับใบจริงที่เลขเดียวกัน ต้องเป็นคนละคีย์', () => {
    const jobs = [
      job({ id: 'siamraj-sql:OPL6909001', request_no: 'OPL6909001', status: 'open' }),
      job({ id: 'siamraj-pre:OPL6909001', request_no: 'OPL6909001', status: 'open' }),
    ];
    const { next } = diffUnitRequestFeedNotifications(null, jobs);
    expect(next.size).toBe(2);
  });

  it('ปิดใบจริง ไม่ลากใบล่วงหน้าเลขเดียวกันไปด้วย', () => {
    const prev = new Map([
      ['siamraj-sql:OPL6909001', 'open'],
      ['siamraj-pre:OPL6909001', 'open'],
    ]);
    const jobs = [
      job({ id: 'siamraj-sql:OPL6909001', request_no: 'OPL6909001', status: 'closed' }),
      job({ id: 'siamraj-pre:OPL6909001', request_no: 'OPL6909001', status: 'open' }),
    ];
    const { events } = diffUnitRequestFeedNotifications(prev, jobs);
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('job_closed');
    expect(events[0]?.job.id).toBe('siamraj-sql:OPL6909001');
  });
});
