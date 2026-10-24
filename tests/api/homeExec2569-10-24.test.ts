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

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('ก้อนเงิน + สมการใบขอ', () => {
  const rows = [
    { requestNo: 'A1', site: 'S1', bu: 'LBD', unit: 'U', position: 'P', qty: 2, keyYmd: '2026-10-01', needYmd: '2026-10-01', endYmd: null, workDays: 'ทุกวัน', finePerDay: 100, deductPerDay: 0 },
    { requestNo: 'A2', site: 'S1', bu: 'LBD', unit: 'U', position: 'P', qty: 1, keyYmd: '2026-10-05', needYmd: '2026-10-20', endYmd: null, workDays: 'ทุกวัน', finePerDay: 100, deductPerDay: 50 },
  ];
  const informs = [{ requestNo: 'A1', startYmd: '2026-10-03', recordYmd: '2026-10-03', qty: 1 }];
  const L = buildPenaltyLedger(rows, informs, '2026-10-10', { from: '2026-10-01', to: '2026-10-10' });
  const body = buildHomeMoney(L, [{ ym: '2026-10', amount: 500, receipts: 2 }], { from: '2026-10-01', to: '2026-10-10', today: '2026-10-10', since: '2024-01-01', bu: null, forcedBu: false });

  it('ยอดรวม = ผลรวมรายใบ · ใบล่วงหน้าที่ยังไม่ถึงวันต้องการไม่มีเงิน · ลูกค้าหักจริงรายเดือน', () => {
    // A1: 1–2 ต.ค. ขาด 2 · 3–10 ต.ค. ขาด 1 = 2×2 + 8 = 12 คน-วัน
    expect(body.totals.need.personDays).toBe(12);
    expect(body.totals.need.fine).toBe(1200);
    expect(body.requests.find((r) => r.requestNo === 'A2')?.amount.need.fine).toBe(0);
    expect(body.customerFines.total).toBe(500);
  });
  it('สมการลงตัวทั้งใบและคน', () => {
    const f = body.flow;
    expect(f.carryInRequests + f.newRequests - f.closedRequests - f.cancelledRequests).toBe(f.remainingRequests);
    expect(f.carryIn + f.newPositions - f.filled - f.cancelled).toBe(f.remaining);
    expect([f.remainingRequests, f.remaining]).toEqual([2, 2]);
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
  it('ค่าตั้งต้นของ / = หน้าผู้บริหาร · หน้าแท็บเดิมยังเปิดได้ (?home=new) และมีปุ่มกลับ', () => {
    const v = read('src/lib/homeV3.ts');
    expect(v).toContain("return 'exec';");
    expect(read('src/pages/HomePage.tsx')).toContain('<HomeExecPage />');
    expect(read('src/pages/HomeExecPage.tsx')).toContain('href="/?home=new"');
    expect(read('src/pages/HomeAiSharePage.tsx')).toContain('href="/?home=exec"');
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
