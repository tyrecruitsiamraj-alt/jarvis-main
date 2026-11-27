/**
 * Dashboard สถานะทำงาน (เจ้าของ 23 พ.ย. 2569):
 * 1) "มีอะไรที่สื่อว่าเป็นคงเหลือของใบขอทั้งหมดที่ยังต้องหาไหม" → "เอาเป็น ใบขอทั้งหมด ปิด ยกเลิก ยังไม่ปิด แล้วยังไม่ปิดนี่แหละแยกลงมา" (แบบ ก)
 *    ภายหลังวันเดียวกัน: ยังไม่ปิดย้ายลงไปหัวแถวสถานะ · ใบขอทั้งหมดสีเทา
 * 2) กล่อง "ทั้งหมด" เคยขึ้น "ถึงเวลาหาแล้ว 18 + ล่วงหน้า 0 = 17" — กล่องสถานะนับจากใบใน feed คนละชุดกับยอด cohort
 *    ⇒ โหมดมีงวด แยกสถานะจากใบชุดเดียวกับยอด (`cohortRemainingByRequest`) ใบนอกชุดไม่นับ
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cohortRemainingByRequest, throughputKeysOfJob, type ThroughputRecord } from '../../src/lib/dashboard/throughput';
import { buildDashboardData, DEFAULT_DASHBOARD_FILTERS, type PeriodRange } from '../../src/lib/dashboard/buildDashboardData';
import type { JobRequest } from '../../src/types';

const NOW = new Date('2026-11-23T05:00:00Z');
const rec = (no: string, units: number, kind: ThroughputRecord['kind'], requestDate = '2026-11-10'): ThroughputRecord =>
  ({ requestNo: no, requestDate, requiredDate: requestDate, leadKind: 'urgent', closureDate: kind === 'remaining' ? null : '2026-11-12', positionUnits: units, isOpen: kind === 'remaining', kind }) as ThroughputRecord;
const job = (no: string, remaining: number, work_status = 'in_progress', extra: Record<string, unknown> = {}) =>
  ({
    id: `siamraj-sql:${no}`,
    request_no: no,
    unit_name: 'หน่วยงานตัวอย่าง',
    request_date: '2026-11-10',
    required_date: '2026-11-10',
    work_status,
    status: 'open',
    request_positions: remaining,
    filled_positions: 0,
    cancelled_positions: 0,
    ...extra,
  }) as unknown as JobRequest;

describe('ยอดต่อใบจาก cohort', () => {
  it('รวมเฉพาะใบที่ยังเหลือหาในช่วง · ใบขอชั่วคราวจับด้วยคำนำหน้า', () => {
    const m = cohortRemainingByRequest(
      [rec('LBD6911001', 2, 'remaining'), rec('LBD6911002', 1, 'filled'), rec('LBD6910001', 3, 'remaining', '2026-10-05')],
      '2026-11-01',
      '2026-11-30',
    );
    expect([...m]).toEqual([['LBD6911001', 2]]);
    expect(throughputKeysOfJob({ id: 'siamraj-sql:LBD6911001', request_no: 'LBD6911001' })).toEqual(['LBD6911001']);
    expect(throughputKeysOfJob({ id: 'siamraj-pre:LBD6911001', request_no: 'LBD6911001' })).toEqual(['ชั่วคราว LBD6911001']);
    expect(throughputKeysOfJob({ id: '1', request_no: 'R-001', externalId: 'R001' })).toEqual(['R001', 'R-001']);
  });
});

describe('🔴 กล่องสถานะบวกลงตัวกับ "ทั้งหมด" เสมอ', () => {
  const period: PeriodRange = { from: '2026-11-01', to: '2026-11-30', previousFrom: '2026-10-01', previousTo: '2026-10-31', label: 'พ.ย. 2569', previousLabel: 'ต.ค. 2569' } as PeriodRange;
  // feed มีใบที่ ERP ปิดไปแล้ว (LBD6911003 ยังเหลือหาใน feed แต่ cohort นับเป็นหาได้) — แบบเคส 18 vs 17
  const jobs = [job('LBD6911001', 2), job('LBD6911002', 1, 'waiting_start'), job('LBD6911003', 1)];
  const throughputRecords = [rec('LBD6911001', 2, 'remaining'), rec('LBD6911002', 1, 'remaining'), rec('LBD6911003', 1, 'filled')];
  const data = buildDashboardData(jobs, [], period, DEFAULT_DASHBOARD_FILTERS, NOW, { jobs, from: period.from, to: period.to, label: period.label, throughputRecords }, [], jobs);
  const total = data.workStatusKpis.find((k) => k.id === 'work_status_total');
  const leaves = data.workStatusKpis.filter((k) => k.id !== 'work_status_total');
  const advanceTotal = (data.workStatusAdvanceKpis ?? [])[0]?.value ?? 0;

  it('ทั้งหมด = ยอด cohort (3) · กล่องสถานะ + ล่วงหน้า + ไม่มีสถานะ = ทั้งหมด', () => {
    expect(total?.value).toBe(3);
    expect(leaves.reduce((s, k) => s + k.value, 0) + advanceTotal).toBe(3);
    expect(total?.description).toContain('= 3 อัตรา');
    expect(total?.description).not.toContain('ถึงเวลาหาแล้ว 4');
  });
  it('ใบที่ ERP นับว่าหาได้แล้ว ไม่ไปโผล่ในกล่องสถานะ', () => {
    expect(data.workStatusKpis.find((k) => k.id === 'work_status_in_progress')?.value).toBe(2);
    expect(data.workStatusKpis.find((k) => k.id === 'work_status_waiting_start')?.value).toBe(1);
  });
});

describe('แถวบน 3 กล่อง ใบขอทั้งหมด · ปิดแล้ว · ยกเลิก · ยังไม่ปิดอยู่หัวแถวสถานะ (เจ้าของ 23 พ.ย. 2569 "ย้ายมาไว้กับพวก กำลังดำเนินการสรรหา")', () => {
  const shell = readFileSync('src/components/dashboard/analytics/DashboardShell.tsx', 'utf8');
  // 27 พ.ย. 2569 เจ้าของ "ใบขอทั้งหมด > ปิดแล้ว > ยกเลิก > คงเหลือ" — กล่องรวมใบเปิดขึ้นแถวบนเป็นกล่องที่ 4 (แบ่งสองช่อง)
  // แถวสถานะนำด้วย ถึงวันแล้ว · แถวล่วงหน้ายังนำด้วยกล่องรวมของแถวตามเดิม (`dashboardRemainSplit2569-11-27.test.ts`)
  it('แถวบน 4 กล่อง (เหลือหาต่อท้าย) · แถวสถานะนำด้วยถึงวันแล้ว · ใบขอทั้งหมดสีเทา', () => {
    expect(shell).toContain('const mainView = dueKpi ? { topRow: top, rows: [dueKpi, ...list.slice(1)] } : withOpen(top, list);');
    expect(shell).toContain('const advanceView = withOpen(advanceTop, advance);');
    expect(shell).toContain('xl:grid-cols-4" data-testid="dashboard-work-top"');
    expect(shell).toContain('{remainTile}');
    expect(shell).toContain("kpi.id === totalId ? 'neutral'");
  });
});
