import { describe, expect, it } from 'vitest';
import { normalizeTrendBu, trendBuFromSiteCode, trendBuLabel } from './bu';
import { followDimGetter, followEventYmd, followUnitResolver } from './followTrends';
import { applicantFunnel } from './applicantTrends';
import { activityLedger, cohortSeries, releaseStats } from './requestTrends';
import { staffTable } from './staffTrends';
import { seriesByBucket } from './timeBuckets';
import type { ApplicantTrendRow, FollowTrendRow, InformTrendRow, ReleaseTrendRow, RequestTrendRow } from './types';

describe('BU ชุดเดียว (รหัสแผนก) — ตารางจับคู่วัดจากข้อมูลจริง', () => {
  it('BU จากไซต์ → รหัสแผนก', () => {
    expect(normalizeTrendBu('LML')).toBe('LM');
    expect(normalizeTrendBu('dsl')).toBe('DS');
    expect(normalizeTrendBu('SNJ')).toBe('SN');
    expect(normalizeTrendBu('CRS')).toBe('CR');
    expect(normalizeTrendBu('LBD')).toBe('LBD');
    expect(normalizeTrendBu('LM')).toBe('LM');
  });
  it('ไม่รู้ = null (ห้ามยัดลงถังอื่น) · รหัสแปลก = คืนตามเดิม', () => {
    expect(normalizeTrendBu('')).toBeNull();
    expect(normalizeTrendBu(null)).toBeNull();
    expect(normalizeTrendBu('XYZ')).toBe('XYZ');
    expect(trendBuFromSiteCode('66LML0011')).toBe('LM');
    expect(trendBuFromSiteCode('อ่านไม่ออก')).toBeNull();
  });
  it('ป้ายใช้ชื่อจาก homeBu ที่เดียว', () => {
    expect(trendBuLabel('LM')).toBe('LM · ดูแลสวน / ภูมิทัศน์');
    expect(trendBuLabel('LBD')).toBe('LBD · พนักงานขับรถ / Valet');
    expect(trendBuLabel(null)).toBe('ไม่ระบุ BU');
  });
});

const f = (over: Partial<FollowTrendRow>): FollowTrendRow => ({
  id: Math.random().toString(36).slice(2),
  createdAt: '2026-09-22T03:00:00Z',
  scheduledAt: null,
  resultAt: null,
  completedAt: null,
  cancelledAt: null,
  outcomeCode: null,
  callStatus: null,
  callOutcome: null,
  attempt: null,
  callRound: 1,
  callMode: 'ai',
  topic: 'ติดตามเริ่มงาน',
  unitName: null,
  siteCode: null,
  staffId: null,
  staffName: null,
  bu: 'LBD',
  ...over,
});

describe('ติดตาม — นับตามวันที่ของเหตุการณ์นั้นเอง', () => {
  it('ลงรายชื่อ = วันลง (ปฏิทินกรุงเทพ)', () => {
    expect(followEventYmd(f({ createdAt: '2026-09-21T18:30:00Z' }), 'registered')).toBe('2026-09-22');
  });
  it('โทรแล้ว = มีผลโทรจริง (ติด/ไม่ติด) · ยกเลิก/ยังรอ ไม่นับ', () => {
    expect(followEventYmd(f({ resultAt: '2026-09-23T02:00:00Z', callStatus: 'completed', callOutcome: 'confirmed' }), 'called')).toBe('2026-09-23');
    expect(followEventYmd(f({ resultAt: '2026-09-23T02:00:00Z', callStatus: 'completed', callOutcome: 'no_answer' }), 'called')).toBe('2026-09-23');
    expect(followEventYmd(f({ resultAt: '2026-09-23T02:00:00Z', callStatus: 'completed', callOutcome: 'no_answer' }), 'connected')).toBeNull();
    expect(followEventYmd(f({ resultAt: '2026-09-23T02:00:00Z', callStatus: 'cancelled', callOutcome: null }), 'called')).toBeNull();
  });
  it('ไปถึงแล้ว = went/arrived/done (ตัวเดียวกับหน้าแรก) · ยกเลิก/ลา = ไม่สำเร็จ · เลื่อน = ไม่นับทั้งสองฝั่ง', () => {
    const at = '2026-09-24T05:00:00Z';
    expect(followEventYmd(f({ completedAt: at, outcomeCode: 'arrived' }), 'success')).toBe('2026-09-24');
    expect(followEventYmd(f({ completedAt: at, outcomeCode: 'went' }), 'success')).toBe('2026-09-24');
    expect(followEventYmd(f({ completedAt: at, outcomeCode: 'done' }), 'success')).toBe('2026-09-24');
    expect(followEventYmd(f({ completedAt: at, outcomeCode: 'leave' }), 'success')).toBeNull();
    expect(followEventYmd(f({ completedAt: at, outcomeCode: 'leave' }), 'dropped')).toBe('2026-09-24');
    expect(followEventYmd(f({ completedAt: at, outcomeCode: 'postponed' }), 'dropped')).toBeNull();
    expect(followEventYmd(f({ completedAt: at, outcomeCode: 'postponed' }), 'success')).toBeNull();
  });
  it('ชื่อไม่มีไซต์ที่ตรงกับไซต์เดียวพอดี = รวมเข้าไซต์นั้น · ชื่อเดียวกันหลายไซต์ = ต่อท้ายรหัสไซต์', () => {
    const rows = [
      f({ unitName: 'FORD', siteCode: null }),
      f({ unitName: 'FORD', siteCode: null }),
      f({ unitName: 'Ford', siteCode: '69LBDL0239' }),
      f({ unitName: 'สมิติเวช', siteCode: '69LBDL0035' }),
      f({ unitName: 'สมิติเวช', siteCode: '69LBDL0077' }),
      f({ unitName: 'สมิติเวช', siteCode: null }), // ใช้กับสองไซต์ ⇒ ไม่รู้ว่าไซต์ไหน
    ];
    const unit = followUnitResolver(rows);
    expect(new Set(rows.slice(0, 3).map(unit))).toEqual(new Set(['FORD']));
    expect(unit(rows[3])).toBe('สมิติเวช · 69LBDL0035');
    expect(unit(rows[4])).toBe('สมิติเวช · 69LBDL0077');
    expect(unit(rows[5])).toBe('สมิติเวช');
  });
  it('หน่วยงานจัดกลุ่มด้วยรหัสไซต์ก่อน ชื่อพิมพ์ต่างกันรวมเป็นที่เดียว', () => {
    const rows = [
      f({ unitName: 'FORD', siteCode: null }),
      f({ unitName: 'Ford ', siteCode: null }),
      f({ unitName: 'ford', siteCode: null }),
      f({ unitName: 'บริษัท โรงพยาบาลพญาไทศรีราชา', siteCode: '67LBDL0100' }),
      f({ unitName: 'พญาไท_ศรีราชา', siteCode: '67LBDL0100' }),
      f({ unitName: 'บริษัท โรงพยาบาลพญาไทศรีราชา', siteCode: '67LBDL0100' }),
      f({ unitName: null, siteCode: null }),
    ];
    const unit = followUnitResolver(rows);
    const labels = rows.map(unit);
    expect(new Set(labels.slice(0, 3)).size).toBe(1);
    expect(labels[3]).toBe('บริษัท โรงพยาบาลพญาไทศรีราชา');
    expect(labels[4]).toBe('บริษัท โรงพยาบาลพญาไทศรีราชา');
    expect(labels[6]).toBe('ไม่ระบุ');
  });
  it('รอบโทร/ใครโทร', () => {
    const round = followDimGetter('round', []);
    const mode = followDimGetter('mode', []);
    expect(round(f({ callRound: 2 }))).toBe('สายที่ 2 ขึ้นไป');
    expect(round(f({ callRound: null }))).toBe('สายแรก');
    expect(mode(f({ callMode: 'manual' }))).toBe('เจ้าหน้าที่โทรเอง');
  });
});

const a = (over: Partial<ApplicantTrendRow>): ApplicantTrendRow => ({
  id: Math.random().toString(36).slice(2),
  createdAt: '2026-09-24T03:00:00Z',
  channel: 'facebook',
  position: 'พนักงานขับรถ',
  province: 'ลพบุรี',
  bu: 'LBD',
  jobId: null,
  isLead: false,
  claimed: false,
  callBucket: null,
  callOutcome: null,
  callAt: null,
  appointmentAt: null,
  attendance: null,
  ...over,
});

describe('ผู้สมัคร — เส้นทางนับกลุ่มเดียวกัน (cohort)', () => {
  const rows = [
    a({ callBucket: 'connected', callOutcome: 'confirmed', appointmentAt: '2026-09-26T05:00:00Z', attendance: 'showed' }),
    a({ callBucket: 'connected', callOutcome: 'declined' }),
    a({ callBucket: 'unreached', callOutcome: 'no_answer' }),
    a({ callBucket: 'pending' }),
    a({}),
    a({ createdAt: '2026-08-01T03:00:00Z', callBucket: 'connected', callOutcome: 'confirmed' }), // นอกช่วง
  ];
  const funnel = applicantFunnel(rows, { from: '2026-09-22', to: '2026-09-28' });
  it('นับเฉพาะคนที่สมัครในช่วง · แต่ละขั้นไม่เกินขั้นก่อน', () => {
    expect(funnel.map((s) => [s.key, s.count])).toEqual([
      ['applied', 5],
      ['called', 3],
      ['connected', 2],
      ['interested', 1],
      ['appointment', 1],
      ['showed', 1],
    ]);
    for (let i = 1; i < funnel.length; i++) expect(funnel[i].count).toBeLessThanOrEqual(funnel[i - 1].count);
  });
  it('% เทียบคนสมัคร และเทียบขั้นก่อน', () => {
    expect(funnel[1].ofApplied).toBeCloseTo(0.6);
    expect(funnel[2].ofPrevious).toBeCloseTo(2 / 3);
    expect(funnel[0].ofPrevious).toBeNull();
  });
});

const r = (over: Partial<RequestTrendRow>): RequestTrendRow => ({
  requestNo: 'R1',
  cohortDate: '2026-09-10',
  submittedDate: '2026-09-08',
  closureDate: null,
  kind: 'remaining',
  positions: 1,
  departmentCode: 'LBD',
  siteCode: '67LBDL0001',
  unitName: 'หน่วยงาน A',
  lifecycleKind: 'resignation',
  leadKind: 'advance',
  ...over,
});

describe('ใบขอ — มุมงวดของใบ (cohort) ตรงกับ Dashboard เดิม', () => {
  it('หาได้แล้ว + ยกเลิก + เหลือหา = ขอมา ทุกงวด · ยกเลิกไม่ถูกนับเป็นหาได้แล้ว', () => {
    const rows = [
      r({ requestNo: 'A', kind: 'filled', positions: 3, closureDate: '2026-09-20' }),
      r({ requestNo: 'A', kind: 'remaining', positions: 2 }),
      r({ requestNo: 'B', kind: 'cancelled', positions: 5, closureDate: '2026-09-15' }),
      r({ requestNo: 'C', kind: 'filled', positions: 1, cohortDate: '2026-08-20', closureDate: '2026-08-25' }),
    ];
    const s = cohortSeries(rows, { from: '2026-08-01', to: '2026-09-30' }, 'month');
    expect(s.map((p) => [p.key, p.requested, p.filled, p.cancelled, p.remaining])).toEqual([
      ['2026-08', 1, 1, 0, 0],
      ['2026-09', 10, 3, 5, 2],
    ]);
    for (const p of s) expect(p.filled + p.cancelled + p.remaining).toBe(p.requested);
  });
});

describe('ใบขอ — มุมวันที่เกิดจริง + สมการงานค้าง', () => {
  const rows = [
    // ใบ A: ขอ 4 (กรอก 1 ก.ย.) หาได้ 3 (แจ้งเข้า 2 ใบวันที่ 10 + 1 ใบวันที่ 20) เหลือ 1
    r({ requestNo: 'A', submittedDate: '2026-09-01', kind: 'filled', positions: 3, closureDate: null }),
    r({ requestNo: 'A', submittedDate: '2026-09-01', kind: 'remaining', positions: 1 }),
    // ใบ B: ขอ 2 ยกเลิกทั้งใบ 15 ก.ย.
    r({ requestNo: 'B', submittedDate: '2026-09-05', kind: 'cancelled', positions: 2, closureDate: '2026-09-15' }),
    // ใบ C: กรอกก่อนช่วง (ส.ค.) ขอ 1 หาได้ 1 แต่ **ไม่มีใบแจ้งเข้าที่มีวันที่** ⇒ undatedFilled
    r({ requestNo: 'C', submittedDate: '2026-08-10', cohortDate: '2026-08-12', kind: 'filled', positions: 1 }),
  ];
  const informs: InformTrendRow[] = [
    { requestNo: 'A', day: '2026-09-10', count: 2, departmentCode: 'LBD' },
    { requestNo: 'A', day: '2026-09-20', count: 1, departmentCode: 'LBD' },
    // แจ้งเข้าเกินที่ใบหาได้ (ซ้ำ/เกินขอ) — ต้องถูกตัด ไม่นับเกิน
    { requestNo: 'A', day: '2026-09-25', count: 3, departmentCode: 'LBD' },
    // ใบนอกชุด (เช่น ถูกกรอง BU ออก) ต้องไม่ถูกนับ
    { requestNo: 'ZZZ', day: '2026-09-12', count: 9, departmentCode: 'LBA' },
  ];
  const led = activityLedger(rows, informs, { from: '2026-09-01', to: '2026-09-30' }, 'week');

  it('หาได้แล้วนับตามวันแจ้งเข้า ไม่เกินที่ใบนั้นหาได้จริง · ใบนอกชุดไม่นับ', () => {
    expect(led.points.reduce((s, p) => s + p.informed, 0)).toBe(3);
  });
  it('ยกเลิกนับตามวันยกเลิก และไม่ปนกับหาได้แล้ว', () => {
    expect(led.points.reduce((s, p) => s + p.cancelled, 0)).toBe(2);
  });
  it('สมการ: ยกมา + ขอใหม่ − หาได้ − ยกเลิก = เหลือหา (ทุกงวดต่อกัน)', () => {
    let prev = 1; // ใบ C ขอ 1 ก่อนช่วง (หาได้แล้วแต่ไม่มีวันที่ ⇒ ยังค้างในสมการ)
    for (const p of led.points) {
      expect(p.backlog).toBe(prev + p.added - p.informed - p.cancelled);
      prev = p.backlog;
    }
  });
  it('ส่วนต่างสองมุม = หาได้แล้วที่ไม่มีวันที่ (ต้องติดธงประมาณการ)', () => {
    expect(led.undatedFilled).toBe(1);
    expect(led.openNow).toBe(1);
    // สมการจบที่ 2 แต่ของจริงค้าง 1 — ส่วนต่าง 1 = ใบ C ที่หาได้แล้วแต่ไม่มีวันที่แจ้งเข้า
    expect(led.ledgerEnd - led.openNow).toBe(led.undatedFilled);
  });
});

describe('ปล่อยประกาศ — ใช้กี่วันจากวันกรอกใบถึงวันปล่อย', () => {
  const releases: ReleaseTrendRow[] = [
    { jobId: 'j1', requestNo: 'A', releasedAt: '2026-09-03T03:00:00Z', staffId: 'u1', staffName: 'เนส', bu: 'LBD' },
    { jobId: 'j2', requestNo: 'B', releasedAt: '2026-09-15T03:00:00Z', staffId: 'u1', staffName: 'เนส', bu: 'LBD' },
    { jobId: 'j3', requestNo: 'X', releasedAt: '2026-09-16T03:00:00Z', staffId: 'u2', staffName: 'หวาน', bu: 'LBD' },
    { jobId: 'j4', requestNo: 'A', releasedAt: '2026-08-03T03:00:00Z', staffId: 'u2', staffName: 'หวาน', bu: 'LBD' },
  ];
  const requests = [r({ requestNo: 'A', submittedDate: '2026-09-01' }), r({ requestNo: 'B', submittedDate: '2026-09-05' })];
  it('ปล่อยรวดเดียว (คนเดียว นาทีเดียว ≥ 10 ใบ) ต้องแยกให้เห็น', () => {
    const bulk: ReleaseTrendRow[] = Array.from({ length: 12 }, (_, i) => ({
      jobId: `b${i}`,
      requestNo: null,
      releasedAt: `2026-08-25T03:30:${String(i).padStart(2, '0')}Z`,
      staffId: 'u9',
      staffName: 'เนส',
      bu: 'LBD',
    }));
    const s = releaseStats([...bulk, ...releases], requests, { from: '2026-08-01', to: '2026-09-30' });
    expect(s.batches).toEqual([{ day: '2026-08-25', staffName: 'เนส', count: 12 }]);
    expect(releaseStats(releases, requests, { from: '2026-09-01', to: '2026-09-30' }).batches).toEqual([]);
  });
  it('มัธยฐานวัน · สัดส่วนที่ปล่อยใน 3 วัน · ใบที่ไม่รู้วันกรอกไม่เอามาคิดวัน', () => {
    const s = releaseStats(releases, requests, { from: '2026-09-01', to: '2026-09-30' });
    expect(s.released).toBe(3);
    expect(s.medianDaysToRelease).toBe(6); // (2 + 10) / 2
    expect(s.within3Days).toBe(0.5);
  });
});

describe('ตารางเทียบเจ้าหน้าที่ — คนเดียวกันรวมแถวเดียวข้ามส่วน', () => {
  it('รวมปล่อยประกาศ + ลงติดตาม ด้วยรหัสผู้ใช้ · เทียบช่วงก่อน', () => {
    const releases: ReleaseTrendRow[] = [
      { jobId: 'j1', requestNo: 'A', releasedAt: '2026-09-23T03:00:00Z', staffId: 'u1', staffName: 'เนส', bu: 'LBD' },
      { jobId: 'j2', requestNo: 'B', releasedAt: '2026-09-16T03:00:00Z', staffId: 'u1', staffName: 'เนส', bu: 'LBD' },
    ];
    const follow = [
      f({ staffId: 'u1', staffName: 'เนส', createdAt: '2026-09-24T03:00:00Z', completedAt: '2026-09-25T03:00:00Z', outcomeCode: 'arrived' }),
      f({ staffId: 'u1', staffName: 'เนส', createdAt: '2026-09-24T03:00:00Z', completedAt: '2026-09-26T03:00:00Z', outcomeCode: 'leave' }),
      f({ staffId: 'u2', staffName: 'หวาน', createdAt: '2026-09-25T03:00:00Z' }),
    ];
    const t = staffTable({ releases, follow }, { from: '2026-09-22', to: '2026-09-28' }, { from: '2026-09-15', to: '2026-09-21' });
    const nes = t.find((x) => x.key === 'u1')!;
    expect(nes).toMatchObject({ released: 1, releasedPrev: 1, registered: 2, success: 1 });
    expect(nes.successRate).toBe(0.5);
    expect(t.find((x) => x.key === 'u2')?.registered).toBe(1);
  });
});

describe('แบ่งงวดแล้วยอดรวมไม่หาย (ทุกส่วนใช้ seriesByBucket ตัวเดียว)', () => {
  it('ติดตามรายวัน = รายเดือน', () => {
    const rows = Array.from({ length: 20 }, (_, i) => f({ createdAt: `2026-09-${String(i + 1).padStart(2, '0')}T03:00:00Z` }));
    const range = { from: '2026-09-01', to: '2026-09-30' };
    const d = seriesByBucket(rows, (x) => followEventYmd(x, 'registered'), range, 'day');
    const m = seriesByBucket(rows, (x) => followEventYmd(x, 'registered'), range, 'month');
    expect(d.reduce((s, p) => s + p.value, 0)).toBe(20);
    expect(m[0].value).toBe(20);
  });
});
