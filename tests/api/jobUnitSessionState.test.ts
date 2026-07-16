import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearJobUnitPageSession,
  loadJobListLastUrl,
  resolveUnitDetailBackPath,
  resolveUnitNavPath,
  sanitizeUnitReturnTo,
  saveJobListLastUrl,
  saveUnitLastPath,
} from '../../src/lib/jobUnitSessionState';

describe('jobUnitSessionState', () => {
  beforeEach(() => {
    clearJobUnitPageSession();
  });

  it('sanitizes only jobs list/overview return paths', () => {
    expect(sanitizeUnitReturnTo('/jobs/list?q=foo&p=2')).toBe('/jobs/list?q=foo&p=2');
    expect(sanitizeUnitReturnTo('/jobs/overview')).toBe('/jobs/overview');
    expect(sanitizeUnitReturnTo('/jobs/board')).toBe('/jobs/board');
    expect(sanitizeUnitReturnTo('/dashboard?tab=1')).toBe('/dashboard?tab=1');
    expect(sanitizeUnitReturnTo('https://evil.com')).toBeNull();
    expect(sanitizeUnitReturnTo('//evil.com')).toBeNull();
    expect(sanitizeUnitReturnTo('/api/secret')).toBeNull();
    expect(sanitizeUnitReturnTo('/matching')).toBeNull();
  });

  it('persists list url across resolve helpers', () => {
    saveUnitLastPath('/jobs/list');
    saveJobListLastUrl('/jobs/list?ws=evaluating&p=3');
    expect(loadJobListLastUrl()).toBe('/jobs/list?ws=evaluating&p=3');
    expect(resolveUnitNavPath()).toBe('/jobs/list?ws=evaluating&p=3');
  });

  it('prefers state returnTo then query then saved list url', () => {
    saveJobListLastUrl('/jobs/list?q=saved');
    expect(
      resolveUnitDetailBackPath({
        stateReturnTo: '/jobs/list?q=state',
        search: '?returnTo=%2Fjobs%2Flist%3Fq%3Dquery',
      }),
    ).toBe('/jobs/list?q=state');

    expect(
      resolveUnitDetailBackPath({
        search: '?returnTo=%2Fjobs%2Flist%3Fq%3Dquery',
      }),
    ).toBe('/jobs/list?q=query');

    expect(resolveUnitDetailBackPath({})).toBe('/jobs/list?q=saved');
  });
});
