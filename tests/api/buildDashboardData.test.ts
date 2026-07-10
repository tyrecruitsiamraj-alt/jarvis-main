import { describe, it, expect } from 'vitest';
import {
  applyDashboardFilters,
  buildDashboardData,
  classifyRequestActivity,
  isNewOpeningRequest,
  isReplacementRequest,
  isResignationRequest,
  mapJobToTaskStatus,
  resolvePeriodRange,
  resolveYearToDateTrendRange,
} from '../../src/lib/dashboard/buildDashboardData';
import { DEFAULT_DASHBOARD_FILTERS } from '../../src/lib/dashboard/buildDashboardData';
import { sumJobPositionUnits } from '../../src/lib/jobPositionUnits';
import { jobsToThroughputRecords } from '../../src/lib/dashboard/throughput';
import type { JobRequest } from '@/types';

function job(partial: Partial<JobRequest> & { unit_name: string }): JobRequest {
  return {
    id: partial.id ?? 'j1',
    job_type: 'thai_executive',
    job_category: 'private',
    status: 'open',
    urgency: 'advance',
    total_income: 0,
    location_address: 'Bangkok',
    penalty_per_day: 0,
    days_without_worker: 0,
    total_penalty: 0,
    request_date: '2026-07-01',
    required_date: '2026-07-20',
    created_at: '2026-07-01',
    ...partial,
  };
}

describe('buildDashboardData', () => {
  it('builds activity trend for resignations, replacements, and new openings', () => {
    const jobs = [
      job({
        id: 'a',
        unit_name: 'A',
        request_date: '2026-07-02',
        required_date: '2026-07-02',
        request_action_name: 'ลาออก',
        send_replacement: true,
      }),
      job({
        id: 'b',
        unit_name: 'B',
        request_date: '2026-07-02',
        required_date: '2026-07-02',
        request_action_name: 'เปิดงานใหม่',
      }),
      job({
        id: 'c',
        unit_name: 'C',
        request_date: '2026-07-03',
        required_date: '2026-07-03',
        status: 'closed',
        closed_date: '2026-07-10',
        request_positions: 1,
        filled_positions: 1,
      }),
    ];
    const period = resolvePeriodRange('this_month', undefined, new Date('2026-07-15'));
    const data = buildDashboardData(jobs, [], period, DEFAULT_DASHBOARD_FILTERS, new Date('2026-07-15'));
    expect(data.kpis.find((k) => k.id === 'total_workload')?.value).toBe(3);
    const july = data.activityTrend.find((p) => p.date.startsWith('2026-07'));
    expect(july?.resignations).toBe(1);
    expect(july?.replacements).toBe(0);
    expect(july?.newOpenings).toBeGreaterThanOrEqual(1);
    expect(data.requestControlSummary).toBeDefined();
    expect(data.activityTrend.every((p) => p.label.length > 0)).toBe(true);
  });

  it('builds activity trend for selected period only', () => {
    const jobs = [
      job({ id: 'jan', unit_name: 'A', request_date: '2026-01-15', required_date: '2026-01-15', request_action_name: 'ลาออก' }),
      job({ id: 'feb', unit_name: 'B', request_date: '2026-02-10', required_date: '2026-02-10', request_action_name: 'เปลี่ยนตัว' }),
      job({ id: 'jul', unit_name: 'C', request_date: '2026-07-02', required_date: '2026-07-02', request_action_name: 'เปิดงานใหม่' }),
    ];
    const now = new Date('2026-07-15');
    const period = resolvePeriodRange('this_month', undefined, now);
    const scoped = jobs.filter((j) => j.request_date.startsWith('2026-07'));
    const data = buildDashboardData(scoped, [], period, DEFAULT_DASHBOARD_FILTERS, now, {
      jobs: scoped,
      from: period.from,
      to: period.to,
      label: period.label,
    });
    expect(data.kpis.find((k) => k.id === 'new_requests')?.value).toBe(1);
    expect(data.activityTrend).toHaveLength(1);
    expect(data.activityTrend[0]?.newOpenings).toBe(1);
    expect(data.activityTrendLabel).toBe(period.label);
  });

  it('weights KPI and age buckets by position_units', () => {
    const jobs = [
      job({ id: 'a', unit_name: 'A', position_units: 3, request_positions: 3, request_date: '2026-07-01', required_date: '2026-07-01' }),
      job({ id: 'b', unit_name: 'B', position_units: 2, request_positions: 2, request_date: '2026-07-02', required_date: '2026-07-02' }),
    ];
    const period = resolvePeriodRange('this_month', undefined, new Date('2026-07-15'));
    const data = buildDashboardData(jobs, [], period, DEFAULT_DASHBOARD_FILTERS, new Date('2026-07-15'));
    expect(data.kpis.find((k) => k.id === 'total_workload')?.value).toBe(5);
    expect(data.ageDaysPositionTotal).toBe(5);
    expect(data.ageDaysRequestTotal).toBe(2);
    const bucketTotal = data.ageDaysBreakdown.reduce((s, b) => s + b.count, 0);
    expect(bucketTotal).toBe(5);
  });

  it('remaining KPI counts all open positions when no period is selected', () => {
    const jobs = [
      job({ id: 'old', unit_name: 'A', position_units: 52, request_date: '2026-05-01', required_date: '2026-05-01' }),
      job({ id: 'new', unit_name: 'B', position_units: 45, request_date: '2026-07-02', required_date: '2026-07-20' }),
    ];
    const data = buildDashboardData(jobs, [], null, DEFAULT_DASHBOARD_FILTERS, new Date('2026-07-15'), undefined, [], jobs);
    expect(data.kpis.find((k) => k.id === 'total')?.value).toBe(97);
    expect(data.kpis.find((k) => k.id === 'remaining')?.value).toBe(97);
    expect(data.periodLabel).toBe('ทั้งหมดที่โหลด');
  });

  it('remaining KPI reflects open positions in selected period only', () => {
    const jobs = [
      job({ id: 'old', unit_name: 'A', position_units: 52, request_positions: 52, request_date: '2026-05-01', required_date: '2026-05-01' }),
      job({ id: 'new', unit_name: 'B', position_units: 45, request_positions: 45, request_date: '2026-07-02', required_date: '2026-07-20' }),
    ];
    const period = resolvePeriodRange('this_month', undefined, new Date('2026-07-15'));
    const scoped = jobs.filter((j) => j.request_date.startsWith('2026-07'));
    const data = buildDashboardData(
      scoped,
      [],
      period,
      DEFAULT_DASHBOARD_FILTERS,
      new Date('2026-07-15'),
      undefined,
      [],
      jobs,
    );
    expect(data.kpis.find((k) => k.id === 'new_requests')?.value).toBe(45);
    expect(data.kpis.find((k) => k.id === 'remaining')?.value).toBe(45);
    expect(data.kpis.find((k) => k.id === 'remaining')?.description).toContain('ใบขอใน');
  });

  it('exposes closed breakdown from throughput records', () => {
    const jobs = [
      job({
        id: 'same',
        unit_name: 'A',
        position_units: 2,
        request_positions: 2,
        filled_positions: 2,
        status: 'closed',
        request_date: '2026-07-02',
        required_date: '2026-07-20',
        closed_date: '2026-07-10',
      }),
      job({
        id: 'backlog',
        unit_name: 'B',
        position_units: 3,
        request_positions: 3,
        filled_positions: 3,
        status: 'closed',
        request_date: '2026-06-20',
        required_date: '2026-06-20',
        closed_date: '2026-07-05',
      }),
      job({ id: 'open', unit_name: 'C', position_units: 1, request_positions: 1, request_date: '2026-07-03', required_date: '2026-07-20' }),
    ];
    const period = resolvePeriodRange('this_month', undefined, new Date('2026-07-15'));
    const scoped = jobs.filter((j) => j.request_date.startsWith('2026-07'));
    const records = jobsToThroughputRecords(jobs);
    const data = buildDashboardData(
      scoped,
      [],
      period,
      DEFAULT_DASHBOARD_FILTERS,
      new Date('2026-07-15'),
      {
        jobs: scoped,
        from: period.from,
        to: period.to,
        label: period.label,
        throughputRecords: records,
      },
      jobs.filter((j) => j.status === 'closed'),
    );
    expect(data.closedBreakdown).toEqual({ samePeriod: 2, backlog: 3 });
    expect(data.kpis.find((k) => k.id === 'fulfilled' || k.id === 'filled')?.value).toBeGreaterThanOrEqual(2);
    expect(data.fulfillmentBreakdown).toBeDefined();
  });

  it('uses closed jobs feed for fully closed KPI', () => {
    const jobs = [job({ id: 'a', unit_name: 'A', position_units: 2, request_positions: 2, request_date: '2026-07-01', required_date: '2026-07-01' })];
    const period = resolvePeriodRange('this_month', undefined, new Date('2026-07-15'));
    const closed = [
      job({
        id: 'c1',
        unit_name: 'A',
        position_units: 5,
        request_positions: 5,
        filled_positions: 5,
        status: 'closed',
        closed_date: '2026-07-10',
        request_date: '2026-07-01',
        required_date: '2026-07-01',
      }),
    ];
    const data = buildDashboardData(jobs, [], period, DEFAULT_DASHBOARD_FILTERS, new Date('2026-07-15'), undefined, closed);
    expect(data.kpis.find((k) => k.id === 'fully_closed')?.value).toBe(1);
    expect(data.kpis.find((k) => k.id === 'fully_closed')?.label).toBe('ปิดครบใบขอ');
  });

  it('filters work queue by search', () => {
    const jobs = [
      job({ id: '1', unit_name: 'Alpha', recruiter_name: 'Ann', request_date: '2026-07-01' }),
      job({ id: '2', unit_name: 'Beta', recruiter_name: 'Bob', request_date: '2026-07-02' }),
    ];
    const period = resolvePeriodRange('this_month', undefined, new Date('2026-07-15'));
    const data = buildDashboardData(jobs, [], period, { ...DEFAULT_DASHBOARD_FILTERS, search: 'Alpha' }, new Date('2026-07-15'));
    expect(data.workQueue).toHaveLength(1);
    expect(data.workQueue[0]?.unitName).toBe('Alpha');
    expect(data.workQueue[0]?.requestPositions).toBeGreaterThan(0);
  });

  it('maps overdue when past required date', () => {
    const st = mapJobToTaskStatus(
      job({
        unit_name: 'U',
        required_date: '2026-06-01',
        request_date: '2026-05-01',
      }),
      new Date('2026-07-01'),
    );
    expect(st).toBe('overdue');
  });
});

describe('request categories', () => {
  it('detects resignation, replacement, and new opening', () => {
    expect(isResignationRequest(job({ unit_name: 'U', request_action_name: 'ลาออก' }))).toBe(true);
    expect(
      isResignationRequest(job({ unit_name: 'U', readOnly: true, resigned_employee_name: 'A' })),
    ).toBe(false);
    expect(isReplacementRequest(job({ unit_name: 'U', request_action_name: 'เปลี่ยนตัว' }))).toBe(true);
    expect(isNewOpeningRequest(job({ unit_name: 'U', request_action_name: 'รับสมัครใหม่' }))).toBe(true);
    expect(classifyRequestActivity(job({ unit_name: 'U', request_action_name: 'ลาออก' }))).toBe('resignation');
    expect(classifyRequestActivity(job({ unit_name: 'U', request_action_name: 'เปลี่ยนตัว' }))).toBe('replacement');
    expect(classifyRequestActivity(job({ unit_name: 'U', request_action_name: 'รับสมัครใหม่' }))).toBe('new_opening');
  });
});

describe('resolvePeriodRange', () => {
  it('returns this_month range', () => {
    const p = resolvePeriodRange('this_month', undefined, new Date('2026-07-15'));
    expect(p.from).toBe('2026-07-01');
    expect(p.to).toBe('2026-07-31');
  });
});

describe('resolveYearToDateTrendRange', () => {
  it('spans January through current month', () => {
    const t = resolveYearToDateTrendRange(new Date('2026-07-15'));
    expect(t.from).toBe('2026-01-01');
    expect(t.to).toBe('2026-07-31');
  });
});

describe('applyDashboardFilters', () => {
  it('filters by queue status', () => {
    const items = [
      { id: '1', status: 'overdue' as const },
      { id: '2', status: 'completed' as const },
    ];
    const out = applyDashboardFilters(
      items as ReturnType<typeof buildDashboardData>['workQueue'],
      { ...DEFAULT_DASHBOARD_FILTERS, queueStatus: 'overdue' },
    );
    expect(out).toHaveLength(1);
  });
});
