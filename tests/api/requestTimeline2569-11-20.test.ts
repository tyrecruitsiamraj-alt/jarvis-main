/**
 * GET /api/request-timeline — ใบขอทำอะไรไปแล้ว (แท็บ Scale ลง · เจ้าของ 20 พ.ย. 2569 ผู้บริหารถามย้อนกลับ)
 * 🔴 ด่าน: อ่านอย่างเดียว · ใบนอก BU ที่เห็น = null (ไม่ถามงานของใบนั้น) · สถานะคำสั่งเป็นคำที่คนอ่าน · ไม่มีชื่อผู้สมัคร
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecruitAppFact } from '../../src/lib/recruitOverviewTypes';

const calls: Array<[string, unknown[]]> = [];
let replyFor: (sql: string) => unknown[] = () => [];
let scope: unknown = { mode: 'all' };
let facts: RecruitAppFact[] = [];
const factJobs: string[][] = [];
vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: async (sql: string, p: unknown[]) => (calls.push([sql, p]), { rows: replyFor(sql) }) }));
vi.mock('../../api/_lib/departmentScope.js', async (o) => ({ ...(await o<object>()), loadMatchingBuScope: async () => scope, loadUserDepartmentScope: async () => scope }));
/** สมุดใบขอ ERP ที่กรองตามสิทธิ์ของผู้ถามแล้ว — null = อ่านไม่ได้ */
let ledger: Array<{ requestNo: string; bu: string; prequest?: boolean }> | null = [];
const ledgerCalls: unknown[] = [];
vi.mock('../../api/_lib/siamrajPenaltyLedgerSql.js', () => ({
  loadPenaltyLedgerRaw: async (s: unknown) => {
    ledgerCalls.push(s);
    if (!ledger) throw new Error('ERP ไม่ตอบ');
    return { rows: ledger, informs: [], customerFines: [] };
  },
}));
vi.mock('../../api/_lib/http.js', async (o) => ({ ...(await o<object>()), withRbac: (h: unknown) => h }));
vi.mock('../../api/_handlers/recruit-overview.js', () => ({ loadFactsForJobs: async (ids: string[]) => (factJobs.push(ids), facts.filter((f) => f.jobId && ids.includes(f.jobId))) }));

const { requestTimelineHandler, requestEventsSql, requestVisibleSql } = await import('../../api/_handlers/request-timeline');

async function call(query: Record<string, string>, method = 'GET') {
  let status = 0;
  let body: unknown = null;
  const res = { setHeader() {}, status: (s: number) => ((status = s), { json: (b: unknown) => (body = b) }) };
  await requestTimelineHandler({ method, query, user: { sub: 'u', role: 'admin' } } as never, res as never);
  return { status, body: body as { jobs: Record<string, { done: { work: Record<string, number>; chain: number[] }; events: Array<Record<string, unknown>> | null } | null> } };
}

const A = 'siamraj-sql:OPL6911006';
const B = 'siamraj-pre:OPL6911006';
const fact = (id: string, over: Partial<RecruitAppFact> = {}): RecruitAppFact => ({
  id,
  createdAt: '2026-11-10T00:30:00.000Z',
  jobId: A,
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
  ...over,
});
const EVENTS = [
  { job_id: A, day: '2026-11-04', kind: 'links', who: 'เจมส์', detail: 'Facebook · Facebook Group', n: 3, extra: 0 },
  { job_id: A, day: '2026-11-04', kind: 'manualPosted', who: 'เจมส์', detail: 'Facebook · Facebook Group', n: 2, extra: 0 },
  { job_id: A, day: '2026-11-20', kind: 'scrap', who: 'เจมส์', detail: 'rejected', n: 74, extra: 0 },
  { job_id: A, day: '2026-11-20', kind: 'scrap', who: 'เจมส์', detail: 'completed', n: 5, extra: 0 },
  { job_id: A, day: '2026-11-20', kind: 'scrap', who: 'เจมส์', detail: 'filled', n: 1, extra: 0 },
  { job_id: A, day: '2026-11-06', kind: 'autopost', who: 'คิว', detail: 'pending', n: 1, extra: 0 },
  { job_id: A, day: '2026-11-11', kind: 'contacts', who: 'แป๋ม', detail: 'นัดได้', n: 1, extra: 1 },
  { job_id: A, day: '2026-11-11', kind: 'contacts', who: 'แป๋ม', detail: 'ติดต่อไม่ได้ · ไม่รับสาย', n: 2, extra: 0 },
  { job_id: A, day: '2026-11-12', kind: 'attendance', who: 'แป๋ม', detail: 'showed', n: 1, extra: 0 },
  { job_id: B, day: '2026-11-05', kind: 'links', who: 'ใหม่', detail: 'Tiktok · Tiktok Live', n: 4, extra: 0 },
];

beforeEach(() => {
  calls.length = 0;
  factJobs.length = 0;
  ledgerCalls.length = 0;
  ledger = [];
  scope = { mode: 'all' };
  replyFor = (sql) => (sql.includes('job_site_map') ? [] : EVENTS);
  facts = [
    fact('app-9f1c0a11', { calledByAi: true, aiAnswer: 'said_yes', aiAnswerAt: '2026-11-10T01:00:00.000Z', logOk: true, appointmentAt: '2026-11-12T03:00:00.000Z', attendance: 'showed', informed: true, informedAt: '2026-11-18' }),
    fact('app-9f1c0a12', { createdAt: '2026-11-10T02:00:00.000Z', calledByAi: true, aiAnswer: 'said_no', aiAnswerAt: '2026-11-10T03:00:00.000Z' }),
    // กรอก 01:30 เวลาไทยของวันที่ 20
    fact('app-9f1c0a16', { createdAt: '2026-11-19T18:30:00.000Z', channelLabel: 'Tiktok · Tiktok Live' }),
  ];
});

describe('GET /api/request-timeline', () => {
  it('สรุปต่อใบ: งานที่ทำทุกชนิด + รายชื่อไล่ตามสายเดียวกับแท็บ · ไม่ขอ events = ไม่ส่งเหตุการณ์', async () => {
    const r = await call({ jobs: `${A},${B}` });
    expect(r.status).toBe(200);
    expect(r.body.jobs[A]).toEqual({ done: { work: { links: 3, manualPosted: 2, autopost: 1, scrap: 80, contacts: 3, appts: 1 }, chain: [3, 2, 1, 1, 1, 1, 1] }, events: null });
    expect(r.body.jobs[B]).toEqual({ done: { work: { links: 4, manualPosted: 0, autopost: 0, scrap: 0, contacts: 0, appts: 0 }, chain: [0, 0, 0, 0, 0, 0, 0] }, events: null });
    // แอดมินเห็นทุก BU — ไม่ต้องถามว่าใบอยู่ BU ไหน
    expect(calls.some(([sql]) => sql.includes('job_site_map'))).toBe(false);
    expect(calls.at(-1)?.[1]).toEqual([[A, B]]);
    expect(factJobs).toEqual([[A, B]]);
  });

  it('events=1: ไล่ตามวัน · สถานะคำสั่งเป็นคำที่คนอ่าน (หลายสถานะรวมเป็นคำเดียว) · รายชื่อ/AI/แจ้งเข้า นับเป็นจำนวน ไม่มีชื่อคน', async () => {
    const r = await call({ jobs: A, events: '1' });
    const ev = r.body.jobs[A]?.events ?? [];
    const pick = (kind: string) => ev.filter((e) => e.kind === kind).map((e) => [e.day, e.who, e.detail, e.n]);
    expect(pick('scrap')).toEqual([['2026-11-20', 'เจมส์', 'ไม่สำเร็จ', 74], ['2026-11-20', 'เจมส์', 'สำเร็จ', 6]]);
    expect(pick('autopost')).toEqual([['2026-11-06', 'คิว', 'รอ', 1]]);
    expect(pick('attendance')).toEqual([['2026-11-12', 'แป๋ม', 'มา', 1]]);
    expect(pick('contacts')).toEqual([['2026-11-11', 'แป๋ม', 'นัดได้', 1], ['2026-11-11', 'แป๋ม', 'ติดต่อไม่ได้ · ไม่รับสาย', 2]]);
    // รายชื่อเข้า: วันไทยของเวลากรอก + ช่องทาง · สองใบวันเดียวกันช่องทางเดียวกันรวมเป็นแถวเดียว
    expect(pick('names').map(([d, , , n]) => [d, n])).toEqual([['2026-11-10', 2], ['2026-11-20', 1]]);
    expect(pick('ai')).toEqual([['2026-11-10', 'AI', 'สนใจ', 1], ['2026-11-10', 'AI', 'ไม่สนใจ', 1]]);
    expect(pick('informed')).toEqual([['2026-11-18', null, null, 1]]);
    expect(JSON.stringify(ev)).not.toMatch(/app-9f1c0a|phone|full_name/);
  });

  it('ผู้ใช้ที่เห็นบาง BU: ใบนอก BU = null และไม่ถามงานของใบนั้น', async () => {
    scope = { mode: 'code', code: 'LBD', codes: ['LBD'] };
    replyFor = (sql) => (sql.includes('job_site_map') ? [{ job_id: A }] : EVENTS.filter((e) => e.job_id === A));
    const r = await call({ jobs: `${A},${B}` });
    expect(r.body.jobs[B]).toBeNull();
    expect(r.body.jobs[A]?.done.work.links).toBe(3);
    const [visibleSql, visibleParams] = calls[0];
    expect(visibleSql).toContain('job_site_map');
    expect(visibleParams).toEqual([[A, B], ['LBD']]);
    expect(calls[1][1]).toEqual([[A]]);
    expect(factJobs).toEqual([[A]]);
  });

  it('ใบขอชั่วคราวที่ฝั่งเราไม่รู้ BU: ถามสมุดใบขอที่กรองตามสิทธิ์แล้ว — อยู่ใน BU ที่เห็น = เห็น · ไม่อยู่ / ERP ไม่ตอบ = ไม่เห็น', async () => {
    scope = { mode: 'code', code: 'LBD', codes: ['LBD'] };
    replyFor = (sql) => (sql.includes('job_site_map') ? [{ job_id: A }] : EVENTS);
    ledger = [{ requestNo: 'ชั่วคราว OPL6911006', bu: 'LBD', prequest: true }];
    const seen = await call({ jobs: `${A},${B}` });
    expect(seen.body.jobs[B]?.done.work.links).toBe(4);
    expect(ledgerCalls).toEqual([scope]);
    // ใบขอชั่วคราวของ BU อื่น (เลขเดียวกับใบจริงที่เห็น) ต้องไม่หลุด
    ledger = [{ requestNo: 'ชั่วคราว OPL6911006', bu: 'LBA', prequest: true }, { requestNo: 'OPL6911006', bu: 'LBD' }];
    expect((await call({ jobs: `${A},${B}` })).body.jobs[B]).toBeNull();
    ledger = null;
    const blind = await call({ jobs: `${A},${B}` });
    expect(blind.status).toBe(200);
    expect([blind.body.jobs[A]?.done.work.links, blind.body.jobs[B]]).toEqual([3, null]);
    // ทุกใบรู้ BU จากฝั่งเราแล้ว = ไม่ต้องถาม ERP
    ledgerCalls.length = 0;
    await call({ jobs: A });
    expect(ledgerCalls).toEqual([]);
  });

  it('ไม่มีสิทธิ์ BU ไหนเลย = ทุกใบ null ไม่ถามฐาน', async () => {
    scope = { mode: 'none' };
    const r = await call({ jobs: A });
    expect(r.body.jobs).toEqual({ [A]: null });
    expect(calls).toEqual([]);
    expect(factJobs).toEqual([]);
  });

  it('คำขอผิดรูป = 400 ไม่ถามฐาน · รับแต่ GET', async () => {
    expect((await call({})).status).toBe(400);
    expect((await call({ jobs: 'OPL6911006' })).status).toBe(400);
    expect((await call({ jobs: `${A},standalone:thai_executive` })).status).toBe(400);
    expect((await call({ jobs: Array.from({ length: 31 }, (_, i) => `siamraj-sql:OPL69110${String(i).padStart(2, '0')}`).join(',') })).status).toBe(400);
    expect((await call({ jobs: A }, 'POST')).status).toBe(405);
    expect(calls).toEqual([]);
  });

  it('SQL อ่านอย่างเดียว จากแหล่งเดียวกับงานรายคน · BU ของใบ = ไซต์ของใบขอ', () => {
    const sql = requestEventsSql();
    for (const t of ['recruit_posting_links', 'recruit_posting_link_posts', 'job_posting_requests', 'application_contact_logs', 'application_appointment_results']) expect(sql).toContain(t);
    expect(sql).toContain('coalesce(l.responsible_user_id, l.created_by_user_id)');
    expect(sql).toContain("at time zone 'Asia/Bangkok'");
    for (const s of [sql, requestVisibleSql()]) expect(s).not.toMatch(/\b(insert|update|delete|truncate|alter|drop)\b/i);
    expect(requestVisibleSql()).toContain('site_code');
    // ใบขอชั่วคราวไม่มีรหัสไซต์ — ถอยไป BU ของประกาศ
    expect(requestVisibleSql()).toContain('p.department_code');
    // ไม่ดึงชื่อ/เบอร์ผู้สมัคร
    expect(sql).not.toMatch(/a\.full_name|a\.phone/);
  });
});
