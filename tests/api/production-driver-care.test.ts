// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bangkokBusinessDateYmd } from '../../api/_lib/businessDate.js';
import { recalculateRiskScores } from '../../api/_lib/driverCareRisk.js';
import { DomainError } from '../../api/_lib/domainErrors.js';
import { checkApiAccess } from '../../api/_lib/rbac.js';

vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: vi.fn(),
}));

import { dbQuery } from '../../api/_lib/postgres.js';

const ROOT = join(__dirname, '../..');

describe('production Driver Care contracts', () => {
  it('GET handler is read-only (no recalculate imports)', () => {
    const src = readFileSync(join(ROOT, 'api/_handlers/driver-care.ts'), 'utf8');
    expect(src).not.toContain('recalculateRiskScores');
    expect(src).not.toContain('ensureTodayRiskScores');
    expect(src).toContain('resolveReadScoreDate');
  });

  it('fetchDriverEmployees does not fallback to all active employees', () => {
    const src = readFileSync(join(ROOT, 'api/_lib/driverCareRisk.ts'), 'utf8');
    expect(src).not.toMatch(/limit\s+50/);
    expect(src).toContain('ไม่พบพนักงานคนขับ');
  });

  it('recalculate uses explicit endpoint with supervisor RBAC', () => {
    expect(checkApiAccess('staff', 'driver-care-recalculate', 'POST').ok).toBe(false);
    expect(checkApiAccess('supervisor', 'driver-care-recalculate', 'POST').ok).toBe(true);
    const registry = readFileSync(join(ROOT, 'api/_handlers/registry.ts'), 'utf8');
    expect(registry).toContain("'/api/driver-care/recalculate'");
  });

  it('uses Bangkok business date for daily scoring', () => {
    const ymd = bangkokBusinessDateYmd(new Date('2026-06-08T17:00:00Z'));
    expect(ymd).toBe('2026-06-09');
  });
});

describe('production Driver Care — no driver fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('recalculate throws when driver position filter matches nobody', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [] });
    await expect(recalculateRiskScores('2026-06-08')).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('ไม่พบพนักงานคนขับ'),
    } satisfies Partial<DomainError>);
  });
});
