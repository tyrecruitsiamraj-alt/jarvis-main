/**
 * Dashboard สถานะทำงาน: กล่อง "หาได้แล้ว" / "ยกเลิก" ต่อท้ายแถวบนและแถวล่วงหน้า (เจ้าของ 23 พ.ย. 2569 "เพิ่มปิดได้กับยกเลิกมาที")
 * เลข = ยอดตามช่วงตัวเดียวกับการ์ด หาได้แล้ว/ยกเลิก · สองแถวรวมกันต้องเท่ายอดเดิม · อัตราที่ยกเลิกไม่นับเป็นหาได้
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isAdvanceNotDueRecord, sumCohortDoneByAdvance, sumCohortStockByRequestDate, type ThroughputRecord } from '../../src/lib/dashboard/throughput';
import { WORK_DONE_LABEL, parseWorkDoneBoxId, workDoneBoxId } from '../../src/lib/dashboard/workStatusBox';

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
  it('id แยกจากกล่องสถานะ (ไม่อยู่ในสมการของ "ทั้งหมด") · คำ = หาได้แล้ว / ยกเลิก', () => {
    expect(workDoneBoxId('filled', false)).toBe('work_done_filled');
    expect(workDoneBoxId('cancelled', true)).toBe('work_done_advance_cancelled');
    expect(parseWorkDoneBoxId('work_done_advance_filled')).toEqual({ kind: 'filled', advance: true });
    expect(parseWorkDoneBoxId('work_status_in_progress')).toBeNull();
    expect(WORK_DONE_LABEL).toEqual({ filled: 'หาได้แล้ว', cancelled: 'ยกเลิก' });
  });
  it('ต่อท้ายทั้งสองแถว · ไม่มีแถบสัดส่วน · กดแล้วเปิดรายการชุดเดียวกับเลข · โหลดยอดตามช่วงไม่ขึ้น = "—"', () => {
    const shell = readFileSync('src/components/dashboard/analytics/DashboardShell.tsx', 'utf8');
    expect(shell).toContain('tiles([...list, ...(data.workStatusDoneKpis ?? [])])');
    expect(shell).toContain('tiles([...advance, ...(data.workStatusAdvanceDoneKpis ?? [])])');
    expect(shell).toContain('progressPercent={parseWorkDoneBoxId(kpi.id) ? null :');
    const page = readFileSync('src/pages/dashboard/SupervisorDashboard.tsx', 'utf8');
    expect(page).toContain('records.filter((r) => isAdvanceNotDueRecord(r, todayYmd) === done.advance)');
    expect(page).toContain('built.workStatusDoneKpis?.map((k) => ({ ...k, unavailable: true }))');
  });
});
