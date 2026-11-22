/**
 * สรุปงานสรรหาให้ผู้ช่วย AI (เจ้าของ 20 พ.ย. 2569 "ถ้าในจอตอบไม่ได้ ผู้ช่วย AI ต้องช่วยได้")
 * 🔴 ด่าน: เลขในสรุป = เลขของแท็บ Scale ลง ตัวต่อตัว (ไม่มีนิยามใหม่) · เทียบไม่ได้ = null ไม่ใช่ 0 · ไม่มี id/ชื่อผู้สมัคร · ไม่เกินเพดานผลอ่าน
 */
import { describe, expect, it } from 'vitest';
import type { RecruitAppFact, RecruitAppJob } from './recruitOverviewTypes';
import type { StaffActivityRow } from './staffActivity';
import type { StuckRequest } from './recruitStuck';
import type { MoneyRequest } from './homeMoney';
import { EXEC_SUMMARY_MAX, buildExecSummary, type ExecSummaryArgs } from './execSummary';
import { SCALE_ROOT, scaleBoxOf, scaleSections, type ScaleBoxKey, type ScaleInput, type ScaleLevel } from './overviewScale';

const fact = (id: string, over: Partial<RecruitAppFact> = {}): RecruitAppFact => ({
  id,
  createdAt: '2026-11-10T00:30:00.000Z',
  jobId: 'siamraj-sql:OPL6911006',
  bu: 'LBD',
  channelLabel: 'Facebook · Facebook Group · หางานขับรถ กทม',
  referralSource: 'facebook',
  position: 'พนักงานขับรถ',
  phoneOk: true,
  calledByAi: false,
  calledByStaff: false,
  firstCalledAt: null,
  aiAnswer: null,
  aiAnswerAt: null,
  staffAnswer: null,
  staffAnswerAt: null,
  staffLastAt: null,
  contact: null,
  contactBy: null,
  logOk: null,
  logReason: null,
  logAt: null,
  appointmentAt: null,
  attendance: null,
  onBoard: false,
  informed: false,
  bringer: 'คิว',
  postSource: 'manual',
  ...over,
});
const yes = { calledByAi: true, aiAnswer: 'said_yes' as const };
const COHORT: RecruitAppFact[] = [
  fact('app-9f1c0a11', { ...yes, logOk: true, appointmentAt: '2026-11-12T03:00:00.000Z', attendance: 'showed', claimedBy: 'แป๋ม', claimedAt: '2026-11-10T02:00:00.000Z', informed: true, informedAt: '2026-11-18', homeProvince: 'กรุงเทพมหานคร', homeDistrict: 'บางรัก', age: 30 }),
  fact('app-9f1c0a12', { ...yes, logOk: false, logReason: 'ไม่รับสาย', claimedBy: 'แป๋ม', claimedAt: '2026-11-11T03:00:00.000Z', homeProvince: 'กรุงเทพมหานคร', homeDistrict: 'ดินแดง', age: 50 }),
  fact('app-9f1c0a16', { ...yes, createdAt: '2026-11-19T18:30:00.000Z', channelLabel: 'Tiktok · Tiktok Live' }),
  fact('app-77b20b18', { bu: 'LBA', jobId: 'siamraj-sql:LAO6911027', channelLabel: 'Webjob · Jobthai', bringer: 'ฟอร์ด', homeProvince: 'ชลบุรี' }),
];
const row = (userId: string, name: string, bu: string, day: string, o: Partial<StaffActivityRow> = {}): StaffActivityRow => ({ userId, name, bu, day, autopost: 0, scrap: 0, links: 0, manualPosted: 0, contacts: 0, appts: 0, ...o });
const Q = '5f4b2fcd-7f64-4bb8-92cf-7c118d9a0bef';
const STAFF = [row(Q, 'คิว', 'LBD', '2026-11-19', { links: 3 }), row(Q, 'คิว', 'LBD', '2026-11-20', { links: 5, scrap: 2 }), row('0a8f0b5e-11d2-4c7e-9a61-2b1f6f0f9c01', 'ฟอร์ด', 'LBA', '2026-11-20', { links: 4 })];
const req = (no: string, bu: string, recruiter: string | null, flow: [number, number, number, number, number], o: Record<string, unknown> = {}): StuckRequest =>
  ({
    requestNo: no,
    jobId: `siamraj-sql:${no}`,
    bu,
    unitName: 'ธนาคารตัวอย่าง จำกัด (มหาชน)',
    position: 'ขับรถ',
    recruiter,
    requested: flow[1],
    filled: flow[2],
    cancelled: flow[3],
    remaining: flow[4],
    applications: 0,
    ageDays: 12,
    signals: { post: 'posted', released: true, links: 1 },
    flow: { carryIn: flow[0], new: flow[1], filled: flow[2], cancelled: flow[3], remaining: flow[4], fillDays: [], cancelDays: [] },
    ...o,
  }) as unknown as StuckRequest;
const REQUESTS = [req('OPL6911006', 'LBD', 'คิว', [0, 3, 1, 0, 2]), req('OPL6910100', 'LBD', 'คิว', [2, 0, 0, 2, 0]), req('LAO6911027', 'LBA', 'ฟอร์ด', [0, 5, 0, 0, 5])];
const money = (no: string, bu: string, o: Record<string, unknown> = {}): MoneyRequest =>
  ({ requestNo: no, bu, unit: 'บริษัท ตัวอย่างการเงิน จำกัด', position: 'ขับรถ', clocked: false, speedDays: null, lateDays: null, stopReason: null, amount: { need: { days: 0, personDays: 0, fine: 0, deduct: 0, coveredPersonDays: 0 }, key: { days: 0, personDays: 0, fine: 0, deduct: 0, coveredPersonDays: 0 } }, ...o }) as unknown as MoneyRequest;
const MONEY = [money('OPL6911006', 'LBD', { amount: { need: { days: 15, personDays: 15, fine: 15000, deduct: 7500, coveredPersonDays: 0 }, key: { days: 0, personDays: 0, fine: 0, deduct: 0, coveredPersonDays: 0 } } }), money('OPL6910100', 'LBD', { stopReason: 'ลูกค้าหาคนเองได้' })];
const JOBS: Record<string, RecruitAppJob> = {
  'siamraj-sql:OPL6911006': { requestNo: 'OPL6911006', unitName: 'ธนาคารตัวอย่าง จำกัด (มหาชน)', position: 'ขับรถ', recruiter: 'คิว', area: { province: 'กรุงเทพมหานคร', district: 'บางรัก' }, ageMin: 25, ageMax: 45, gender: null },
};
const INPUT: ScaleInput = { cohort: COHORT, staff: STAFF, requests: REQUESTS, money: MONEY, jobs: JOBS, from: '2026-11-01', to: '2026-11-20', today: '2026-11-20', now: Date.parse('2026-11-20T05:00:00.000Z') };
const PREV: ScaleInput = {
  cohort: [fact('app-55aa0c01', { createdAt: '2026-10-20T03:00:00.000Z' })],
  staff: [row(Q, 'คิว', 'LBD', '2026-10-29', { links: 2 }), row('7c1e2d3f-5a6b-4c8d-9e0f-1a2b3c4d5e6f', 'ต้น', 'LM', '2026-10-30', { links: 5 })],
  requests: [req('OPL6910100', 'LBD', 'คิว', [9, 0, 0, 0, 9])],
  money: [],
  jobs: JOBS,
  // ช่วงก่อนเริ่มหลังลิงก์เริ่มจำคนสร้าง (28 ต.ค.) = Gen link เทียบได้ · แต่ก่อน "โพสต์แล้ว" เริ่มนับ (13 พ.ย.) = งานรวมเทียบไม่ได้
  from: '2026-10-28',
  to: '2026-10-31',
  today: '2026-11-20',
  now: INPUT.now,
};
const at = (o: Partial<ScaleLevel> = {}): ScaleLevel => ({ ...SCALE_ROOT, ...o });
const args = (o: Partial<ExecSummaryArgs> = {}): ExecSummaryArgs => ({ input: INPUT, prev: PREV, prevCohortOk: true, level: at(), box: null, roster: null, generatedAt: '2026-11-20T05:00:00.000Z', errors: [], ...o });
const boxOf = (s: ReturnType<typeof buildExecSummary>, key: ScaleBoxKey) => s.sections.flatMap((x) => x.boxes).find((b) => b.key === key);

describe('buildExecSummary — ชั้นทั้งหมด', () => {
  const s = buildExecSummary(args());

  it('ทุกกล่อง = กล่องของแท็บ Scale ลง ตัวต่อตัว (คำ · เลข · บรรทัดล่าง) + สมการใบขอ', () => {
    const screen = scaleSections(INPUT, at());
    expect(s.sections.map((x) => x.title)).toEqual(screen.map((x) => x.title));
    for (const sec of screen)
      for (const b of sec.boxes) {
        const mine = boxOf(s, b.key);
        expect([b.key, mine?.label, mine?.value ?? null, mine?.text ?? null]).toEqual([b.key, b.label, b.format === 'text' ? null : b.value, b.format === 'text' ? (b.text ?? null) : null]);
        expect([b.key, mine?.sub ?? '']).toEqual([b.key, b.sub]);
      }
    expect(s.sections[0].equation).toBe('ยกมา 2 + ขอใหม่ 8 − หาได้แล้ว 1 − ยกเลิก 2 = เหลือหา 7 อัตรา');
    expect(s.window).toEqual({ from: '2026-11-01', to: '2026-11-20', days: 20, compareWith: '2026-10-28 ถึง 2026-10-31' });
    expect([s.level, s.bus]).toEqual([['ทั้งหมด'], ['LBD', 'LBA']]);
  });

  it('ค่าช่วงก่อน: มี = เลข · เลขที่เพิ่งเริ่มนับ = null · สถานะ ณ ตอนนี้ไม่มีช่อง prev', () => {
    expect(boxOf(s, 'cNames')).toMatchObject({ value: 4, prev: 1 });
    expect(boxOf(s, 'reqPos')).toMatchObject({ value: 7, prev: 9 });
    expect(boxOf(s, 'wLinks')).toMatchObject({ value: 12, prev: 7 });
    expect(boxOf(s, 'wSum')).toMatchObject({ value: 14, prev: null });
    // ช่วงก่อนที่เริ่มก่อนลิงก์จำคนสร้าง = Gen link เทียบไม่ได้ (ไม่ใช่เพิ่มขึ้นจาก 0)
    expect(boxOf(buildExecSummary(args({ prev: { ...PREV, from: '2026-10-12' } })), 'wLinks')).toMatchObject({ value: 12, prev: null });
    expect('prev' in (boxOf(s, 'reqIdle') ?? {})).toBe(false);
    expect('prev' in (boxOf(s, 'hAll') ?? {})).toBe(false);
    // รายชื่อช่วงก่อนไม่ครบ / อ่านงานช่วงก่อนไม่ได้ = null (ไม่เทียบกับ 0)
    const blind = buildExecSummary(args({ prevCohortOk: false, prev: { ...PREV, staff: null } }));
    expect([boxOf(blind, 'cNames')?.prev, boxOf(blind, 'wLinks')?.prev, boxOf(blind, 'reqPos')?.prev]).toEqual([null, null, 9]);
    // ไม่มีช่วงก่อน (ปุ่ม "ทั้งหมด") = ไม่เทียบเลย
    const none = buildExecSummary(args({ prev: null, prevCohortOk: false }));
    expect([none.window.compareWith, 'prev' in (boxOf(none, 'cNames') ?? {})]).toEqual([null, false]);
  });

  it('แยกตาม BU รวมกัน = กล่อง · คนในแต่ละขั้นไปไหนต่อ · ยกเลิกเพราะอะไร · ตรงเกณฑ์ใบขอ · แจ้งเข้า', () => {
    expect(s.chain).toEqual(['รายชื่อ', 'AI โทรแล้ว', 'AI สนใจ', 'คนโทรต่อ ติดต่อได้', 'นัดได้', 'มา', 'แจ้งเข้า']);
    expect(s.byBu?.map((r) => [r.bu, r.remainingPositions, r.work, r.chain[0]])).toEqual([['LBD', 2, 10, 3], ['LBA', 5, 4, 1]]);
    expect(s.byBu?.reduce((a, r) => a + (r.work ?? 0), 0)).toBe(boxOf(s, 'wSum')?.value);
    expect(s.next?.find((n) => n.from === 'AI สนใจ')).toEqual({ from: 'AI สนใจ', total: 3, parts: [{ label: 'ติดต่อได้', value: 1 }, { label: 'ติดต่อไม่ได้', value: 1, reasons: 'ไม่รับสาย 1' }, { label: 'รอโทร', value: 1 }] });
    expect(s.cancelReasons).toEqual([{ reason: 'ลูกค้าหาคนเองได้', positions: 2, requests: 1 }]);
    expect(s.fit?.columns.length).toBe(7);
    expect(s.fit?.stages[0]).toEqual({ stage: 'รายชื่อ', total: 4, cells: [1, 1, 0, 0, 2, 1, 0] });
    expect(s.informed).toEqual([{ bu: 'LBD', channel: expect.any(String), bringer: 'คิว', createdDay: '2026-11-10', informedDay: '2026-11-18', days: 8 }]);
    expect(s.topCustomers?.[0]).toMatchObject({ name: 'ธนาคารตัวอย่าง จำกัด (มหาชน)', remaining: 7 });
    expect(s.days?.slice(-2)).toEqual([['2026-11-19', 3], ['2026-11-20', 11]]);
    expect(s.months).toBeUndefined();
  });

  it('ไม่มี id ผู้สมัคร · เล็กกว่าเพดานผลอ่าน', () => {
    const json = JSON.stringify(s);
    expect(json).not.toMatch(/app-[0-9a-f]{6}/);
    expect(json.length).toBeLessThan(EXEC_SUMMARY_MAX);
  });
});

describe('buildExecSummary — ชั้น BU · คน · วัน · กล่องที่ขอ', () => {
  it('ชั้น BU: รายคน (คนที่ช่วงนี้ไม่มีงานก็อยู่) + รายชื่ออยู่ที่ใคร', () => {
    const roster = [{ userId: 'a1f0c7d2-3b4e-4f5a-8c6d-7e8f9a0b1c2d', name: 'โอ๊ต', bu: 'LBD', lastDay: '2026-10-28' }];
    const s = buildExecSummary(args({ level: at({ bu: 'LBD' }), roster }));
    expect(s.level).toEqual(['ทั้งหมด', 'LBD']);
    expect(s.byBu).toBeUndefined();
    expect(s.people?.map((p) => [p.name, p.work, p.chain[0], p.lastDay, p.idleDays])).toEqual([['คิว', 10, 3, '2026-11-20', 0], ['โอ๊ต', 0, 0, '2026-10-28', 22]]);
    expect(s.peopleAverage).toMatchObject({ people: 1, work: 10 });
    expect(s.hold).toEqual([{ name: 'แป๋ม', all: 2, ok: 1, fail: 1, waiting: 0, okPct: 50, oldestDays: null }]);
    expect(boxOf(s, 'cNames')?.value).toBe(scaleBoxOf(scaleSections(INPUT, at({ bu: 'LBD' })), 'cNames')?.value);
  });

  it('ชั้นคน: รายชื่อที่หามาแยกช่องทาง · ชั้นวัน: ใครทำอะไร เทียบกับวันก่อน', () => {
    const who = buildExecSummary(args({ level: at({ bu: 'LBD', who: 'คิว' }) }));
    expect(who.level).toEqual(['ทั้งหมด', 'LBD', 'คิว']);
    expect(who.channels?.map((c) => c.chain[0]).reduce((a, n) => a + n, 0)).toBe(boxOf(who, 'cNames')?.value);
    expect(who.people).toBeUndefined();
    const day = buildExecSummary(args({ level: at({ day: '2026-11-20' }) }));
    expect(day.window.compareWith).toBe('วันก่อน 2026-11-19');
    expect(day.workKinds).toEqual(['Gen link', 'โพสต์แล้ว', 'Scrap', 'Autopost', 'ลงผลติดต่อ', 'ลงนัด']);
    expect(day.dayPeople).toEqual([{ name: 'คิว', bu: 'LBD', sum: 7, kinds: [5, 0, 2, 0, 0, 0] }, { name: 'ฟอร์ด', bu: 'LBA', sum: 4, kinds: [4, 0, 0, 0, 0, 0] }]);
    expect(boxOf(day, 'wSum')).toMatchObject({ value: 11, prev: 3 });
    // วันแรกของช่วง = ไม่มีวันก่อนในมือ
    const first = buildExecSummary(args({ level: at({ day: '2026-11-01' }) }));
    expect([first.window.compareWith, boxOf(first, 'wSum')?.prev]).toEqual([null, null]);
  });

  it('กล่องที่ขอ: แยกตามชั้นถัดไป + ค่าช่วงก่อนทีละแถว (แถวที่หายไปขึ้นเป็น 0) · กล่องใบขอที่ชั้น BU ได้รายใบ + เหตุผลยกเลิก', () => {
    const s = buildExecSummary(args({ box: 'wLinks' }));
    expect(s.breakdown).toEqual({
      box: 'Gen link',
      by: 'แยกตาม BU',
      total: 12,
      rows: [{ label: 'LBD', value: 8, prev: 2 }, { label: 'LBA', value: 4, prev: 0 }, { label: 'LM', value: 0, prev: 5 }],
    });
    const cancelled = buildExecSummary(args({ level: at({ bu: 'LBD' }), box: 'reqCancelled' }));
    expect(cancelled.breakdown).toMatchObject({ by: 'แยกตามเจ้าหน้าที่สรรหา', total: 2, rows: [{ label: 'คิว', value: 2 }] });
    expect(cancelled.requests).toEqual([{ requestNo: 'OPL6910100', jobId: 'siamraj-sql:OPL6910100', position: 'ขับรถ', unit: 'ธนาคารตัวอย่าง จำกัด (มหาชน)', amount: 2, ageDays: 12, recruiter: 'คิว', cancelReason: 'ลูกค้าหาคนเองได้' }]);
    const open = buildExecSummary(args({ level: at({ bu: 'LBD' }), box: 'reqPos' }));
    expect(open.requests?.map((r) => [r.requestNo, r.amount, r.started])).toEqual([['OPL6911006', 2, true]]);
    // ชั้นทั้งหมดยังไม่มีรายใบ (ต้องลงชั้น BU) · กล่องที่ไม่มีในชั้นนั้นบอกตรง ๆ
    expect(buildExecSummary(args({ box: 'reqPos' })).requests).toBeUndefined();
    expect(buildExecSummary(args({ level: at({ day: '2026-11-20' }), box: 'fine' })).errors).toEqual(['ชั้นนี้ไม่มีกล่อง fine']);
  });

  it('ช่วงที่ครอบหลายเดือน = มีตารางเทียบเดือน รวมทุกเดือน = กล่อง', () => {
    const wide: ScaleInput = { ...INPUT, from: '2026-10-15', cohort: [...COHORT, fact('app-55aa0c01', { createdAt: '2026-10-20T03:00:00.000Z' })], staff: [...STAFF, row(Q, 'คิว', 'LBD', '2026-10-20', { links: 3 })] };
    const s = buildExecSummary(args({ input: wide, prev: null, prevCohortOk: false }));
    expect(s.months).toEqual([
      { month: 'ต.ค. 69 · 15–31', work: 3, chain: [1, 0, 0, 0, 0, 0, 0] },
      { month: 'พ.ย. 69 · 1–20', work: 14, chain: [4, 3, 3, 1, 1, 1, 1] },
    ]);
    expect(s.months?.reduce((a, m) => a + (m.work ?? 0), 0)).toBe(boxOf(s, 'wSum')?.value);
  });

  it('ข้อมูลเยอะเกินเพดาน = ตัดก้อนรองออกและบอกไว้ ไม่ตัดเงียบ · กล่องเลขอยู่ครบ', () => {
    // ชื่อยาวผิดปกติ 400 คน — ของจริงสั้นกว่านี้มาก (ด่านนี้กันกรณีสุดขอบ)
    const long = 'ชื่อที่ยาวมากเกินกว่าที่ควรจะเป็นในระบบจริง '.repeat(4);
    const many = Array.from({ length: 400 }, (_, i) => fact(`app-big${String(i).padStart(5, '0')}`, { bringer: `${long}${i}`, channelLabel: `Facebook · ${long}${i} · กลุ่ม ${i}`, informed: true, informedAt: '2026-11-18' }));
    const staff = many.map((f, i) => row(`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, f.bringer as string, 'LBD', '2026-11-20', { links: 1 }));
    const s = buildExecSummary(args({ input: { ...INPUT, cohort: many, staff }, level: at({ bu: 'LBD' }), box: 'cNames' }));
    expect(JSON.stringify(s).length).toBeLessThanOrEqual(EXEC_SUMMARY_MAX);
    expect(s.errors.join(' ')).toContain('ข้อมูลเยอะเกิน ตัดก้อนนี้ออก');
    expect(s.sections.flatMap((x) => x.boxes).length).toBeGreaterThan(30);
    expect(s.people?.length).toBe(30);
  });
});
