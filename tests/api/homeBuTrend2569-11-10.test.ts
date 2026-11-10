// @vitest-environment node
/**
 * เทียบ BU ตามเวลา + ลิงก์พกช่วงวันที่ (เจ้าของ 10 พ.ย. 2569)
 * > *"ถ้าฉันกดดูแบบเดือน ก็จะเห็นทุกเดือนเลย พอกดเดือนไหนก็ค่อยให้เห็นเป็นวัน"*
 * > *"กด 1474 ของ 1-10 พย ต้องโชว์ยอด 1-10 พย"*
 * แท่งของช่วงเดียวกับการ์ด = เลขบนการ์ดพอดี (สมุดใบขอตัวเดียวกัน ไม่คิดใหม่)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPenaltyLedger, requestFlow, type PenaltyRequestRow } from '@/lib/requestPenaltyLedger';
import { buildBuTrend, dayBuckets, monthBuckets } from '@/lib/homeBuTrend';
import { rangeFromParams, withRange } from '@/lib/jobNavigation';

const base = (p: Partial<PenaltyRequestRow>): PenaltyRequestRow => ({
  requestNo: 'OPL6911003',
  site: 'LBD001',
  bu: 'LBD',
  unit: 'หน่วยงาน',
  position: 'พนักงานขับรถ',
  qty: 1,
  keyYmd: '2026-10-20',
  needYmd: '2026-10-25',
  endYmd: null,
  workDays: null,
  finePerDay: 500,
  deductPerDay: 300,
  ...p,
});

const TODAY = '2026-11-10';
const rows: PenaltyRequestRow[] = [
  base({ requestNo: 'OPL6910001' }),
  base({ requestNo: 'OPL6910002', bu: 'LBA', site: 'LBA001', qty: 2, finePerDay: 1000, deductPerDay: 0 }),
  base({ requestNo: 'OPL6911001', keyYmd: '2026-11-02', needYmd: '2026-11-05' }),
  base({ requestNo: 'OPL6909001', keyYmd: '2026-09-01', needYmd: '2026-09-03', endYmd: '2026-10-15' }),
  base({ requestNo: 'OPL6911002', bu: 'LM', site: 'LM001', keyYmd: '2026-11-03', needYmd: '2026-12-01', finePerDay: 0, deductPerDay: 0 }),
];
const buOf = (r: PenaltyRequestRow) => r.bu ?? 'ไม่ระบุ BU';
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('เทียบ BU ตามเวลา ใช้สมุดเดียวกับการ์ด', () => {
  it('เดือนนี้ (1–10 พ.ย.) รวมทุก BU = เงินและเหลือหาบนการ์ดช่วงเดียวกัน', () => {
    const range = { from: '2026-11-01', to: TODAY };
    const card = buildPenaltyLedger(rows, [], TODAY, range, {});
    const cardMoney = sum(card.requests.map((r) => r.amount.need.fine + r.amount.need.deduct));
    const cardFlow = requestFlow(card.requests, range.from, range.to);
    const trend = buildBuTrend(rows, [], TODAY, monthBuckets(TODAY, 12), buOf);
    const nov = trend.points[trend.points.length - 1];
    expect(nov.key).toBe('2026-11');
    expect(nov.to).toBe(TODAY);
    const cells = Object.values(nov.byBu);
    expect(sum(cells.map((c) => c.money))).toBeCloseTo(cardMoney, 2);
    expect(cardMoney).toBeGreaterThan(0);
    expect(sum(cells.map((c) => c.remainingRequests))).toBe(cardFlow.remainingRequests);
    expect(sum(cells.map((c) => c.remainingPositions))).toBe(cardFlow.remaining);
  });

  it('แท่งรายวันวันที่ 10 = เหลือหา ณ 10 พ.ย. · ใบที่ไม่มีค่าปรับแต่ยังเปิดก็อยู่ในแถว BU', () => {
    const trend = buildBuTrend(rows, [], TODAY, dayBuckets('2026-11', TODAY), buOf);
    const d10 = trend.points[trend.points.length - 1];
    expect(d10.key).toBe(TODAY);
    const card = requestFlow(buildPenaltyLedger(rows, [], TODAY, { from: TODAY, to: TODAY }, {}).requests, TODAY, TODAY);
    expect(sum(Object.values(d10.byBu).map((c) => c.remainingRequests))).toBe(card.remainingRequests);
    expect(trend.bus).toEqual(['LBA', 'LBD', 'LM']);
    expect(d10.byBu.LM).toEqual({ money: 0, remainingRequests: 1, remainingPositions: 1 });
  });

  it('ใบที่ปิดก่อนช่วงไม่โผล่ในเดือนหลังปิด · เดือนที่ยังไม่มีใบ = ไม่มีแถว (ตารางขึ้น 0)', () => {
    const trend = buildBuTrend(rows, [], TODAY, monthBuckets(TODAY, 3), buOf);
    const [sep, oct, nov] = trend.points;
    expect(sep.byBu.LBD?.remainingRequests).toBe(1);
    expect(oct.byBu.LBA?.remainingRequests).toBe(1);
    expect(nov.byBu.LBD?.remainingRequests).toBe(2);
  });
});

describe('ช่องเดือน/วัน', () => {
  it('เดือนนี้ตัดที่วันนี้ · ข้ามปีถูก', () => {
    expect(monthBuckets('2026-01-15', 3)).toEqual([
      { key: '2025-11', from: '2025-11-01', to: '2025-11-30' },
      { key: '2025-12', from: '2025-12-01', to: '2025-12-31' },
      { key: '2026-01', from: '2026-01-01', to: '2026-01-15' },
    ]);
  });
  it('รายวันไม่เกินวันนี้ · เดือนก่อนครบทุกวัน · ก.พ. ปีอธิกสุรทิน', () => {
    expect(dayBuckets('2026-11', TODAY)).toHaveLength(10);
    expect(dayBuckets('2026-10', TODAY)).toHaveLength(31);
    expect(dayBuckets('2028-02', '2028-12-31')).toHaveLength(29);
    expect(dayBuckets('2026-12', TODAY)).toEqual([]);
  });
});

describe('ลิงก์พกช่วงวันที่ไปหน้าปลายทาง', () => {
  it('ต่อ query ถูกทั้งมีและไม่มี ? · อ่านกลับได้ช่วงเดิม', () => {
    const r = { from: '2026-11-01', to: '2026-11-10' };
    expect(withRange('/jobs/board?view=list', r)).toBe('/jobs/board?view=list&from=2026-11-01&to=2026-11-10');
    expect(withRange('/follow', r)).toBe('/follow?from=2026-11-01&to=2026-11-10');
    const back = rangeFromParams(new URL(`http://x${withRange('/jobs/board?view=contact&chip=uncalled', r)}`).searchParams);
    expect(back).toEqual(r);
  });
  it('ไม่ครบ/ผิดรูป/กลับหัว = ไม่กรอง (ไม่เดาช่วง)', () => {
    expect(rangeFromParams(new URLSearchParams('from=2026-11-01'))).toBeNull();
    expect(rangeFromParams(new URLSearchParams('from=2026-11-1&to=2026-11-10'))).toBeNull();
    expect(rangeFromParams(new URLSearchParams('from=2026-11-10&to=2026-11-01'))).toBeNull();
  });
  it('หน้าหลักโฉมต้นแบบส่งช่วงไปทุกปุ่มลัด · แท็บการติดต่ออ่าน chip/scope จากลิงก์', () => {
    const home = readFileSync('src/pages/HomeOverviewPage.tsx', 'utf8');
    expect(home).toContain("withRange(STEP_PAGE[s.key].to, range)");
    expect(home).toContain("withRange('/jobs/board?view=contact&scope=mine&chip=uncalled', range)");
    expect(home).toContain("withRange('/jobs/board?view=appointments', { from: today, to: today })");
    const board = readFileSync('src/pages/jobs/StaffJobBoardPage.tsx', 'utf8');
    expect(board).toContain('rangeFromParams(searchParams)');
    const ws = readFileSync('src/components/recruit-rm/RmWorkspace.tsx', 'utf8');
    expect(ws).toContain("searchParams.get('scope') === 'all' ? 'all' : 'mine'");
    expect(ws).toContain('CONTACT_CHIPS.some((x) => x.id === c)');
  });
  it('API แนวโน้ม BU อยู่ในเส้นเดิม (ไม่เปลี่ยน contract เดิม) · รายการใบบอกขั้น', () => {
    const api = readFileSync('api/_handlers/home-money.ts', 'utf8');
    expect(api).toContain("q.trend === 'bu'");
    const drill = readFileSync('src/components/home-exec/ExecDrill.tsx', 'utf8');
    expect(drill).toContain('stageOf');
  });
});
