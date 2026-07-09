import { describe, it, expect } from 'vitest';
import { unitNamesForSendReplacement } from '../../src/lib/unitRequestDisplay';
import type { JobRequest } from '@/types';

function job(partial: Partial<JobRequest> & { unit_name: string }): JobRequest {
  return {
    id: '1',
    job_type: 'new_hire',
    job_category: 'driver',
    status: 'open',
    created_at: '2026-01-01',
    ...partial,
  };
}

describe('unitNamesForSendReplacement', () => {
  it('returns unique unit names only when send_replacement is true', () => {
    const names = unitNamesForSendReplacement([
      job({ unit_name: 'Alpha', send_replacement: true }),
      job({ unit_name: 'Beta', send_replacement: false }),
      job({ unit_name: 'Alpha', send_replacement: true }),
      job({ unit_name: 'Gamma', send_replacement: null }),
    ]);
    expect(names).toEqual(['Alpha']);
  });

  it('sorts Thai locale order', () => {
    const names = unitNamesForSendReplacement([
      job({ unit_name: 'ข', send_replacement: true }),
      job({ unit_name: 'ก', send_replacement: true }),
    ]);
    expect(names).toEqual(['ก', 'ข']);
  });
});
