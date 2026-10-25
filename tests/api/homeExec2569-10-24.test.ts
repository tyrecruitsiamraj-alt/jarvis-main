/**
 * หน้าหลักผู้บริหาร หน้าเดียวเลื่อนลง (เจ้าของ 24 ต.ค. 2569) — ด่านที่ห้ามหลุด
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPenaltyLedger } from '@/lib/requestPenaltyLedger';
import { buildHomeMoney, ledgerByRequest } from '@/lib/homeMoney';
import { previousWindow } from '@/lib/homeMoneyApi';
import { channelInterestOf } from '@/lib/channelPlatforms';
import { byOwner, costliest, dueSoon, NO_OWNER, peopleNeeded, scaleOf, staleOf, thisMonthWindow } from '@/lib/homeExec';
import type { MoneyRequest } from '@/lib/homeMoney';

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('ก้อนเงิน + สมการใบขอ', () => {
  const rows = [
    { requestNo: 'A1', site: 'S1', bu: 'LBD', unit: 'U', position: 'P', qty: 2, keyYmd: '2026-10-01', needYmd: '2026-10-01', endYmd: null, workDays: 'ทุกวัน', finePerDay: 100, deductPerDay: 0 },
    { requestNo: 'A2', site: 'S1', bu: 'LBD', unit: 'U', position: 'P', qty: 1, keyYmd: '2026-10-05', needYmd: '2026-10-20', endYmd: null, workDays: 'ทุกวัน', finePerDay: 100, deductPerDay: 50 },
  ];
  const informs = [{ requestNo: 'A1', startYmd: '2026-10-03', recordYmd: '2026-10-03', qty: 1 }];
  const L = buildPenaltyLedger(rows, informs, '2026-10-10', { from: '2026-10-01', to: '2026-10-10' });
  const body = buildHomeMoney(L, [{ ymd: '2026-10-05', amount: 500, receipts: 2 }, { ymd: '2026-09-30', amount: 900, receipts: 1 }], { from: '2026-10-01', to: '2026-10-10', today: '2026-10-10', since: '2024-01-01', bu: null, forcedBu: false });

  it('ยอดรวม = ผลรวมรายใบ · ใบล่วงหน้าที่ยังไม่ถึงวันต้องการไม่มีเงิน · ลูกค้าหักจริงรายเดือน', () => {
    // A1: 1–2 ต.ค. ขาด 2 · 3–10 ต.ค. ขาด 1 = 2×2 + 8 = 12 คน-วัน
    expect(body.totals.need.personDays).toBe(12);
    expect(body.totals.need.fine).toBe(1200);
    expect(body.requests.find((r) => r.requestNo === 'A2')?.amount.need.fine).toBe(0);
    expect(body.customerFines.total).toBe(500);
  });
  it('สมการลงตัวทั้งใบและคน · รายใบที่กดดูบวกกันเท่ากล่อง', () => {
    const f = body.flow;
    const sumOf = (k: 'carryIn' | 'newPositions' | 'filled' | 'cancelled' | 'remaining') =>
      body.requests.reduce((a, r) => a + (r.flow?.[k] ?? 0), 0);
    expect([sumOf('carryIn'), sumOf('newPositions'), sumOf('filled'), sumOf('cancelled'), sumOf('remaining')]).toEqual([
      f.carryIn, f.newPositions, f.filled, f.cancelled, f.remaining,
    ]);
    expect(body.requests.filter((r) => r.flow?.open).length).toBe(f.remainingRequests);
    expect(f.carryInRequests + f.newRequests - f.closedRequests - f.cancelledRequests).toBe(f.remainingRequests);
    expect(f.carryIn + f.newPositions - f.filled - f.cancelled).toBe(f.remaining);
    expect([f.remainingRequests, f.remaining]).toEqual([2, 2]);
    expect(body.requests.filter((r) => r.clocked).length).toBe(body.clocks.speed.n);
  });
  it('แท็บใบขอใช้ยอดรายใบจากสมุดเดียวกัน (เลขไม่ใช่ศูนย์ = จับคู่เลขใบขอได้)', () => {
    expect(ledgerByRequest(body).get('A1')?.fine).toBe(1200);
    expect(read('src/components/home-ai-share/HomeRequestsTab.tsx')).toContain('ledgerByRequest(money)');
  });
  it('ช่วงก่อนหน้ายาวเท่ากันชนติดวันแรก', () => {
    expect(previousWindow({ from: '2026-10-18', to: '2026-10-24' })).toEqual({ from: '2026-10-11', to: '2026-10-17' });
  });
});

describe('ช่องทาง: สนใจ / นัดได้', () => {
  it('นับเฉพาะที่กรอกในช่วง · สนใจรวมคนที่มีนัด', () => {
    const base = { channelLabel: 'Facebook Group', referralSource: null, aiAnswer: null, staffAnswer: null, appointmentAt: null } as const;
    const r = channelInterestOf(
      [
        { ...base, createdAt: '2026-10-02T03:00:00Z', aiAnswer: 'said_yes' },
        { ...base, createdAt: '2026-10-03T03:00:00Z', appointmentAt: '2026-10-05T03:00:00Z' },
        { ...base, createdAt: '2026-09-01T03:00:00Z', aiAnswer: 'said_yes' },
      ],
      '2026-10-01',
      '2026-10-31',
    );
    expect(r.byType.get('Facebook กลุ่ม')).toEqual({ interested: 2, appointed: 1 });
    expect(r.byPlatform.get('facebook')).toEqual({ interested: 2, appointed: 1 });
  });
});

describe('หน้า + เส้น', () => {
  it('ค่าตั้งต้นของ / = หน้าผู้บริหาร · หน้าแท็บเดิมรวมเป็นส่วนรายชื่อท้ายหน้า ไม่มีปุ่มพาออก (25 ต.ค. 2569)', () => {
    const v = read('src/lib/homeV3.ts');
    expect(v).toContain("return 'exec';");
    expect(read('src/pages/HomePage.tsx')).toContain('<HomeExecPage />');
    const exec = read('src/pages/HomeExecPage.tsx');
    expect(exec).not.toContain('href="/?home=new"');
    expect(exec).not.toContain('แบบแท็บเดิม');
    expect(exec).toContain('<HomeAiSharePage embedded=');
    expect(exec).toContain('exec-fold-ai');
    // หน้าเดิมยังเปิดได้ที่ ?home=new (ทางถอย) และฝังแล้วไม่มีหัว/ปฏิทิน/แท็บใบขอซ้ำ
    const old = read('src/pages/HomeAiSharePage.tsx');
    expect(old).toContain('href="/?home=exec"');
    expect(old).toContain('{embedded ? null : (');
  });
  it('ครบทุกส่วนที่เจ้าของสั่ง · มีกราฟ Interactive', () => {
    const page = read('src/pages/HomeExecPage.tsx');
    for (const id of ['exec-kpis', 'exec-flow', 'exec-follow', 'exec-ai-share']) expect(page).toContain(id);
    expect(page).toContain('<HomeRequestsTab');
    expect(page).toContain('<HomeMoneySection');
    const money = read('src/components/home-exec/HomeMoneySection.tsx');
    expect(money).toContain('animationDuration={CHART.animationDuration}');
    expect(money).toContain('cursor={CHART.cursorBar}');
    expect(read('api/_handlers/registry.ts')).toContain("'/api/home-money': homeMoneyHandler");
  });
});

describe('30 วินาที: ต้องรีบ · ใครค้างเท่าไหร่ (24 ต.ค. 2569 รอบ 2)', () => {
  const amt = { days: 0, personDays: 0, fine: 0, deduct: 0, coveredPersonDays: 0 };
  const req = (o: Partial<MoneyRequest>): MoneyRequest => ({
    requestNo: 'R', bu: 'LBD', unit: 'U', position: 'P', qty: 1, filled: 0, keyYmd: '2026-10-01', needYmd: '2026-10-01', endYmd: null,
    open: true, advance: false, finePerDay: 100, deductPerDay: 50, speedDays: null, lateDays: null, owner: null, filledInWindow: 0, closedInWindow: false, clocked: false, flow: null,
    amount: { need: amt, key: amt }, ...o,
  });
  const list = [
    req({ requestNo: 'A', qty: 3, filled: 1, owner: 'แบงค์' }), // เลยแล้ว ขาด 2 → 300/วัน
    req({ requestNo: 'B', qty: 1 }), // เลยแล้ว 150/วัน
    req({ requestNo: 'C', needYmd: '2026-10-26', owner: 'แบงค์' }), // อีก 2 วัน
    req({ requestNo: 'D', needYmd: '2026-11-30', open: false }), // ปิดแล้ว ไม่เกี่ยว
    req({ requestNo: 'E', open: false, owner: 'แบงค์', closedInWindow: true, filledInWindow: 2 }), // ปิดครบในช่วง
    req({ requestNo: 'OLD', needYmd: '2026-06-01', qty: 4 }), // ค้างเกิน 90 วัน ไม่เคยได้คน
  ];
  it('เสียวันละมากสุด = เลยวันที่ต้องการแล้ว · คนที่ขาด × (ค่าปรับ + ลดมูลค่า)', () => {
    const c = costliest(list, '2026-10-24');
    expect(c.rows.map((r) => [r.requestNo, r.perDay])).toEqual([['A', 300], ['B', 150]]);
    expect(c.total).toBe(2);
    // ใบค้างนานผิดปกติแยกออก ไม่เบียด
    expect(staleOf(list, '2026-10-24')).toMatchObject({ perDay: 600, rows: [{ requestNo: 'OLD' }] });
  });
  it('ถึงวันที่ต้องการใน 3 วัน ยังขาดคน', () => {
    expect(dueSoon(list, '2026-10-24').rows.map((r) => r.requestNo)).toEqual(['C']);
  });
  it('แยกเจ้าหน้าที่ · ไม่รู้ชื่อ = ยังไม่มีคนรับผิดชอบ อยู่ท้าย · ปิดแล้วไม่นับ', () => {
    const o = byOwner(list, '2026-10-24');
    expect(o).toEqual([
      { name: 'แบงค์', requests: 2, overdue: 1, missing: 3, perDay: 300, closed: 1, filled: 2 },
      { name: NO_OWNER, requests: 2, overdue: 2, missing: 5, perDay: 750, closed: 0, filled: 0 },
    ]);
  });
  it('Scale: คนทำได้วันละ = งาน ÷ คน-วัน · งานเพิ่ม X ต้องใช้คนเพิ่มปัดขึ้น', () => {
    const sc = scaleOf({ staffActions: 300, staffPeople: 5, staffPersonDays: 50, aiCalls: 1000 }, '2026-10-01', '2026-10-10')!;
    expect(sc).toEqual({ perPersonDay: 6, staffPeople: 5, staffPerDay: 30, aiPerDay: 100, days: 10 });
    expect(peopleNeeded(50, sc.perPersonDay)).toBe(9);
    expect(peopleNeeded(50, null)).toBeNull();
  });
  it('ค่าตั้งต้น = เดือนนี้', () => {
    expect(thisMonthWindow('2026-10-24')).toEqual({ from: '2026-10-01', to: '2026-10-24' });
  });
  it('หน้าโชว์ลูกค้าหักจริงกับตามสัญญาตัวเท่ากัน · ส่วนยาวพับไว้', () => {
    const page = read('src/pages/HomeExecPage.tsx');
    for (const id of ['exec-money-actual', 'exec-money-contract', 'exec-urgent-costly', 'exec-urgent-soon', 'exec-stale', 'exec-owners', 'exec-channels', 'exec-scale', 'exec-fold-requests', 'exec-fold-money']) {
      expect(page).toContain(id);
    }
  });
});

describe('กดกล่องดูลึกได้เรื่อย ๆ · เลขวิ่งตอนข้อมูลเปลี่ยน (24 ต.ค. 2569 รอบ 4)', () => {
  const page = read('src/pages/HomeExecPage.tsx');
  const drill = read('src/components/home-exec/ExecDrill.tsx');
  it('แผงเดียวซ้อนชั้น ย้อนกลับได้ · กดใบแล้วไปใบอื่นของเจ้าหน้าที่/หน่วยงานเดียวกัน', () => {
    expect(page).toContain('<ExecDrill');
    expect(drill).toContain('exec-drill-back');
    expect(drill).toContain('ใบอื่นของหน่วยงานนี้');
    expect(drill).not.toMatch(/<Dialog\b/);
  });
  it('กล่องเงิน เหลือหา หาคนครบ สมการใบขอ กดได้ · ตัวเลขใช้ Num ที่วิ่ง', () => {
    for (const k of ["openList('เสียเงินตามสัญญา'", "openList('เหลือหา'", 'r.clocked', 'flowRows(pick)', 'exec-flow-']) expect(page).toContain(k);
    expect((page.match(/<Num /g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(read('src/components/home-exec/Num.tsx')).toContain("useCountUp(Math.round((held ?? 0) * scale), 'exec')");
  });
});
