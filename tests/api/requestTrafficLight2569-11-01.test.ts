/**
 * หน้าใบขอ สีไฟจราจร (เจ้าของ 1 พ.ย. 2569 *"อันไหนแนวโน้มบวกเป็นเขียว แดง เหลือง ให้ดูง่ายๆ"*)
 * 1. การ์ด 4 ใบในศูนย์ควบคุมใบขอ: ลูกศรเทียบช่วงก่อนยาวเท่ากัน · ดีขึ้น/ทรงตัว/แย่ลง ตาม journey
 * 2. หน้ารายการใบขอ: ช่อง SLA รายใบ ตัวตัดสินเดียวกับตาราง SLA ใน Dashboard
 */
import { describe, expect, it } from 'vitest';
import {
  KPI_TREND_TONE,
  kpiTrendPercent,
  kpiTrendPreviousRange,
  kpiTrendVerdict,
  kpiTrendWindow,
  kpiTrendWord,
  withKpiTrend,
} from '@/lib/dashboard/kpiTrend';
import { SLA_CELL_TONE, jobSlaCell, filterRecordsForSlaCell, filterRecordsForLeadKind, buildSlaByLeadKind } from '@/lib/dashboard/slaByLeadKind';
import { jobToRequestControlRecord } from '@/lib/requestControl';
import { controlRecordToDashboardDetailItem } from '@/lib/dashboard/dashboardDetailDialog';
import { sortJobsByTableColumn, JOB_LIST_TABLE_COLUMNS } from '@/lib/jobListTableSort';
import { JOB_LIST_DEFAULTS, buildJobListSearchParams, parseJobListSearchParams } from '@/lib/jobListPageState';
import fs from 'node:fs';
import path from 'node:path';
import type { DashboardKpi } from '@/lib/dashboard/types';
import { defaultDashboardDateRange } from '@/lib/dashboard/buildDashboardData';
import { monthlyIntakePoints, type ThroughputRecord } from '@/lib/dashboard/throughput';
import type { JobRequest } from '@/types';

const kpi = (id: string, value: number): DashboardKpi => ({ id, label: id, value, description: '', trendPercent: null });

const rec = (requestNo: string, requestDate: string, kind: ThroughputRecord['kind'], units = 1): ThroughputRecord =>
  ({ requestNo, requestDate, closureDate: null, positionUnits: units, isOpen: kind === 'open', kind }) as ThroughputRecord;

describe('ลูกศรแนวโน้มการ์ด', () => {
  it('ตาม journey: เข้ามา/หาได้แล้ว เพิ่ม = ดีขึ้น · ยกเลิก/เหลือหา เพิ่ม = แย่ลง', () => {
    expect(kpiTrendVerdict('total_requests', 15)).toBe('better');
    expect(kpiTrendVerdict('closed', 20)).toBe('better');
    expect(kpiTrendVerdict('cancelled', 20)).toBe('worse');
    expect(kpiTrendVerdict('remaining', 111)).toBe('worse');
    expect(kpiTrendVerdict('cancelled', -46)).toBe('better');
    expect(kpiTrendVerdict('closed', -10)).toBe('worse');
  });

  it('เปลี่ยนไม่ถึง 5% = ทรงตัว (เหลือง)', () => {
    expect(kpiTrendVerdict('closed', 2)).toBe('flat');
    expect(kpiTrendVerdict('remaining', -4)).toBe('flat');
    expect(kpiTrendVerdict('closed', 5)).toBe('better');
    expect(KPI_TREND_TONE).toEqual({ better: 'success', flat: 'warn', worse: 'danger' });
  });

  it('คำบนการ์ดบอกทิศ เพิ่มขึ้น/ลดลง/ทรงตัว (เจ้าของ 1 พ.ย.) · ดีหรือแย่บอกด้วยสี', () => {
    expect(kpiTrendWord(15)).toBe('เพิ่มขึ้น');
    expect(kpiTrendWord(-46)).toBe('ลดลง');
    expect(kpiTrendWord(111)).toBe('เพิ่มขึ้น');
    expect(kpiTrendWord(2)).toBe('ทรงตัว');
    expect(kpiTrendWord(-4)).toBe('ทรงตัว');
    const card = fs.readFileSync(path.resolve(__dirname, '../../src/components/dashboard/analytics/DashboardKpiCard.tsx'), 'utf8');
    expect(card).not.toMatch(/ดีขึ้น|แย่ลง/);
    // เจ้าของ 1 พ.ย. "เอา % ออก" — การ์ดไม่เขียน % ของแนวโน้ม
    expect(card).not.toMatch(/\{trend\}%/);
  });

  it('ช่วงก่อนเป็น 0 = ไม่มี % (ไม่ใช่ 0) · การ์ดอื่นไม่มีลูกศร', () => {
    expect(kpiTrendPercent(5, 0)).toBeNull();
    expect(kpiTrendPercent(116, 114)).toBe(2);
    expect(kpiTrendVerdict('work_status_total', 20)).toBeNull();
    expect(kpiTrendVerdict('closed', null)).toBeNull();
  });

  it('เลือกเดือน = เทียบเดือนก่อนเต็มเดือน (ต.ค. เทียบ ก.ย.)', () => {
    const w = kpiTrendWindow({ from: '2026-10-01', to: '2026-10-31', previousFrom: '2026-08-31', previousTo: '2026-09-30' }, '2026-11-01');
    expect(w).toEqual({ from: '2026-10-01', to: '2026-10-31', previousFrom: '2026-09-01', previousTo: '2026-09-30', partial: false });
    expect(kpiTrendPreviousRange({ from: '2026-03-01', to: '2026-03-31', previousFrom: '2026-01-29', previousTo: '2026-02-28' })).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(kpiTrendPreviousRange({ from: '2026-01-01', to: '2026-01-31', previousFrom: '', previousTo: '' })).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });

  it('เลือกทั้งปี = เทียบปีก่อน · ช่วงอื่น = ยาวเท่ากันติดกัน', () => {
    expect(kpiTrendPreviousRange({ from: '2026-01-01', to: '2026-12-31', previousFrom: '2025-01-01', previousTo: '2025-12-31' })).toEqual({ from: '2025-01-01', to: '2025-12-31' });
    expect(kpiTrendPreviousRange({ from: '2026-10-06', to: '2026-10-12', previousFrom: '2026-09-29', previousTo: '2026-10-05' })).toEqual({ from: '2026-09-29', to: '2026-10-05' });
  });

  it('ช่วงที่ยังไม่จบ เทียบเฉพาะวันที่ผ่านมาเท่ากัน', () => {
    const w = kpiTrendWindow({ from: '2026-11-01', to: '2026-11-30', previousFrom: '2026-10-02', previousTo: '2026-10-31' }, '2026-11-03');
    expect(w).toEqual({ from: '2026-11-01', to: '2026-11-03', previousFrom: '2026-10-01', previousTo: '2026-10-03', partial: true });
    expect(kpiTrendWindow({ from: '2026-12-01', to: '2026-12-31', previousFrom: '2026-10-31', previousTo: '2026-11-30' }, '2026-11-03')).toBeNull();
  });

  it('นับ cohort ชุดเดียวกับเลขบนการ์ด และบอกเลขที่ใช้เทียบ', () => {
    const cur = [rec('A1', '2026-10-05', 'filled', 2), rec('A2', '2026-10-06', 'cancelled'), rec('A3', '2026-10-07', 'open')];
    const prev = [rec('B1', '2026-09-05', 'filled'), rec('B2', '2026-09-06', 'cancelled'), rec('B3', '2026-09-07', 'cancelled'), rec('B4', '2026-09-08', 'open')];
    const w = kpiTrendWindow({ from: '2026-10-01', to: '2026-10-31', previousFrom: '2026-08-31', previousTo: '2026-09-30' }, '2026-11-01');
    const out = withKpiTrend(
      [kpi('total_requests', 4), kpi('closed', 2), kpi('cancelled', 1), kpi('remaining', 1), kpi('work_status_total', 9)],
      cur,
      prev,
      w,
    );
    const by = Object.fromEntries(out.map((k) => [k.id, k]));
    expect(by.total_requests.trendPercent).toBe(0); // 4 เทียบ 4
    expect(by.closed.trendPercent).toBe(100); // 2 เทียบ 1
    expect(by.cancelled.trendPercent).toBe(-50); // 1 เทียบ 2
    expect(by.remaining.trendPercent).toBe(0);
    expect(by.closed.trendBase).toBe('1–30 ก.ย. 2569 1');
    expect(by.work_status_total.trendPercent).toBeNull();
  });

  it('เปิด Dashboard มาที่เดือนก่อนเต็มเดือน (Choice "เดือนก่อน") ลูกศรขึ้นเลย', () => {
    expect(defaultDashboardDateRange(new Date(2026, 10, 1, 10))).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(defaultDashboardDateRange(new Date(2027, 0, 15))).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    expect(defaultDashboardDateRange(new Date(2028, 2, 3))).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('แท่งเข้ามารายเดือนบน hero ไม่ขึ้นกับงวด · เดือนที่ไม่มีใบ = 0', () => {
    const pts = monthlyIntakePoints(
      [rec('A', '2026-08-03', 'filled', 2), rec('B', '2026-10-09', 'open'), rec('C', '2026-10-20', 'cancelled', 3), rec('D', '2026-12-01', 'open')],
      '2026-08-01',
      '2026-10-31',
    );
    expect(pts.map((p) => [p.label, p.requestedPositions])).toEqual([
      ['ส.ค. 2569', 2],
      ['ก.ย. 2569', 0],
      ['ต.ค. 2569', 4],
    ]);
  });

  it('ไม่มีข้อมูลช่วงก่อน = ไม่ใส่ลูกศร', () => {
    const ks = [kpi('closed', 2)];
    expect(withKpiTrend(ks, [], null, null)).toBe(ks);
  });
});

function job(partial: Partial<JobRequest> & Pick<JobRequest, 'id'>): JobRequest {
  return {
    unit_name: 'หน่วยงาน',
    location_address: '',
    status: 'open',
    urgency: 'advance',
    total_income: 0,
    job_type: 'driver',
    job_category: 'private',
    penalty_per_day: 0,
    days_without_worker: 0,
    total_penalty: 0,
    request_positions: 1,
    filled_positions: 0,
    request_date: '2026-10-01',
    created_at: '2026-10-01T00:00:00.000Z',
    ...partial,
  } as JobRequest;
}

describe('ช่อง SLA หน้ารายการใบขอ', () => {
  const today = new Date('2026-11-01T10:00:00+07:00');
  const overdue = job({ id: 'siamraj-sql:OPL6909001', request_no: 'OPL6909001', request_date: '2026-09-01', required_date: '2026-09-01' });
  const safe = job({ id: 'siamraj-sql:OPL6910050', request_no: 'OPL6910050', request_date: '2026-10-01', required_date: '2026-12-15' });

  it('สีไฟจราจร: ยังทัน/ปิดทัน เขียว · เสี่ยง เหลือง · เกินแล้ว/ปิดไม่ทัน แดง', () => {
    expect(SLA_CELL_TONE.on_track).toBe('success');
    expect(SLA_CELL_TONE.closed_on_time).toBe('success');
    expect(SLA_CELL_TONE.at_risk).toBe('warn');
    expect(SLA_CELL_TONE.breached).toBe('danger');
    expect(SLA_CELL_TONE.closed_late).toBe('danger');
  });

  it('ใบเลยกำหนด = เกินแล้ว · ใบยังไกล = ยังทัน', () => {
    expect(jobSlaCell(overdue, today)).toBe('breached');
    expect(jobSlaCell(safe, today)).toBe('on_track');
  });

  it('กดหัวช่อง SLA เรียงเกินแล้วขึ้นก่อน', () => {
    expect(JOB_LIST_TABLE_COLUMNS).toContain('sla');
    const sorted = sortJobsByTableColumn([safe, overdue], { column: 'sla', dir: 'asc' }, today);
    expect(sorted.map((j) => j.request_no)).toEqual(['OPL6909001', 'OPL6910050']);
  });

  it('ตัวกรอง SLA เก็บใน URL (?sla=) · ค่าแปลกถูกทิ้ง · เปลี่ยนแล้วกลับหน้า 1', () => {
    const p = buildJobListSearchParams({ ...JOB_LIST_DEFAULTS, slaFilter: ['breached', 'at_risk'] });
    expect(p.get('sla')).toBe('breached,at_risk');
    expect(parseJobListSearchParams(new URLSearchParams('sla=breached,xxx,on_track')).slaFilter).toEqual(['breached', 'on_track']);
    expect(parseJobListSearchParams(new URLSearchParams('')).slaFilter).toEqual([]);
  });

  it('หน้ารายการใบขอมีตัวกรอง SLA ที่ใช้ jobSlaCell ตัวเดียวกับป้าย', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../src/pages/jobs/JobListPage.tsx'), 'utf8');
    expect(src).toContain('id="job-list-sla"');
    expect(src).toContain('slaFilter.includes(jobSlaCell(j))');
  });

  it('ศูนย์ควบคุมใบขอ: กดเลขแถวรวมทุกชนิดได้ — รายการเท่าเลขในตาราง', () => {
    const recs = [overdue, safe, job({ id: 'siamraj-sql:OPL6909002', request_no: 'OPL6909002', request_date: '2026-09-02', required_date: '2026-09-02' })].map((j) =>
      jobToRequestControlRecord(j, today),
    );
    const table = buildSlaByLeadKind(recs, today);
    expect(filterRecordsForSlaCell(recs, null, 'breached', today)).toHaveLength(table.totalRow.cells.breached);
    expect(filterRecordsForLeadKind(recs, null, today)).toHaveLength(table.totalRow.total);
  });

  it('รายการที่เปิดจากตัวเลขบอกสถานะ SLA เป็นคำ', () => {
    const item = controlRecordToDashboardDetailItem(jobToRequestControlRecord(overdue, today), () => undefined);
    expect(item.subtitle).toContain('SLA เกินแล้ว · ครบ');
  });
});
