// @vitest-environment node
/**
 * GET /api/team-online — หน้า "ทีม Online" (29 ก.ย. 2569)
 * 🔴 ด่าน: ผู้ใช้ถูกล็อกแผนก = BU ของตัวเองเสมอ (ทุกก้อน รวมตารางต่อ BU) · ก้อนล้มแยกกัน (null + เหตุ ห้าม 0 ปลอม) ·
 *    คิวรีใช้นิยามกลาง (ผลโทร/ยกเลิก/Lead) · ร่องรอยการใช้งานห้ามมีคู่ updated_by ที่ระบบเขียนเอง
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
const loadMatchingBuScope = vi.fn();
const listSiamrajUnitRequests = vi.fn();
const loadRequestTrendPayload = vi.fn();
vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: (...a: unknown[]) => dbQuery(...a) }));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));
vi.mock('../../api/_lib/http.js', async (orig) => ({ ...(await orig<typeof import('../../api/_lib/http.js')>()), withAuth: (h: unknown) => h }));
vi.mock('../../api/_lib/departmentScope.js', () => ({ loadMatchingBuScope: (...a: unknown[]) => loadMatchingBuScope(...a) }));
vi.mock('../../api/_lib/siamrajUnitRequests.js', () => ({ listSiamrajUnitRequests: (...a: unknown[]) => listSiamrajUnitRequests(...a) }));
vi.mock('../../api/_lib/requestTrendRows.js', () => ({
  loadRequestTrendPayload: (...a: unknown[]) => loadRequestTrendPayload(...a),
  requestTrendDataFrom: (today: string) => `${Number(today.slice(0, 4)) - 2}-01-01`,
}));

const mod = await import('../../api/_handlers/team-online.js');
const handler = mod.default as unknown as (req: unknown, res: unknown) => Promise<void>;

const FEED = [
  { id: 'siamraj-sql:A1', site_code: '66LML0011', position_units: 5 },
  { id: 'siamraj-sql:A2', site_code: '65LBDL0143', position_units: 2 },
  { id: 'siamraj-pre:P1', site_code: '', position_units: 3 },
];

/** ตอบตามคิวรี — แยกด้วยชื่อตาราง/คอลัมน์ที่มีแค่คิวรีนั้น */
function fakeDb(sql: string) {
  if (sql.includes('min(created_at) as at from audit_logs')) return { rows: [{ at: '2026-07-01T00:00:00Z' }] };
  if (sql.includes('min(first_result_at)')) return { rows: [{ at: '2026-09-23T00:00:00Z' }] };
  if (sql.includes('with ev as')) {
    return {
      rows: [
        { uid: 'u1', bucket: '2026-09-29 09', cur: true },
        { uid: 'u2', bucket: '2026-09-28 09', cur: false },
      ],
    };
  }
  if (sql.includes('from lumos_dispatch_queue q')) {
    return {
      rows: [
        { who: 'p1', bu: 'LBD', person_ref: 'app-1', outcome: 'confirmed', summary: null, reply: null, first_at: '2026-09-29T02:00:00Z', last_at: '2026-09-29T02:00:00Z' },
        { who: 'p2', bu: 'LM', person_ref: 'app-2', outcome: 'no_answer', summary: null, reply: null, first_at: '2026-09-29T02:00:00Z', last_at: '2026-09-29T02:00:00Z' },
      ],
    };
  }
  if (sql.includes('from recruit_postings p')) {
    return {
      rows: [
        { job_id: 'siamraj-sql:A2', first_at: '2026-09-29T01:00:00Z', bu: 'LBD', applicants: 2 },
        { job_id: 'siamraj-sql:A1', first_at: '2026-09-01T01:00:00Z', bu: 'LM', applicants: 0 },
      ],
    };
  }
  return { rows: [] };
}

function run(query: Record<string, string> = {}) {
  const json = vi.fn();
  const res = { status: vi.fn(() => ({ json })), setHeader: vi.fn() };
  return handler({ method: 'GET', user: { sub: `u${Math.random()}`, role: 'admin' }, query }, res).then(() => json.mock.calls[0]?.[0]);
}

/** เส้นจำผล 60 วิต่อ (ขอบเขต, ช่วง, BU) ⇒ เลื่อนนาฬิกาข้ามแคชทุกเคส (ปลอมแค่ Date) */
let tick = 0;
beforeEach(() => {
  tick += 1;
  vi.useFakeTimers({ toFake: ['Date'] });
  // 29 ก.ย. 2569 10:00 ไทย + เลื่อนทีละ 2 นาที (ยังอยู่วันเดียวกัน)
  vi.setSystemTime(new Date(Date.UTC(2026, 8, 29, 3, 0, 0) + tick * 120_000));
  dbQuery.mockReset().mockImplementation(async (sql: string) => fakeDb(sql));
  loadMatchingBuScope.mockReset().mockResolvedValue({ mode: 'all' });
  listSiamrajUnitRequests.mockReset().mockResolvedValue(FEED);
  loadRequestTrendPayload.mockReset().mockResolvedValue({
    range: { from: '2024-01-01', to: '2027-03-30' },
    requests: [
      { requestNo: 'R1', submittedDate: '2026-09-29', cohortDate: '2026-10-01', departmentCode: 'LBD' },
      { requestNo: 'R2', submittedDate: '2026-09-28', cohortDate: '2026-09-28', departmentCode: 'LM' },
    ],
    informs: [],
    source: 'fresh',
    ageSeconds: 0,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ขอบเขต + BU + ช่วงเวลา', () => {
  it('ช่วงเวลาผิด = วันนี้ · ผู้ใช้เห็นทั้งหมดรับ bu จากพารามิเตอร์', async () => {
    const body = await run({ period: 'bogus', bu: 'lml' });
    expect(body.period).toBe('today');
    expect(body.bu).toBe('LM');
  });

  it('🔴 ผู้ใช้ถูกล็อกแผนก = BU ของตัวเองทุกก้อน · ตารางต่อ BU เหลือแถวเดียว · คนใช้งานยังเป็นทุก BU', async () => {
    loadMatchingBuScope.mockResolvedValue({ mode: 'code', code: 'LM' });
    const body = await run({ bu: 'LBD' });
    expect(body.bu).toBe('LM');
    expect(body.byBu.map((r: { bu: string }) => r.bu)).toEqual(['LM']);
    expect(body.lumos.called.cur).toBe(1);
    expect(body.requestsIn.cur).toBe(0);
    expect(body.requestsIn.prev).toBe(1);
    expect(body.users.cur).toBe(1);
  });

  it('ยังไม่ผูกแผนก = ไม่มีตัวเลข + บอกเหตุ ไม่ยิงคิวรี', async () => {
    loadMatchingBuScope.mockResolvedValue({ mode: 'none' });
    const body = await run({});
    expect(body.users).toBeNull();
    expect(body.errors.byBu).toContain('ยังไม่ได้ผูกแผนก');
    expect(dbQuery).not.toHaveBeenCalled();
  });
});

describe('ตัวเลขประกอบจากแถวจริง', () => {
  it('วันนี้: ใบขอเข้า (ERP มีแต่วัน) · Lumos นับคน · Success ประกาศ · ต่อ BU มีแถวไม่ระบุ BU ท้ายสุด', async () => {
    const body = await run({ period: 'today' });
    expect(body.errors).toEqual({});
    expect(body.requestsIn).toMatchObject({ cur: 1, prev: 1, dateOnly: true, series: [] });
    expect(body.lumos.called.cur).toBe(2);
    expect(body.lumos.reached.cur).toBe(1);
    expect(body.lumos.noAnswer.cur).toBe(1);
    expect(body.postings.published.cur).toBe(1);
    expect(body.postings.withApplicants.cur).toBe(1);
    expect(body.byBu.map((r: { bu: string }) => r.bu).at(-1)).toBe('');
    expect(body.bu_options.map((o: { bu: string }) => o.bu)).not.toContain('');
    const lm = body.byBu.find((r: { bu: string }) => r.bu === 'LM');
    // Gen link ตั้งแต่ 1 ก.ย. ยังไม่มีผู้สมัคร = เกิน 7 วัน
    expect(lm).toMatchObject({ openNow: 1, openWithoutLink: 0, staleNoApplicants: 1, remaining: 5 });
    const total = body.byBu.reduce((s: number, r: { remaining: number }) => s + r.remaining, 0);
    expect(total).toBe(10);
  });

  it('🔴 ERP ล่ม = ใบขอเข้า null + บอกเหตุ · ตารางต่อ BU ยังขึ้นแต่คอลัมน์ใบขอเข้าเป็น null (ไม่ใช่ 0)', async () => {
    loadRequestTrendPayload.mockRejectedValue(new Error('ERP down'));
    const body = await run({ period: 'week' });
    expect(body.requestsIn).toBeNull();
    expect(body.errors.requestsIn).toBeTruthy();
    expect(body.byBu.length).toBeGreaterThan(0);
    expect(body.byBu.every((r: { requestsIn: number | null }) => r.requestsIn === null)).toBe(true);
    expect(body.lumos).not.toBeNull();
  });

  it('feed ล่ม = ตารางต่อ BU null + บอกเหตุ · การ์ดยังขึ้น', async () => {
    listSiamrajUnitRequests.mockRejectedValue(new Error('feed down'));
    const body = await run({ period: 'month' });
    expect(body.byBu).toBeNull();
    expect(body.errors.byBu).toContain('ใบขอที่เปิดอยู่');
    expect(body.postings).not.toBeNull();
  });
});

describe('โครงคิวรี (นิยามกลาง)', () => {
  it('คนใช้งาน: รวมร่องรอยทุกตาราง · ต่อกับตารางผู้ใช้ · ไม่มีคู่ updated_by ของงานติดตาม (ผล Lumos ขยับ updated_at)', () => {
    const sql = mod.usersSql();
    for (const [t] of mod.ACTIVITY_SOURCES) expect(sql).toContain(`from ${t}`);
    expect(sql).toContain('join users u on u.id = ev.uid');
    expect(mod.ACTIVITY_SOURCES.some(([t, u]) => t === 'follow_entries' && u === 'updated_by')).toBe(false);
    expect(sql).toContain("to_char(timezone('Asia/Bangkok', ev.at), $3)");
  });

  it('Lumos: เลนหน้าสาธารณะ · ผลจาก last_outcome ก่อน result · ไม่นับยกเลิก · ห้ามเขียน result is null', () => {
    const sql = mod.callsSql();
    expect(sql).toContain("q.person_ref like 'app-%'");
    expect(sql).toContain("coalesce(q.last_outcome, q.result->>'outcome')");
    expect(sql).toContain("q.status = 'cancelled'");
    expect(sql).not.toMatch(/result is null/);
  });

  it('ประกาศ: ประกาศแรกของใบ · ผู้สมัครไม่นับ Lead (ตัวเดียวกับการ์ดกล่องงาน) · BU จากไซต์ก่อนแผนก', () => {
    const sql = mod.postingsSql();
    expect(sql).toContain('min(p.created_at) as first_at');
    expect(sql).toContain('not coalesce(a.is_lead, false)');
    expect(sql).toContain('left join job_site_map m on m.job_id = fp.job_id');
  });
});
