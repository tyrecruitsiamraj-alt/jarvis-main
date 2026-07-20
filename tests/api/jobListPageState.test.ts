import { describe, it, expect } from 'vitest';
import {
  buildJobListSearchParams,
  mergeJobListState,
  parseJobListSearchParams,
  JOB_LIST_DEFAULTS,
} from '../../src/lib/jobListPageState';

describe('jobListPageState', () => {
  it('parses and builds work status filter (ws)', () => {
    const state = parseJobListSearchParams(new URLSearchParams('ws=waiting_interview&p=3'));
    expect(state.workStatusFilter).toBe('waiting_interview');
    expect(state.page).toBe(3);
    const params = buildJobListSearchParams(state);
    expect(params.get('ws')).toBe('waiting_interview');
    expect(params.get('p')).toBe('3');
  });

  it('resets page when work status filter changes', () => {
    const next = mergeJobListState(
      { ...JOB_LIST_DEFAULTS, page: 3, workStatusFilter: 'all' },
      { workStatusFilter: 'evaluating' },
    );
    expect(next.page).toBe(1);
    expect(next.workStatusFilter).toBe('evaluating');
  });

  it('keeps page when only page is patched', () => {
    const next = mergeJobListState({ ...JOB_LIST_DEFAULTS, page: 2 }, { page: 3 });
    expect(next.page).toBe(3);
  });
});
