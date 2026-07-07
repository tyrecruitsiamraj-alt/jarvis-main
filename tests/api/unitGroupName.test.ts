import { describe, it, expect } from 'vitest';
import { unitOrganizationKey, unitOrganizationLabel, pickUnitOrganizationDisplayName, buildOrganizationKeyResolver } from '../../src/lib/unitGroupName';
import { buildDashboardData } from '../../src/lib/dashboard/buildDashboardData';
import { DEFAULT_DASHBOARD_FILTERS } from '../../src/lib/dashboard/buildDashboardData';
import { resolvePeriodRange } from '../../src/lib/dashboard/buildDashboardData';
import type { JobRequest } from '@/types';

describe('unitGroupName', () => {
  it('merges branch variants to same organization key', () => {
    expect(unitOrganizationKey('ธนาคารกรุงศรี สาขาเซ็นทรัล')).toBe(
      unitOrganizationKey('ธนาคารกรุงศรี'),
    );
  });

  it('strips legal suffix', () => {
    expect(unitOrganizationKey('ธนาคารกรุงศรี จำกัด (มหาชน)')).toBe(
      unitOrganizationKey('ธนาคารกรุงศรี'),
    );
  });

  it('merges company prefix and จำกัด variants', () => {
    expect(unitOrganizationKey('บริษัท บำรุงราษฎร์ จำกัด')).toBe(
      unitOrganizationKey('บำรุงราษฎร์'),
    );
    expect(unitOrganizationKey('บำรุงราษฎร์ จำกัด')).toBe(unitOrganizationKey('บำรุงราษฎร์'));
    expect(unitOrganizationKey('บจก. บำรุงราษฎร์')).toBe(unitOrganizationKey('บำรุงราษฎร์'));
  });

  it('normalizes whitespace and case', () => {
    expect(unitOrganizationKey('ธนาคาร  กรุงศรี')).toBe(unitOrganizationKey('ธนาคารกรุงศรี'));
  });

  it('label strips branch for display', () => {
    expect(unitOrganizationLabel('ธนาคารกรุงศรี สำนักงานใหญ่')).toBe('ธนาคารกรุงศรี');
  });

  it('pick display name prefers common short label', () => {
    expect(
      pickUnitOrganizationDisplayName([
        'ธนาคารกรุงศรี สาขาเซ็นทรัล',
        'ธนาคารกรุงศรี',
        'ธนาคารกรุงศรี สาขาเชียงใหม่',
      ]),
    ).toBe('ธนาคารกรุงศรี');
  });

  it('merges truncated prefix with full organization name', () => {
    const resolve = buildOrganizationKeyResolver(['บำรุงราษ', 'บริษัท บำรุงราษฎร์ จำกัด']);
    expect(resolve('บำรุงราษ')).toBe(resolve('บริษัท บำรุงราษฎร์ จำกัด'));
  });
});

describe('buildDashboardData unit overview grouping', () => {
  function job(unit_name: string, partial: Partial<JobRequest> = {}): JobRequest {
    return {
      id: unit_name,
      unit_name,
      job_type: 'central',
      job_category: 'private',
      status: 'open',
      urgency: 'urgent',
      total_income: 0,
      location_address: '',
      penalty_per_day: 0,
      days_without_worker: 0,
      total_penalty: 0,
      request_date: '2026-07-01',
      required_date: '2026-07-10',
      created_at: '2026-07-01',
      ...partial,
    };
  }

  it('merges Krung Sri branches into one row', () => {
    const jobs = [
      job('ธนาคารกรุงศรี สาขาเซ็นทรัล', { position_units: 3 }),
      job('ธนาคารกรุงศรี สำนักงานใหญ่', { position_units: 2 }),
    ];
    const period = resolvePeriodRange('this_month', undefined, new Date('2026-07-15'));
    const data = buildDashboardData(jobs, [], period, DEFAULT_DASHBOARD_FILTERS, new Date('2026-07-15'));
    const krungsri = data.unitOverview.filter((u) => u.name.includes('กรุงศรี'));
    expect(krungsri).toHaveLength(1);
    expect(krungsri[0]?.total).toBe(5);
  });

  it('merges จำกัด and plain company name', () => {
    const jobs = [
      job('บริษัท บำรุงราษฎร์ จำกัด', { position_units: 2 }),
      job('บำรุงราษฎร์', { position_units: 3 }),
    ];
    const period = resolvePeriodRange('this_month', undefined, new Date('2026-07-15'));
    const data = buildDashboardData(jobs, [], period, DEFAULT_DASHBOARD_FILTERS, new Date('2026-07-15'));
    const rows = data.unitOverview.filter((u) => u.name.includes('บำรุงราษ'));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.total).toBe(5);
  });

  it('merges truncated บำรุงราษ with full บำรุงราษฎร์ name', () => {
    const jobs = [
      job('บำรุงราษ', { position_units: 4 }),
      job('บริษัท บำรุงราษฎร์ จำกัด', { position_units: 6 }),
    ];
    const period = resolvePeriodRange('this_month', undefined, new Date('2026-07-15'));
    const data = buildDashboardData(jobs, [], period, DEFAULT_DASHBOARD_FILTERS, new Date('2026-07-15'));
    const rows = data.unitOverview.filter((u) => u.name.includes('บำรุงราษ'));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.total).toBe(10);
  });
});
