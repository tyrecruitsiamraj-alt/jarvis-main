import { describe, it, expect } from 'vitest';
import {
  buildJobListSearchParams,
  mergeJobListState,
  parseJobListSearchParams,
  JOB_LIST_DEFAULTS,
} from '../../src/lib/jobListPageState';

describe('jobListPageState', () => {
  it('parses and builds work status filter (ws) — single legacy value', () => {
    const state = parseJobListSearchParams(new URLSearchParams('ws=waiting_interview&p=3'));
    expect(state.workStatusFilter).toEqual(['waiting_interview']);
    expect(state.page).toBe(3);
    const params = buildJobListSearchParams(state);
    expect(params.get('ws')).toBe('waiting_interview');
    expect(params.get('p')).toBe('3');
  });

  it('parses and builds multiple work statuses (comma list)', () => {
    const state = parseJobListSearchParams(
      new URLSearchParams('ws=daily_work,daily_pay,bogus,all'),
    );
    expect(state.workStatusFilter).toEqual(['daily_work', 'daily_pay']); // ค่าเพี้ยน/all ถูกตัดทิ้ง
    const params = buildJobListSearchParams(state);
    expect(params.get('ws')).toBe('daily_work,daily_pay');
    // ว่าง = ทั้งหมด → ไม่ใส่ ws ใน URL
    expect(
      buildJobListSearchParams({ ...JOB_LIST_DEFAULTS, workStatusFilter: [] }).get('ws'),
    ).toBeNull();
  });

  it('resets page when work status filter changes', () => {
    const next = mergeJobListState(
      { ...JOB_LIST_DEFAULTS, page: 3, workStatusFilter: [] },
      { workStatusFilter: ['evaluating'] },
    );
    expect(next.page).toBe(1);
    expect(next.workStatusFilter).toEqual(['evaluating']);
  });

  it('keeps page when only page is patched', () => {
    const next = mergeJobListState({ ...JOB_LIST_DEFAULTS, page: 2 }, { page: 3 });
    expect(next.page).toBe(3);
  });
});
