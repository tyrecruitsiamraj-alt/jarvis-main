import { describe, it, expect } from 'vitest';
import {
  formatWorkPersonName,
  isUnitRequestWorkStatus,
  resolveUnitRequestWorkStatus,
  UNIT_REQUEST_WORK_STATUS_DATE_LABELS,
  UNIT_REQUEST_WORK_STATUS_LABELS,
} from '../../src/lib/unitRequestWorkStatus';
import { buildDashboardData, jobToWorkItem, DEFAULT_DASHBOARD_FILTERS } from '../../src/lib/dashboard/buildDashboardData';
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

describe('unitRequestWorkStatus', () => {
  it('resolves labels and optional date titles', () => {
    expect(UNIT_REQUEST_WORK_STATUS_LABELS.waiting_inform).toBe('รอแจ้งเข้า');
    expect(UNIT_REQUEST_WORK_STATUS_DATE_LABELS.waiting_interview).toContain('สัมภาษณ์');
    expect(isUnitRequestWorkStatus('waiting_start')).toBe(true);
    expect(resolveUnitRequestWorkStatus(null)).toBe('in_progress');
    expect(formatWorkPersonName('สมชาย', 'ใจดี')).toBe('สมชาย ใจดี');
  });

  it('maps work status onto dashboard work items', () => {
    const item = jobToWorkItem(
      job({
        unit_name: 'A',
        request_no: 'R1',
        recruiter_name: 'Rec',
        screener_name: 'Scr',
        work_status: 'waiting_interview',
        work_person_first_name: 'Ann',
        work_person_last_name: 'Bee',
        work_status_date: '2026-07-18',
      }),
      new Date('2026-07-15'),
    );
    expect(item.workStatus).toBe('waiting_interview');
    expect(item.workStatusLabel).toBe('รอสัมภาษณ์');
    expect(item.workPersonName).toBe('Ann Bee');
    expect(item.workStatusDate).toBe('2026-07-18');
    expect(item.nextAction).toBe('นัด/ตามสัมภาษณ์');
  });

  it('work status KPIs count requests and sum to total', () => {
    const jobs = [
      job({ id: 'a', unit_name: 'A', work_status: 'waiting_inform' }),
      job({ id: 'b', unit_name: 'B', work_status: 'waiting_interview' }),
      job({ id: 'c', unit_name: 'C' }),
    ];
    const data = buildDashboardData(jobs, [], null, DEFAULT_DASHBOARD_FILTERS, new Date('2026-07-15'), undefined, [], jobs);
    expect(data.workStatusKpis.find((k) => k.id === 'work_status_total')?.value).toBe(3);
    expect(data.workStatusKpis.find((k) => k.id === 'work_status_waiting_inform')?.value).toBe(1);
    expect(data.workStatusKpis.find((k) => k.id === 'work_status_waiting_interview')?.value).toBe(1);
    expect(data.workStatusKpis.find((k) => k.id === 'work_status_in_progress')?.value).toBe(1);
    expect(data.kpis.find((k) => k.id === 'remaining')?.value).toBeGreaterThan(0);
  });
});
