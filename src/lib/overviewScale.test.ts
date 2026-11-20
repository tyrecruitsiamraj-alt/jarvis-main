/**
 * แท็บ "Scale ลง" ของหน้าภาพรวม (เจ้าของ 20 พ.ย. 2569) — 🔴 ด่าน:
 * แถวรวมของทุกตาราง = กล่องเลขของชั้นนั้น · แถวที่แยกจากกล่อง บวกกันได้เท่ากล่อง (เจ้าของไม่เชื่อเลขที่ไม่ลงตัว)
 * ยังโหลดไม่ได้ = ไม่มีเลข (ไม่ใช่ 0) · ชั้นใน URL ที่ข้ามชั้นแม่ต้องถอยกลับ
 * ข้อมูลรูปเดียวกับของจริง: เลขใบ `OPL69…` · id ใบสมัคร · BU `LBD/LBA/LM` · ใบที่ไม่มี BU
 */
import { describe, expect, it } from 'vitest';
import type { RecruitAppFact } from './recruitOverviewTypes';
import type { StaffActivityRow } from './staffActivity';
import type { StuckRequest } from './recruitStuck';
import type { MoneyRequest } from './homeMoney';
import { BU_UNKNOWN } from './recruitAudience';
import { NO_RECRUITER_LABEL } from './recruitStuck';
import {
  SCALE_ROOT,
  SCALE_VERSUS_LABEL,
  bkkDayOf,
  scaleBoxOf,
  scaleBreakdown,
  scaleBuTable,
  scaleBus,
  scaleChainTable,
  scaleChannelOf,
  scaleChildren,
  scaleClockedRows,
  scaleCrumbs,
  scaleDayCount,
  scaleDaySeries,
  scaleDayTable,
  scaleDays,
  scaleGroupOf,
  scaleHoldTable,
  scaleLevelFromParams,
  scaleLevelToParams,
  scaleMoneyOf,
  scaleOpenRequests,
  scalePenaltyRows,
  scalePeopleTable,
  scaleSections,
  scaleTopRequests,
  scaleUserIdOf,
  type ScaleBoxKey,
  type ScaleInput,
  type ScaleLevel,
} from './overviewScale';

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
  // LBD · คิวหามา · Facebook Group
  fact('app-9f1c0a11', { ...yes, aiAnswerAt: '2026-11-10T01:00:00.000Z', staffFirstAt: '2026-11-10T05:00:00.000Z', logOk: true, appointmentAt: '2026-11-12T03:00:00.000Z', attendance: 'showed', claimedBy: 'แป๋ม', claimedAt: '2026-11-10T02:00:00.000Z', informed: true, phoneKey: '811111111' }),
  fact('app-9f1c0a12', { ...yes, createdAt: '2026-11-11T02:00:00.000Z', aiAnswerAt: '2026-11-11T01:00:00.000Z', staffFirstAt: '2026-11-11T11:00:00.000Z', logOk: false, claimedBy: 'แป๋ม', claimedAt: '2026-11-11T03:00:00.000Z', phoneKey: '822222222' }),
  fact('app-9f1c0a13', { ...yes, createdAt: '2026-11-15T02:00:00.000Z', aiAnswerAt: '2026-11-15T02:30:00.000Z', claimedBy: 'แป๋ม', claimedAt: '2026-11-15T03:00:00.000Z', phoneKey: '833333333' }),
  fact('app-9f1c0a14', { createdAt: '2026-11-12T03:00:00.000Z', calledByAi: true, aiAnswer: 'said_no', channelLabel: 'Facebook · Facebook Group · พนักงานขับรถมืออาชีพ', phoneKey: '811111111' }),
  fact('app-9f1c0a15', { createdAt: '2026-11-12T04:00:00.000Z', phoneOk: false, channelLabel: 'Facebook · Facebook Group · พนักงานขับรถมืออาชีพ' }),
  // LBD · คิวหามา · Tiktok Live — กรอก 01:30 ของวันที่ 20 (เวลาไทย)
  fact('app-9f1c0a16', { ...yes, createdAt: '2026-11-19T18:30:00.000Z', aiAnswerAt: '2026-11-19T19:00:00.000Z', channelLabel: 'Tiktok · Tiktok Live', phoneKey: '844444444' }),
  // LBD · ดึงจาก iRecruit
  fact('app-9f1c0a17', { createdAt: '2026-11-05T02:00:00.000Z', channelLabel: 'iRecruit', bringer: 'iRecruit', postSource: null, informed: true, phoneKey: '855555555' }),
  // LBA
  fact('app-77b20b18', { ...yes, bu: 'LBA', jobId: 'siamraj-sql:LAO6911027', createdAt: '2026-11-06T01:00:00.000Z', aiAnswerAt: '2026-11-06T02:00:00.000Z', staffFirstAt: '2026-11-06T04:00:00.000Z', logOk: true, claimedBy: 'น้ำ', claimedAt: '2026-11-06T03:00:00.000Z', channelLabel: 'Webjob · Jobthai', bringer: 'ฟอร์ด', phoneKey: '866666666' }),
  fact('app-77b20b19', { bu: 'LBA', jobId: 'siamraj-sql:LAO6911027', createdAt: '2026-11-06T05:00:00.000Z', calledByAi: true, aiAnswer: 'no_pickup', channelLabel: 'Webjob · Jobthai', bringer: 'ฟอร์ด', phoneKey: '877777777' }),
  fact('app-77b20b1a', { bu: 'LBA', jobId: 'siamraj-sql:LAO6911027', createdAt: '2026-11-18T05:00:00.000Z', channelLabel: 'Scrap · JobBKK', bringer: 'So Scraping', postSource: null, phoneKey: '899999999' }),
  // ใบที่ไม่มี BU · สมัครเองที่หน้าเว็บ
  fact('app-0c33d21b', { bu: null, jobId: null, createdAt: '2026-11-02T02:00:00.000Z', channelLabel: null, bringer: null, postSource: null }),
];

const row = (userId: string, name: string, bu: string, day: string, o: Partial<StaffActivityRow> = {}): StaffActivityRow => ({ userId, name, bu, day, autopost: 0, scrap: 0, links: 0, manualPosted: 0, contacts: 0, appts: 0, ...o });
const Q = '5f4b2fcd-7f64-4bb8-92cf-7c118d9a0bef';
const STAFF: StaffActivityRow[] = [
  row(Q, 'คิว', 'LBD', '2026-11-10', { links: 10, manualPosted: 4, autopost: 1 }),
  row(Q, 'คิว', 'LBD', '2026-11-20', { links: 5, scrap: 2 }),
  row('d3d2bc64-fbc1-48da-8411-f7e789596a04', 'แป๋ม', 'LBD', '2026-11-10', { contacts: 6, appts: 1 }),
  row('d3d2bc64-fbc1-48da-8411-f7e789596a04', 'แป๋ม', 'LBD', '2026-11-19', { contacts: 3 }),
  row('0a8f0b5e-11d2-4c7e-9a61-2b1f6f0f9c01', 'ฟอร์ด', 'LBA', '2026-11-06', { links: 4, autopost: 2 }),
  row('7c1e2d3f-5a6b-4c8d-9e0f-1a2b3c4d5e6f', 'น้ำ', 'LBA', '2026-11-06', { contacts: 2 }),
];

const req = (no: string, bu: string, flow: [number, number, number, number, number], o: Record<string, unknown> = {}): StuckRequest =>
  ({
    requestNo: no,
    jobId: `siamraj-sql:${no}`,
    bu,
    unitName: 'ธนาคารกรุงศรีอยุธยา  จำกัด (มหาชน)',
    position: 'ขับรถ',
    recruiter: 'คิว',
    requested: flow[1],
    filled: 0,
    cancelled: flow[3],
    remaining: flow[4],
    applications: 0,
    ageDays: 12,
    signals: { post: null, released: false, links: 0 },
    flow: { carryIn: flow[0], new: flow[1], filled: flow[2], cancelled: flow[3], remaining: flow[4], fillDays: [], cancelDays: [] },
    ...o,
  }) as unknown as StuckRequest;
const REQUESTS: StuckRequest[] = [
  req('OPL6911006', 'LBD', [0, 3, 1, 0, 2], { filled: 1, applications: 5, signals: { post: 'posted', released: true, links: 2 } }),
  req('OPL6910100', 'LBD', [2, 0, 0, 1, 1], { unitName: 'KS สาขาตัวอย่าง', position: 'พนักงานขับรถ ส่วนกลาง', ageDays: 40 }),
  req('OPL6911035', 'LBD', [0, 1, 0, 0, 1], { recruiter: null, ageDays: 3 }),
  req('LAO6911027', 'LBA', [0, 5, 0, 0, 5], { unitName: 'บริษัท ตัวอย่างค้าปลีก จำกัด', position: 'ช่างซ่อมบำรุง', recruiter: 'ฟอร์ด', ageDays: 1, signals: { post: 'pending', released: false, links: 0 } }),
  req('LAO6910011', 'LBA', [1, 0, 1, 0, 0], { unitName: 'บริษัท ตัวอย่างอาคาร จำกัด', position: null, recruiter: 'ฟอร์ด', filled: 1 }),
  req('LMO6911010', 'LM', [4, 0, 0, 0, 4], { unitName: 'หน่วยงานตัวอย่างดูแลสวน', position: 'คนสวน', recruiter: null, ageDays: 200 }),
];

const money = (no: string, bu: string, o: { fine?: number; deduct?: number; days?: number; speed?: number | null; late?: number | null } = {}): MoneyRequest =>
  ({
    requestNo: no,
    bu,
    unit: 'บริษัท ตัวอย่างการเงิน จำกัด',
    position: 'ขับรถ',
    clocked: o.speed != null,
    speedDays: o.speed ?? null,
    lateDays: o.late ?? null,
    amount: { need: { days: o.days ?? 0, personDays: 0, fine: o.fine ?? 0, deduct: o.deduct ?? 0, coveredPersonDays: 0 }, key: { days: 0, personDays: 0, fine: 0, deduct: 0, coveredPersonDays: 0 } },
  }) as unknown as MoneyRequest;
const MONEY: MoneyRequest[] = [
  money('OPL6911006', 'LBD', { fine: 15000, deduct: 7500, days: 15 }),
  money('OPL6907006', 'LBD', { speed: 124, late: 32 }),
  money('OPL6908010', 'LBD', { speed: 20, late: 0 }),
  money('LAO6911027', 'LBA', { deduct: 108333.4, days: 20 }),
  money('LAO6910006', 'LBA', { speed: 32, late: 0 }),
  // สมุดค่าปรับส่ง BU เป็นรหัสยาวของไซต์ (LML = LM) — ต้องนับเข้า LM ไม่ใช่ BU ใหม่
  money('LMO6911010', 'LML', { fine: 13000, days: 13 }),
];

const INPUT: ScaleInput = { cohort: COHORT, staff: STAFF, requests: REQUESTS, money: MONEY, from: '2026-11-01', to: '2026-11-20', today: '2026-11-20', now: Date.parse('2026-11-20T05:00:00.000Z') };
const at = (o: Partial<ScaleLevel> = {}): ScaleLevel => ({ ...SCALE_ROOT, ...o });
const val = (lv: ScaleLevel, key: ScaleBoxKey, inp: ScaleInput = INPUT) => scaleBoxOf(scaleSections(inp, lv), key)?.value ?? null;
const sumOf = (list: ReadonlyArray<number | null>) => list.reduce<number>((a, v) => a + (v ?? 0), 0);
const CHAIN: ScaleBoxKey[] = ['cNames', 'cAiCalled', 'cAiYes', 'cStaffOk', 'cBooked', 'cShowed', 'cInformed'];

describe('กล่องเลขของชั้น "ทั้งหมด"', () => {
  it('ใบขอ: ยกมา + ขอใหม่ − หาได้แล้ว − ยกเลิก = เหลือหา และนับใบที่ยังไม่เริ่มหา', () => {
    const s = scaleSections(INPUT, at());
    expect(s[0].equation).toBe('ยกมา 7 + ขอใหม่ 9 − หาได้แล้ว 2 − ยกเลิก 1 = เหลือหา 13 อัตรา');
    expect(7 + 9 - 2 - 1).toBe(val(at(), 'reqPos'));
    expect(val(at(), 'reqCount')).toBe(5);
    expect(val(at(), 'reqIdle')).toBe(3);
    expect(scaleBoxOf(s, 'reqIdle')?.sub).toBe('60% ของใบที่เหลือหา');
  });

  it('งานที่ทำ: รวม = 5 ชนิดงาน ไม่นับลงนัด', () => {
    expect(val(at(), 'wSum')).toBe(39);
    expect(sumOf((['wLinks', 'wPosted', 'wScrap', 'wAutopost', 'wContacts'] as const).map((k) => val(at(), k)))).toBe(39);
    expect(val(at(), 'wAppts')).toBe(1);
    expect(scaleBoxOf(scaleSections(INPUT, at()), 'wAppts')?.sub).toBe('ไม่นับในรวม');
  });

  it('รายชื่อ: ไล่ตามสายเดียวกับภาพรวม + บรรทัดล่างบอกสัดส่วนของขั้นก่อน', () => {
    expect(CHAIN.map((k) => val(at(), k))).toEqual([11, 7, 5, 2, 1, 1, 2]);
    const s = scaleSections(INPUT, at());
    expect(scaleBoxOf(s, 'cAiCalled')?.sub).toBe('64% ของรายชื่อ');
    expect(scaleBoxOf(s, 'cAiYes')?.sub).toBe('71% ของที่ AI โทร');
    expect(scaleBoxOf(s, 'cStaffOk')?.sub).toBe('40% ของที่สนใจ');
    expect(scaleBoxOf(s, 'cBooked')?.ids).toEqual(['app-9f1c0a11']);
  });

  it('รายชื่ออยู่ที่ใคร: รับมาโทร = ติดต่อได้ + ติดต่อไม่ได้ + ยังไม่ลงผล · AI สนใจที่ยังไม่มีใครรับ', () => {
    expect(val(at(), 'hAll')).toBe(4);
    expect(sumOf((['hOk', 'hFail', 'hWait'] as const).map((k) => val(at(), k)))).toBe(4);
    expect(val(at(), 'hFree')).toBe(1);
    expect(scaleBoxOf(scaleSections(INPUT, at()), 'hFree')?.ids).toEqual(['app-9f1c0a16']);
  });

  it('เร็วแค่ไหน: วันละ = ยอดของช่วง ÷ 20 วัน · เข้ามากกว่าออก = ไม่หมด', () => {
    const s = scaleSections(INPUT, at());
    expect(val(at(), 'inPerDay')).toBe(0.5); // 9 ÷ 20 = 0.45
    expect(val(at(), 'outPerDay')).toBe(0.2); // (2 + 1) ÷ 20 = 0.15
    expect(scaleBoxOf(s, 'eta')).toMatchObject({ format: 'text', text: 'ไม่หมด', sub: 'เข้ามากกว่าออกวันละ 0.3' });
    expect(val(at(), 'speed')).toBe(58.7); // (124 + 32 + 20) ÷ 3
    expect(scaleBoxOf(s, 'onTime')).toMatchObject({ value: 67, sub: '2 จาก 3 ใบ' });
    expect(scaleBoxOf(s, 'callHours')).toMatchObject({ value: 4, sub: 'ชม. · ยังไม่ได้โทร 2 คน' });
  });

  it('งานค้างจะหมดเมื่อไหร่: ออกมากกว่าเข้า = อีกกี่วัน · เท่ากัน = เท่าเดิม', () => {
    const faster: ScaleInput = { ...INPUT, requests: [req('OPL6911050', 'LBD', [24, 2, 10, 0, 16])] };
    expect(scaleBoxOf(scaleSections(faster, at()), 'eta')).toMatchObject({ text: 'อีก 40 วัน', sub: 'ถ้าเร็วเท่านี้' });
    expect(scaleBoxOf(scaleSections(INPUT, at({ bu: 'LM' })), 'eta')).toMatchObject({ text: 'เท่าเดิม', sub: 'เข้าเท่ากับออก' });
  });

  it('เบอร์ผิด · ซ้ำ · Scrap', () => {
    const s = scaleSections(INPUT, at());
    expect(scaleBoxOf(s, 'badPhone')).toMatchObject({ value: 1, sub: '9.1% ของรายชื่อ', ids: ['app-9f1c0a15'] });
    expect(scaleBoxOf(s, 'dup')).toMatchObject({ value: 1, ids: ['app-9f1c0a14'] });
    expect(val(at(), 'scrapOrders')).toBe(2);
    expect(scaleBoxOf(s, 'scrapNames')).toMatchObject({ value: 1, ids: ['app-77b20b1a'] });
  });

  it('ค่าปรับ = รวมรายใบของหน้าหลัก (ตามสัญญา)', () => {
    expect(val(at(), 'penCount')).toBe(3);
    expect(val(at(), 'fine')).toBe(28000);
    expect(val(at(), 'deduct')).toBe(115833);
    expect(scalePenaltyRows(scaleMoneyOf(INPUT, null)).map((r) => r.requestNo)).toEqual(['LAO6911027', 'OPL6911006', 'LMO6911010']);
    // รหัสยาวของไซต์ (LML) = ชั้น LM
    expect([val(at({ bu: 'LM' }), 'penCount'), val(at({ bu: 'LM' }), 'fine')]).toEqual([1, 13000]);
    expect(scaleMoneyOf(INPUT, 'LM').map((r) => r.requestNo)).toEqual(['LMO6911010']);
    expect(scaleClockedRows(scaleMoneyOf(INPUT, 'LBD')).map((r) => r.requestNo)).toEqual(['OPL6907006', 'OPL6908010']);
  });
});

describe('ยังโหลดไม่ได้ = ไม่มีเลข ไม่ใช่ 0', () => {
  it('งาน / ใบขอ / ค่าปรับ ที่ยังไม่มีข้อมูล ขึ้น null ทั้งก้อน', () => {
    const blank: ScaleInput = { ...INPUT, staff: null, requests: null, money: null };
    const s = scaleSections(blank, at());
    expect(s[0].equation).toBeNull();
    for (const k of ['reqPos', 'reqCount', 'reqIdle', 'wSum', 'wLinks', 'inPerDay', 'eta', 'speed', 'onTime', 'scrapOrders', 'penCount', 'fine', 'deduct'] as const) expect(scaleBoxOf(s, k)?.value).toBeNull();
    expect(scaleBoxOf(s, 'wSum')?.sub).toBe('');
    // รายชื่อยังอยู่ครบ เพราะมาจากชุดที่หน้าโหลดแล้ว
    expect(scaleBoxOf(s, 'cNames')?.value).toBe(11);
  });
});

describe('แยกตาม BU — ทุกคอลัมน์รวมเท่ากล่องของชั้นทั้งหมด', () => {
  it('BU เรียงตามที่ทีมคุ้น + ใบที่ไม่มี BU อยู่ท้าย', () => {
    expect(scaleBus(INPUT)).toEqual(['LBD', 'LBA', 'LM', BU_UNKNOWN]);
  });

  it('แถวรวม = ผลบวกของทุก BU = กล่องเลข', () => {
    const t = scaleBuTable(INPUT);
    expect(t.rows.map((r) => [r.bu, r.reqPos, r.reqCount, r.reqIdle, r.people, r.work])).toEqual([
      ['LBD', 4, 3, 2, 2, 31],
      ['LBA', 5, 1, 0, 2, 8],
      ['LM', 4, 1, 1, 0, 0],
      [BU_UNKNOWN, 0, 0, 0, 0, 0],
    ]);
    expect(t.rows.find((r) => r.bu === 'LBD')?.chain).toEqual([7, 5, 4, 1, 1, 1, 2]);
    for (const k of ['reqPos', 'reqCount', 'reqIdle', 'people', 'work'] as const) expect(sumOf(t.rows.map((r) => r[k]))).toBe(t.total[k]);
    CHAIN.forEach((k, i) => {
      expect(sumOf(t.rows.map((r) => r.chain[i]))).toBe(t.total.chain[i]);
      expect(t.total.chain[i]).toBe(val(at(), k));
    });
    expect(t.total.reqPos).toBe(val(at(), 'reqPos'));
    expect(t.total.work).toBe(val(at(), 'wSum'));
  });
});

describe('กดกล่อง = เลขนั้นแยกตามชั้นถัดไป (บวกกันได้เท่ากล่อง)', () => {
  const sums = (lv: ScaleLevel, key: ScaleBoxKey) => {
    const bd = scaleBreakdown(INPUT, lv, key);
    return { kind: bd?.kind, rows: bd?.rows.map((r) => [r.label, r.value]), total: bd?.total, sum: sumOf(bd?.rows.map((r) => r.value) ?? []) };
  };

  it('ชั้นทั้งหมด → BU', () => {
    expect(sums(at(), 'cAiYes')).toEqual({ kind: 'bu', rows: [['LBD', 4], ['LBA', 1]], total: 5, sum: 5 });
    expect(sums(at(), 'fine')).toEqual({ kind: 'bu', rows: [['LBD', 15000], ['LM', 13000]], total: 28000, sum: 28000 });
    for (const k of ['reqPos', 'reqCount', 'reqIdle', 'wSum', 'wContacts', 'cNames', 'cInformed', 'hAll', 'hWait', 'hFree', 'badPhone', 'dup', 'scrapOrders', 'scrapNames', 'penCount', 'deduct'] as const) {
      const x = sums(at(), k);
      expect([k, x.sum]).toEqual([k, x.total]);
      expect([k, x.total]).toEqual([k, val(at(), k)]);
    }
  });

  it('เลขที่บวกกันไม่ได้ (เฉลี่ย · %) ไม่มีแถวรวม และ BU ที่ไม่มีเลขไม่ขึ้น', () => {
    const bd = scaleBreakdown(INPUT, at(), 'speed');
    expect(bd?.total).toBeNull();
    expect(bd?.rows.map((r) => [r.label, r.value, r.note])).toEqual([
      ['LBD', 72, 'วัน · จาก 2 ใบที่หาครบ'],
      ['LBA', 32, 'วัน · จาก 1 ใบที่หาครบ'],
    ]);
    expect(scaleBreakdown(INPUT, at(), 'onTime')?.rows.map((r) => [r.label, r.value, r.note])).toEqual([
      ['LBD', 50, '1 จาก 2 ใบ'],
      ['LBA', 100, '1 จาก 1 ใบ'],
    ]);
  });

  it('ชั้น BU → เจ้าหน้าที่สรรหา / คน / คนหามา / คนที่รับไปโทร', () => {
    const lbd = at({ bu: 'LBD' });
    expect(sums(lbd, 'reqPos')).toEqual({ kind: 'recruiter', rows: [['คิว', 3], [NO_RECRUITER_LABEL, 1]], total: 4, sum: 4 });
    expect(sums(lbd, 'wSum')).toEqual({ kind: 'staff', rows: [['คิว', 22], ['แป๋ม', 9]], total: 31, sum: 31 });
    expect(sums(lbd, 'cNames')).toEqual({ kind: 'bringer', rows: [['คิว', 6], ['ดึงจาก iRecruit', 1]], total: 7, sum: 7 });
    expect(sums(lbd, 'hAll')).toEqual({ kind: 'holder', rows: [['แป๋ม', 3]], total: 3, sum: 3 });
    expect(sums(lbd, 'scrapOrders')).toEqual({ kind: 'staff', rows: [['คิว', 2]], total: 2, sum: 2 });
    const bad = scaleBreakdown(INPUT, lbd, 'badPhone');
    expect(bad?.rows.map((r) => [r.label, r.value, r.note, r.ids])).toEqual([['คิว', 1, 'จากรายชื่อ 6 คน', ['app-9f1c0a15']]]);
    expect(scaleBreakdown(INPUT, lbd, 'dup')?.rows.map((r) => [r.label, r.value])).toEqual([['คิว', 1]]);
  });

  it('กี่ชั่วโมงทีมถึงโทร แยกตามคนที่รับไปโทร — ใช้ค่ากลาง ไม่ใช่ผลบวก', () => {
    const bd = scaleBreakdown(INPUT, at({ bu: 'LBD' }), 'callHours');
    expect(bd).toMatchObject({ kind: 'holder', total: null });
    expect(bd?.rows.map((r) => [r.label, r.value, r.note])).toEqual([['แป๋ม', 10, 'โทรแล้ว 2 คน · ยังไม่ได้โทร 1 คน']]);
  });

  it('ชั้นคน → วัน / ช่องทาง · ชั้นช่องทาง → กลุ่ม', () => {
    const q = at({ bu: 'LBD', who: 'คิว' });
    expect(sums(q, 'wSum')).toEqual({ kind: 'day', rows: [['10 พ.ย. · อ', 15], ['20 พ.ย. · ศ', 7]], total: 22, sum: 22 });
    const fb = scaleChannelOf(COHORT[0]);
    const tt = scaleChannelOf(COHORT[5]);
    expect(sums(q, 'cNames')).toEqual({ kind: 'channel', rows: [[fb, 5], [tt, 1]], total: 6, sum: 6 });
    expect(sums({ ...q, ch: fb }, 'cNames')).toEqual({ kind: 'group', rows: [[scaleGroupOf(COHORT[0]), 3], [scaleGroupOf(COHORT[3]), 2]], total: 5, sum: 5 });
  });

  it('ชั้นล่างสุดของเรื่องนั้นไม่มีแถวลูก (จอเปิดรายชื่อ / รายใบแทน)', () => {
    const lbd = at({ bu: 'LBD' });
    for (const k of ['hFree', 'fine', 'penCount', 'speed', 'onTime', 'inPerDay', 'eta', 'scrapNames'] as const) expect([k, scaleBreakdown(INPUT, lbd, k)]).toEqual([k, null]);
    const q = at({ bu: 'LBD', who: 'คิว' });
    expect(scaleChildren(INPUT, q, 'reqPos')).toBeNull();
    expect(scaleChildren(INPUT, q, 'hAll')).toBeNull();
    expect(scaleChildren(INPUT, { ...q, ch: scaleChannelOf(COHORT[0]), grp: scaleGroupOf(COHORT[0]) }, 'cNames')).toBeNull();
  });
});

describe('ชั้น BU: แยกตามคน + รายชื่ออยู่ที่ใคร', () => {
  it('แถวรวม = กล่องของ BU · แหล่งที่ไม่ใช่คน (iRecruit) ไม่มีงาน ไม่มีวันทำล่าสุด', () => {
    const t = scalePeopleTable(INPUT, 'LBD');
    expect(t.rows.map((r) => [r.name, r.member, r.source, r.work, r.chain[0], r.lastDay, r.idleDays])).toEqual([
      ['คิว', true, false, 22, 6, '2026-11-20', 0],
      ['แป๋ม', true, false, 9, 0, '2026-11-19', 1],
      ['ดึงจาก iRecruit', false, true, null, 1, null, null],
    ]);
    expect(sumOf(t.rows.map((r) => r.work))).toBe(t.total.work);
    expect(t.total.work).toBe(val(at({ bu: 'LBD' }), 'wSum'));
    CHAIN.forEach((k, i) => {
      expect(sumOf(t.rows.map((r) => r.chain[i]))).toBe(t.total.chain[i]);
      expect(t.total.chain[i]).toBe(val(at({ bu: 'LBD' }), k));
    });
    expect(t.average).toMatchObject({ people: 2, work: 15.5 });
    expect(t.rows[0].per100).toBe(27.3); // 6 รายชื่อ ÷ 22 งานหา
    expect(t.rows[1].per100).toBeNull(); // ไม่มีงานหารายชื่อ = ไม่มีอัตรา
  });

  it('เทียบกับทีม: ทำเยอะ ได้น้อย / ทำน้อย ได้เยอะ', () => {
    const U1 = '11111111-2222-4333-8444-555555555555';
    const U2 = '66666666-7777-4888-9999-000000000000';
    const inp: ScaleInput = {
      ...INPUT,
      staff: [row(U1, 'หมิว', 'LBD', '2026-11-04', { links: 100 }), row(U2, 'ว่าน', 'LBD', '2026-11-04', { links: 10 })],
      cohort: [...Array.from({ length: 2 }, (_, i) => fact(`app-a1b2c3d${i}`, { bringer: 'หมิว' })), ...Array.from({ length: 8 }, (_, i) => fact(`app-e5f6a7b${i}`, { bringer: 'ว่าน' }))],
    };
    const t = scalePeopleTable(inp, 'LBD');
    expect(t.rows.map((r) => [r.name, r.per100, r.versus && SCALE_VERSUS_LABEL[r.versus]])).toEqual([
      ['หมิว', 2, 'ทำเยอะ ได้น้อย'],
      ['ว่าน', 80, 'ทำน้อย ได้เยอะ'],
    ]);
    expect(t.total.per100).toBe(9.1); // 10 รายชื่อ ÷ 110 งานหา
  });

  it('รายชื่ออยู่ที่ใคร: ทุกแถวลงตัว + ค้างนานสุดนับจากวันที่รับไป', () => {
    const t = scaleHoldTable(INPUT, 'LBD');
    expect(t.rows).toEqual([{ name: 'แป๋ม', all: 3, ok: 1, fail: 1, wait: 1, okPct: 50, oldestDays: 5 }]);
    expect(t.total.all).toBe(val(at({ bu: 'LBD' }), 'hAll'));
    for (const r of [...t.rows, t.total]) expect(r.ok + r.fail + r.wait).toBe(r.all);
  });
});

describe('ชั้นคน', () => {
  it('ใบขอที่ดูแล · งานทั้งหมดของคนนั้น · รายชื่อที่หามา · รายชื่อที่รับไปโทร', () => {
    const q = at({ bu: 'LBD', who: 'คิว' });
    const s = scaleSections(INPUT, q);
    expect(s.map((x) => x.key)).toEqual(['req', 'work', 'names', 'hold']);
    expect(s[0].title).toBe('ใบขอที่ดูแล');
    expect([val(q, 'reqPos'), val(q, 'reqCount'), val(q, 'reqIdle')]).toEqual([3, 2, 1]);
    expect(val(q, 'wSum')).toBe(22);
    expect(CHAIN.map((k) => val(q, k))).toEqual([6, 5, 4, 1, 1, 1, 1]);
    expect(val(q, 'hAll')).toBe(0);
    const p = at({ bu: 'LBD', who: 'แป๋ม' });
    expect((['hAll', 'hOk', 'hFail', 'hWait'] as const).map((k) => val(p, k))).toEqual([3, 1, 1, 1]);
    expect(scaleUserIdOf(INPUT, 'คิว')).toBe(Q);
    expect(scaleUserIdOf(INPUT, 'ดึงจาก iRecruit')).toBeNull();
  });

  it('ตารางช่องทาง / กลุ่ม: แถวรวม = รายชื่อของชั้น และมี id ให้เปิดรายชื่อ', () => {
    const q = at({ bu: 'LBD', who: 'คิว' });
    const t = scaleChainTable(INPUT, q);
    expect(t.by).toBe('channel');
    expect(t.rows.map((r) => r.chain[0])).toEqual([5, 1]);
    CHAIN.forEach((k, i) => {
      expect(sumOf(t.rows.map((r) => r.chain[i]))).toBe(t.total.chain[i]);
      expect(t.total.chain[i]).toBe(val(q, k));
    });
    const g = scaleChainTable(INPUT, { ...q, ch: scaleChannelOf(COHORT[0]) });
    expect(g.by).toBe('group');
    expect(g.rows.map((r) => [r.label, r.chain[0], r.ids[2]])).toEqual([
      [scaleGroupOf(COHORT[0]), 3, ['app-9f1c0a11', 'app-9f1c0a12', 'app-9f1c0a13']],
      [scaleGroupOf(COHORT[3]), 2, []],
    ]);
  });
});

describe('แกนวัน', () => {
  it('ทุกวันของช่วงอยู่ครบ (ว่าง = 0) และรวมเท่างานของชั้น', () => {
    expect(scaleDays(INPUT)).toHaveLength(20);
    expect(scaleDays(INPUT)[0]).toBe('2026-11-01');
    expect(scaleDays({ from: '2026-11-01', to: '2026-11-30', today: '2026-11-20' }).at(-1)).toBe('2026-11-20');
    // ช่วงยาว (เทียบเดือน / ทั้งหมด): "วันละ" นับครบทุกวัน · กราฟเหลือ 62 วันล่าสุด
    const long = { from: '2025-01-01', to: '2026-11-20', today: '2026-11-20' };
    expect(scaleDayCount(long)).toBe(689);
    expect([scaleDays(long).length, scaleDays(long)[0], scaleDays(long).at(-1)]).toEqual([62, '2026-09-20', '2026-11-20']);
    expect(scaleDayCount({ from: '2026-12-01', to: '2026-12-31', today: '2026-11-20' })).toBe(0);
    expect(val(at(), 'inPerDay', { ...INPUT, from: '2025-01-01' })).toBe(0); // 9 ÷ 689 วัน
    const all = scaleDaySeries(INPUT, at());
    expect(all).toHaveLength(20);
    expect(all.filter((d) => d.value > 0)).toEqual([
      { day: '2026-11-06', value: 8 },
      { day: '2026-11-10', value: 21 },
      { day: '2026-11-19', value: 3 },
      { day: '2026-11-20', value: 7 },
    ]);
    expect(sumOf(all.map((d) => d.value))).toBe(val(at(), 'wSum'));
    expect(sumOf(scaleDaySeries(INPUT, at({ bu: 'LBD', who: 'คิว' })).map((d) => d.value))).toBe(22);
    // เลือกวันอยู่ กราฟยังเป็นของทั้งช่วง (แท่งไม่หาย)
    expect(sumOf(scaleDaySeries(INPUT, at({ day: '2026-11-20' })).map((d) => d.value))).toBe(39);
  });

  it('วันที่ 20 ใครทำอะไร: แถวรวม = กล่องงานของวันนั้น · รายชื่อ = ใบที่กรอกวันนั้น (เวลาไทย)', () => {
    const d = at({ day: '2026-11-20' });
    expect(bkkDayOf('2026-11-19T18:30:00.000Z')).toBe('2026-11-20');
    const t = scaleDayTable(INPUT, d);
    expect(t.rows.map((r) => [r.name, r.bu, r.userId, r.sum, r.work.links, r.work.scrap])).toEqual([['คิว', 'LBD', Q, 7, 5, 2]]);
    expect(t.total.sum).toBe(val(d, 'wSum'));
    const s = scaleSections(INPUT, d);
    expect(s.map((x) => x.key)).toEqual(['req', 'work', 'names', 'hold']);
    expect(s[1].title).toBe('งานที่ทำ · 20 พ.ย.');
    expect(val(d, 'cNames')).toBe(1);
    // เรื่องที่ไม่มีแกนวัน = ไม่มีเลข
    expect([val(d, 'reqPos'), val(d, 'hAll')]).toEqual([null, null]);
    expect(val(at({ bu: 'LBD', who: 'คิว', day: '2026-11-10' }), 'wSum')).toBe(15);
    expect(scaleBreakdown(INPUT, at({ bu: 'LBD', day: '2026-11-10' }), 'wSum')?.rows.map((r) => [r.label, r.value])).toEqual([['คิว', 15], ['แป๋ม', 6]]);
  });
});

describe('ใบขอ: รายใบ + ลูกค้า / ตำแหน่งที่เหลือหาเยอะสุด', () => {
  it('ค้างนานสุดก่อน · เลือกเฉพาะที่ยังไม่เริ่มหาได้', () => {
    const lbd = at({ bu: 'LBD' });
    expect(scaleOpenRequests(INPUT, lbd).map((r) => r.requestNo)).toEqual(['OPL6910100', 'OPL6911006', 'OPL6911035']);
    expect(scaleOpenRequests(INPUT, lbd, true).map((r) => r.requestNo)).toEqual(['OPL6910100', 'OPL6911035']);
    expect(scaleOpenRequests(INPUT, at({ bu: 'LBD', who: 'คิว' })).map((r) => r.requestNo)).toEqual(['OPL6910100', 'OPL6911006']);
  });

  it('รวมตามชื่อ เรียงตามที่เหลือหา · ใบที่ปิดแล้วไม่ขึ้น', () => {
    expect(scaleTopRequests(INPUT, null, 'customer').map((r) => [r.label, r.new, r.filled, r.cancelled, r.remaining, r.count, r.oldest])).toEqual([
      ['บริษัท ตัวอย่างค้าปลีก จำกัด', 5, 0, 0, 5, 1, 1],
      ['หน่วยงานตัวอย่างดูแลสวน', 0, 0, 0, 4, 1, 200],
      ['ธนาคารกรุงศรีอยุธยา  จำกัด (มหาชน)', 4, 1, 0, 3, 2, 12],
      ['KS สาขาตัวอย่าง', 0, 0, 1, 1, 1, 40],
    ]);
    expect(scaleTopRequests(INPUT, 'LBD', 'position').map((r) => [r.label, r.remaining])).toEqual([
      ['ขับรถ', 3],
      ['พนักงานขับรถ ส่วนกลาง', 1],
    ]);
  });
});

describe('ทางเดิน + URL', () => {
  it('ทางเดินเรียงจากบนลงล่าง วันอยู่ท้ายสุด', () => {
    const c = scaleCrumbs(at({ bu: 'LBD', who: 'คิว', ch: 'Facebook Group', grp: 'หางานขับรถ กทม', day: '2026-11-20' }));
    expect(c.map((x) => x.label)).toEqual(['ทั้งหมด', 'LBD', 'คิว', 'Facebook Group', 'หางานขับรถ กทม', '20 พ.ย.']);
    expect(c[2].level).toEqual(at({ bu: 'LBD', who: 'คิว' }));
    expect(c[0].level).toEqual(SCALE_ROOT);
  });

  it('ชั้นใน URL ที่ไม่มีชั้นแม่ถอยกลับ · วันผิดรูปทิ้ง', () => {
    expect(scaleLevelFromParams(new URLSearchParams('who=คิว&ch=Facebook Group'))).toEqual(SCALE_ROOT);
    expect(scaleLevelFromParams(new URLSearchParams('sbu=LBD&who=คิว&grp=หางานขับรถ กทม&day=20-11'))).toEqual(at({ bu: 'LBD', who: 'คิว' }));
    expect(scaleLevelFromParams(new URLSearchParams('sbu=LBD&day=2026-11-20'))).toEqual(at({ bu: 'LBD', day: '2026-11-20' }));
  });

  it('เขียนชั้นลง URL โดยไม่แตะตัวกรองของแท็บอื่น', () => {
    const p = scaleLevelToParams(new URLSearchParams('ov=scale&bu=LBA&from=2026-11-01'), at({ bu: 'LBD', who: 'คิว' }), 'cAiYes');
    expect(Object.fromEntries(p)).toEqual({ ov: 'scale', bu: 'LBA', from: '2026-11-01', sbu: 'LBD', who: 'คิว', box: 'cAiYes' });
    expect(scaleLevelFromParams(p)).toEqual(at({ bu: 'LBD', who: 'คิว' }));
    expect(Object.fromEntries(scaleLevelToParams(p, SCALE_ROOT, null))).toEqual({ ov: 'scale', bu: 'LBA', from: '2026-11-01' });
  });
});
