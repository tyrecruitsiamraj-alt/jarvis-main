/**
 * กล่องใบขอของหน้าหลัก ขอใหม่ · ปิดครบ · ยกเลิก → ไล่ 12 เดือน → รายวัน → BU → เหตุผล (เจ้าของ 23 พ.ย. 2569 ข้อ 2)
 * ตัวตัดสินเดียวกับสมการใบขอ (`requestFlowRole`) ⇒ แท่งเดือน = `requestFlow` ของเดือนนั้น · ผลรวมรายวัน = แท่งเดือน
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildRequestDrillPayload, closedTimingOf, NO_STOP_REASON } from '../../src/lib/homeRequestDrill';
import { drillDayBars, drillLabeledIds, drillMonthBars, drillReasonRows, drillSetOf } from '../../src/lib/homeDrill';
import { requestFlow, type LedgerRequest } from '../../src/lib/requestPenaltyLedger';

const req = (over: Partial<LedgerRequest>): LedgerRequest =>
  ({
    requestNo: 'OPL6911001',
    site: 'LBD001',
    bu: 'LBD',
    unit: 'บจก. ทดสอบ',
    position: 'พนักงานขับรถ',
    qty: 1,
    keyYmd: '2026-10-05',
    needYmd: '2026-10-20',
    endYmd: null,
    stopReason: null,
    workDays: null,
    finePerDay: 0,
    deductPerDay: 0,
    filled: 0,
    foundYmd: null,
    speedDays: null,
    lateDays: null,
    advance: false,
    open: true,
    amount: { need: { days: 0, personDays: 0, fine: 0, deduct: 0, coveredPersonDays: 0 }, key: { days: 0, personDays: 0, fine: 0, deduct: 0, coveredPersonDays: 0 } },
    starts: [],
    ...over,
  }) as LedgerRequest;

const requests = [
  // ขอใหม่ ต.ค. แล้วคนเริ่มงานครบ 25 ต.ค. (ช้ากว่าวันต้องการ 5 วัน) = ปิดครบ ต.ค.
  req({ requestNo: 'OPL6910001', keyYmd: '2026-10-05', needYmd: '2026-10-20', starts: [['2026-10-25', 1]], endYmd: '2026-10-26', open: false }),
  // ขอใหม่ ต.ค. แล้วหยุดใบ 3 พ.ย. ไม่มีคน = ยกเลิก พ.ย. เหตุผลจาก ERP
  req({ requestNo: 'OPL6910002', bu: 'LBA', keyYmd: '2026-10-10', needYmd: '2026-10-12', endYmd: '2026-11-03', stopReason: 'ลูกค้ายกเลิก', open: false }),
  // ขอใหม่ พ.ย. ยังเปิด (ล่วงหน้า)
  req({ requestNo: 'OPL6911003', keyYmd: '2026-11-02', needYmd: '2026-12-01' }),
  // ยกเลิกไม่กรอกเหตุผล
  req({ requestNo: 'OPL6911004', keyYmd: '2026-11-05', needYmd: '2026-11-06', endYmd: '2026-11-08', open: false }),
  // นอก 12 เดือน ไม่นับ
  req({ requestNo: 'OPL6810005', keyYmd: '2025-10-01', needYmd: '2025-10-05', endYmd: '2025-10-30', starts: [['2025-10-20', 1]], open: false }),
];
const FROM = '2025-12-01';
const TO = '2026-11-23';
const p = buildRequestDrillPayload(requests, FROM, TO, (r) => r.bu ?? '');

describe('ชุดข้อมูลใบขอ', () => {
  it('กล่องใบขอใช้ชุดใบขอ · กล่องผู้สมัครใช้ชุดเดิม', () => {
    expect(drillSetOf('reqNew')).toBe('requests');
    expect(drillSetOf('reqCancelled')).toBe('requests');
    expect(drillSetOf('applied')).toBe('applicants');
    expect(p.boxes.map((b) => [b.key, b.title, b.unit])).toEqual([
      ['reqNew', 'ขอใหม่', 'ใบ'],
      ['reqClosed', 'ปิดครบ', 'ใบ'],
      ['reqCancelled', 'ยกเลิก', 'ใบ'],
    ]);
  });
  it('🔴 แท่งเดือน = สมการใบขอของเดือนนั้น · ผลรวมรายวัน = แท่งเดือน', () => {
    for (const [month, last] of [['2026-10', '2026-10-31'], ['2026-11', TO]] as const) {
      const flow = requestFlow(requests, `${month}-01`, last);
      const bar = (k: 'reqNew' | 'reqClosed' | 'reqCancelled') => drillMonthBars(p, k).find((b) => b.key === month)?.total ?? 0;
      const days = (k: 'reqNew' | 'reqClosed' | 'reqCancelled') => drillDayBars(p, k, month).reduce((n, b) => n + b.total, 0);
      expect([bar('reqNew'), bar('reqClosed'), bar('reqCancelled')]).toEqual([flow.newRequests, flow.closedRequests, flow.cancelledRequests]);
      expect([days('reqNew'), days('reqClosed'), days('reqCancelled')]).toEqual([bar('reqNew'), bar('reqClosed'), bar('reqCancelled')]);
    }
    expect(drillMonthBars(p, 'reqNew').find((b) => b.key === '2026-10')?.total).toBe(2);
    expect(drillMonthBars(p, 'reqClosed').find((b) => b.key === '2026-10')?.total).toBe(1);
    expect(drillMonthBars(p, 'reqCancelled').find((b) => b.key === '2026-11')?.total).toBe(2);
  });
  it('วันของปิดครบ/ยกเลิก = วันที่ใบหมดอัตรา', () => {
    expect(drillDayBars(p, 'reqClosed', '2026-10').find((b) => b.total > 0)?.key).toBe('2026-10-25');
    expect(drillDayBars(p, 'reqCancelled', '2026-11').filter((b) => b.total > 0).map((b) => b.key)).toEqual(['2026-11-03', '2026-11-08']);
  });
  it('เหตุผล: ขอใหม่ = ชนิดใบ · ปิดครบ = ทันวันที่ต้องการไหม · ยกเลิก = เหตุผลจาก ERP (ไม่กรอก = ช่องของตัวเอง)', () => {
    expect(drillReasonRows(p, 'reqNew', { month: '2026-11' }).rows.find((r) => r.key === 'advance')?.n).toBe(1);
    expect(drillReasonRows(p, 'reqClosed', { month: '2026-10' }).rows.find((r) => r.n > 0)?.label).toBe('ช้า 1–7 วัน');
    const cancel = drillReasonRows(p, 'reqCancelled', { month: '2026-11' }).rows.filter((r) => r.n > 0).map((r) => r.label);
    expect(cancel.sort()).toEqual(['ลูกค้ายกเลิก', NO_STOP_REASON].sort());
    expect(closedTimingOf(null, '2026-10-25')).toBe('noNeed');
    expect(closedTimingOf('2026-10-25', '2026-10-25')).toBe('onTime');
    expect(closedTimingOf('2026-09-01', '2026-10-25')).toBe('late30plus');
  });
  it('BU ตาม BU ของใบ · รายการใบมีเลขที่และหน่วยงาน · ใบนอก 12 เดือนไม่นับ', () => {
    expect(drillReasonRows(p, 'reqCancelled', { month: '2026-11', bu: 'LBA' }).total).toBe(1);
    expect(drillLabeledIds(p, 'reqNew', { month: '2026-10' }).map((x) => x.label)).toEqual(['OPL6910001 · บจก. ทดสอบ', 'OPL6910002 · บจก. ทดสอบ']);
    expect(p.ids.some((id) => id.includes('OPL6810005'))).toBe(false);
  });
});

describe('จอ', () => {
  it('กล่องใบขอบนหน้าหลัก (สองโฉม) เปิดแผงไล่ 12 เดือน · แผงเดิมอยู่ปุ่ม "สรุปช่วงวันที่บนหน้า"', () => {
    const page = readFileSync('src/pages/HomeOverviewPage.tsx', 'utf8');
    expect(page.match(/openRequestDrill\('reqNew', openNew\)/g)?.length).toBe(2);
    expect(page.match(/openRequestDrill\('reqClosed'/g)?.length).toBe(2);
    expect(page.match(/openRequestDrill\('reqCancelled', openCancelledSummary\)/g)?.length).toBe(2);
    const sheet = readFileSync('src/components/home-overview/TimeDrillSheet.tsx', 'utf8');
    expect(sheet).toContain('fetchHomeDrill(bu, drillSetOf(box))');
    expect(sheet).toContain('data-testid="drill-request-list"');
    expect(readFileSync('api/_handlers/home-drill.ts', 'utf8')).toContain("req.query?.set === 'requests'");
  });
});
