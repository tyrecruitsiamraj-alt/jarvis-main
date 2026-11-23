/**
 * Dashboard สถานะทำงาน: แถวบนสุด ใบขอทั้งหมด · ปิดแล้ว · ยกเลิก เหนือแถวสถานะ ทั้งชุดหลักและล่วงหน้า (เจ้าของ 23 พ.ย. 2569 "เพิ่มปิดได้กับยกเลิกมาที" → "แยกมาเป็น 3 กล่อง")
 * เลข = ยอดตามช่วงตัวเดียวกับการ์ด หาได้แล้ว/ยกเลิก · สองแถวรวมกันต้องเท่ายอดเดิม · อัตราที่ยกเลิกไม่นับเป็นหาได้
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildWorkMonths, isAdvanceNotDueRecord, sumCohortDoneByAdvance, sumCohortStockByRequestDate, type ThroughputRecord } from '../../src/lib/dashboard/throughput';
import { WORK_DONE_LABEL, WORK_TOP_TOTAL_LABEL, parseWorkDoneBoxId, parseWorkTopTotalId, workDoneBoxId, workTopTotalId } from '../../src/lib/dashboard/workStatusBox';
import { buildDashboardData, DEFAULT_DASHBOARD_FILTERS } from '../../src/lib/dashboard/buildDashboardData';
import type { JobRequest } from '../../src/types';

const TODAY = '2026-11-23';
const rec = (over: Partial<ThroughputRecord>): ThroughputRecord => ({
  requestNo: 'OPL6911001',
  requestDate: '2026-11-10',
  requiredDate: '2026-11-10',
  leadKind: 'urgent',
  closureDate: '2026-11-12',
  positionUnits: 1,
  isOpen: false,
  kind: 'filled',
  ...over,
});

const records: ThroughputRecord[] = [
  // ถึงวันต้องการแล้ว: หาได้ 3 อัตรา (2 ใบ) · ยกเลิก 2 อัตรา (1 ใบ)
  rec({ requestNo: 'OPL6911001', positionUnits: 2, kind: 'filled' }),
  rec({ requestNo: 'OPL6911002', positionUnits: 1, kind: 'filled', leadKind: 'advance', requiredDate: '2026-11-20', requestDate: '2026-11-20' }),
  rec({ requestNo: 'OPL6911003', positionUnits: 2, kind: 'cancelled' }),
  // ล่วงหน้า ยังไม่ถึงวันต้องการ (ต้องการ 28 พ.ย.): หาได้ 4 อัตรา (1 ใบ) · ยกเลิก 1 อัตรา (1 ใบ)
  rec({ requestNo: 'OPL6911004', positionUnits: 4, kind: 'filled', leadKind: 'advance', requiredDate: '2026-11-28', requestDate: '2026-11-28' }),
  rec({ requestNo: 'OPL6911005', positionUnits: 1, kind: 'cancelled', leadKind: 'advance', requiredDate: '2026-11-28', requestDate: '2026-11-28' }),
  // ฉุกเฉินที่ยังไม่ถึงวันต้องการ ไม่ใช่ชนิดล่วงหน้า → แถวบน
  rec({ requestNo: 'OPL6911006', positionUnits: 1, kind: 'filled', leadKind: 'urgent', requiredDate: '2026-11-25', requestDate: '2026-11-25' }),
  // ยังเหลือหา ไม่นับทั้งสองกล่อง · นอกช่วง ไม่นับ
  rec({ requestNo: 'OPL6911007', positionUnits: 5, kind: 'remaining', isOpen: true, closureDate: null }),
  rec({ requestNo: 'OPL6910099', positionUnits: 9, kind: 'filled', requestDate: '2026-10-05', requiredDate: '2026-10-05' }),
];

describe('หาได้แล้ว / ยกเลิก แยกแถวบนกับแถวล่วงหน้า', () => {
  const done = sumCohortDoneByAdvance(records, '2026-11-01', '2026-11-30', TODAY);
  const stock = sumCohortStockByRequestDate(records, '2026-11-01', '2026-11-30');

  it('แถวล่วงหน้า = ชนิดล่วงหน้า + วันต้องการยังไม่ถึง (กติกาเดียวกับใบเปิด) · วันต้องการ = วันนี้ถือว่าถึงแล้ว', () => {
    expect(isAdvanceNotDueRecord({ leadKind: 'advance', requiredDate: '2026-11-24' }, TODAY)).toBe(true);
    expect(isAdvanceNotDueRecord({ leadKind: 'advance', requiredDate: TODAY }, TODAY)).toBe(false);
    expect(isAdvanceNotDueRecord({ leadKind: 'urgent', requiredDate: '2026-11-30' }, TODAY)).toBe(false);
    expect(isAdvanceNotDueRecord({ leadKind: 'advance', requiredDate: null }, TODAY)).toBe(false);
  });
  it('นับอัตราและใบต่อกล่อง', () => {
    expect(done.filled.main).toEqual({ positions: 4, requests: 3 });
    expect(done.filled.advance).toEqual({ positions: 4, requests: 1 });
    expect(done.cancelled.main).toEqual({ positions: 2, requests: 1 });
    expect(done.cancelled.advance).toEqual({ positions: 1, requests: 1 });
  });
  it('🔴 สองแถวรวมกัน = การ์ด หาได้แล้ว / ยกเลิก เดิม (ตัวนับเดียวกัน) · ยกเลิกไม่ปนเป็นหาได้', () => {
    expect(done.filled.main.positions + done.filled.advance.positions).toBe(stock.filledPositions);
    expect(done.cancelled.main.positions + done.cancelled.advance.positions).toBe(stock.cancelledPositions);
    expect(done.filled.main.requests + done.filled.advance.requests).toBe(stock.filledRequestCount);
    expect(done.cancelled.main.requests + done.cancelled.advance.requests).toBe(stock.cancelledRequestCount);
  });
});

describe('กล่องบนจอ', () => {
  it('id แยกจากกล่องสถานะ · คำ = ปิดแล้ว / ยกเลิก (คำที่เจ้าของเลือก)', () => {
    expect(workDoneBoxId('filled', false)).toBe('work_done_filled');
    expect(workDoneBoxId('cancelled', true)).toBe('work_done_advance_cancelled');
    expect(parseWorkDoneBoxId('work_done_advance_filled')).toEqual({ kind: 'filled', advance: true });
    expect(parseWorkDoneBoxId('work_status_in_progress')).toBeNull();
    expect(WORK_DONE_LABEL).toEqual({ filled: 'ปิดแล้ว', cancelled: 'ยกเลิก' });
    expect(WORK_TOP_TOTAL_LABEL).toBe('ใบขอทั้งหมด');
    expect(parseWorkTopTotalId(workTopTotalId(true))).toEqual({ advance: true });
    expect(parseWorkTopTotalId('work_status_total')).toBeNull();
  });
  it('แถวบนสุด 3 กล่องอยู่เหนือแถวสถานะ ทั้งชุดหลักและล่วงหน้า · กดใบขอทั้งหมด = เทียบรายเดือน · โหลดยอดตามช่วงไม่ขึ้น = "—"', () => {
    const shell = readFileSync('src/components/dashboard/analytics/DashboardShell.tsx', 'utf8');
    expect(shell).toContain('data-testid="dashboard-work-top"');
    expect(shell).toContain('data-testid="dashboard-work-advance-top"');
    expect(shell).toContain('<div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">{tiles(list)}</div>');
    expect(shell).toContain('statusPick?.months ? (');
    const page = readFileSync('src/pages/dashboard/SupervisorDashboard.tsx', 'utf8');
    expect(page).toContain('const months = buildWorkMonths(records, from, to, topTotal.advance ?');
    expect(page).toContain('done.advance ? records.filter((r) => isAdvanceNotDueRecord(r, todayYmd)) : records');
    expect(page).toContain('built.workStatusTopKpis?.map((k) => ({ ...k, unavailable: true }))');
  });
});

describe('แถวบนสุด ใบขอทั้งหมด · ปิดแล้ว · ยกเลิก (เจ้าของ 23 พ.ย. 2569)', () => {
  const NOW = new Date('2026-11-23T03:00:00Z');
  const job = (over: Partial<JobRequest>): JobRequest =>
    ({ unit_name: 'หน่วยงานทดสอบ', request_date: '2026-11-01', required_date: '2026-11-05', work_status: 'in_progress', filled_positions: 0, cancelled_positions: 0, ...over }) as JobRequest;
  const jobs = [
    // ใบเดียวมีทั้ง ยังต้องหา 2 · ปิดแล้ว 2 · ยกเลิก 1 (นับเป็นใบเดียว)
    job({ id: 'siamraj-sql:OPL6911001', request_no: 'OPL6911001', request_positions: 5, filled_positions: 2, cancelled_positions: 1 }),
    job({ id: 'siamraj-sql:OPL6911002', request_no: 'OPL6911002', request_positions: 3 }),
    // ล่วงหน้า ยังไม่ถึงวันต้องการ (ต้องการ 28 พ.ย.): ยังต้องหา 3 · ปิดแล้ว 1
    job({ id: 'siamraj-sql:OPL6911003', request_no: 'OPL6911003', request_positions: 4, filled_positions: 1, required_date: '2026-11-28' }),
  ];
  const data = buildDashboardData(jobs, [], null, DEFAULT_DASHBOARD_FILTERS, NOW, undefined, [], jobs);
  const pair = (k?: { value: number; secondaryCount?: number | null }) => [k?.value, k?.secondaryCount];
  const top = data.workStatusTopKpis ?? [];
  const advTop = data.workStatusAdvanceTopKpis ?? [];

  it('แถวสถานะ "ทั้งหมด" = ยังต้องหาเหมือนเดิม (เท่าการ์ดเหลือหา)', () => {
    const statusTotal = data.workStatusKpis.find((k) => k.id === 'work_status_total');
    expect(statusTotal?.value).toBe(8);
    expect(data.kpis.find((k) => k.id === 'remaining')?.value).toBe(8);
  });
  it('ใบขอทั้งหมด = ทั้งหมด (ยังต้องหา) + ปิดแล้ว + ยกเลิก · ใบนับไม่ซ้ำ · สมการใต้กล่อง', () => {
    expect(top.map((k) => k.label)).toEqual(['ใบขอทั้งหมด', 'ปิดแล้ว', 'ยกเลิก']);
    expect(pair(top[0])).toEqual([12, 3]);
    expect(pair(top[1])).toEqual([3, 2]);
    expect(pair(top[2])).toEqual([1, 1]);
    expect(top[0].value).toBe(8 + top[1].value + top[2].value);
    expect(top[0].description).toBe('ทั้งหมด 8 + ปิดแล้ว 3 + ยกเลิก 1 = 12 อัตรา · 3 ใบ');
  });
  it('ล่วงหน้าแบบเดียวกัน: ใบขอทั้งหมด = ล่วงหน้า (ยังต้องหา) + ปิดแล้ว + ยกเลิก ของแถวนั้น', () => {
    expect(data.workStatusAdvanceKpis?.[0]?.value).toBe(3);
    expect(pair(advTop[0])).toEqual([4, 1]);
    expect(pair(advTop[1])).toEqual([1, 1]);
    expect(pair(advTop[2])).toEqual([0, 0]);
    expect(advTop[0].description).toBe('ล่วงหน้า 3 + ปิดแล้ว 1 + ยกเลิก 0 = 4 อัตรา · 1 ใบ');
  });
});

describe('เทียบรายเดือนตอนกดใบขอทั้งหมด', () => {
  const months = buildWorkMonths(records, '2026-10-01', '2026-11-30');
  it('ทุกเดือนในช่วงอยู่ครบแม้เป็น 0 · ต่อเดือน เข้ามา = ปิดแล้ว + ยกเลิก + เหลือหา', () => {
    expect(months.map((m) => m.month)).toEqual(['2026-10', '2026-11']);
    for (const m of months) expect(m.requested).toBe(m.filled + m.cancelled + m.remaining);
  });
  it('ผลรวมปิดแล้ว/ยกเลิกทุกเดือน = ยอดตามช่วง (ตัวเดียวกับกล่อง)', () => {
    const stock = sumCohortStockByRequestDate(records, '2026-10-01', '2026-11-30');
    expect(months.reduce((n, m) => n + m.filled, 0)).toBe(stock.filledPositions);
    expect(months.reduce((n, m) => n + m.cancelled, 0)).toBe(stock.cancelledPositions);
    expect(months.find((m) => m.month === '2026-10')?.filled).toBe(9);
  });
  it('กรองเฉพาะล่วงหน้าได้', () => {
    const adv = buildWorkMonths(records, '2026-11-01', '2026-11-30', (r) => isAdvanceNotDueRecord(r, TODAY));
    expect(adv[0]).toEqual({ month: '2026-11', requested: 5, filled: 4, cancelled: 1, remaining: 0 });
  });
});
