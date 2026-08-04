import { describe, it, expect } from 'vitest';
import { unitOrganizationKey, unitOrganizationLabel, pickUnitOrganizationDisplayName, buildOrganizationKeyResolver, NO_SITE_CODE_LABEL } from '../../src/lib/unitGroupName';
import { filterJobsForSiteCode } from '../../src/lib/dashboard/drillDownFilters';
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
    expect(unitOrganizationLabel('ธนาคารกรุงศรี สำนักงานใหญ่')).toBe('กรุงศรี');
  });

  it('pick display name prefers common short label', () => {
    expect(
      pickUnitOrganizationDisplayName([
        'ธนาคารกรุงศรี สาขาเซ็นทรัล',
        'ธนาคารกรุงศรี',
        'ธนาคารกรุงศรี สาขาเชียงใหม่',
      ]),
    ).toBe('กรุงศรี');
  });

  it('merges bank prefix variants', () => {
    expect(unitOrganizationKey('ธนาคารกรุงศรี')).toBe(unitOrganizationKey('กรุงศรี'));
    expect(unitOrganizationKey('ธ.กรุงเทพ')).toBe(unitOrganizationKey('กรุงเทพ'));
  });

  it('merges truncated prefix with full organization name', () => {
    const resolve = buildOrganizationKeyResolver(['บำรุงราษ', 'บริษัท บำรุงราษฎร์ จำกัด']);
    expect(resolve('บำรุงราษ')).toBe(resolve('บริษัท บำรุงราษฎร์ จำกัด'));
  });
});

describe('buildDashboardData site overview grouping', () => {
  function job(id: string, partial: Partial<JobRequest> = {}): JobRequest {
    return {
      id,
      unit_name: id,
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

  function build(jobs: JobRequest[]) {
    const period = resolvePeriodRange('this_month', undefined, new Date('2026-07-15'));
    return buildDashboardData(jobs, [], period, DEFAULT_DASHBOARD_FILTERS, new Date('2026-07-15'));
  }

  it('keeps one row per site_code even when the customer name is the same', () => {
    const jobs = [
      job('a', { site_code: '67LBDL0208', unit_name: 'ธนาคารกรุงศรี สาขาเซ็นทรัล', position_units: 3 }),
      job('b', { site_code: '67LBDL0324', unit_name: 'ธนาคารกรุงศรี สำนักงานใหญ่', position_units: 2 }),
    ];
    const rows = build(jobs).unitOverview;
    expect(rows.map((r) => r.siteCode).sort()).toEqual(['67LBDL0208', '67LBDL0324']);
    expect(rows.find((r) => r.siteCode === '67LBDL0208')?.total).toBe(3);
    expect(rows.find((r) => r.siteCode === '67LBDL0324')?.total).toBe(2);
  });

  it('merges rows that share the same site_code', () => {
    const jobs = [
      job('a', { site_code: '68LML0019', unit_name: 'บริษัท บำรุงราษฎร์ จำกัด', position_units: 2 }),
      job('b', { site_code: '68LML0019', unit_name: 'บำรุงราษฎร์', position_units: 3 }),
    ];
    const rows = build(jobs).unitOverview;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.siteCode).toBe('68LML0019');
    expect(rows[0]?.name).toBe('68LML0019');
    expect(rows[0]?.total).toBe(5);
    // ชื่อลูกค้าที่สะกดต่างกันในไซต์เดียวกัน → เลือกชื่อกลางด้วย helper เดิม
    expect(rows[0]?.unitName).toContain('บำรุงราษ');
  });

  it('keeps requests without site_code in a labelled bucket instead of dropping them', () => {
    const jobs = [
      job('a', { site_code: '69DSL0037', unit_name: 'บริษัท วัน แบงค็อก จำกัด', position_units: 4 }),
      job('b', { unit_name: 'ลูกค้าที่ยังไม่ผูกไซต์', position_units: 6 }),
    ];
    const rows = build(jobs).unitOverview;
    expect(rows).toHaveLength(2);
    const noSite = rows.find((r) => r.siteCode === undefined);
    expect(noSite?.name).toBe(NO_SITE_CODE_LABEL);
    expect(noSite?.total).toBe(6);
    // ยอดรวมต้องไม่หายไปกับถังที่ไม่มีรหัส
    expect(rows.reduce((s, r) => s + r.open, 0)).toBe(10);
  });
});

describe('filterJobsForSiteCode', () => {
  const jobs = [
    { id: 'a', site_code: '67LBDL0208' },
    { id: 'b', site_code: ' 67LBDL0208 ' },
    { id: 'c', site_code: '67LBDL0324' },
    { id: 'd' },
  ] as unknown as JobRequest[];

  it('matches site_code exactly (trimmed) — ไม่ผ่านการรวมชื่อ', () => {
    expect(filterJobsForSiteCode(jobs, '67LBDL0208').map((j) => j.id)).toEqual(['a', 'b']);
    expect(filterJobsForSiteCode(jobs, '67LBDL0324').map((j) => j.id)).toEqual(['c']);
  });

  it('returns the no-site bucket when siteCode is undefined', () => {
    expect(filterJobsForSiteCode(jobs, undefined).map((j) => j.id)).toEqual(['d']);
  });
});
