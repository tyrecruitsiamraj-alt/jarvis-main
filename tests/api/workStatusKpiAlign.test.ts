import { describe, it, expect } from 'vitest';
import { buildDashboardData, DEFAULT_DASHBOARD_FILTERS, resolvePeriodRange } from '../../src/lib/dashboard/buildDashboardData';
import type { JobRequest } from '../../src/types';

function job(partial: Partial<JobRequest> & Pick<JobRequest, 'id' | 'request_no'>): JobRequest {
  return {
    unit_name: 'Unit',
    location_address: '',
    status: 'open',
    request_date: '2026-06-01',
    required_date: '2026-06-01',
    created_at: '2026-06-01T00:00:00.000Z',
    urgency: 'advance',
    total_income: 0,
    job_type: 'full_time',
    job_category: 'private',
    penalty_per_day: 0,
    days_without_worker: 0,
    total_penalty: 0,
    request_positions: 1,
    filled_positions: 0,
    cancelled_positions: 0,
    ...partial,
  } as JobRequest;
}

describe('work status KPIs align with remaining', () => {
  it('All mode: remaining and work-status use full open stock (ที่ต้องหา)', () => {
    const openJobs = [
      job({
        id: '1',
        request_no: 'R-001',
        externalId: 'R001',
        work_status: 'waiting_inform',
        request_positions: 2,
        filled_positions: 0,
        cancelled_positions: 0,
      }),
      job({
        id: '2',
        request_no: 'R-002',
        externalId: 'R002',
        work_status: 'evaluating',
        request_positions: 1,
        filled_positions: 0,
        cancelled_positions: 0,
      }),
    ];

    const data = buildDashboardData(
      openJobs,
      [],
      null,
      DEFAULT_DASHBOARD_FILTERS,
      new Date('2026-07-14T00:00:00.000Z'),
      {
        jobs: openJobs,
        from: '2026-01-01',
        to: '2026-07-31',
        label: 'YTD',
        throughputRecords: [
          { requestNo: 'R001', requestDate: '2026-06-01', closureDate: null, positionUnits: 2, isOpen: true, kind: 'remaining' },
          { requestNo: 'R002', requestDate: '2026-06-05', closureDate: null, positionUnits: 1, isOpen: true, kind: 'remaining' },
          // ใบนอก feed ไม่นับในโหมดทั้งหมด (นับจากใบเปิดจริง)
          { requestNo: 'R003', requestDate: '2026-06-10', closureDate: null, positionUnits: 3, isOpen: true, kind: 'remaining' },
          { requestNo: 'R004', requestDate: '2026-05-01', closureDate: '2026-05-20', positionUnits: 5, isOpen: false, kind: 'filled' },
        ],
      },
    );

    const remaining = data.kpis.find((k) => k.id === 'remaining');
    const workTotal = data.workStatusKpis?.find((k) => k.id === 'work_status_total');
    expect(remaining?.value).toBe(3);
    expect(remaining?.secondaryCount).toBe(2);
    expect(workTotal?.value).toBe(3);
    expect(workTotal?.secondaryCount).toBe(2);
  });

  it('Month mode: remaining and work-status follow request-month cohort', () => {
    const openJobs = [
      job({
        id: '1',
        request_no: 'R-001',
        externalId: 'R001',
        work_status: 'waiting_inform',
        request_date: '2026-06-01',
        request_positions: 2,
        filled_positions: 0,
        cancelled_positions: 0,
      }),
    ];
    const period = resolvePeriodRange('custom', { from: '2026-06-01', to: '2026-06-30' });

    const data = buildDashboardData(
      openJobs,
      [],
      period,
      DEFAULT_DASHBOARD_FILTERS,
      new Date('2026-07-14T00:00:00.000Z'),
      {
        jobs: openJobs,
        from: period.from,
        to: period.to,
        label: period.label,
        throughputRecords: [
          { requestNo: 'R001', requestDate: '2026-06-01', closureDate: null, positionUnits: 2, isOpen: true, kind: 'remaining' },
          { requestNo: 'R003', requestDate: '2026-06-10', closureDate: null, positionUnits: 3, isOpen: true, kind: 'remaining' },
        ],
      },
    );

    const remaining = data.kpis.find((k) => k.id === 'remaining');
    const workTotal = data.workStatusKpis?.find((k) => k.id === 'work_status_total');
    expect(remaining?.value).toBe(5);
    expect(workTotal?.value).toBe(5);
  });
});
