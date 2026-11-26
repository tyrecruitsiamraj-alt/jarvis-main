/**
 * GET /api/exec-summary — สรุปงานสรรหาให้ผู้ช่วย AI (เจ้าของ 20 พ.ย. 2569 "ถ้าในจอตอบไม่ได้ ผู้ช่วย AI ต้องช่วยได้")
 * 🔴 ด่าน: อ่านจาก 4 เส้นเดียวกับจอ ด้วย header ของผู้ถาม (สิทธิ์/BU เดิม) · ช่วงเดียวกับจอ (เดือนนี้ + ช่วงก่อน) · อ่านไม่ได้ = บอกเหตุ ไม่ขึ้น 0
 * · ค่าที่ขอผิด (BU / ชื่อ / วัน / กล่อง) บอกตรง ๆ พร้อมค่าที่ใช้ได้ · อ่านอย่างเดียว
 * · ถามถึงคนด้วยชื่ออย่างเดียว / ใบขอด้วยเลขที่ใบขออย่างเดียวได้ (ทดสอบผู้ช่วยบนเว็บจริง 22 พ.ย. 2569 — ตอบไม่ได้เพราะไม่รู้ BU / ไม่รู้ id ใบ)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { RecruitAppFact } from '../../src/lib/recruitOverviewTypes';

type Sub = 'overview' | 'stuck' | 'staff' | 'money' | 'timeline';
type Call = { query: Record<string, string>; cookie: unknown };
const calls: Record<Sub, Call[]> = { overview: [], stuck: [], staff: [], money: [], timeline: [] };
let fail: Partial<Record<Sub, boolean>> = {};
let lockedBu: string | null = null;
/** มีใบขอชั่วคราวเลขเดียวกับใบขอจริงในชุด (ของจริงซ้ำกัน 64%) */
let withTemp = false;

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
const APPS = [
  fact('app-9f1c0a11', { calledByAi: true, aiAnswer: 'said_yes' }),
  fact('app-9f1c0a12'),
  fact('app-77b20b18', { bu: 'LBA', jobId: 'siamraj-sql:LAO6911027', bringer: 'ฟอร์ด' }),
  // ช่วงก่อน (1–20 ต.ค.)
  fact('app-55aa0c01', { createdAt: '2026-10-10T03:00:00.000Z' }),
];
const WINDOW = { month: '2026-11', from: '2026-11-01', to: '2026-11-30', prevFrom: '2026-10-01', prevTo: '2026-10-20', isCurrent: true };
const row = (name: string, bu: string, day: string, links: number) => ({ userId: `00000000-0000-4000-8000-00000000000${name.length}`, name, bu, day, autopost: 0, scrap: 0, links, manualPosted: 0, contacts: 0, appts: 0 });
const req = (no: string, bu: string, flow: [number, number, number, number, number]) => ({
  requestNo: no,
  jobId: `siamraj-sql:${no}`,
  bu,
  unitName: 'ธนาคารตัวอย่าง จำกัด (มหาชน)',
  position: 'ขับรถ',
  recruiter: 'คิว',
  requested: flow[1],
  filled: flow[2],
  cancelled: flow[3],
  remaining: flow[4],
  applications: 0,
  ageDays: 12,
  released: true,
  signals: { post: 'posted', released: true, links: 1 },
  flow: { carryIn: flow[0], new: flow[1], filled: flow[2], cancelled: flow[3], remaining: flow[4], fillDays: [], cancelDays: [] },
});
const sub = (name: keyof typeof calls, body: (q: Record<string, string>) => unknown) => ({
  default: async (r: { query: Record<string, string>; headers?: Record<string, unknown>; method?: string }, res: { status: (c: number) => { json: (b: unknown) => void } }) => {
    calls[name].push({ query: r.query, cookie: r.headers?.cookie });
    if (r.method !== 'GET') return res.status(405).json({});
    if (fail[name]) return res.status(500).json({ error: 'x' });
    return res.status(200).json(body(r.query));
  },
});
vi.mock('../../api/_handlers/recruit-overview.js', () =>
  sub('overview', () => ({ window: WINDOW, today: '2026-11-20', firstDay: '2026-09-01', generatedAt: '2026-11-20T05:00:00.000Z', bu: lockedBu, apps: APPS, appJobs: {}, errors: {} })),
);
vi.mock('../../api/_handlers/recruit-stuck.js', () =>
  sub('stuck', (q) => ({
    requests:
      q.from === '2026-11-01'
        ? [req('OPL6911006', 'LBD', [0, 3, 1, 0, 2]), req('LAO6911027', 'LBA', [0, 5, 0, 0, 5]), ...(withTemp ? [{ ...req('OPL6911006', 'LBD', [0, 1, 0, 0, 1]), jobId: 'siamraj-pre:OPL6911006' }] : [])]
        : [req('OPL6910100', 'LBD', [9, 0, 0, 0, 9])],
  })),
);
const NO_WORK = { links: 0, manualPosted: 0, autopost: 0, scrap: 0, contacts: 0, appts: 0 };
const TIMELINE: Record<string, unknown> = {
  'siamraj-sql:OPL6911006': { done: { work: { ...NO_WORK, links: 4, contacts: 2 }, chain: [3, 2, 1, 1, 0, 0, 0] }, events: [{ day: '2026-11-05', kind: 'links', who: 'คิว', detail: 'Facebook Group', n: 4 }] },
  // ใบที่ยกเลิกไปตั้งแต่เดือนก่อน — ไม่อยู่ในใบขอของช่วง แต่มีงานที่ทำ
  'siamraj-sql:OPL6909095': { done: { work: { ...NO_WORK, links: 19 }, chain: [2, 2, 0, 0, 0, 0, 0] }, events: [{ day: '2026-09-20', kind: 'links', who: 'คิว', detail: 'Facebook Group', n: 19 }] },
  'siamraj-pre:OPL6911006': { done: { work: { ...NO_WORK, scrap: 1 }, chain: [0, 0, 0, 0, 0, 0, 0] }, events: [] },
};
// ผู้ถามเห็นทุก BU: เลขที่ไม่มีจริงก็ได้ก้อนว่างกลับมา (ตัวจริงทำแบบนี้) — ต้องไม่ถูกตอบว่าเป็นใบที่ไม่มีใครทำอะไร
vi.mock('../../api/_handlers/request-timeline.js', () =>
  sub('timeline', (q) => ({ jobs: Object.fromEntries(q.jobs.split(',').map((id) => [id, TIMELINE[id] ?? { done: { work: NO_WORK, chain: [0, 0, 0, 0, 0, 0, 0] }, events: [] }])) })),
);
vi.mock('../../api/_handlers/staff-activity.js', () =>
  sub('staff', (q) => (q.roster === '1' ? { roster: [{ userId: 'x', name: 'โอ๊ต', bu: 'LBD', lastDay: '2026-10-28' }] } : { rows: q.from === '2026-11-01' ? [row('คิว', 'LBD', '2026-11-20', 5), row('ฟอร์ด', 'LBA', '2026-11-20', 4)] : [row('คิว', 'LBD', '2026-10-10', 2)] })),
);
vi.mock('../../api/_handlers/home-money.js', () => sub('money', () => ({ requests: [] })));
vi.mock('../../api/_lib/http.js', async (o) => ({ ...(await o<object>()), withRbac: (h: unknown) => h }));

const { execSummaryHandler, clearExecSummaryCache } = await import('../../api/_handlers/exec-summary');

type Body = {
  window: Record<string, unknown>;
  level: string[];
  bus: string[];
  sections: Array<{ title: string; equation?: string; boxes: Array<{ key: string; value: number | null; prev?: number | null }> }>;
  people?: Array<Record<string, unknown>>;
  byBu?: Array<Record<string, unknown>>;
  errors: string[];
  message?: string;
  breakdown?: { rows: Array<{ label: string; value: number }> };
  dayPeople?: unknown[];
  request?: (Record<string, unknown> & { timeline: Array<Record<string, unknown>> }) | null;
};
async function call(query: Record<string, string>, method = 'GET', sub = 'u1') {
  let status = 0;
  let body: unknown = null;
  const res = { setHeader() {}, status: (s: number) => ((status = s), { json: (b: unknown) => (body = b) }) };
  await execSummaryHandler({ method, query, headers: { cookie: 'jarvis_session=abc' }, user: { sub, role: 'admin' } } as never, res as never);
  return { status, body: body as Body };
}
const box = (b: Body, key: string) => b.sections.flatMap((s) => s.boxes).find((x) => x.key === key);

beforeEach(() => {
  for (const k of Object.keys(calls) as Array<keyof typeof calls>) calls[k].length = 0;
  fail = {};
  lockedBu = null;
  withTemp = false;
  clearExecSummaryCache();
});

describe('GET /api/exec-summary', () => {
  it('ไม่ส่งอะไร = เดือนนี้ถึงวันนี้ ช่วงเดียวกับจอ · อ่าน 4 เส้นเดิมด้วย header ของผู้ถาม (+ ช่วงก่อน + คนที่มีงานใน 60 วัน)', async () => {
    const r = await call({});
    expect(r.status).toBe(200);
    expect(calls.overview.map((c) => c.query)).toEqual([{ asof: '1' }]);
    expect(calls.stuck.map((c) => c.query)).toEqual([{ from: '2026-11-01', to: '2026-11-30' }, { from: '2026-10-01', to: '2026-10-20' }]);
    expect(calls.money.map((c) => c.query)).toEqual([{ from: '2026-11-01', to: '2026-11-30' }, { from: '2026-10-01', to: '2026-10-20' }]);
    expect(calls.staff.map((c) => c.query)).toEqual(expect.arrayContaining([{ from: '2026-11-01', to: '2026-11-30' }, { from: '2026-10-01', to: '2026-10-20' }, { from: '2026-11-20', to: '2026-11-20', roster: '1' }]));
    for (const c of Object.values(calls).flat()) expect(c.cookie).toBe('jarvis_session=abc');
    expect(r.body.window).toEqual({ from: '2026-11-01', to: '2026-11-30', days: 20, text: '1–20 พ.ย. 2569', compareWith: '1–20 ต.ค. 2569' });
    expect([r.body.level, r.body.bus]).toEqual([['ทั้งหมด'], ['LBD', 'LBA']]);
    expect(r.body.sections[0].equation).toBe('ยกมา 0 + ขอใหม่ 8 − หาได้แล้ว 1 − ยกเลิก 0 = เหลือหา 7 อัตรา');
    // รายชื่อ = ใบที่กรอกในช่วง (ใบของช่วงก่อนไม่ปน) · เทียบช่วงก่อน
    expect(box(r.body, 'cNames')).toMatchObject({ value: 3, prev: 1 });
    expect(box(r.body, 'reqPos')).toMatchObject({ value: 7, prev: 9 });
    // ช่วงก่อนเริ่ม 1 ต.ค. — ก่อนลิงก์เริ่มจำคนสร้าง (28 ต.ค.) = เทียบไม่ได้ ไม่ใช่เพิ่มขึ้นจาก 2
    expect(box(r.body, 'wLinks')).toMatchObject({ value: 9, prev: null });
    expect(r.body.errors).toEqual([]);
  });

  it('ส่งช่วง / เดือนเอง = ช่วงนั้นไปถึงเส้นภาพรวม · ถามต่อช่วงเดิมภายในไม่กี่วินาทีไม่อ่านซ้ำ (ผู้ถามคนอื่นอ่านของตัวเอง)', async () => {
    await call({ from: '2026-11-01', to: '2026-11-15' });
    expect(calls.overview.at(-1)?.query).toEqual({ from: '2026-11-01', to: '2026-11-15', asof: '1' });
    await call({ month: '2026-10' });
    expect(calls.overview.at(-1)?.query).toEqual({ month: '2026-10', asof: '1' });
    const n = calls.overview.length;
    const again = await call({ month: '2026-10', bu: 'LBD', box: 'wLinks' });
    expect(again.status).toBe(200);
    expect(calls.overview.length).toBe(n);
    await call({ month: '2026-10' }, 'GET', 'u2');
    expect(calls.overview.length).toBe(n + 1);
  });

  it('ชั้น BU → คน → วัน → กล่อง · ค่าที่ขอผิดบอกตรง ๆ พร้อมค่าที่ใช้ได้ ไม่เดาให้', async () => {
    const bu = await call({ bu: 'lbd' });
    expect(bu.body.level).toEqual(['ทั้งหมด', 'LBD']);
    expect(bu.body.people?.map((p) => p.คน)).toEqual(['คิว', 'โอ๊ต']);
    expect((await call({ bu: 'LBD', who: 'คิว' })).body.level).toEqual(['ทั้งหมด', 'LBD', 'คิว']);
    const day = await call({ day: '2026-11-20' });
    expect([day.body.level, day.body.dayPeople?.length]).toEqual([['ทั้งหมด', '20 พ.ย.'], 2]);
    expect((await call({ box: 'cNames' })).body.breakdown?.rows).toEqual([{ label: 'LBD', value: 2, prev: 1 }, { label: 'LBA', value: 1, prev: 0 }]);
    expect((await call({ box: 'wLinks' })).body.breakdown?.rows).toEqual([{ label: 'LBD', value: 5, prev: null }, { label: 'LBA', value: 4, prev: null }]);
    const wrong = await call({ bu: 'ZZ', who: 'ใครก็ไม่รู้', day: '2026-12-25', box: 'ไม่มี' });
    expect(wrong.status).toBe(200);
    expect(wrong.body.level).toEqual(['ทั้งหมด']);
    expect(wrong.body.errors).toEqual(['ไม่มี BU ZZ ในช่วงนี้ — BU ที่มี: LBD, LBA', 'ไม่เจอ ใครก็ไม่รู้ — ชื่อที่มี: คิว, โอ๊ต, ฟอร์ด', 'วันที่ 2026-12-25 อยู่นอกช่วง 2026-11-01 ถึง 2026-11-30', 'ชั้นนี้ไม่มีกล่อง ไม่มี — ใช้ค่า key จาก sections']);
    expect((await call({ bu: 'LBD', who: 'ใครก็ไม่รู้' })).body.errors).toEqual(['ไม่เจอ ใครก็ไม่รู้ ใน LBD — ชื่อที่มี: คิว, โอ๊ต']);
  });

  it('ถามถึงคนด้วยชื่ออย่างเดียว = คนนั้นรวมทุก BU + แยก BU (คนที่ช่วงนี้ไม่มีงานก็เจอ) · ส่ง bu มาด้วย = ดูเฉพาะ BU นั้น', async () => {
    const q = await call({ who: 'คิว' });
    expect([q.body.level, q.body.byBu]).toEqual([['ทั้งหมด', 'คิว'], [{ BU: 'LBD', สังกัด: 'สังกัด BU นี้', รายชื่อ: 2 }]]);
    expect((await call({ who: ' ฟอร์ด ' })).body.level).toEqual(['ทั้งหมด', 'ฟอร์ด']);
    expect((await call({ who: 'โอ๊ต' })).body.level).toEqual(['ทั้งหมด', 'โอ๊ต']);
    expect((await call({ who: 'คิว', day: '2026-11-20' })).body.level).toEqual(['ทั้งหมด', 'คิว', '20 พ.ย.']);
    expect((await call({ bu: 'LBD', who: 'คิว' })).body.level).toEqual(['ทั้งหมด', 'LBD', 'คิว']);
    const other = await call({ bu: 'LBA', who: 'คิว' });
    expect([other.body.level, other.body.errors]).toEqual([['ทั้งหมด', 'LBA'], ['ไม่เจอ คิว ใน LBA — ชื่อที่มี: ฟอร์ด']]);
  });

  it('ถามถึงใบขอด้วยเลขที่ใบขออย่างเดียว = ใบนั้นใบเดียว: ยอดอัตรา + งานที่ทำตั้งแต่ขอ + ไทม์ไลน์ (อ่านด้วย header ของผู้ถาม)', async () => {
    const r = await call({ request: ' opl 6911006 ', bu: 'ZZ' });
    expect(r.status).toBe(200);
    expect(calls.timeline.map((c) => [c.query, c.cookie])).toEqual([[{ jobs: 'siamraj-sql:OPL6911006', events: '1' }, 'jarvis_session=abc']]);
    expect(r.body.request).toMatchObject({
      เลขที่ใบขอ: 'OPL6911006',
      BU: 'LBD',
      เจ้าหน้าที่สรรหา: 'คิว',
      'ใบขอ (อัตรา ตามช่วง)': { ยกมา: 0, ขอใหม่: 3, หาได้แล้ว: 1, ยกเลิก: 0, เหลือหา: 2 },
      'งานที่ทำ ตั้งแต่ขอ': { รวม: 6, 'Gen link': 4, ลงผลติดต่อ: 2 },
      'รายชื่อ ตั้งแต่ขอ': { รายชื่อ: 3, 'AI สนใจ': 1 },
    });
    expect(r.body.request?.timeline).toEqual([{ วันที่: '5 พ.ย. 2569', ทำอะไร: 'Gen link', จำนวน: '4 ลิงก์', ใคร: 'คิว', รายละเอียด: 'Facebook Group' }]);
    expect([r.body.errors, r.body.window, 'sections' in r.body]).toEqual([[], { from: '2026-11-01', to: '2026-11-30', days: 20, text: '1–20 พ.ย. 2569', compareWith: null }, false]);
  });

  it('ใบที่จบก่อนช่วง = มีแต่งานที่ทำ บอกว่าไม่มียอดอัตรา · เลขที่ไม่มีจริง = ไม่เจอ (ไม่ตอบว่าใบนี้ไม่มีใครทำอะไร) · อ่านงานไม่ได้ = บอกเหตุ', async () => {
    const old = await call({ request: 'OPL6909095' });
    expect(calls.timeline.at(-1)?.query).toEqual({ jobs: 'siamraj-sql:OPL6909095,siamraj-pre:OPL6909095', events: '1' });
    expect(Object.keys(old.body.request ?? {})).toEqual(['เลขที่ใบขอ', 'งานที่ทำ ตั้งแต่ขอ', 'รายชื่อ ตั้งแต่ขอ', 'timeline']);
    expect(old.body.request?.['งานที่ทำ ตั้งแต่ขอ']).toMatchObject({ รวม: 19 });
    expect(old.body.errors).toEqual(['ใบ OPL6909095 ไม่อยู่ในใบขอของช่วง 1–20 พ.ย. 2569 (จบก่อนช่วงนี้) — ไม่มียอดอัตราและเหตุผลยกเลิก มีเฉพาะงานที่ทำและรายชื่อ']);
    const none = await call({ request: 'OPL0000000' });
    expect([none.status, none.body.request, none.body.errors]).toEqual([200, null, ['ไม่เจอใบขอ OPL0000000 — ตรวจเลขที่ใบขออีกครั้ง (อักษรนำหน้าเลขที่ใบขอไม่ใช่ BU)']]);
    fail = { timeline: true };
    const blind = await call({ request: 'OPL6911006' });
    expect([blind.body.request?.['งานที่ทำ ตั้งแต่ขอ'], blind.body.request?.['ใบขอ (อัตรา ตามช่วง)'], blind.body.errors]).toEqual([null, { ยกมา: 0, ขอใหม่: 3, หาได้แล้ว: 1, ยกเลิก: 0, เหลือหา: 2 }, ['อ่านงานที่ทำกับใบนี้ไม่ได้ — มีแต่ยอดอัตราของใบ']]);
    // ใบที่ไม่อยู่ในช่วง + อ่านงานไม่ได้ = ไม่เจอ (ไม่มีหลักฐานว่าใบมีจริง)
    expect((await call({ request: 'OPL6909095' })).body.request).toBeNull();
    // อ่านใบขอของช่วงไม่ได้ = บอกเหตุนั้น ไม่บอกว่าใบจบก่อนช่วง
    clearExecSummaryCache();
    fail = { stuck: true };
    const noReqs = await call({ request: 'OPL6909095' });
    expect([noReqs.body.request?.['งานที่ทำ ตั้งแต่ขอ'], noReqs.body.errors]).toEqual([expect.objectContaining({ รวม: 19 }), ['อ่านใบขอของช่วงนี้ไม่ได้ — กล่องใบขอไม่มีเลข']]);
  });

  it('ใบขอชั่วคราวเลขซ้ำใบขอจริง = แสดงใบขอจริง บอกว่ามีอีกใบ · ส่ง id เต็มของอีกใบ = ได้ใบนั้น', async () => {
    withTemp = true;
    const real = await call({ request: 'OPL6911006' });
    expect(real.body.request?.['งานที่ทำ ตั้งแต่ขอ']).toMatchObject({ 'Gen link': 4 });
    expect(real.body.errors).toEqual(['เลขที่ OPL6911006 มี 2 ใบ (ใบขอจริงกับใบขอชั่วคราวเลขซ้ำกัน) — ที่แสดงคือใบขอจริง · อีกใบดูด้วย request=siamraj-pre:OPL6911006']);
    const temp = await call({ request: 'siamraj-pre:OPL6911006' });
    expect(calls.timeline.at(-1)?.query).toEqual({ jobs: 'siamraj-pre:OPL6911006', events: '1' });
    expect([temp.body.request?.['งานที่ทำ ตั้งแต่ขอ'], temp.body.request?.['ใบขอ (อัตรา ตามช่วง)'], temp.body.errors]).toEqual([{ รวม: 1, 'Gen link': 0, โพสต์: 0, Scrap: 1, Autopost: 0, ลงผลติดต่อ: 0, ลงนัด: 0 }, { ยกมา: 0, ขอใหม่: 1, หาได้แล้ว: 0, ยกเลิก: 0, เหลือหา: 1 }, []]);
  });

  it('ผู้ใช้ที่ล็อก BU เดียว = เริ่มที่ชั้น BU นั้น ขอ BU อื่นไม่ได้', async () => {
    lockedBu = 'LBD';
    const r = await call({ bu: 'LBA' });
    expect(r.body.level).toEqual(['ทั้งหมด', 'LBD']);
  });

  it('อ่านเส้นใดไม่ได้ = กล่องของก้อนนั้นไม่มีเลข + บอกเหตุ (ไม่ขึ้น 0) · อ่านภาพรวมไม่ได้ = 502 และไม่จำไว้', async () => {
    fail = { stuck: true };
    const r = await call({});
    expect([box(r.body, 'reqPos')?.value, box(r.body, 'wLinks')?.value]).toEqual([null, 9]);
    expect(r.body.errors).toEqual(['อ่านใบขอของช่วงนี้ไม่ได้ — กล่องใบขอไม่มีเลข']);
    clearExecSummaryCache();
    fail = { overview: true };
    const down = await call({});
    expect([down.status, down.body.message]).toEqual([502, 'อ่านข้อมูลภาพรวมของช่วงนี้ไม่ได้ ลองใหม่อีกครั้ง']);
    fail = {};
    expect((await call({})).status).toBe(200);
  });

  it('คำขอผิดรูป = 400 ไม่อ่านอะไร · รับแต่ GET · โค้ดไม่มีคำสั่งเขียน', async () => {
    expect((await call({ from: '2026-11-10' })).status).toBe(400);
    expect((await call({ from: '2026-11-10', to: '2026-11-01' })).status).toBe(400);
    expect((await call({ month: '2026-13-01' })).status).toBe(400);
    expect((await call({ day: 'วันนี้' })).status).toBe(400);
    expect((await call({}, 'POST')).status).toBe(405);
    expect(Object.values(calls).flat()).toEqual([]);
    const src = readFileSync('api/_handlers/exec-summary.ts', 'utf8');
    expect(src).not.toMatch(/dbQuery|method: '(POST|PUT|PATCH|DELETE)'/);
    expect(src).toContain("export default withRbac(execSummaryHandler, 'job-applications');");
    expect(readFileSync('api/_handlers/registry.ts', 'utf8')).toContain("'/api/exec-summary': execSummaryHandler as ApiHandler,");
  });
});
