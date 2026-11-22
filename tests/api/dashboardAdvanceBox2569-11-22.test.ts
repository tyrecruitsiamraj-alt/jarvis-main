/**
 * Dashboard: แยก "ล่วงหน้า" ออกจากกล่อง "กำลังดำเนินการสรรหา" (เจ้าของ 22 พ.ย. 2569)
 * > "หน้า Dashboard แยกล่วงหน้าออกมาจากดำเนินการสรรหาให้ที" · Choice "กล่องใหม่ข้างกัน" + "ยังไม่ถึงวันต้องการ"
 * + ป๊อปรายการใบขอของ Dashboard เคยขึ้นวันที่ต้องการคนหลังคำว่า "เข้ามา" (เจ้าของ "เข้ามา 1 พย ได้ไง") → โชว์วันที่กรอกจริง
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildDashboardData, DEFAULT_DASHBOARD_FILTERS } from '../../src/lib/dashboard/buildDashboardData';
import { WORK_STATUS_ADVANCE_ID, workStatusBoxIdOf } from '../../src/lib/dashboard/workStatusBox';
import { cohortRowToDashboardDetailItem } from '../../src/lib/dashboard/dashboardDetailDialog';
import type { CohortDrillRow } from '../../src/lib/dashboard/cohortDrillDown';
import type { JobRequest } from '../../src/types';

const TODAY = new Date('2026-11-22T03:00:00Z');
let seq = 0;
const job = (over: Partial<JobRequest>): JobRequest => {
  seq += 1;
  const no = `OPL69110${String(seq).padStart(2, '0')}`;
  return {
    id: `siamraj-sql:${no}`,
    request_no: no,
    unit_name: 'หน่วยงานทดสอบ',
    request_date: '2026-11-20',
    required_date: '2026-11-24',
    request_positions: 1,
    filled_positions: 0,
    cancelled_positions: 0,
    work_status: 'in_progress',
    ...over,
  } as JobRequest;
};

const open = [
  // ล่วงหน้า ยังไม่ถึงวันต้องการ (กรอกก่อน 30 วัน · ต้องการ 1 ธ.ค.) → กล่องล่วงหน้า
  job({ request_date: '2026-11-01', required_date: '2026-12-01', request_positions: 3, send_replacement: true }),
  job({ request_date: '2026-11-10', required_date: '2026-11-23', request_positions: 2 }),
  // ล่วงหน้า แต่เลยวันต้องการแล้ว → ถึงเวลาต้องหา อยู่กำลังดำเนินการสรรหา
  job({ request_date: '2026-10-01', required_date: '2026-11-10', request_positions: 4, send_replacement: true }),
  // ล่วงหน้า วันต้องการ = วันนี้ → ถึงวันแล้ว อยู่กำลังดำเนินการสรรหา
  job({ request_date: '2026-11-01', required_date: '2026-11-22', request_positions: 1, send_replacement: false }),
  // ฉุกเฉิน (ขอกระชั้น 4 วัน) ยังไม่ถึงวันต้องการ → ไม่ใช่ชนิดล่วงหน้า อยู่กำลังดำเนินการสรรหา
  job({ request_date: '2026-11-20', required_date: '2026-11-24', request_positions: 2 }),
  // ย้อนหลัง → กำลังดำเนินการสรรหา
  job({ request_date: '2026-11-15', required_date: '2026-11-05', request_positions: 1 }),
  // สถานะอื่นที่เป็นล่วงหน้ายังไม่ถึงวัน → อยู่กล่องสถานะของมัน ไม่ถูกดึงออก
  job({ request_date: '2026-11-01', required_date: '2026-12-15', request_positions: 5, work_status: 'waiting_start' }),
  job({ request_date: '2026-11-01', required_date: '2026-12-15', request_positions: 2, work_status: 'on_hold' }),
];

describe('กล่อง "ล่วงหน้า" แยกจาก "กำลังดำเนินการสรรหา"', () => {
  const data = buildDashboardData(open, [], null, DEFAULT_DASHBOARD_FILTERS, TODAY);
  const box = (id: string) => data.workStatusKpis.find((k) => k.id === id);

  it('ล่วงหน้า = ใบสถานะดำเนินการ ชนิดล่วงหน้า ที่ยังไม่ถึงวันต้องการ · ที่เหลืออยู่กำลังดำเนินการสรรหา', () => {
    expect([box(WORK_STATUS_ADVANCE_ID)?.value, box(WORK_STATUS_ADVANCE_ID)?.secondaryCount]).toEqual([5, 2]);
    expect([box('work_status_in_progress')?.value, box('work_status_in_progress')?.secondaryCount]).toEqual([8, 4]);
    expect(box(WORK_STATUS_ADVANCE_ID)?.label).toBe('ล่วงหน้า');
    expect(box(WORK_STATUS_ADVANCE_ID)?.description).toBe('ใบเปิดทั้งหมด · ยังไม่ถึงวันต้องการ · 5 อัตรา · 2 ใบ');
  });

  it('สองกล่องรวมกัน = เลขเดิมของกำลังดำเนินการสรรหา · "ทั้งหมด" ไม่เปลี่ยน · ทุกกล่องรวมกัน = ทั้งหมด', () => {
    const total = box('work_status_total');
    const leaves = data.workStatusKpis.filter((k) => k.id !== 'work_status_total');
    expect((box(WORK_STATUS_ADVANCE_ID)?.value ?? 0) + (box('work_status_in_progress')?.value ?? 0)).toBe(13);
    expect([total?.value, total?.secondaryCount]).toEqual([20, 8]);
    expect(leaves.reduce((n, k) => n + k.value, 0)).toBe(20);
    expect(leaves.reduce((n, k) => n + (k.secondaryCount ?? 0), 0)).toBe(8);
    expect(total?.description).toBe('ใบเปิดทั้งหมด · ผลรวมสถานะ = 20 อัตรา · 8 ใบ');
    // เท่ากับการ์ดเหลือหา
    expect(data.kpis.find((k) => k.id === 'remaining')?.value).toBe(20);
  });

  it('สถานะอื่นไม่ถูกดึงออก แม้เป็นล่วงหน้าที่ยังไม่ถึงวัน', () => {
    expect(box('work_status_waiting_start')?.value).toBe(5);
    expect(box('work_status_on_hold')?.value).toBe(2);
  });

  it('ส่งคนแทน / ไม่ส่งคนแทน / ยังไม่ระบุ ของกำลังดำเนินการสรรหา รวมกัน = เลขบนกล่องหลังแยก', () => {
    expect(box('work_status_in_progress')?.description).toBe('ใบเปิดทั้งหมด · ส่งคนแทน 4 + ไม่ส่งคนแทน 1 + ยังไม่ระบุ 3 = 8 อัตรา · 4 ใบ');
  });

  it('กล่องล่วงหน้าอยู่ถัดจากกำลังดำเนินการสรรหา และอยู่เสมอแม้เป็น 0', () => {
    const ids = data.workStatusKpis.map((k) => k.id);
    expect(ids.indexOf(WORK_STATUS_ADVANCE_ID)).toBe(ids.indexOf('work_status_in_progress') + 1);
    const none = buildDashboardData([job({})], [], null, DEFAULT_DASHBOARD_FILTERS, TODAY);
    expect(none.workStatusKpis.find((k) => k.id === WORK_STATUS_ADVANCE_ID)?.value).toBe(0);
  });

  it('รายการตอนกดกล่องใช้ตัวตัดสินเดียวกับเลขบนกล่อง — จำนวนใบต่อกล่องเท่ากัน', () => {
    const byBox = new Map<string, { positions: number; requests: number }>();
    for (const j of open) {
      const id = workStatusBoxIdOf(j, TODAY);
      const b = byBox.get(id) ?? { positions: 0, requests: 0 };
      b.positions += j.request_positions ?? 0;
      b.requests += 1;
      byBox.set(id, b);
    }
    for (const k of data.workStatusKpis.filter((x) => x.id !== 'work_status_total')) {
      expect([k.id, k.value, k.secondaryCount]).toEqual([k.id, byBox.get(k.id)?.positions ?? 0, byBox.get(k.id)?.requests ?? 0]);
    }
    const page = readFileSync('src/pages/dashboard/SupervisorDashboard.tsx', 'utf8');
    expect(page).toContain('stock.filter((j) => workStatusBoxIdOf(j) === kpiId)');
    expect(page).toContain("work_status_advance: 'in_progress'");
  });

  it('พอถึงวันต้องการ ใบย้ายจากล่วงหน้าไปกำลังดำเนินการสรรหาเอง', () => {
    const j = job({ request_date: '2026-11-01', required_date: '2026-11-25' });
    expect(workStatusBoxIdOf(j, new Date('2026-11-24T03:00:00Z'))).toBe(WORK_STATUS_ADVANCE_ID);
    expect(workStatusBoxIdOf(j, new Date('2026-11-25T03:00:00Z'))).toBe('work_status_in_progress');
    expect(workStatusBoxIdOf(j, new Date('2026-11-30T03:00:00Z'))).toBe('work_status_in_progress');
  });
});

describe('ป๊อปรายการใบขอของ Dashboard — วันที่กรอกจริง ไม่ใช่วันอ้างอิงงวด', () => {
  const row: CohortDrillRow = {
    requestNo: 'LAO6909006',
    jobId: 'siamraj-sql:LAO6909006',
    requestNoDisplay: 'LAO6909006',
    unitName: 'หน่วยงานทดสอบ',
    siteCode: null,
    departmentCode: 'LBA',
    // วันอ้างอิงงวด = วันที่ต้องการคน
    requestDate: '2026-11-01',
    submittedDate: '2026-09-03',
    requesterName: null,
    requiredDate: '2026-11-01',
    leadKind: 'advance',
    requestActionName: null,
    positions: 1,
    requestPositions: 1,
    filledPositions: 0,
    cancelledPositions: 0,
    remainingPositions: 1,
  };

  it('ขึ้น "กรอก <วันที่กรอกจริง> · ต้องการ <วันที่ต้องการ>" — ไม่ขึ้นวันที่ต้องการซ้ำหลังคำว่าเข้ามา', () => {
    const item = cohortRowToDashboardDetailItem(row, 'total_requests');
    expect(item.subtitle).toBe('ล่วงหน้า · กรอก 3 ก.ย. 2569 · ต้องการ 1 พ.ย. 2569 · ขอ 1 · ปิดได้ 0 · ยกเลิก 0 · เหลือ 1');
    expect(item.subtitle).not.toContain('เข้ามา 1 พ.ย.');
  });

  it('ไม่มีวันที่กรอก = ไม่ขึ้นช่องนั้น (ไม่เอาวันอื่นมาแทน)', () => {
    const item = cohortRowToDashboardDetailItem({ ...row, submittedDate: null }, 'total_requests');
    expect(item.subtitle).toBe('ล่วงหน้า · ต้องการ 1 พ.ย. 2569 · ขอ 1 · ปิดได้ 0 · ยกเลิก 0 · เหลือ 1');
  });
});
