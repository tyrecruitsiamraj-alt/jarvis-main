/**
 * หน้า "ทีม Online" — ช่วงเวลาแบบในภาพต้นแบบ + ข้อความเปลี่ยนแปลง (29 ก.ย. 2569)
 * 🔴 ด่าน: ถึงตอนนี้เทียบช่วงก่อนถึงจุดเดียวกัน · ปฏิทินกรุงเทพ · ข้อความตรงภาพ ("ลด 14 คน (20.6%)")
 */
import { describe, expect, it } from 'vitest';
import { countDelta, fmtPct, rateDelta, ratio, seriesOf, teamOnlineWindow, teamWindowText } from './teamOnline';

const bkk = (s: string) => new Date(`${s}+07:00`);
const iso = (s: string) => bkk(s).toISOString();

describe('teamOnlineWindow', () => {
  it('วันนี้: 00:00 ถึงตอนนี้ เทียบเมื่อวาน 00:00 ถึงเวลาเดียวกัน · ช่วงย่อยรายชั่วโมง', () => {
    const w = teamOnlineWindow('today', bkk('2026-09-29T12:05:00'));
    expect(w.start).toBe(iso('2026-09-29T00:00:00'));
    expect(w.prevStart).toBe(iso('2026-09-28T00:00:00'));
    expect(w.prevEnd).toBe(iso('2026-09-28T12:05:00'));
    expect(w.grain).toBe('hour');
    expect(w.buckets.map((b) => b.label).slice(-3)).toEqual(['10', '11', '12']);
    expect(w.buckets[0].key).toBe('2026-09-29 00');
    expect(w.prevBuckets[12].key).toBe('2026-09-28 12');
    expect(teamWindowText(w)).toContain('ถึง 12:05 เทียบ');
  });

  it('สัปดาห์นี้: จันทร์ถึงตอนนี้ เทียบจันทร์ก่อนถึงเวลาเดียวกัน', () => {
    const w = teamOnlineWindow('week', bkk('2026-09-29T12:00:00')); // อังคาร
    expect(w.start).toBe(iso('2026-09-28T00:00:00'));
    expect(w.prevStart).toBe(iso('2026-09-21T00:00:00'));
    expect(w.prevEnd).toBe(iso('2026-09-22T12:00:00'));
    expect(w.buckets.map((b) => b.key)).toEqual(['2026-09-28', '2026-09-29']);
    expect(w.prevBuckets.map((b) => b.key)).toEqual(['2026-09-21', '2026-09-22']);
  });

  it('เดือนนี้: วันที่ 1 ถึงตอนนี้ เทียบวันเดียวกันของเดือนก่อน · เดือนก่อนสั้นกว่า = ตัดที่สิ้นเดือน', () => {
    const w = teamOnlineWindow('month', bkk('2026-09-29T12:00:00'));
    expect(w.start).toBe(iso('2026-09-01T00:00:00'));
    expect(w.prevStart).toBe(iso('2026-08-01T00:00:00'));
    expect(w.prevEnd).toBe(iso('2026-08-29T12:00:00'));
    expect(w.buckets).toHaveLength(29);
    const mar = teamOnlineWindow('month', bkk('2027-03-31T09:00:00'));
    expect(mar.prevEnd).toBe(iso('2027-02-28T09:00:00'));
    expect(mar.prevEndYmd).toBe('2027-02-28');
  });

  it('ปีนี้: 1 ม.ค. ถึงตอนนี้ เทียบปีก่อนถึงวันเวลาเดียวกัน · ช่วงย่อยรายเดือน', () => {
    const w = teamOnlineWindow('year', bkk('2026-09-29T12:00:00'));
    expect(w.start).toBe(iso('2026-01-01T00:00:00'));
    expect(w.prevEnd).toBe(iso('2025-09-29T12:00:00'));
    expect(w.buckets.map((b) => b.key)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
    expect(w.prevBuckets[0].key).toBe('2025-01');
    expect(w.startYmd).toBe('2026-01-01');
    expect(w.endYmd).toBe('2026-09-29');
  });

  it('เที่ยงคืนตี 1 เวลาไทย ยังเป็นวันไทย (ไม่ใช่วัน UTC)', () => {
    const w = teamOnlineWindow('today', bkk('2026-09-30T01:00:00'));
    expect(w.startYmd).toBe('2026-09-30');
    expect(w.buckets.map((b) => b.label)).toEqual(['00']);
  });
});

describe('ข้อความเปลี่ยนแปลง (ตรงภาพต้นแบบ)', () => {
  it('จำนวน: เพิ่ม/ลด + หน่วย + %', () => {
    expect(countDelta(54, 68, 'คน').text).toBe('ลด 14 คน (20.6%)');
    expect(countDelta(7, 6, 'ใบ').text).toBe('เพิ่ม 1 ใบ (16.7%)');
    expect(countDelta(5, 6, 'คน').text).toBe('ลด 1 คน (16.7%)');
    expect(countDelta(3, 3, 'ใบ').tone).toBe('flat');
    expect(countDelta(2, 0, 'ใบ').text).toBe('เพิ่ม 2 ใบ (ช่วงก่อนไม่มี)');
  });

  it('อัตรา: ต่างกันเป็นจุดเปอร์เซ็นต์ · ไม่มีฐาน = ไม่เดา', () => {
    expect(rateDelta(0.4, 0.4).text).toBe('เพิ่ม 0.0 จุดเปอร์เซ็นต์');
    expect(rateDelta(0.5, 0.4).text).toBe('เพิ่ม 10.0 จุดเปอร์เซ็นต์');
    expect(rateDelta(0.3, 0.4).text).toBe('ลด 10.0 จุดเปอร์เซ็นต์');
    expect(rateDelta(0.4, null).text).toBe('ช่วงก่อนไม่มีฐาน');
    expect(ratio(2, 5)).toBe(0.4);
    expect(ratio(1, 0)).toBeNull();
    expect(fmtPct(2 / 3)).toBe('66.7%');
    expect(fmtPct(null)).toBe('—');
  });

  it('เรียงค่าตามช่วงย่อย · ช่วงที่ไม่มีข้อมูล = 0', () => {
    const w = teamOnlineWindow('week', bkk('2026-09-29T12:00:00'));
    expect(seriesOf(w.buckets, new Map([['2026-09-29', 4]]))).toEqual([0, 4]);
  });
});

import {
  bucketKeyOf,
  buildBuRows,
  callsSummary,
  coverageOf,
  distinctCount,
  postingsSummary,
  requestsCount,
  sideOf,
  sideOfYmd,
  teamWatchItems,
  usersCount,
  type RawCallRow,
  type TeamOnlineResponse,
} from './teamOnline';

describe('ช่วงของเหตุการณ์ + ความครอบคลุมของข้อมูล', () => {
  const w = teamOnlineWindow('today', bkk('2026-09-29T12:00:00'));

  it('sideOf: ปลายช่วงไม่รวม · ช่องว่างระหว่างสองช่วงไม่นับ', () => {
    expect(sideOf(w, iso('2026-09-29T00:00:00'))).toBe('cur');
    expect(sideOf(w, iso('2026-09-29T12:00:00'))).toBeNull();
    expect(sideOf(w, iso('2026-09-28T11:59:00'))).toBe('prev');
    // เมื่อวานหลัง 12:00 = อยู่นอกช่วงก่อน (เทียบถึงเวลาเดียวกันเท่านั้น)
    expect(sideOf(w, iso('2026-09-28T15:00:00'))).toBeNull();
    expect(sideOf(w, null)).toBeNull();
  });

  it('sideOfYmd: ข้อมูลที่มีแต่วัน — วันนี้ทั้งวัน เทียบเมื่อวานทั้งวัน', () => {
    expect(sideOfYmd(w, '2026-09-29')).toBe('cur');
    expect(sideOfYmd(w, '2026-09-28')).toBe('prev');
    expect(sideOfYmd(w, '2026-09-27')).toBeNull();
  });

  it('bucketKeyOf ใช้เวลาไทย (01:30 ไทย = วันไทย ไม่ใช่วัน UTC)', () => {
    expect(bucketKeyOf(iso('2026-09-30T01:30:00'), 'hour')).toBe('2026-09-30 01');
    expect(bucketKeyOf(iso('2026-09-30T01:30:00'), 'day')).toBe('2026-09-30');
    expect(bucketKeyOf(iso('2026-09-30T01:30:00'), 'month')).toBe('2026-09');
  });

  it('🔴 ข้อมูลเริ่มหลังช่วงก่อน = ช่วงก่อน "none" (ห้ามโชว์ 0) · เริ่มกลางช่วง = partial', () => {
    const week = teamOnlineWindow('week', bkk('2026-09-29T12:00:00'));
    expect(coverageOf(week, iso('2026-09-23T06:17:00')).prev).toBe('none');
    expect(coverageOf(week, iso('2026-09-21T06:00:00')).prev).toBe('partial');
    expect(coverageOf(week, iso('2026-01-01T00:00:00'))).toMatchObject({ cur: 'full', prev: 'full' });
    const year = teamOnlineWindow('year', bkk('2026-09-29T12:00:00'));
    expect(coverageOf(year, iso('2026-07-01T09:11:00'))).toMatchObject({ cur: 'partial', prev: 'none' });
  });

  it('distinctCount: คนเดียวหลายเหตุการณ์ = 1 · เส้นเรียงตามช่วงย่อย', () => {
    const c = distinctCount(w, [
      { who: 'a', side: 'cur', key: '2026-09-29 09' },
      { who: 'a', side: 'cur', key: '2026-09-29 10' },
      { who: 'b', side: 'cur', key: '2026-09-29 10' },
      { who: 'a', side: 'prev', key: '2026-09-28 09' },
    ]);
    expect(c.cur).toBe(2);
    expect(c.prev).toBe(1);
    expect(c.series[9]).toBe(1);
    expect(c.series[10]).toBe(2);
    expect(c.prevSeries[9]).toBe(1);
    // ผลรวมรายชั่วโมง (3) ≠ ยอดทั้งช่วง (2) — เหตุผลที่จอเขียนว่า "ห้ามบวก"
    expect(c.series.reduce((s, n) => s + n, 0)).toBe(3);
  });

  it('usersCount อ่านแถวที่ SQL นับไม่ซ้ำมาแล้ว', () => {
    const c = usersCount(w, [
      { uid: 'u1', bucket: '2026-09-29 08', cur: true },
      { uid: 'u1', bucket: '2026-09-28 08', cur: false },
      { uid: 'u2', bucket: '2026-09-28 09', cur: false },
    ]);
    expect([c.cur, c.prev]).toEqual([1, 2]);
  });
});

describe('ตัวประกอบคำตอบ', () => {
  const w = teamOnlineWindow('week', bkk('2026-09-29T12:00:00'));

  it('ใบขอเข้า: นับใบไม่ซ้ำตามวันที่ขอเข้า · รายชั่วโมงไม่มีเส้น (ERP มีแต่วัน)', () => {
    const rows = [
      { requestNo: 'R1', day: '2026-09-28', bu: 'LBD' },
      { requestNo: 'R1', day: '2026-09-28', bu: 'LBD' },
      { requestNo: 'R2', day: '2026-09-29', bu: 'LM' },
      { requestNo: 'R3', day: '2026-09-22', bu: 'LBD' },
      { requestNo: 'R4', day: '2026-09-23', bu: 'LBD' },
    ];
    const c = requestsCount(w, rows);
    expect([c.cur, c.prev]).toEqual([2, 1]);
    expect(c.series).toEqual([1, 1]);
    const today = requestsCount(teamOnlineWindow('today', bkk('2026-09-29T12:00:00')), rows);
    expect([today.cur, today.prev, today.series.length]).toEqual([1, 1, 0]);
  });

  const call = (over: Partial<RawCallRow>): RawCallRow => ({
    who: 'p1',
    bu: 'LBD',
    personRef: 'app-1',
    outcome: 'no_answer',
    summary: null,
    reply: null,
    firstAt: iso('2026-09-29T09:00:00'),
    lastAt: iso('2026-09-29T09:00:00'),
    ...over,
  });

  it('Lumos: โทรแล้วนับทั้งผลแรกและผลล่าสุด · ติดต่อได้/ไม่รับสาย = ผลล่าสุด · ยกเลิกไม่นับ', () => {
    const s = callsSummary(w, [
      call({ who: 'p1', outcome: 'no_answer' }),
      // โทรครั้งแรกสัปดาห์ก่อน (ไม่รับ) แล้วโทรซ้ำสัปดาห์นี้ติด
      call({ who: 'p2', outcome: 'confirmed', firstAt: iso('2026-09-22T09:00:00'), lastAt: iso('2026-09-28T10:00:00') }),
      call({ who: 'p3', outcome: 'cancelled' }),
    ]);
    expect([s.called.cur, s.called.prev]).toEqual([2, 1]);
    expect(s.reached).toEqual({ cur: 1, prev: 0 });
    expect(s.noAnswer).toEqual({ cur: 1, prev: 0 });
  });

  it('Success ประกาศ: กลุ่มใบตามวัน Gen link ครั้งแรก · มีผู้สมัคร ≥ 1', () => {
    const s = postingsSummary(w, [
      { jobId: 'J1', firstAt: iso('2026-09-28T10:00:00'), bu: 'LBD', applicants: 3 },
      { jobId: 'J2', firstAt: iso('2026-09-29T08:00:00'), bu: 'LBD', applicants: 0 },
      { jobId: 'J3', firstAt: iso('2026-09-21T08:00:00'), bu: 'LM', applicants: 1 },
      { jobId: 'J4', firstAt: iso('2026-09-10T08:00:00'), bu: 'LM', applicants: 9 },
    ]);
    expect([s.published.cur, s.published.prev]).toEqual([2, 1]);
    expect(s.withApplicants).toEqual({ cur: 1, prev: 1 });
    expect(s.applicants).toEqual({ cur: 3, prev: 1 });
  });

  it('ต่อ BU: ไม่ระบุ BU อยู่ท้าย (ยอดรวมตรงหัวกล่องงาน) · แหล่งที่อ่านไม่ได้ = null ไม่ใช่ 0', () => {
    const rows = buildBuRows(w, {
      labelOf: (b) => b || 'ไม่ระบุ BU',
      requests: null,
      postings: [{ jobId: 'J1', firstAt: iso('2026-09-28T10:00:00'), bu: 'LBD', applicants: 2 }],
      calls: [call({})],
      openJobs: [
        { id: 'siamraj-sql:A', bu: 'LBD', positions: 2, hasLink: true, staleNoApplicants: false },
        { id: 'siamraj-sql:B', bu: 'LBD', positions: 1, hasLink: false, staleNoApplicants: false },
        { id: 'siamraj-pre:C', bu: null, positions: 3, hasLink: false, staleNoApplicants: false },
      ],
    });
    expect(rows.map((r) => r.bu)).toEqual(['LBD', '']);
    expect(rows[0]).toMatchObject({ requestsIn: null, published: 1, applicants: 2, called: 1, openNow: 2, openWithoutLink: 1, remaining: 3 });
    expect(rows[1]).toMatchObject({ label: 'ไม่ระบุ BU', openNow: 1, remaining: 3 });
    expect(rows.reduce((s, r) => s + r.remaining, 0)).toBe(6);
  });

  it('แถบจับตา: เอาเรื่องที่ขยับมากสุด · ช่วงก่อนไม่มีข้อมูลห้ามเอามาเทียบ · ต่อท้ายงานที่ต้องทำ', () => {
    const cov = { since: null, cur: 'full', prev: 'full' } as const;
    const r = {
      bu: null,
      users: { cur: 54, prev: 68, series: [], prevSeries: [], coverage: cov },
      requestsIn: { cur: 7, prev: 6, series: [], prevSeries: [], dateOnly: true, coverage: cov, stale: false },
      lumos: {
        called: { cur: 30, prev: 0, series: [], prevSeries: [] },
        reached: { cur: 0, prev: 0 },
        interested: { cur: 0, prev: 0 },
        noAnswer: { cur: 0, prev: 0 },
        coverage: { since: 'x', cur: 'full', prev: 'none' },
      },
      postings: null,
      byBu: [{ bu: 'LBD', openWithoutLink: 4, staleNoApplicants: 1 }],
    } as unknown as TeamOnlineResponse;
    const items = teamWatchItems(r);
    expect(items.map((i) => i.text)).toEqual([
      'คนใช้งานลด 14 คน (20.6%)',
      'ใบขอเข้าเพิ่ม 1 ใบ (16.7%)',
      'ใบเปิดยังไม่ Gen link 4 ใบ',
      'Gen link เกิน 7 วันยังไม่มีผู้สมัคร 1 ใบ',
    ]);
    expect(items.some((i) => i.key === 'called')).toBe(false);
  });
});
