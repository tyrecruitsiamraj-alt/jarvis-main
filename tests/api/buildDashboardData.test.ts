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
} from '../../src/lib/dashboard/buildDashboardData';
import { DEFAULT_DASHBOARD_FILTERS } from '../../src/lib/dashboard/buildDashboardData';
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
        request_action_name: 'ลาออก',
        send_replacement: true,
      }),
      job({
        id: 'b',
        unit_name: 'B',
        request_date: '2026-07-02',
        request_action_name: 'เปิดงานใหม่',
      }),
      job({
        id: 'c',
        unit_name: 'C',
        request_date: '2026-07-03',
        status: 'closed',
        closed_date: '2026-07-10',
      }),
    ];
    const period = resolvePeriodRange('this_month', undefined, new Date('2026-07-15'));
    const scoped = jobs;
    const data = buildDashboardData(scoped, [], period, DEFAULT_DASHBOARD_FILTERS, new Date('2026-07-15'));
    expect(data.kpis.find((k) => k.id === 'total')?.value).toBe(3);
    const july = data.activityTrend.find((p) => p.date.startsWith('2026-07'));
    expect(july?.resignations).toBe(1);
    expect(july?.replacements).toBe(0);
    expect(july?.newOpenings).toBe(2);
    const periodTotal =
      (july?.resignations ?? 0) + (july?.replacements ?? 0) + (july?.newOpenings ?? 0);
    expect(periodTotal).toBe(3);
    expect(data.kpis.find((k) => k.id === 'total')?.value).toBe(periodTotal);
    expect(data.activityTrend.every((p) => p.label.length > 0)).toBe(true);
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
