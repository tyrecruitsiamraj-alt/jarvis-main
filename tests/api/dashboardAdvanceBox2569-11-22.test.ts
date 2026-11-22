/**
 * Dashboard: แยก "ล่วงหน้า" ออกจากกล่อง "กำลังดำเนินการสรรหา" (เจ้าของ 22 พ.ย. 2569) → ค่ำวันเดียวกันเป็นแถวของตัวเองแยกตามสถานะ
 * > "หน้า Dashboard แยกล่วงหน้าออกมาจากดำเนินการสรรหาให้ที" · Choice "กล่องใหม่ข้างกัน" + "ยังไม่ถึงวันต้องการ"
 * + ป๊อปรายการใบขอของ Dashboard เคยขึ้นวันที่ต้องการคนหลังคำว่า "เข้ามา" (เจ้าของ "เข้ามา 1 พย ได้ไง") → โชว์วันที่กรอกจริง
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildDashboardData, DEFAULT_DASHBOARD_FILTERS } from '../../src/lib/dashboard/buildDashboardData';
import { WORK_STATUS_ADVANCE_ID, advanceStatusBoxId, jobInWorkStatusBox, workStatusBoxIdOf } from '../../src/lib/dashboard/workStatusBox';
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
  // สถานะอื่นที่เป็นล่วงหน้ายังไม่ถึงวัน → อยู่แถวล่วงหน้า ในกล่องสถานะของมัน
  job({ request_date: '2026-11-01', required_date: '2026-12-15', request_positions: 5, work_status: 'waiting_start' }),
  job({ request_date: '2026-11-01', required_date: '2026-12-15', request_positions: 2, work_status: 'on_hold' }),
];

describe('แถว "ล่วงหน้า" แยกตามสถานะ (เจ้าของ 22 พ.ย. 2569 ค่ำ)', () => {
  const data = buildDashboardData(open, [], null, DEFAULT_DASHBOARD_FILTERS, TODAY);
  const main = (id: string) => data.workStatusKpis.find((k) => k.id === id);
  const adv = (id: string) => data.workStatusAdvanceKpis?.find((k) => k.id === id);
  const pair = (k?: { value: number; secondaryCount?: number | null }) => [k?.value, k?.secondaryCount];

  it('แถวล่วงหน้า = ใบล่วงหน้าที่ยังไม่ถึงวันต้องการ ทุกสถานะ · ที่เหลืออยู่แถวบน', () => {
    expect(pair(adv(WORK_STATUS_ADVANCE_ID))).toEqual([12, 4]);
    expect(pair(adv(advanceStatusBoxId('in_progress')))).toEqual([5, 2]);
    expect(adv(advanceStatusBoxId('waiting_start'))?.value).toBe(5);
    expect(adv(advanceStatusBoxId('on_hold'))?.value).toBe(2);
    expect(pair(main('work_status_in_progress'))).toEqual([8, 4]);
    expect(main('work_status_waiting_start')?.value).toBe(0);
    expect(main('work_status_on_hold')?.value).toBe(0);
    expect(adv(WORK_STATUS_ADVANCE_ID)?.description).toBe('ใบเปิดทั้งหมด · ยังไม่ถึงวันต้องการ · 12 อัตรา · 4 ใบ');
  });

  it('สองแถวรวมกัน = ทั้งหมด = การ์ดเหลือหา · "ทั้งหมด" บอกสมการ', () => {
    const total = main('work_status_total');
    const leaves = [
      ...data.workStatusKpis.filter((k) => k.id !== 'work_status_total'),
      ...(data.workStatusAdvanceKpis ?? []).filter((k) => k.id !== WORK_STATUS_ADVANCE_ID),
    ];
    expect(pair(total)).toEqual([20, 8]);
    expect(leaves.reduce((n, k) => n + k.value, 0)).toBe(20);
    expect(leaves.reduce((n, k) => n + (k.secondaryCount ?? 0), 0)).toBe(8);
    expect(total?.description).toBe('ใบเปิดทั้งหมด · ถึงเวลาหาแล้ว 8 + ล่วงหน้า 12 = 20 อัตรา · 8 ใบ');
    expect(data.kpis.find((k) => k.id === 'remaining')?.value).toBe(20);
  });

  it('แถวล่วงหน้ามีสถานะครบเท่าแถวบน ชื่อเดียวกัน และอยู่เสมอแม้เป็น 0', () => {
    const mainLabels = data.workStatusKpis.filter((k) => k.id !== 'work_status_total').map((k) => k.label);
    const advLabels = (data.workStatusAdvanceKpis ?? []).filter((k) => k.id !== WORK_STATUS_ADVANCE_ID).map((k) => k.label);
    expect(advLabels).toEqual(mainLabels);
    expect(data.workStatusAdvanceKpis?.[0]?.id).toBe(WORK_STATUS_ADVANCE_ID);
    const none = buildDashboardData([job({})], [], null, DEFAULT_DASHBOARD_FILTERS, TODAY);
    expect(none.workStatusAdvanceKpis?.map((k) => k.value)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('ส่งคนแทน / ไม่ส่งคนแทน / ยังไม่ระบุ ของกำลังดำเนินการสรรหา ทั้งสองแถว รวมกัน = เลขบนกล่อง', () => {
    expect(main('work_status_in_progress')?.description).toBe('ใบเปิดทั้งหมด · ส่งคนแทน 4 + ไม่ส่งคนแทน 1 + ยังไม่ระบุ 3 = 8 อัตรา · 4 ใบ');
    expect(adv(advanceStatusBoxId('in_progress'))?.description).toBe('ใบเปิดทั้งหมด · ส่งคนแทน 3 + ไม่ส่งคนแทน 0 + ยังไม่ระบุ 2 = 5 อัตรา · 2 ใบ');
  });

  it('รายการตอนกดกล่องใช้ตัวตัดสินเดียวกับเลขบนกล่อง — ทุกกล่องทั้งสองแถว', () => {
    for (const k of [...data.workStatusKpis.filter((x) => x.id !== 'work_status_total'), ...(data.workStatusAdvanceKpis ?? [])]) {
      const inBox = open.filter((j) => jobInWorkStatusBox(j, k.id, TODAY));
      expect([k.id, k.value, k.secondaryCount]).toEqual([k.id, inBox.reduce((n, j) => n + (j.request_positions ?? 0), 0), inBox.length]);
    }
    const page = readFileSync('src/pages/dashboard/SupervisorDashboard.tsx', 'utf8');
    expect(page).toContain('stock.filter((j) => jobInWorkStatusBox(j, kpiId))');
    expect(page).toContain("[WORK_STATUS_ADVANCE_ID]: 'advance'");
  });

  it('พอถึงวันต้องการ ใบย้ายจากแถวล่วงหน้าขึ้นแถวบนเอง (สถานะเดิม)', () => {
    const j = job({ request_date: '2026-11-01', required_date: '2026-11-25', work_status: 'waiting_inform' });
    expect(workStatusBoxIdOf(j, new Date('2026-11-24T03:00:00Z'))).toBe(advanceStatusBoxId('waiting_inform'));
    expect(workStatusBoxIdOf(j, new Date('2026-11-25T03:00:00Z'))).toBe('work_status_waiting_inform');
    expect(workStatusBoxIdOf(j, new Date('2026-11-30T03:00:00Z'))).toBe('work_status_waiting_inform');
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
