import { describe, it, expect } from 'vitest';
import {
  formatWorkPersonName,
  formatWorkPersonsSummary,
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
    expect(UNIT_REQUEST_WORK_STATUS_LABELS.evaluating).toBe('เริ่มประเมิน');
    expect(UNIT_REQUEST_WORK_STATUS_DATE_LABELS.evaluating).toContain('ประเมิน');
    expect(isUnitRequestWorkStatus('evaluating')).toBe(true);
    expect(resolveUnitRequestWorkStatus(null)).toBe('in_progress');
    expect(formatWorkPersonName('สมชาย', 'ใจดี')).toBe('สมชาย ใจดี');
  });

  it('summarizes multiple work persons', () => {
    expect(
      formatWorkPersonsSummary([
        { first_name: 'Ann', last_name: 'A' },
        { first_name: 'Bob', last_name: 'B' },
      ]),
    ).toBe('Ann A และอีก 1 คน');
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

  it('work status KPIs count remaining positions and sum to total', () => {
    const jobs = [
      job({
        id: 'a',
        unit_name: 'A',
        work_status: 'waiting_inform',
        request_positions: 5,
        filled_positions: 2,
        cancelled_positions: 0,
        position_units: 3,
      }),
      job({
        id: 'b',
        unit_name: 'B',
        work_status: 'waiting_interview',
        request_positions: 4,
        filled_positions: 0,
        cancelled_positions: 0,
        position_units: 4,
      }),
      job({
        id: 'c',
        unit_name: 'C',
        request_positions: 2,
        filled_positions: 0,
        cancelled_positions: 0,
        position_units: 2,
      }),
    ];
    const data = buildDashboardData(jobs, [], null, DEFAULT_DASHBOARD_FILTERS, new Date('2026-07-15'), undefined, [], jobs);
    expect(data.workStatusKpis.find((k) => k.id === 'work_status_total')?.value).toBe(9);
    expect(data.workStatusKpis.find((k) => k.id === 'work_status_waiting_inform')?.value).toBe(3);
    expect(data.workStatusKpis.find((k) => k.id === 'work_status_waiting_interview')?.value).toBe(4);
    expect(data.workStatusKpis.find((k) => k.id === 'work_status_in_progress')?.value).toBe(2);
    expect(data.kpis.find((k) => k.id === 'remaining')?.value).toBe(9);
  });
});
