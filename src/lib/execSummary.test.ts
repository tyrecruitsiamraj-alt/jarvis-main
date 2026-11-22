/**
 * สรุปงานสรรหาให้ผู้ช่วย AI (เจ้าของ 20 พ.ย. 2569 "ถ้าในจอตอบไม่ได้ ผู้ช่วย AI ต้องช่วยได้")
 * 🔴 ด่าน: เลขในสรุป = เลขของแท็บ Scale ลง ตัวต่อตัว (ไม่มีนิยามใหม่) · เทียบไม่ได้ = null ไม่ใช่ 0 · ไม่มี id/ชื่อผู้สมัคร · ไม่เกินเพดานผลอ่าน
 * 🔴 ทุกตาราง = แถวละก้อน หัวคอลัมน์คำเดียวกับจอ ไม่มีแถวเลขเรียงตำแหน่ง (ผู้ช่วยเคยหยิบ "แจ้งเข้า" ไปตอบเป็น "รายชื่อ" · ทดสอบบนเว็บจริง 22 พ.ย. 2569)
 */
import { describe, expect, it } from 'vitest';
import type { RecruitAppFact, RecruitAppJob } from './recruitOverviewTypes';
import type { StaffActivityRow } from './staffActivity';
import type { StuckRequest } from './recruitStuck';
import type { MoneyRequest } from './homeMoney';
import { EXEC_REQUEST_ROWS, EXEC_SUMMARY_MAX, buildExecRequest, buildExecSummary, type ExecSummaryArgs } from './execSummary';
import { SCALE_ROOT, scaleBoxOf, scaleSections, scaleStaffNamer, type ScaleBoxKey, type ScaleInput, type ScaleLevel } from './overviewScale';
import { staffWorkTotal } from './staffActivity';
import type { RequestEvent, RequestTimelineJob } from './requestTimeline';

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
    released: true,
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

const CHAIN_HEADS = ['รายชื่อ', 'AI โทรแล้ว', 'AI สนใจ', 'คนโทรต่อ ติดต่อได้', 'นัดได้', 'มา', 'แจ้งเข้า'];
const chain = (v: number[]) => Object.fromEntries(CHAIN_HEADS.map((h, i) => [h, v[i]]));
/** ไม่มีแถวเลขเรียงตำแหน่งเหลือในสรุป — ทุกเลขต้องมีป้ายกำกับ */
const hasBareNumberArray = (v: unknown): boolean =>
  Array.isArray(v) ? (v.length > 1 && v.every((x) => typeof x === 'number')) || v.some(hasBareNumberArray) : v != null && typeof v === 'object' ? Object.values(v).some(hasBareNumberArray) : false;

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
    // ช่วงเขียนแบบที่จอใช้ (ปี พ.ศ.) ให้ผู้ช่วยยกไปตอบได้ทั้งคำ · from/to ยังเป็นค่าที่ใช้ส่งคำสั่ง
    expect(s.window).toEqual({ from: '2026-11-01', to: '2026-11-20', days: 20, text: '1–20 พ.ย. 2569', compareWith: '28–31 ต.ค. 2569' });
    // ช่วงที่ยังไม่จบ = เขียนถึงวันนี้ (เหมือนหัวจอ)
    expect(buildExecSummary(args({ input: { ...INPUT, to: '2026-11-30' } })).window.text).toBe('1–20 พ.ย. 2569');
    expect([s.level, s.bus]).toEqual([['ทั้งหมด'], ['LBD', 'LBA']]);
  });

  it('ค่าช่วงก่อน: มี = เลข · เลขที่เพิ่งเริ่มนับ = null พร้อมเหตุ · สถานะ ณ ตอนนี้ไม่มีช่อง prev', () => {
    expect(boxOf(s, 'cNames')).toMatchObject({ value: 4, prev: 1 });
    expect(boxOf(s, 'reqPos')).toMatchObject({ value: 7, prev: 9 });
    expect(boxOf(s, 'wLinks')).toMatchObject({ value: 12, prev: 7 });
    expect('prevNote' in (boxOf(s, 'wLinks') ?? {})).toBe(false);
    expect(boxOf(s, 'wSum')).toMatchObject({ value: 14, prev: null, prevNote: 'ระบบเริ่มนับเลขนี้ 13 พ.ย. 2569 ช่วงก่อนยังไม่มีครบ' });
    // ช่วงก่อนที่เริ่มก่อนลิงก์จำคนสร้าง = Gen link เทียบไม่ได้ (ไม่ใช่เพิ่มขึ้นจาก 0)
    expect(boxOf(buildExecSummary(args({ prev: { ...PREV, from: '2026-10-12' } })), 'wLinks')).toMatchObject({ value: 12, prev: null, prevNote: 'ระบบเริ่มนับเลขนี้ 28 ต.ค. 2569 ช่วงก่อนยังไม่มีครบ' });
    expect('prev' in (boxOf(s, 'reqIdle') ?? {})).toBe(false);
    expect('prev' in (boxOf(s, 'hAll') ?? {})).toBe(false);
    // รายชื่อช่วงก่อนไม่ครบ / อ่านงานช่วงก่อนไม่ได้ = null (ไม่เทียบกับ 0) · ไม่ใช่เรื่องวันเริ่มนับ = ไม่มีเหตุกำกับ
    const blind = buildExecSummary(args({ prevCohortOk: false, prev: { ...PREV, staff: null } }));
    expect([boxOf(blind, 'cNames')?.prev, boxOf(blind, 'wLinks')?.prev, boxOf(blind, 'reqPos')?.prev]).toEqual([null, null, 9]);
    expect([boxOf(blind, 'cNames')?.prevNote, boxOf(blind, 'wLinks')?.prevNote]).toEqual([undefined, undefined]);
    // ไม่มีช่วงก่อน (ปุ่ม "ทั้งหมด") = ไม่เทียบเลย
    const none = buildExecSummary(args({ prev: null, prevCohortOk: false }));
    expect([none.window.compareWith, 'prev' in (boxOf(none, 'cNames') ?? {})]).toEqual([null, false]);
  });

  it('แยกตาม BU: หัวคอลัมน์คำเดียวกับจอ ทุกเลขมีป้าย · รวมกัน = กล่อง', () => {
    const lbd = scaleSections(INPUT, at({ bu: 'LBD' }));
    expect(s.byBu?.[0]).toEqual({
      BU: 'LBD',
      'เหลือหา (อัตรา)': 2,
      'เหลือหา (ใบ)': 1,
      'ยังไม่เริ่มหา (ใบ)': 0,
      'AI สนใจ ยังไม่มีใครรับ': scaleBoxOf(lbd, 'hFree')?.value,
      คนทำงาน: 1,
      งานที่ทำ: 10,
      ...chain([3, 3, 3, 1, 1, 1, 1]),
    });
    expect(s.byBu?.map((r) => [r.BU, r['เหลือหา (อัตรา)'], r.งานที่ทำ, r.รายชื่อ, r.แจ้งเข้า])).toEqual([['LBD', 2, 10, 3, 1], ['LBA', 5, 4, 1, 0]]);
    expect(s.byBu?.reduce((a, r) => a + Number(r.งานที่ทำ ?? 0), 0)).toBe(boxOf(s, 'wSum')?.value);
    expect(s.byBu?.reduce((a, r) => a + Number(r.รายชื่อ ?? 0), 0)).toBe(boxOf(s, 'cNames')?.value);
    expect(s.byBu?.reduce((a, r) => a + Number(r['AI สนใจ ยังไม่มีใครรับ'] ?? 0), 0)).toBe(boxOf(s, 'hFree')?.value);
    expect(hasBareNumberArray(s)).toBe(false);
  });

  it('ทุกคนของทุก BU แบบย่อ + รายชื่ออยู่ที่ใคร (ถามถึงคน/ค้างที่ใครได้ที่ชั้นทั้งหมด)', () => {
    expect(s.people).toEqual([
      { คน: 'คิว', BU: 'LBD', ทำล่าสุด: '20 พ.ย. 2569', 'ไม่มีงานมา (วัน)': 0, งานที่ทำ: 10, 'รายชื่อที่หามา (ทุก BU)': 3 },
      { คน: 'ฟอร์ด', BU: 'LBA', ทำล่าสุด: '20 พ.ย. 2569', 'ไม่มีงานมา (วัน)': 0, งานที่ทำ: 4, 'รายชื่อที่หามา (ทุก BU)': 1 },
    ]);
    // คนที่หารายชื่อให้ BU อื่นด้วย = นับรวมทุก BU (ชั้นทั้งหมด = ทุก BU)
    const crossAll = buildExecSummary(args({ input: { ...INPUT, cohort: [...COHORT, fact('app-77b20b1c', { bu: 'LBA', jobId: 'siamraj-sql:LAO6911027', bringer: 'คิว' })] } }));
    expect(crossAll.people?.[0]).toMatchObject({ คน: 'คิว', BU: 'LBD', 'รายชื่อที่หามา (ทุก BU)': 4 });
    // คนที่ช่วงนี้ไม่มีงาน (อยู่ในรายชื่อ 60 วัน) ก็ขึ้น
    const roster = [{ userId: 'a1f0c7d2-3b4e-4f5a-8c6d-7e8f9a0b1c2d', name: 'โอ๊ต', bu: 'LBD', lastDay: '2026-10-28' }];
    expect(buildExecSummary(args({ roster })).people?.at(-1)).toEqual({ คน: 'โอ๊ต', BU: 'LBD', ทำล่าสุด: '28 ต.ค. 2569', 'ไม่มีงานมา (วัน)': 22, งานที่ทำ: 0, 'รายชื่อที่หามา (ทุก BU)': 0 });
    expect(s.hold).toEqual([{ คน: 'แป๋ม', BU: 'LBD', รับมาโทร: 2, ติดต่อได้: 1, ติดต่อไม่ได้: 1, ยังไม่ลงผล: 0, 'ติดต่อได้ %': 50, 'ค้างนานสุด (วัน)': null }]);
    expect(s.hold?.reduce((a, r) => a + Number(r.รับมาโทร), 0)).toBe(boxOf(s, 'hAll')?.value);
    // รายชื่อค้างที่ใคร = รับไปแล้วยังไม่ลงผล (ไม่ใช่ยอดรับมาโทร) · ไม่มีใครค้าง = ตารางว่าง · รวมกัน = กล่องยังไม่ลงผล
    expect(s.waiting).toEqual([]);
    const stuck = buildExecSummary(args({ input: { ...INPUT, cohort: [...COHORT, fact('app-9f1c0a19', { ...yes, claimedBy: 'แป๋ม', claimedAt: '2026-11-17T02:00:00.000Z' }), fact('app-77b20b1d', { ...yes, bu: 'LBA', jobId: 'siamraj-sql:LAO6911027', claimedBy: 'น้ำ', claimedAt: '2026-11-19T02:00:00.000Z' })] } }));
    expect(stuck.waiting).toEqual([{ คน: 'แป๋ม', BU: 'LBD', ยังไม่ลงผล: 1, 'ค้างนานสุด (วัน)': 3 }, { คน: 'น้ำ', BU: 'LBA', ยังไม่ลงผล: 1, 'ค้างนานสุด (วัน)': 1 }]);
    expect(stuck.waiting?.reduce((a, r) => a + Number(r.ยังไม่ลงผล), 0)).toBe(boxOf(stuck, 'hWait')?.value);
  });

  it('ใบที่เหลือหา ออกไปหาคนถึงไหน: รวมกัน = เหลือหา (ใบ) · ยังไม่เริ่ม = ยังไม่เริ่มหา (ใบ) · ยอดรวมบวกไว้ให้แล้ว', () => {
    const requests = [
      req('OPL6911006', 'LBD', 'คิว', [0, 3, 1, 0, 2], { applications: 2 }),
      req('OPL6911007', 'LBD', 'คิว', [0, 1, 0, 0, 1]),
      req('LAO6911027', 'LBA', 'ฟอร์ด', [0, 5, 0, 0, 5], { released: false, signals: { post: null, released: false, links: 0 } }),
      req('OPL6910100', 'LBD', 'คิว', [2, 0, 0, 2, 0]),
    ];
    const p = buildExecSummary(args({ input: { ...INPUT, requests } }));
    expect(p.posting?.summary).toEqual({ 'เหลือหา (ใบ)': 3, 'เริ่มหาแล้ว (ใบ)': 2, 'เริ่มหาแล้ว มีรายชื่อแล้ว (ใบ)': 1, 'เริ่มหาแล้ว ยังไม่มีรายชื่อ (ใบ)': 1, 'ยังไม่เริ่มหา (ใบ)': 1 });
    expect([p.posting?.summary['เหลือหา (ใบ)'], p.posting?.summary['ยังไม่เริ่มหา (ใบ)']]).toEqual([boxOf(p, 'reqCount')?.value, boxOf(p, 'reqIdle')?.value]);
    expect(p.posting?.rows.length).toBe(9);
    expect(p.posting?.rows.filter((r) => Number(r.ใบ) > 0)).toEqual([
      { หลักฐานการออกหาคน: 'โพสต์แล้ว มีรายชื่อ', เริ่มหา: 'เริ่มแล้ว', ใบ: 1, อัตรา: 2, 'มีรายชื่อแล้ว (ใบ)': 1 },
      { หลักฐานการออกหาคน: 'โพสต์แล้ว ยังไม่มีรายชื่อ', เริ่มหา: 'เริ่มแล้ว', ใบ: 1, อัตรา: 1, 'มีรายชื่อแล้ว (ใบ)': 0 },
      { หลักฐานการออกหาคน: 'ไม่พบหลักฐานการออกหาคน', เริ่มหา: 'ยังไม่เริ่มหา', ใบ: 1, อัตรา: 5, 'มีรายชื่อแล้ว (ใบ)': 0 },
    ]);
    expect(p.posting?.rows.reduce((a, r) => a + Number(r.อัตรา), 0)).toBe(boxOf(p, 'reqPos')?.value);
    // "ประกาศแล้วมีคนสมัครไหม" = ก้อนแยก (ประกาศ = ขึ้นหน้าประกาศ คนละเรื่องกับโพสต์) · ประกาศแล้ว + ยังไม่ประกาศ = เหลือหา (ใบ)
    expect(p.announce).toEqual({ 'เหลือหา (ใบ)': 3, ประกาศแล้ว: 2, 'ประกาศแล้ว มีคนกรอก': 1, 'ประกาศแล้ว ไม่มีคนกรอก': 1, ยังไม่ประกาศ: 1, 'ยังไม่ประกาศ แต่มีคนกรอกแล้ว': 0 });
    expect(Number(p.announce?.ประกาศแล้ว) + Number(p.announce?.ยังไม่ประกาศ)).toBe(boxOf(p, 'reqCount')?.value);
    expect(Object.keys(p).indexOf('announce')).toBeLessThan(Object.keys(p).indexOf('posting'));
    expect(buildExecSummary(args({ input: { ...INPUT, requests: null } })).announce).toBeUndefined();
    // ใบขอยังอ่านไม่ได้ / ชั้นวัน = ไม่มีก้อนนี้ (ไม่ขึ้น 0)
    expect(buildExecSummary(args({ input: { ...INPUT, requests: null } })).posting).toBeUndefined();
    expect(buildExecSummary(args({ level: at({ day: '2026-11-20' }) })).posting).toBeUndefined();
  });

  it('คนในแต่ละขั้นไปไหนต่อ · ยกเลิกเพราะอะไร · ตรงเกณฑ์ใบขอ · แจ้งเข้า · ลูกค้า · งานรายวัน', () => {
    expect(s.next?.find((n) => n.from === 'AI สนใจ')).toEqual({ from: 'AI สนใจ', total: 3, parts: [{ label: 'ติดต่อได้', value: 1 }, { label: 'ติดต่อไม่ได้', value: 1, reasons: 'ไม่รับสาย 1' }, { label: 'รอโทร', value: 1 }] });
    // นัดแล้วไม่มา ระบบไม่ได้เก็บเหตุผล = ไม่มีช่อง reasons (ผู้ช่วยต้องตอบว่าไม่ได้เก็บ ไม่ยกเหตุผลของขั้นอื่นมาแทน)
    expect(s.next?.find((n) => n.from === 'นัดได้')?.parts.every((p) => !('reasons' in p))).toBe(true);
    expect(s.cancelReasons).toEqual([{ ยกเลิกเพราะ: 'ลูกค้าหาคนเองได้', อัตรา: 2, ใบ: 1 }]);
    expect(s.fit?.stages[0]).toEqual({ ขั้น: 'รายชื่อ', ทั้งหมด: 4, อำเภอเดียวกับงาน: 1, จังหวัดเดียวกับงาน: 1, ภาคเดียวกับงาน: 0, คนละภาคกับงาน: 0, เทียบพื้นที่ไม่ได้: 2, อายุไม่เข้าเกณฑ์: 1, เพศไม่ตรงใบขอ: 0 });
    expect(s.fit?.areaUnknownWhy.reduce((a, w) => a + w.people, 0)).toBe(boxOf(s, 'fitUnknown')?.value);
    expect(s.informed).toEqual([{ BU: 'LBD', ช่องทาง: expect.any(String), ใครหามา: 'คิว', กรอกใบ: '10 พ.ย. 2569', แจ้งเข้า: '18 พ.ย. 2569', ใช้กี่วัน: 8 }]);
    expect(s.topCustomers?.[0]).toEqual({ ลูกค้า: 'ธนาคารตัวอย่าง จำกัด (มหาชน)', ขอใหม่: 8, หาได้แล้ว: 1, ยกเลิก: 2, 'เหลือหา (อัตรา)': 7, 'เหลือหา (ใบ)': 2, 'ค้างนานสุด (วัน)': 12 });
    expect(s.topPositions?.[0]).toMatchObject({ ตำแหน่ง: 'ขับรถ', 'เหลือหา (อัตรา)': 7 });
    expect([s.days?.['2026-11-19'], s.days?.['2026-11-20'], Object.keys(s.days ?? {}).length]).toEqual([3, 11, 20]);
    expect(s.months).toBeUndefined();
  });

  it('วันที่ในตารางเขียนแบบที่จอใช้ — รูป ค.ศ. เหลือเฉพาะค่าที่ใช้ส่งคำสั่ง (window.from/to · คีย์ของ days)', () => {
    const { generatedAt: _g, window: _w, days: _d, ...rest } = buildExecSummary(args({ roster: [{ userId: 'a1f0c7d2-3b4e-4f5a-8c6d-7e8f9a0b1c2d', name: 'โอ๊ต', bu: 'LBD', lastDay: '2026-10-28' }] }));
    expect(JSON.stringify(rest)).not.toMatch(/20\d\d-\d\d-\d\d/);
    const { generatedAt: _g2, window: _w2, days: _d2, ...bu } = buildExecSummary(args({ level: at({ bu: 'LBD' }) }));
    expect(JSON.stringify(bu)).not.toMatch(/20\d\d-\d\d-\d\d/);
  });

  it('ไม่มี id ผู้สมัคร · เล็กกว่าเพดานผลอ่าน', () => {
    const json = JSON.stringify(s);
    expect(json).not.toMatch(/app-[0-9a-f]{6}/);
    expect(json.length).toBeLessThan(EXEC_SUMMARY_MAX);
  });
});

describe('buildExecSummary — ชั้น BU · คน · วัน · กล่องที่ขอ', () => {
  it('ชั้น BU: รายคนครบสาย (คนที่ช่วงนี้ไม่มีงานก็อยู่) + รายชื่ออยู่ที่ใคร', () => {
    const roster = [{ userId: 'a1f0c7d2-3b4e-4f5a-8c6d-7e8f9a0b1c2d', name: 'โอ๊ต', bu: 'LBD', lastDay: '2026-10-28' }];
    const s = buildExecSummary(args({ level: at({ bu: 'LBD' }), roster }));
    expect(s.level).toEqual(['ทั้งหมด', 'LBD']);
    expect(s.byBu).toBeUndefined();
    expect(s.people?.[0]).toEqual({ คน: 'คิว', ทำล่าสุด: '20 พ.ย. 2569', 'ไม่มีงานมา (วัน)': 0, งานที่ทำ: 10, ...chain([3, 3, 3, 1, 1, 1, 1]), 'ทำ 100 งาน ได้กี่รายชื่อ': 30 });
    expect(s.people?.map((p) => [p.คน, p.งานที่ทำ, p.รายชื่อ, p.ทำล่าสุด, p['ไม่มีงานมา (วัน)']])).toEqual([['คิว', 10, 3, '20 พ.ย. 2569', 0], ['โอ๊ต', 0, 0, '28 ต.ค. 2569', 22]]);
    expect(s.peopleAverage).toMatchObject({ คนทำงาน: 1, งานที่ทำ: 10, รายชื่อ: 3 });
    expect(s.hold).toEqual([{ คน: 'แป๋ม', รับมาโทร: 2, ติดต่อได้: 1, ติดต่อไม่ได้: 1, ยังไม่ลงผล: 0, 'ติดต่อได้ %': 50, 'ค้างนานสุด (วัน)': null }]);
    expect(s.waiting).toEqual([]);
    expect(s.announce).toMatchObject({ 'เหลือหา (ใบ)': 1, ประกาศแล้ว: 1, ยังไม่ประกาศ: 0 });
    expect(boxOf(s, 'cNames')?.value).toBe(scaleBoxOf(scaleSections(INPUT, at({ bu: 'LBD' })), 'cNames')?.value);
    expect(hasBareNumberArray(s)).toBe(false);
    // คนของ BU อื่นที่หารายชื่อให้ BU นี้ = บอกว่านอก BU
    const cross = buildExecSummary(args({ input: { ...INPUT, cohort: [...COHORT, fact('app-77b20b1c', { bu: 'LBA', jobId: 'siamraj-sql:LAO6911027', bringer: 'คิว' })] }, level: at({ bu: 'LBA' }) }));
    expect(cross.people?.find((p) => p.คน === 'คิว')).toMatchObject({ สังกัด: 'นอก LBA', งานที่ทำ: null, รายชื่อ: 1 });
  });

  it('ชั้นคน: รายชื่อที่หามาแยกช่องทาง + ยอดรวมทุก BU เมื่อหาให้หลาย BU · ชั้นวัน: ใครทำอะไร เทียบกับวันก่อน', () => {
    const who = buildExecSummary(args({ level: at({ bu: 'LBD', who: 'คิว' }) }));
    expect(who.level).toEqual(['ทั้งหมด', 'LBD', 'คิว']);
    expect(who.channels?.every((c) => typeof c.ช่องทาง === 'string' && c.BU === 'LBD')).toBe(true);
    expect(who.channels?.reduce((a, c) => a + Number(c.รายชื่อ), 0)).toBe(boxOf(who, 'cNames')?.value);
    expect([who.people, who.allBus]).toEqual([undefined, undefined]);
    const cross0: ScaleInput = { ...INPUT, cohort: [...COHORT, fact('app-77b20b1c', { bu: 'LBA', jobId: 'siamraj-sql:LAO6911027', bringer: 'คิว', channelLabel: 'Webjob · Jobthai' })] };
    const cross = buildExecSummary(args({ input: cross0, level: at({ bu: 'LBD', who: 'คิว' }) }));
    // กล่องของชั้นยังนับเฉพาะ LBD (เหมือนจอ) · ยอดรวมทุก BU อยู่ก้อนแยก และทุกทางบวกได้เท่ากัน
    expect(boxOf(cross, 'cNames')?.value).toBe(3);
    expect(cross.allBus?.byBu).toEqual([{ BU: 'LBD', รายชื่อ: 3 }, { BU: 'LBA', รายชื่อ: 1 }]);
    expect(cross.allBus?.['รายชื่อรวมทุก BU']).toBe(4);
    expect(cross.allBus?.channels.reduce((a, c) => a + Number(c.รายชื่อ), 0)).toBe(4);
    expect(cross.allBus?.channels.map((c) => [c.ช่องทาง, c.BU])).toContainEqual(['Jobthai', 'ทุก BU']);
    // ถามถึงคนด้วยชื่ออย่างเดียว (ไม่ระบุ BU) = ทั้งชั้นนับรวมทุก BU ของคนนั้น + แยก BU ให้ทานกับจอ (ถามซ้ำบนเว็บจริง: ตอบเฉพาะ BU ที่สังกัด = ไม่ครบ)
    const all = buildExecSummary(args({ input: cross0, level: at({ who: 'คิว' }) }));
    expect(all.level).toEqual(['ทั้งหมด', 'คิว']);
    expect([boxOf(all, 'cNames')?.value, boxOf(all, 'wSum')?.value]).toEqual([4, 10]);
    expect(all.byBu).toEqual([{ BU: 'LBD', สังกัด: 'สังกัด BU นี้', รายชื่อ: 3 }, { BU: 'LBA', สังกัด: 'หารายชื่อให้ BU นี้', รายชื่อ: 1 }]);
    expect(all.byBu?.reduce((a, r) => a + Number(r.รายชื่อ), 0)).toBe(boxOf(all, 'cNames')?.value);
    expect(all.channels?.every((c) => c.BU === 'ทุก BU')).toBe(true);
    expect(all.channels?.reduce((a, c) => a + Number(c.รายชื่อ), 0)).toBe(4);
    expect([all.people, all.hold, all.waiting, all.allBus, all.topCustomers]).toEqual([undefined, undefined, undefined, undefined, undefined]);
    expect(hasBareNumberArray(all)).toBe(false);
    // คนที่หาให้ BU เดียว = byBu แถวเดียว เท่ากล่อง
    expect(buildExecSummary(args({ level: at({ who: 'ฟอร์ด' }) })).byBu).toEqual([{ BU: 'LBA', สังกัด: 'สังกัด BU นี้', รายชื่อ: 1 }]);
    const day = buildExecSummary(args({ level: at({ day: '2026-11-20' }) }));
    expect([day.window.text, day.window.compareWith]).toEqual(['20 พ.ย. 2569', 'วันก่อน 19 พ.ย. 2569']);
    expect(day.dayPeople).toEqual([
      { คน: 'คิว', BU: 'LBD', รวม: 7, 'Gen link': 5, โพสต์แล้ว: 0, Scrap: 2, Autopost: 0, ลงผลติดต่อ: 0, ลงนัด: 0 },
      { คน: 'ฟอร์ด', BU: 'LBA', รวม: 4, 'Gen link': 4, โพสต์แล้ว: 0, Scrap: 0, Autopost: 0, ลงผลติดต่อ: 0, ลงนัด: 0 },
    ]);
    expect(day.dayPeople?.reduce((a, r) => a + Number(r.รวม), 0)).toBe(boxOf(day, 'wSum')?.value);
    expect(boxOf(day, 'wSum')).toMatchObject({ value: 11, prev: 3 });
    expect(hasBareNumberArray(day)).toBe(false);
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
    expect(cancelled.requests).toEqual([{ เลขที่ใบขอ: 'OPL6910100', ตำแหน่ง: 'ขับรถ', หน่วยงาน: 'ธนาคารตัวอย่าง จำกัด (มหาชน)', 'ยกเลิก (อัตรา)': 2, 'ค้าง (วัน)': 12, เจ้าหน้าที่สรรหา: 'คิว', ยกเลิกเพราะ: 'ลูกค้าหาคนเองได้' }]);
    const open = buildExecSummary(args({ level: at({ bu: 'LBD' }), box: 'reqPos' }));
    expect(open.requests?.map((r) => [r.เลขที่ใบขอ, r['เหลือหา (อัตรา)'], r.เริ่มหา])).toEqual([['OPL6911006', 2, 'เริ่มแล้ว']]);
    // รายใบเกิน 25 ใบ = ส่ง 25 ใบแรก (ค้างนานสุดก่อน) และบอกจำนวนทั้งหมด — ยอดของกล่องยังครบ
    const many = Array.from({ length: 27 }, (_, i) => req(`OPL69110${String(40 + i)}`, 'LBD', 'คิว', [0, 1, 0, 0, 1], { ageDays: i }));
    const long = buildExecSummary(args({ input: { ...INPUT, requests: many }, level: at({ bu: 'LBD' }), box: 'reqCount' }));
    expect([long.requests?.length, long.requests?.[0]['ค้าง (วัน)'], boxOf(long, 'reqCount')?.value]).toEqual([25, 26, 27]);
    expect(long.errors).toEqual(['รายใบ (ค้างนานสุดก่อน) มี 27 แถว ส่งมา 25 แถวแรก']);
    expect(open.errors).toEqual([]);
    // ชั้นทั้งหมดยังไม่มีรายใบ (ต้องลงชั้น BU) · กล่องที่ไม่มีในชั้นนั้นบอกตรง ๆ
    expect(buildExecSummary(args({ box: 'reqPos' })).requests).toBeUndefined();
    expect(buildExecSummary(args({ level: at({ day: '2026-11-20' }), box: 'fine' })).errors).toEqual(['ชั้นนี้ไม่มีกล่อง fine']);
  });

  it('ช่วงที่ครอบหลายเดือน = มีตารางเทียบเดือน รวมทุกเดือน = กล่อง', () => {
    const wide: ScaleInput = { ...INPUT, from: '2026-10-15', cohort: [...COHORT, fact('app-55aa0c01', { createdAt: '2026-10-20T03:00:00.000Z' })], staff: [...STAFF, row(Q, 'คิว', 'LBD', '2026-10-20', { links: 3 })] };
    const s = buildExecSummary(args({ input: wide, prev: null, prevCohortOk: false }));
    expect(s.months).toEqual([
      { เดือน: 'ต.ค. 69 · 15–31', งานที่ทำ: 3, ...chain([1, 0, 0, 0, 0, 0, 0]) },
      { เดือน: 'พ.ย. 69 · 1–20', งานที่ทำ: 14, ...chain([4, 3, 3, 1, 1, 1, 1]) },
    ]);
    expect(s.months?.reduce((a, m) => a + Number(m.งานที่ทำ ?? 0), 0)).toBe(boxOf(s, 'wSum')?.value);
  });

  it('ข้อมูลเยอะเกินเพดาน = ตัดก้อนรองออกและบอกไว้ ไม่ตัดเงียบ · กล่องเลขอยู่ครบ', () => {
    // ชื่อยาวผิดปกติ 400 คน — ของจริงสั้นกว่านี้มาก (ด่านนี้กันกรณีสุดขอบ)
    const long = 'ชื่อที่ยาวมากเกินกว่าที่ควรจะเป็นในระบบจริง '.repeat(4);
    const many = Array.from({ length: 400 }, (_, i) => fact(`app-big${String(i).padStart(5, '0')}`, { bringer: `${long}${i}`, channelLabel: `Facebook · ${long}${i} · กลุ่ม ${i}`, informed: true, informedAt: '2026-11-18' }));
    const staff = many.map((f, i) => row(`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, f.bringer as string, 'LBD', '2026-11-20', { links: 1 }));
    const s = buildExecSummary(args({ input: { ...INPUT, cohort: many, staff }, level: at({ bu: 'LBD' }), box: 'cNames' }));
    expect(JSON.stringify(s).length).toBeLessThanOrEqual(EXEC_SUMMARY_MAX);
    expect(s.errors.join(' ')).toContain('ข้อมูลเยอะเกิน ตัดก้อนนี้ออก');
    // ตารางที่ยาวเกินจำนวนแถวที่ส่ง บอกเสมอว่ามีทั้งหมดกี่แถว (ผู้ช่วยจะได้ไม่ตอบว่ามีแค่นี้)
    expect(s.errors).toEqual(expect.arrayContaining(['ตารางแยกตามคน มี 400 แถว ส่งมา 30 แถวแรก', 'รายชื่อ ใครหามา มี 401 แถว ส่งมา 40 แถวแรก']));
    expect(s.sections.flatMap((x) => x.boxes).length).toBeGreaterThan(30);
    // ยังเกินหลังตัดก้อนรอง = ตัดท้ายตาราง แล้วบอกจำนวนแถวที่เหลือ (แถวบนสุด = มากสุด ยังอยู่)
    expect(s.errors.join(' ')).toMatch(/ตารางยาวเกิน ตัดท้ายออก: .*people เหลือ \d+ แถวแรก/);
    expect(s.people?.length).toBeGreaterThanOrEqual(5);
    expect(s.people?.length).toBeLessThan(30);
    // ชั้นทั้งหมดก็ไม่เกิน (ทุกคนแบบย่อ ไม่เกิน 40 แถว)
    const top = buildExecSummary(args({ input: { ...INPUT, cohort: many, staff } }));
    expect([JSON.stringify(top).length <= EXEC_SUMMARY_MAX, top.people?.length]).toEqual([true, 40]);
  });
});

describe('buildExecRequest — ใบขอใบเดียว ทำอะไรไปแล้ว (ก้อนเดียวกับจอของแท็บ Scale ลง)', () => {
  const WINDOW = { from: '2026-11-01', to: '2026-11-20', days: 20, text: '1–20 พ.ย. 2569', compareWith: null };
  const work = { links: 3, manualPosted: 2, autopost: 0, scrap: 1, contacts: 4, appts: 1 };
  const events: RequestEvent[] = [
    { day: '2026-10-05', kind: 'links', who: 'คิว', detail: 'Facebook Group', n: 3 },
    { day: '2026-10-06', kind: 'names', who: null, detail: 'Facebook Group', n: 2 },
    { day: '2026-10-07', kind: 'contacts', who: 'แป๋ม', detail: 'ติดต่อไม่ได้', n: 4 },
  ];
  const job: RequestTimelineJob = { done: { work, chain: [2, 2, 1, 0, 0, 0, 0] }, events };
  const cancelledReq = req('OPL6910100', 'LBD', 'คิว', [2, 0, 0, 2, 0], {
    day: '2026-10-01',
    requested: 2,
    releasedAt: '2026-10-02T03:00:00.000Z',
    releasedBy: 'kiw.s@siamraj.example',
    flow: { carryIn: 2, new: 0, filled: 0, cancelled: 2, remaining: 0, fillDays: [], cancelDays: [['2026-11-05', 2]] },
  });
  const nameOf = scaleStaffNamer([{ login: 'kiw.s', name: 'คิว' }]);
  const base = { requestNo: 'OPL6910100', nameOf, window: WINDOW, generatedAt: '2026-11-20T05:00:00.000Z', errors: [] as string[] };

  it('ใบในช่วง: ยอดอัตรา + ยกเลิกเพราะอะไร + งานที่ทำ/รายชื่อตั้งแต่ขอ + ไทม์ไลน์ เก่า → ใหม่ · ไม่มีอีเมลของคนประกาศ', () => {
    const out = buildExecRequest({ ...base, request: cancelledReq, job, cancelReason: 'ลูกค้าหาคนเองได้' });
    expect(out.request).toEqual({
      เลขที่ใบขอ: 'OPL6910100',
      BU: 'LBD',
      ตำแหน่ง: 'ขับรถ',
      หน่วยงาน: 'ธนาคารตัวอย่าง จำกัด (มหาชน)',
      เจ้าหน้าที่สรรหา: 'คิว',
      'ค้าง (วัน)': 12,
      หลักฐานการออกหาคน: 'โพสต์แล้ว ยังไม่มีรายชื่อ',
      ยกเลิกเพราะ: 'ลูกค้าหาคนเองได้',
      'ใบขอ (อัตรา ตามช่วง)': { ยกมา: 2, ขอใหม่: 0, หาได้แล้ว: 0, ยกเลิก: 2, เหลือหา: 0 },
      'งานที่ทำ ตั้งแต่ขอ': { รวม: staffWorkTotal(work), 'Gen link': 3, โพสต์แล้ว: 2, Scrap: 1, Autopost: 0, ลงผลติดต่อ: 4, ลงนัด: 1 },
      'รายชื่อ ตั้งแต่ขอ': chain([2, 2, 1, 0, 0, 0, 0]),
      timeline: [
        { วันที่: '1 ต.ค. 2569', ทำอะไร: 'ขอมา', จำนวน: '2 อัตรา' },
        { วันที่: '2 ต.ค. 2569', ทำอะไร: 'ประกาศ', ใคร: 'คิว' },
        { วันที่: '5 ต.ค. 2569', ทำอะไร: 'Gen link', จำนวน: '3 ลิงก์', ใคร: 'คิว', รายละเอียด: 'Facebook Group' },
        { วันที่: '6 ต.ค. 2569', ทำอะไร: 'รายชื่อเข้า', จำนวน: '2 คน', รายละเอียด: 'Facebook Group' },
        { วันที่: '7 ต.ค. 2569', ทำอะไร: 'ลงผลติดต่อ', จำนวน: '4 ครั้ง', ใคร: 'แป๋ม', รายละเอียด: 'ติดต่อไม่ได้' },
        { วันที่: '5 พ.ย. 2569', ทำอะไร: 'ยกเลิก', จำนวน: '2 อัตรา', รายละเอียด: 'ลูกค้าหาคนเองได้' },
      ],
    });
    expect(out.errors).toEqual([]);
    expect(JSON.stringify(out)).not.toContain('@');
    expect(hasBareNumberArray(out)).toBe(false);
  });

  it('ใบที่จบก่อนช่วง (ไม่มีแถวใบขอ) = มีแต่งานที่ทำ/รายชื่อ/ไทม์ไลน์ ไม่แต่งยอดอัตรา · อ่านงานไม่ได้ = บอกเหตุ ไม่ขึ้น 0', () => {
    const old = buildExecRequest({ ...base, request: null, job, cancelReason: null, errors: ['ใบ OPL6910100 ไม่อยู่ในใบขอของช่วง'] });
    expect(Object.keys(old.request ?? {})).toEqual(['เลขที่ใบขอ', 'งานที่ทำ ตั้งแต่ขอ', 'รายชื่อ ตั้งแต่ขอ', 'timeline']);
    expect(old.request?.timeline.map((e) => e.ทำอะไร)).toEqual(['Gen link', 'รายชื่อเข้า', 'ลงผลติดต่อ']);
    expect(old.errors).toEqual(['ใบ OPL6910100 ไม่อยู่ในใบขอของช่วง']);
    const blind = buildExecRequest({ ...base, request: cancelledReq, job: null, cancelReason: null });
    expect([blind.request?.['งานที่ทำ ตั้งแต่ขอ'], blind.request?.['รายชื่อ ตั้งแต่ขอ']]).toEqual([null, null]);
    expect(blind.request?.timeline.map((e) => e.ทำอะไร)).toEqual(['ขอมา', 'ประกาศ', 'ยกเลิก']);
    expect(blind.errors).toEqual(['อ่านงานที่ทำกับใบนี้ไม่ได้ — มีแต่ยอดอัตราของใบ']);
  });

  it('ไทม์ไลน์ยาวมาก = ส่งแถวล่าสุด + หลักของใบครบ แล้วบอกว่าตัดไปกี่แถว · ไม่เกินเพดานผลอ่าน', () => {
    const many: RequestEvent[] = Array.from({ length: 400 }, (_, i) => ({ day: `2026-10-${String(3 + (i % 28)).padStart(2, '0')}`, kind: 'contacts', who: `คนที่ ${i}`, detail: 'ติดต่อไม่ได้ เพราะไม่รับสายหลายครั้ง', n: 1 }));
    const out = buildExecRequest({ ...base, request: cancelledReq, job: { done: job.done, events: many }, cancelReason: 'ลูกค้าหาคนเองได้' });
    const marks = out.request?.timeline.filter((e) => ['ขอมา', 'ประกาศ', 'ยกเลิก'].includes(String(e.ทำอะไร))).length;
    expect(marks).toBe(3);
    expect((out.request?.timeline.length ?? 0) - 3).toBeLessThanOrEqual(EXEC_REQUEST_ROWS);
    expect(JSON.stringify(out).length).toBeLessThanOrEqual(EXEC_SUMMARY_MAX + 300);
    expect(out.errors.join(' ')).toMatch(/ไทม์ไลน์มี 403 แถว ส่งมา \d+ แถว \(ตัดแถวเก่าสุดออก \d+ แถว\)/);
    // ยอดรวมยังครบ ไม่ขึ้นกับแถวที่ตัด
    expect(out.request?.['งานที่ทำ ตั้งแต่ขอ']?.รวม).toBe(staffWorkTotal(work));
  });
});
