/**
 * หน้า "ทีม Online" — ตัวคิด pure (29 ก.ย. 2569 · รอบ 2 ปฏิทิน + เทียบ BU)
 * 🔴 ด่าน:
 * - ช่วงเวลาเดียวกับแท็บ Dashboard (ช่วงตั้งต้น · เทียบช่วงก่อน/ปีก่อน · ตัดปลายที่วันนี้)
 * - คนใช้งาน % ของบัญชีใน BU ไม่เกิน 100 · แยกบทบาท · BU ที่ยังไม่มีบัญชี = null (ห้าม 0%)
 * - ใบขอเข้านับอัตรา · Lumos จัดสายตรงกับ Success Rate ของ Dashboard (ยกเลิกไม่นับ · ฐาน = ได้คุยจริง)
 * - ติดตรงไหน = ขั้นที่หายมากสุด · ขั้นที่ยังไม่มีการบันทึก = null ไม่ใช่ "ติด"
 * - แถบจับตาไม่เทียบช่วงที่ข้อมูลไม่ครบ · ขึ้น BU ที่ยังไม่ใช้ระบบ
 */
import { describe, expect, it } from 'vitest';
import {
  buildBuRows,
  classifyQueueRow,
  countDelta,
  countPill,
  pooledUsage,
  ratePill,
  coverageOf,
  distinctCount,
  fmtPct,
  funnelRows,
  lumosSummary,
  makeLocator,
  postingsSummary,
  rangeText,
  rateDelta,
  ratio,
  requestsSummary,
  stuckStage,
  successRate,
  sumCount,
  teamWatchItems,
  teamWindow,
  teamWindowText,
  trendOf,
  usersSummary,
  type RawAccount,
  type RawFunnelRequest,
  type RawQueueRow,
  type TeamOnlineResponse,
} from './teamOnline';

const TODAY = '2026-09-29';
const label = (bu: string) => `${bu} · ป้าย`;

describe('ช่วงเวลา (ตัวเดียวกับแท็บ Dashboard)', () => {
  it('ค่าตั้งต้น = 30 วันถึงวันนี้ เทียบ 30 วันก่อนหน้า · รายวัน', () => {
    const w = teamWindow({}, TODAY);
    expect(w.range).toEqual({ from: '2026-08-31', to: TODAY });
    expect(w.previous).toEqual({ from: '2026-08-01', to: '2026-08-30' });
    expect(w.buckets).toHaveLength(30);
    expect(w.prevBuckets).toHaveLength(30);
    expect(w.lastBucketOpen).toBe(true);
    expect(w.fetchFrom).toBe('2026-08-01');
  });

  it('ช่วงที่เลือกเอง + รายเดือน + เทียบปีก่อน · ปลายเกินวันนี้ตัดที่วันนี้ · ช่วงย่อยตัดขอบ', () => {
    const w = teamWindow({ from: '2026-07-15', to: '2026-12-31', grain: 'month', compare: 'lastYear' }, TODAY);
    expect(w.range).toEqual({ from: '2026-07-15', to: TODAY });
    expect(w.previous).toEqual({ from: '2025-07-15', to: '2025-09-29' });
    expect(w.buckets.map((b) => [b.key, b.from, b.to])).toEqual([
      ['2026-07', '2026-07-15', '2026-07-31'],
      ['2026-08', '2026-08-01', '2026-08-31'],
      ['2026-09', '2026-09-01', TODAY],
    ]);
    expect(w.prevBuckets[0].key).toBe('2025-07');
  });

  it('ค่าผิด = ค่าตั้งต้น · ช่วงที่จบก่อนวันนี้ไม่มีช่วงย่อยค้าง', () => {
    expect(teamWindow({ from: 'bad', to: '2026-01-01', grain: 'x' }, TODAY).grain).toBe('day');
    const w = teamWindow({ from: '2026-09-01', to: '2026-09-07', grain: 'day' }, TODAY);
    expect(w.lastBucketOpen).toBe(false);
    expect(w.previous).toEqual({ from: '2026-08-25', to: '2026-08-31' });
  });

  it('ข้อความช่วง: เดือนเดียวกัน / ข้ามเดือน / วันเดียว', () => {
    expect(rangeText({ from: '2026-09-01', to: '2026-09-29' })).toBe('1–29 ก.ย. 2569');
    expect(rangeText({ from: '2026-08-25', to: '2026-09-29' })).toBe('25 ส.ค. – 29 ก.ย. 2569');
    expect(rangeText({ from: '2025-12-25', to: '2026-01-05' })).toBe('25 ธ.ค. 2568 – 5 ม.ค. 2569');
    expect(rangeText({ from: TODAY, to: TODAY })).toBe('29 ก.ย. 2569');
    expect(teamWindowText(teamWindow({ from: '2026-09-01', to: '2026-09-07' }, TODAY))).toBe('1–7 ก.ย. 2569 เทียบ 25–31 ส.ค. 2569');
  });

  it('makeLocator: วันในช่วงนี้/ช่วงก่อน + ลำดับช่วงย่อย · นอกช่วง = null', () => {
    const w = teamWindow({ from: '2026-09-01', to: '2026-09-07' }, TODAY);
    const at = makeLocator(w);
    expect(at('2026-09-03')).toEqual({ side: 'cur', i: 2 });
    expect(at('2026-08-26')).toEqual({ side: 'prev', i: 1 });
    expect(at('2026-09-20')).toBeNull();
    expect(at(null)).toBeNull();
  });

  it('🔴 ความครอบคลุม: ข้อมูลเริ่มหลังช่วงก่อน = none · เริ่มกลางช่วงก่อน = partial', () => {
    const w = teamWindow({}, TODAY);
    expect(coverageOf(w, '2026-09-23').prev).toBe('none');
    expect(coverageOf(w, '2026-09-23').cur).toBe('partial');
    expect(coverageOf(w, '2026-08-16').prev).toBe('partial');
    expect(coverageOf(w, '2026-07-01')).toMatchObject({ cur: 'full', prev: 'full' });
  });
});

describe('ตัวนับ + เส้นแนวโน้ม', () => {
  const w = teamWindow({ from: '2026-09-01', to: '2026-09-07' }, TODAY);

  it('distinctCount: คนเดียวหลายวัน = 1 ในยอดรวม แต่ขึ้นทุกวันในเส้น (ห้ามบวก)', () => {
    const c = distinctCount(w, [
      { who: 'a', ymd: '2026-09-01' },
      { who: 'a', ymd: '2026-09-02' },
      { who: 'b', ymd: '2026-09-02' },
      { who: 'a', ymd: '2026-08-30' },
    ]);
    expect([c.cur, c.prev]).toEqual([2, 1]);
    expect(c.series.slice(0, 2)).toEqual([1, 2]);
    expect(c.prevSeries[5]).toBe(1);
  });

  it('sumCount: รวมค่าต่อช่วงย่อย', () => {
    const c = sumCount(w, [
      { ymd: '2026-09-01', n: 3 },
      { ymd: '2026-09-01', n: 2 },
      { ymd: '2026-08-31', n: 4 },
    ]);
    expect([c.cur, c.prev, c.series[0], c.prevSeries[6]]).toEqual([5, 4, 5, 4]);
  });

  it('trendOf: ขึ้น/ลง/ทรงตัว · จุดน้อยกว่า 3 = บอกไม่ได้ · ช่วงย่อยที่ยังไม่จบไม่นับ', () => {
    expect(trendOf([1, 2, 3, 4], false).direction).toBe('up');
    expect(trendOf([4, 3, 2, 1], false).direction).toBe('down');
    expect(trendOf([2, 2, 2, 2], false).direction).toBe('flat');
    expect(trendOf([1, 2], false).direction).toBe('none');
    // ช่วงย่อยสุดท้ายยังไม่จบ (เพิ่งเริ่มวัน = 0) ต้องไม่ดึงเส้นลง
    expect(trendOf([2, 3, 4, 0], true).direction).toBe('up');
    expect(trendOf([2, 3, 4, 0], true).fitted).toHaveLength(4);
    expect(trendOf([null, null, 1, 2, 3], false).direction).toBe('up');
  });
});

describe('คนใช้งาน — % ของบัญชีใน BU + แยกบทบาท', () => {
  const w = teamWindow({ from: '2026-09-01', to: '2026-09-07' }, TODAY);
  const acc = (id: string, bu: string, role: string, extra: Partial<RawAccount> = {}): RawAccount => ({
    id,
    bu,
    role,
    active: true,
    createdYmd: '2026-07-01',
    ...extra,
  });
  const accounts = [
    acc('s1', 'LBD', 'staff'),
    acc('s2', 'LBD', 'staff'),
    acc('h1', 'LBD', 'supervisor'),
    acc('o1', 'LBD', 'opl'),
    acc('x1', 'LBD', 'staff', { active: false }),
    acc('n1', 'LBD', 'staff', { createdYmd: '2026-09-10' }),
    acc('m1', 'LM', 'staff'),
    acc('z1', '', 'admin'),
  ];
  const activity = [
    { uid: 's1', ymd: '2026-09-01' },
    { uid: 's1', ymd: '2026-09-02' },
    { uid: 'h1', ymd: '2026-09-03' },
    // บัญชีที่ปิดไปแล้วแต่ใช้ในช่วงนี้ = ยังเป็นฐาน
    { uid: 'x1', ymd: '2026-09-04' },
    { uid: 's2', ymd: '2026-08-28' },
    { uid: 'ghost', ymd: '2026-09-02' },
  ];

  it('🔴 ฐาน = บัญชีที่สร้างแล้วและยังเปิด (หรือใช้ในช่วงนั้น) · % ไม่เกิน 100 · ไม่นับไอดีที่ไม่มีบัญชี', () => {
    const s = usersSummary(w, accounts, activity, label, ['SN']);
    const lbd = s.byBu.find((r) => r.bu === 'LBD')!;
    // s1 s2 h1 o1 x1 (ใช้ในช่วง) — n1 สร้างหลังช่วง
    expect(lbd.accounts).toBe(5);
    expect(lbd.users).toBe(3);
    expect(lbd.pct).toBeCloseTo(0.6);
    expect(lbd.roles).toEqual([
      { role: 'staff', label: 'เจ้าหน้าที่', accounts: 3, users: 2 },
      { role: 'supervisor', label: 'หัวหน้า', accounts: 1, users: 1 },
      { role: 'opl', label: 'OPL', accounts: 1, users: 0 },
    ]);
    expect(s.total.cur).toBe(3);
    expect(s.total.prev).toBe(1);
    expect(lbd.series.every((v) => v === null || (v >= 0 && v <= 1))).toBe(true);
  });

  it('BU ที่ยังไม่มีบัญชี = % null (ห้าม 0%) · BU ที่มีบัญชีแต่ไม่ใช้ = 0% · ไม่ระบุ BU อยู่ท้าย', () => {
    const s = usersSummary(w, accounts, activity, label, ['SN']);
    expect(s.byBu.find((r) => r.bu === 'SN')).toMatchObject({ accounts: 0, pct: null });
    expect(s.byBu.find((r) => r.bu === 'LM')).toMatchObject({ accounts: 1, users: 0, pct: 0 });
    expect(s.byBu.at(-1)?.bu).toBe('');
    expect(s.byBu.at(-1)?.label).toBe('ไม่ระบุ BU');
  });
});

describe('ใบขอเข้า = อัตรา', () => {
  const w = teamWindow({ from: '2026-09-01', to: '2026-09-07' }, TODAY);
  it('รวมอัตราตามวันที่ขอเข้า · นับใบไม่ซ้ำ · ต่อ BU มีเส้นรายช่วงย่อย', () => {
    const s = requestsSummary(
      w,
      [
        { requestNo: 'R1', ymd: '2026-09-01', bu: 'LBD', positions: 3 },
        { requestNo: 'R1', ymd: '2026-09-01', bu: 'LBD', positions: 2 },
        { requestNo: 'R2', ymd: '2026-09-02', bu: 'LM', positions: 1 },
        { requestNo: 'R3', ymd: '2026-08-30', bu: 'LBD', positions: 4 },
      ],
      label,
    );
    expect(s.positions.cur).toBe(6);
    expect(s.positions.prev).toBe(4);
    expect(s.requests).toEqual({ cur: 2, prev: 1 });
    expect(s.byBu[0]).toMatchObject({ bu: 'LBD', positions: { cur: 5, prev: 4 }, requests: { cur: 1, prev: 1 } });
    expect(s.byBu[0].series[0]).toBe(5);
  });

  it('BU ที่ไม่มีใบในสองช่วงนี้ไม่ขึ้นแถว (สำเนา ERP มีประวัติหลายปี) · ยกเว้น BU ที่ส่งมาให้แสดง', () => {
    const s = requestsSummary(
      w,
      [
        { requestNo: 'R1', ymd: '2026-09-01', bu: 'LBD', positions: 1 },
        { requestNo: 'OLD', ymd: '2025-01-10', bu: 'CR', positions: 3 },
      ],
      label,
      ['SN'],
    );
    expect(s.byBu.map((r) => r.bu)).toEqual(['LBD', 'SN']);
  });
});

describe('Lumos ทุกเลน — นิยามเดียวกับ Success Rate ของ Dashboard', () => {
  const w = teamWindow({ from: '2026-09-01', to: '2026-09-07' }, TODAY);
  const row = (over: Partial<RawQueueRow>): RawQueueRow => ({
    ymd: '2026-09-02',
    bu: 'LBD',
    lane: 'public',
    cancelled: false,
    outcome: 'confirmed',
    summary: null,
    reply: null,
    personRef: 'app-1',
    ...over,
  });

  it('จัดสาย: ยกเลิก = ไม่นับเลย · ยังไม่มีผล = รอโทร · ไม่รับสาย = โทรแล้วแต่ไม่ได้คุย · ตอบรับ = สำเร็จ', () => {
    expect(classifyQueueRow(row({ cancelled: true }))).toEqual({ sent: false, called: false, talked: false, success: false });
    expect(classifyQueueRow(row({ outcome: null }))).toMatchObject({ sent: true, called: false });
    expect(classifyQueueRow(row({ outcome: 'no_answer' }))).toMatchObject({ called: true, talked: false, success: false });
    expect(classifyQueueRow(row({ outcome: 'confirmed' }))).toMatchObject({ called: true, talked: true, success: true });
    expect(classifyQueueRow(row({ outcome: 'declined' }))).toMatchObject({ called: true, talked: true, success: false });
  });

  it('ต่อ BU × เลน: ส่งไป = รอโทร + โทรแล้ว · โทรแล้ว = สำเร็จ + ไม่สำเร็จ · Success rate = สำเร็จ ÷ ได้คุยจริง', () => {
    const s = lumosSummary(
      w,
      [
        row({}),
        row({ outcome: 'declined' }),
        row({ outcome: 'no_answer' }),
        row({ outcome: null }),
        row({ lane: 'follow', personRef: 'follow-1', outcome: 'confirmed' }),
        row({ cancelled: true }),
        row({ ymd: '2026-08-30', outcome: 'confirmed' }),
        row({ bu: 'LM', outcome: 'busy', lane: 'match', personRef: 'card-1' }),
      ],
      label,
      ['DS'],
    );
    const lbd = s.byBu.find((r) => r.bu === 'LBD')!;
    expect(lbd.total).toEqual({ sent: 5, waiting: 1, called: 4, success: 2, fail: 2, talked: 3 });
    expect(lbd.total.sent).toBe(lbd.total.waiting + lbd.total.called);
    expect(lbd.total.called).toBe(lbd.total.success + lbd.total.fail);
    expect(successRate(lbd.total)).toBeCloseTo(2 / 3);
    expect(lbd.lanes.public.sent).toBe(4);
    expect(lbd.lanes.follow.sent).toBe(1);
    expect(lbd.prev.success).toBe(1);
    expect(s.byBu.find((r) => r.bu === 'DS')?.total.sent).toBe(0);
    // Success rate ยังไม่มีฐาน = null (ห้าม 0%)
    expect(successRate(s.byBu.find((r) => r.bu === 'LM')!.total)).toBeNull();
    expect(s.called).toMatchObject({ cur: 5, prev: 1 });
  });
});

describe('Success ประกาศ + ใบเปิดตอนนี้', () => {
  const w = teamWindow({ from: '2026-09-01', to: '2026-09-07' }, TODAY);
  it('กลุ่มใบตามวัน Gen link ครั้งแรก · มีผู้สมัคร ≥ 1', () => {
    const s = postingsSummary(w, [
      { jobId: 'J1', ymd: '2026-09-02', bu: 'LBD', applicants: 3 },
      { jobId: 'J2', ymd: '2026-09-03', bu: 'LBD', applicants: 0 },
      { jobId: 'J3', ymd: '2026-08-28', bu: 'LM', applicants: 1 },
    ]);
    expect([s.published.cur, s.published.prev]).toEqual([2, 1]);
    expect(s.withApplicants).toEqual({ cur: 1, prev: 1 });
    expect(s.applicants).toEqual({ cur: 3, prev: 1 });
  });

  it('ต่อ BU: ไม่ระบุ BU อยู่ท้าย · รวมเหลือหาได้ครบ (ตรงหัวกล่องงาน)', () => {
    const rows = buildBuRows(w, {
      labelOf: label,
      postings: [{ jobId: 'J1', ymd: '2026-09-02', bu: 'LBD', applicants: 2 }],
      openJobs: [
        { id: 'siamraj-sql:A', bu: 'LBD', positions: 2, hasLink: true, staleNoApplicants: false },
        { id: 'siamraj-sql:B', bu: 'LBD', positions: 1, hasLink: false, staleNoApplicants: true },
        { id: 'siamraj-pre:C', bu: null, positions: 3, hasLink: false, staleNoApplicants: false },
      ],
    });
    expect(rows.map((r) => r.bu)).toEqual(['LBD', '']);
    expect(rows[0]).toMatchObject({ published: 1, applicants: 2, openNow: 2, openWithoutLink: 1, remaining: 3, staleNoApplicants: 1 });
    expect(rows.reduce((s, r) => s + r.remaining, 0)).toBe(6);
  });
});

describe('ติดตรงไหน ต่อ BU', () => {
  const req = (bu: string, flags: Partial<RawFunnelRequest>): RawFunnelRequest => ({
    requestNo: Math.random().toString(36).slice(2),
    bu,
    genLink: false,
    applicants: false,
    aiCalled: false,
    interested: false,
    appointed: false,
    showed: false,
    ...flags,
  });

  it('ขั้นที่หายมากสุดเทียบขั้นก่อนหน้า = จุดที่ติด', () => {
    const rows = funnelRows(
      [
        req('LBD', { genLink: true, applicants: true, aiCalled: true, interested: true }),
        req('LBD', { genLink: true, applicants: true, aiCalled: true }),
        req('LBD', { genLink: true }),
        req('LBD', {}),
        req('LM', {}),
        req('LM', {}),
      ],
      label,
      ['SN'],
    );
    const lbd = rows.find((r) => r.bu === 'LBD')!;
    expect(lbd.counts).toMatchObject({ requests: 4, genLink: 3, applicants: 2, aiCalled: 2, interested: 1, appointed: 0 });
    expect(lbd.stuckAt).toBe('appointed');
    expect(rows.find((r) => r.bu === 'LM')?.stuckAt).toBe('genLink');
    // ยังไม่มีใบเข้า = ไม่มีคำตอบว่าติดตรงไหน
    expect(rows.find((r) => r.bu === 'SN')?.stuckAt).toBeNull();
  });

  it('🔴 ขั้นที่ระบบยังไม่มีการบันทึก = null และไม่ถูกชี้ว่า "ติด"', () => {
    const rows = funnelRows(
      [req('LBD', { genLink: true, applicants: true, aiCalled: true, interested: true, appointed: true })],
      label,
      [],
      new Set(['showed'] as const),
    );
    expect(rows[0].counts.showed).toBeNull();
    expect(rows[0].stuckAt).toBeNull();
    expect(stuckStage({ requests: 2, genLink: 2, applicants: 2, aiCalled: 1, interested: 1, appointed: 1, showed: null })).toBe('aiCalled');
  });
});

describe('ป้ายเปลี่ยนแปลงมุมการ์ด + % รวมหลาย BU', () => {
  it('จำนวน: % ที่เปลี่ยน · ดี/เสียตามทิศของเมตริก · ช่วงก่อน 0 = "ใหม่" · ข้อมูลไม่ครบ = ไม่ลงสี', () => {
    expect(countPill(38, 41, true)).toEqual({ text: '7.3%', dir: 'down', tone: 'bad' });
    expect(countPill(225, 196, null)).toEqual({ text: '14.8%', dir: 'up', tone: 'neutral' });
    expect(countPill(600, 40, true, true)).toMatchObject({ dir: 'up', tone: 'neutral' });
    expect(countPill(3, 0, true)).toMatchObject({ text: 'ใหม่', dir: 'up', tone: 'good' });
    expect(countPill(5, 5, true)).toEqual({ text: '0%', dir: 'flat', tone: 'neutral' });
  });

  it('อัตรา: ต่างกันเป็นจุด (ไม่ใช่ % ของ %) · ไม่มีฐาน = ไม่มีป้าย', () => {
    expect(ratePill(0.853, 0.667, true)).toEqual({ text: '18.6 จุด', dir: 'up', tone: 'good' });
    expect(ratePill(0.5, null, true)).toBeNull();
  });

  it('🔴 % รวมหลาย BU = รวมตัวตั้ง ÷ รวมตัวหาร (BU ใหญ่หนักกว่า) ไม่ใช่เฉลี่ย %', () => {
    // BU ใหญ่ 30/40 (75%) + BU เล็ก 0/4 (0%) = 30/44 ≈ 68% — เฉลี่ยตรง ๆ จะได้ 37.5% ผิด
    const pooled = pooledUsage([
      { counts: [30], bases: [40] },
      { counts: [0], bases: [4] },
    ], 1);
    expect(pooled[0]).toBeCloseTo(30 / 44);
    expect(pooledUsage([{ counts: [0], bases: [0] }], 1)).toEqual([null]);
  });
});

describe('ข้อความเปลี่ยนแปลง', () => {
  it('จำนวน + อัตรา แบบในภาพต้นแบบ', () => {
    expect(countDelta(54, 68, 'คน').text).toBe('ลด 14 คน (20.6%)');
    expect(countDelta(7, 6, 'ใบ').text).toBe('เพิ่ม 1 ใบ (16.7%)');
    expect(countDelta(3, 0, 'สาย').text).toBe('เพิ่ม 3 สาย (ช่วงก่อนไม่มี)');
    expect(rateDelta(0.4, 0.4).text).toBe('เพิ่ม 0.0 จุดเปอร์เซ็นต์');
    expect(rateDelta(0.5, null).text).toBe('ช่วงก่อนไม่มีฐาน');
    expect(fmtPct(ratio(2, 3))).toBe('66.7%');
    expect(fmtPct(ratio(1, 0))).toBe('—');
  });
});

describe('แถบสิ่งที่ต้องจับตา', () => {
  const cov = { since: null, cur: 'full', prev: 'full' } as const;
  const base = {
    bu: null,
    users: {
      total: { cur: 54, prev: 68, series: [], prevSeries: [] },
      accounts: { cur: 60, prev: 60 },
      coverage: cov,
      byBu: [
        { bu: 'LM', label: 'LM', accounts: 4, users: 0, pct: 0, prevPct: 1, roles: [], series: [] },
        { bu: 'SN', label: 'SN', accounts: 0, users: 0, pct: null, prevPct: null, roles: [], series: [] },
      ],
    },
    requests: {
      positions: { cur: 7, prev: 6, series: [], prevSeries: [] },
      requests: { cur: 5, prev: 5 },
      coverage: cov,
      stale: false,
      ageSeconds: 0,
      byBu: [],
    },
    lumos: {
      called: { cur: 600, prev: 40, series: [], prevSeries: [] },
      coverage: { since: '2026-08-16', cur: 'full', prev: 'partial' },
    },
    postings: null,
    byBu: [{ bu: 'LBD', openWithoutLink: 4, staleNoApplicants: 1 }],
  } as unknown as TeamOnlineResponse;

  it('เอาเรื่องที่ขยับมากสุด (ข้อมูลครบสองช่วงเท่านั้น) + BU ที่ยังไม่ใช้ระบบ + งานที่ต้องทำ', () => {
    expect(teamWatchItems(base).map((i) => i.text)).toEqual([
      'คนใช้งานลด 14 คน (20.6%)',
      'อัตราที่ขอเข้าเพิ่ม 1 อัตรา (16.7%)',
      'LM ยังไม่มีคนใช้ (0 จาก 4 บัญชี)',
      'SN ยังไม่มีบัญชีในระบบ',
      'ใบเปิดยังไม่ Gen link 4 ใบ',
      'Gen link เกิน 7 วันยังไม่มีผู้สมัคร 1 ใบ',
    ]);
  });

  it('🔴 ช่วงก่อนที่ข้อมูลเริ่มกลางทาง ห้ามเอามาเทียบ (เคยขึ้น "Lumos โทรเพิ่ม 1,400%")', () => {
    expect(teamWatchItems(base).some((i) => i.key === 'called')).toBe(false);
  });
});
