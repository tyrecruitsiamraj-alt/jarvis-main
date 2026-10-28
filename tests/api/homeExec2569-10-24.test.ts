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
import { byOwner, costliest, dueSoon, NO_OWNER, overdueOf, staleOf, thisMonthWindow } from '@/lib/homeExec';
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
    const base = { channelLabel: 'Facebook Group', referralSource: null, aiAnswer: null, staffAnswer: null, appointmentAt: null, attendance: null } as const;
    const r = channelInterestOf(
      [
        { ...base, createdAt: '2026-10-02T03:00:00Z', aiAnswer: 'said_yes' },
        { ...base, createdAt: '2026-10-03T03:00:00Z', appointmentAt: '2026-10-05T03:00:00Z' },
        { ...base, createdAt: '2026-09-01T03:00:00Z', aiAnswer: 'said_yes' },
      ],
      '2026-10-01',
      '2026-10-31',
    );
    expect(r.byType.get('Facebook กลุ่ม')).toEqual({ interested: 2, appointed: 1, showed: 0 });
    expect(r.byPlatform.get('facebook')).toEqual({ interested: 2, appointed: 1, showed: 0 });
  });
});

describe('หน้า + เส้น', () => {
  it('ค่าตั้งต้นของ / = หน้าผู้บริหาร · แท็บภาพรวม + แท็บชุดเดียวกับหน้าแท็บเดิม ไม่มีปุ่มพาออก (25 ต.ค. 2569)', () => {
    const v = read('src/lib/homeV3.ts');
    expect(v).toContain("return 'exec';");
    expect(read('src/pages/HomePage.tsx')).toContain('<HomeExecPage />');
    const exec = read('src/pages/HomeExecPage.tsx');
    expect(exec).not.toContain('href="/?home=new"');
    expect(exec).not.toContain('แบบแท็บเดิม');
    expect(exec).toContain('<HomeAiSharePage embedded=');
    expect(exec).toContain('data-testid="exec-tabs"');
    for (const k of ["key: 'overview', label: 'ภาพรวม'", "key: 'requests', label: 'ใบขอ'", "key: 'follow'", "key: 'aftercare'", "key: 'applicants'", "key: 'matching'"])
      expect(exec).toContain(k);
    expect(exec).toContain('pick: tab.key, seq: tab.seq');
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
    open: true, advance: false, finePerDay: 100, deductPerDay: 50, speedDays: null, lateDays: null, owner: null, filledInWindow: 0, closedInWindow: false, stopReason: null, clocked: false, flow: null,
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
    // กล่องเสียเงิน "ใบที่เลยวัน · เสียวันละ" = ผลรวมตารางเจ้าหน้าที่ (เจ้าของ 27 ต.ค. 2569 "ยอดไม่เท่ากันหนิ")
    const od = overdueOf(list, '2026-10-24');
    const owners = byOwner(list, '2026-10-24');
    expect(od.perDay).toBe(1050);
    expect(od.perDay).toBe(owners.reduce((a, o) => a + o.perDay, 0));
    expect(od.rows.length).toBe(owners.reduce((a, o) => a + o.overdue, 0));
    expect(od.perDay).toBe(c.rows.reduce((a, r) => a + r.perDay, 0) + staleOf(list, '2026-10-24').perDay);
    // 27 ต.ค. 2569 "เป็นไปไม่ได้ที่จะโดนปรับวันละ 2 แสน" — เสียวันละ = สมุดของวันนี้ (หักคนแทน) เมื่อ server ส่ง todayCost มา
    const withCover = list.map((r) => (r.requestNo === 'A' ? { ...r, todayCost: 150 } : r.requestNo === 'B' ? { ...r, todayCost: 0 } : r));
    expect(overdueOf(withCover, '2026-10-24').perDay).toBe(150 + 600);
    expect(costliest(withCover, '2026-10-24').rows.map((r) => [r.requestNo, r.perDay])).toEqual([['A', 150]]);
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
  it('ค่าตั้งต้น = เดือนนี้', () => {
    expect(thisMonthWindow('2026-10-24')).toEqual({ from: '2026-10-01', to: '2026-10-24' });
  });
  it('หน้าโชว์ลูกค้าหักจริงกับตามสัญญาตัวเท่ากัน · ส่วนยาวพับไว้', () => {
    const page = read('src/pages/HomeExecPage.tsx');
    for (const id of ['exec-money-actual', 'exec-money-contract', 'exec-urgent-costly', 'exec-urgent-soon', 'exec-owners', 'exec-fold-money']) {
      expect(page).toContain(id);
    }
    // 28 ต.ค. 2569 การ์ดช่องทางย้ายเป็นกราฟ (`ExecChannelChart`)
    expect(page).toContain('<ExecChannelChart stages={stages}');
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
    expect(read('src/components/home-exec/Num.tsx')).toContain("useCountUp(Math.round((held ?? 0) * scale), held == null ? 'none' : 'exec')");
  });
});

describe('อ่านหน้าแบบผู้บริหาร 4 ข้อ + เลขไม่ขึ้น 0 (25 ต.ค. 2569)', () => {
  const page = read('src/pages/HomeExecPage.tsx');
  it('ยกเลิกเป็นกล่องเดียว กดแล้วแยกเหตุผลจาก ERP · ผลรวมเหตุผลเท่ากล่อง · ไม่กรอกอยู่ท้าย', async () => {
    const { reasonsOf, NO_REASON } = await import('@/lib/homeExec');
    const mk = (stopReason: string | null, cancelled: number) => ({ stopReason, flow: { cancelled } }) as never;
    const rows = [mk('ลูกค้ายกเลิก(ไม่เอาคนแล้ว)', 2), mk(null, 1), mk('ยกเลิกโดย-สยามราช', 3), mk('ยกเลิกโดย-สยามราช', 1)];
    const byReq = reasonsOf(rows, () => 1);
    expect(byReq).toEqual([
      { label: 'ยกเลิกโดย-สยามราช', n: 2 },
      { label: 'ลูกค้ายกเลิก(ไม่เอาคนแล้ว)', n: 1 },
      { label: NO_REASON, n: 1 },
    ]);
    const byPeople = reasonsOf(rows, (r: { flow: { cancelled: number } }) => r.flow.cancelled);
    expect(byPeople.reduce((a, x) => a + x.n, 0)).toBe(7);
    expect(page).toContain("label === 'ยกเลิก'");
    expect(read('api/_lib/siamrajPenaltyLedgerSql.ts')).toContain('st_ms_stop_by');
  });
  it('ช่องทาง 4 ขั้น: กรอก · นัดได้ · มาตามนัด · ลงงาน', async () => {
    const { channelInterestOf } = await import('@/lib/channelPlatforms');
    const f = (attendance: string | null) => ({ createdAt: '2026-10-10T03:00:00Z', channelLabel: 'Facebook Group', referralSource: null, aiAnswer: null, staffAnswer: null, appointmentAt: '2026-10-12T03:00:00Z', attendance });
    const m = channelInterestOf([f('showed'), f('no_show'), f(null)] as never, '2026-10-01', '2026-10-31').byType.get('Facebook กลุ่ม');
    expect(m).toEqual({ interested: 3, appointed: 3, showed: 1 });
    expect(page).toContain('showed: all((r) => interest.get(r.channel)?.showed ?? 0)');
    expect(read('src/components/home-exec/ExecChannelChart.tsx')).toContain("{ key: 'showed', label: 'มาตามนัด' }");
    expect(read('src/components/home-ai-share/HomeRequestsTab.tsx')).toContain('มาตามนัด (คน)');
  });
  it('ดูแลหลังเริ่มงานบอกสายที่รออยู่ · ต้องรีบบอกชื่อเจ้าหน้าที่', () => {
    expect(page).toContain('exec-aftercare-upcoming');
    expect(read('api/_handlers/home-money.ts')).toContain('loadAftercareUpcoming');
    expect(page).toContain('คน · {r.owner}');
    expect(read('src/lib/homeExec.ts')).toContain('owner: r.owner?.trim() || NO_OWNER');
  });
  it('เลขกล่องบนโหลดครั้งแรกขึ้นทันที ไม่วิ่งจาก 0', () => {
    expect(page).toContain("const liveKey = kpi ? 'exec' : 'exec-wait';");
  });
});

describe('มือถือ 375 (ตรวจ 25 ต.ค. 2569)', () => {
  const page = read('src/pages/HomeExecPage.tsx');
  const drill = read('src/components/home-exec/ExecDrill.tsx');
  it('ใครค้างเท่าไหร่: มือถือเป็นรายการคนละแถว เลขครบ · ตารางจาก sm ขึ้นไป', () => {
    expect(page).toContain('data-testid="exec-owners-phone"');
    expect(page).toContain('className="divide-y divide-border sm:hidden"');
    expect(page).toContain('className="hidden overflow-x-auto sm:block"');
  });
  it('แผงรายละเอียด: มือถือซ่อน 3 ช่องขวาแล้วบอกในบรรทัดใบขอ · ไม่มีความกว้างสุ่ม', () => {
    expect(drill).toContain('sm:hidden');
    expect(drill).not.toMatch(/min-w-\[/);
  });
  it('หัวส่วนพับขึ้นบรรทัดใหม่ได้ ลูกศรไม่ตกขอบ', () => {
    expect(page).toContain('justify-between whitespace-normal');
    expect(page).toContain("'h-4 w-4 shrink-0 transition-transform'");
  });
});

describe('แท็บ + คำบนจอ (เจ้าของ 25 ต.ค. 2569 ค่ำ)', () => {
  const page = read('src/pages/HomeExecPage.tsx');
  it('ถอด "AI กับคน ถ้างานเพิ่ม" ออกหมด ทั้งจอ ตัวคำนวณ และเส้นดึงข้อมูล', () => {
    expect(page).not.toContain('ถ้างานเพิ่ม');
    expect(page).not.toContain('Slider');
    expect(read('src/lib/homeExec.ts')).not.toContain('scaleOf');
    expect(read('api/_handlers/home-money.ts')).not.toContain('loadWorkload');
  });
  it('ชื่อที่เจ้าของกำหนด: ใบที่โดนค่าปรับ · ใกล้ถึงวันที่ต้องการ · งานของเจ้าหน้าที่ · ใบขอ', () => {
    for (const k of ['title="ใบที่โดนค่าปรับ"', 'title="ใกล้ถึงวันที่ต้องการ"', 'title="งานของเจ้าหน้าที่"', 'title="ใบขอ"']) expect(page).toContain(k);
    for (const old of ['เสียวันละมากสุด', 'ถึงวันที่ต้องการใน 3 วัน', 'ใครค้างเท่าไหร่ · ใครปิดได้', 'ใบขอในช่วงนี้']) expect(page).not.toContain(old);
  });
  it('ใบขอ: จำนวนคนอยู่กล่องเดียวกับจำนวนใบ · สมการยังลงตัวทั้งสองหน่วย', () => {
    expect(page).toContain("['ปิดครบ', flow?.closedRequests, flow?.filled, 'หาได้ '");
    expect(page).toContain('exec-flow-req-sum');
    expect(page).toContain('exec-flow-pos-sum');
  });
  it('การ์ดเสียเงินไม่มีบรรทัดใบที่เลยวัน · ค้างเกิน 90 วัน · เทียบช่วงก่อน (เจ้าของ 28 ต.ค. 2569 "เอาออก")', () => {
    const tile = page.slice(page.indexOf('data-testid="exec-money-tile"'), page.indexOf('label="เหลือหา (ใบขอจริง)"'));
    for (const id of ['data-testid="exec-stale"', 'data-testid="exec-overdue"', 'เทียบช่วงก่อนหน้าที่ยาวเท่ากัน']) expect(tile).not.toContain(id);
  });
});

describe('ใบขอ = ทีม Online แท็บเดียว · ประวัติยิงยกเลิก Lumos (25 ต.ค. 2569)', () => {
  it('แท็บใบขอมีของทีม Online ครบ ไม่มีแท็บทีม Online แยก', () => {
    const page = read('src/pages/HomeExecPage.tsx');
    expect(page).not.toContain("label: 'ทีม Online'");
    const tab = page.slice(page.indexOf('data-testid="exec-requests-body"') - 200);
    expect(tab).toContain('<HomeOnlineTab');
    expect(tab).toContain('<HomeRequestsTab');
  });
  it('ยิงยกเลิกซ้ำ: อ่านประวัติจากบันทึกการใช้งาน · ถามสถานะซ้ำแล้วจดลงบันทึก · หน้าตั้งค่ามีประวัติ', () => {
    const lib = read('api/_lib/followOldIdRepush.ts');
    expect(lib).toContain("export const RECANCEL_ACTION = 'follow.oldid_recancel'");
    expect(lib).toContain('export async function listRecancelRuns');
    const h = read('api/_handlers/follow-oldid-repush.ts');
    expect(h).toContain("req.query?.action === 'history'");
    expect(h).toContain('action: RECANCEL_STATUS_ACTION');
    const card = read('src/pages/settings/LumosOldIdRepushCard.tsx');
    expect(card).toContain('data-testid="oldid-recancel-history"');
    expect(card).toContain("imported: 'รับคำสั่งแล้ว'");
  });
});

