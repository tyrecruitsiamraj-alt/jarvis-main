// @vitest-environment node
/**
 * GET /api/recruit-overview — หน้า "ภาพรวมงานสรรหา" แบบ iRecruit (แท็บภาพรวมของกล่องงาน · 30 ก.ย. 2569)
 * 🔴 ด่าน: อ่านอย่างเดียว · ไม่คืนชื่อ/เบอร์ผู้สมัคร · ผู้ใช้ผูกแผนก = BU ของตัวเองทุกคิวรี · นิยามจากตัวกลางเท่านั้น ·
 *    ก้อนล้มแยกกัน (null + เหตุ ห้าม 0) · อายุงานค้างนับวันเต็ม (ครบ 24 ชม.) · บอร์ด ERP อ่านไม่ได้ = ได้ใบสมัคร null
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
const loadMatchingBuScope = vi.fn();
const loadBoardPhoneSet = vi.fn();
vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: (...a: unknown[]) => dbQuery(...a),
  isPgUndefinedTable: (e: unknown) => (e as { code?: string })?.code === '42P01',
}));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));
vi.mock('../../api/_lib/http.js', async (orig) => ({ ...(await orig<typeof import('../../api/_lib/http.js')>()), withRbac: (h: unknown) => h }));
vi.mock('../../api/_lib/departmentScope.js', () => ({ loadMatchingBuScope: (...a: unknown[]) => loadMatchingBuScope(...a) }));
vi.mock('../../api/_lib/applicationBoardLink.js', () => ({ loadBoardPhoneSet: (...a: unknown[]) => loadBoardPhoneSet(...a) }));
vi.mock('../../api/_lib/logger.js', () => ({ logError: vi.fn(), logWarn: vi.fn() }));

const mod = await import('../../api/_handlers/recruit-overview.js');
const sql = await import('../../api/_lib/applicantOverviewSql.js');
const handler = mod.default as unknown as (req: unknown, res: unknown) => Promise<void>;

const NOW = new Date('2026-09-30T12:00:00.000Z'); // 19:00 เวลาไทย
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

/** แถวข้อเท็จจริงจาก SQL — ใส่เฉพาะช่องที่เทสต์สนใจ */
const factRow = (over: Record<string, unknown> = {}) => ({
  created_at: '2026-09-10T03:00:00.000Z',
  job_id: 'siamraj-sql:R1',
  channel_label: null,
  referral_source: 'facebook',
  position: 'พนักงานขับรถ',
  phone_e164: '+66811111111',
  by_ai: true,
  by_staff: false,
  first_called_at: '2026-09-10T03:05:00.000Z',
  ai_outcome: 'confirmed',
  ai_summary: null,
  ai_reply: null,
  ai_at: '2026-09-10T03:05:00.000Z',
  staff_outcome: null,
  staff_at: null,
  staff_last_at: null,
  contact_class: 'success',
  contact_src: 'ai',
  log_ok: null,
  log_reason: null,
  log_at: null,
  appointment_at: null,
  attendance: null,
  ...over,
});

type Rows = Record<string, unknown>[];
let facts: Rows;
let backlog: Rows;
let staffEvents: Rows;
let aiEvents: Rows;
let releases: Rows;
let failReleases = false;
let noAttendanceTable = false;

function route(text: string, params?: unknown[]) {
  if (text.includes('as first_day')) return { rows: [{ first_day: '2026-08-20' }] };
  if (text.includes('any_row')) return { rows: [{ any_row: false }] };
  if (text.includes('as overdue')) return { rows: [{ overdue: 2, next7: 1 }] };
  if (text.includes("'claim'::text as kind")) return { rows: staffEvents };
  if (text.includes("r.result = 'showed'")) return { rows: [] };
  if (text.includes('as reached') && text.includes('join lumos_dispatch_queue q on')) return { rows: aiEvents };
  if (text.includes('from job_public_releases r')) {
    if (failReleases) throw new Error('boom');
    return { rows: releases };
  }
  if (text.includes('as bad_phone')) return { rows: backlog };
  if (text.includes('as first_called_at')) {
    if (noAttendanceTable && text.includes('application_appointment_results')) throw Object.assign(new Error('no table'), { code: '42P01' });
    return { rows: facts, params };
  }
  throw new Error(`unexpected sql: ${text.slice(0, 80)}`);
}

beforeEach(() => {
  dbQuery.mockReset();
  dbQuery.mockImplementation(async (text: string, params?: unknown[]) => route(text, params));
  loadMatchingBuScope.mockReset();
  loadMatchingBuScope.mockResolvedValue({ mode: 'all' });
  loadBoardPhoneSet.mockReset();
  loadBoardPhoneSet.mockResolvedValue(new Set(['+66811111111']));
  facts = [factRow(), factRow({ phone_e164: '+66822222222', by_ai: false, first_called_at: null, ai_outcome: null, ai_at: null, contact_class: null, contact_src: null })];
  backlog = [];
  staffEvents = [];
  aiEvents = [];
  releases = [
    { job_id: 'siamraj-sql:R1', ymd: '2026-09-02', applicants: 2 },
    { job_id: 'siamraj-sql:R2', ymd: '2026-09-15', applicants: 0 },
  ];
  failReleases = false;
  noAttendanceTable = false;
});

const build = (month?: string) => mod.buildRecruitOverview(month, { mode: 'all' } as never, NOW);

describe('เส้นอ่านอย่างเดียว + ขอบเขต', () => {
  it('รับแค่ GET', async () => {
    const res = { status: vi.fn(() => ({ json: vi.fn() })), setHeader: vi.fn() };
    await handler({ method: 'POST', user: { sub: 'u1', role: 'admin' }, query: {} }, res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it('🔴 ผู้ใช้ผูกแผนก = ส่ง BU ของตัวเองทุกคิวรี (รวมใบที่ประกาศ)', async () => {
    loadMatchingBuScope.mockResolvedValue({ mode: 'code', code: 'LBD' });
    const json = vi.fn();
    await handler({ method: 'GET', user: { sub: 'u1', role: 'staff' }, query: { month: '2026-09' } }, { status: () => ({ json }), setHeader: vi.fn() });
    const body = json.mock.calls[0][0];
    expect(body.bu).toBe('LBD');
    for (const [text, params] of dbQuery.mock.calls as [string, unknown[] | undefined][]) {
      if (text.includes('any_row')) continue;
      expect(params?.[params.length - 1], text.slice(0, 60)).toBe('LBD');
    }
    expect(body.releases).toEqual([{ ymd: '2026-09-02', applicants: 2 }, { ymd: '2026-09-15', applicants: 0 }]);
  });

  it('🔴 ใบที่ประกาศ = ปล่อยขึ้นหน้ารวมงาน (เจ้าของเลือก 30 ก.ย. 2569) ไม่ใช่ Gen link · ช่วงเดียวกับข้อเท็จจริง · ไม่นับ Lead', async () => {
    const text = mod.releasesSql();
    expect(text).toContain('from job_public_releases r');
    expect(text).not.toContain('recruit_postings');
    expect(text).toContain('not coalesce(a.is_lead, false)');
    await build('2026-09');
    const call = (dbQuery.mock.calls as [string, unknown[]][]).find(([t]) => t.includes('from job_public_releases r'))!;
    expect(call[1]).toEqual(['2026-08-01T00:00:00+07:00', '2026-10-01T00:00:00+07:00', null]);
  });

  it('ไม่มีสิทธิ์ BU ไหนเลย (none) = ไม่ยิงคิวรี คืนก้อนว่าง', async () => {
    const body = await mod.buildRecruitOverview('2026-09', { mode: 'none' } as never, NOW);
    expect(dbQuery).not.toHaveBeenCalled();
    expect(body.apps).toEqual([]);
  });

  it('ช่วงที่ขอ = เดือนที่เลือก + ช่วงที่เทียบ (วันไทย) · เดือนผิด/อนาคต = เดือนนี้', async () => {
    const body = await build('2027-01');
    expect(body.window).toMatchObject({ month: '2026-09', from: '2026-09-01', to: '2026-09-30', prevFrom: '2026-08-01', prevTo: '2026-08-30' });
    const factCall = (dbQuery.mock.calls as [string, unknown[]][]).find(([t]) => t.includes('as first_called_at'))!;
    expect(factCall[1]).toEqual(['2026-08-01T00:00:00+07:00', '2026-10-01T00:00:00+07:00', null]);
  });
});

describe('ข้อเท็จจริงต่อใบ — ไม่มีข้อมูลบุคคล · นิยามจากตัวกลาง', () => {
  it('🔴 ไม่คืนชื่อ/เบอร์/รหัสใบ — มีแต่ข้อเท็จจริงที่ใช้นับ', async () => {
    const body = await build('2026-09');
    const keys = Object.keys(body.apps![0]);
    for (const bad of ['id', 'phone', 'phone_e164', 'full_name', 'name', 'address']) expect(keys).not.toContain(bad);
    expect(JSON.stringify(body)).not.toContain('+668');
  });

  it('จัดถังคำตอบ AI ด้วยตัวกลาง · ขึ้นบอร์ดจับคู่ด้วยเบอร์', async () => {
    const body = await build('2026-09');
    expect(body.apps![0]).toMatchObject({ aiAnswer: 'said_yes', contact: 'success', contactBy: 'ai', onBoard: true, calledByAi: true });
    expect(body.apps![1]).toMatchObject({ aiAnswer: null, onBoard: false, calledByAi: false });
  });

  it('🔴 อ่านบอร์ด ERP ไม่ได้ = ได้ใบสมัคร null (ไม่ใช่ "ยังไม่ได้") + บอกเหตุ', async () => {
    loadBoardPhoneSet.mockResolvedValue(null);
    const body = await build('2026-09');
    expect(body.apps!.every((a) => a.onBoard === null)).toBe(true);
    expect(body.errors.board).toBeTruthy();
  });

  it('คิวรีใช้นิยามกลางทุกชิ้น (โทรแล้ว AI/คน · ผลติดต่อล่าสุด · นัด · ผลนัด) และไม่นับ Lead', () => {
    const text = mod.factsSql();
    for (const piece of [sql.CALLED_BY_AI_SQL, sql.CALLED_BY_STAFF_SQL, sql.FIRST_CALLED_AT_SQL, sql.LATEST_CONTACT_LATERAL, sql.APPOINTMENT_AT_SQL, sql.LATEST_ATTENDANCE_SQL, sql.STAFF_LAST_AT_SQL]) {
      expect(text).toContain(piece);
    }
    expect(text).toContain('not coalesce(a.is_lead, false)');
    expect(text).not.toMatch(/a\.status\b|a\.full_name|a\.address/);
  });

  it('ตารางผลนัดยังไม่ migrate = อ่านต่อได้ (ผลนัด null) ไม่ล้มทั้งหน้า', async () => {
    noAttendanceTable = true;
    const body = await build('2026-09');
    expect(body.apps).toHaveLength(2);
    expect(body.errors.apps).toBeUndefined();
  });

  it('🔴 ก้อนล้มแยกกัน — ใบที่ประกาศอ่านไม่ได้ = null + เหตุ ก้อนอื่นยังมา', async () => {
    failReleases = true;
    const body = await build('2026-09');
    expect(body.releases).toBeNull();
    expect(body.errors.releases).toBeTruthy();
    expect(body.apps).toHaveLength(2);
  });
});

describe('งานค้างตอนนี้ — อายุนับวันเต็ม (ครบ 24 ชม. = 1 วัน)', () => {
  it('ยังไม่มีใครโทร: 95 ชม. = ไม่เกิน 3 วัน · 96 ชม. = 4–7 · 191 ชม. = 4–7 · 192 ชม. = เกิน 7', () => {
    const rows = [95, 96, 191, 192].map((h) => ({ created_at: hoursAgo(h), called: false, in_queue: h === 95, bad_phone: h === 192 }));
    const b = mod.toBacklog(rows, { overdue: 0, next7: 0 }, NOW.getTime());
    expect(b.uncalled).toEqual({ total: 4, d0_3: 1, d4_7: 2, over7: 1, inQueue: 1, badPhone: 1 });
  });

  it('ตอบ AI ว่าสนใจ รอคนโทรต่อ: คนลงมือหลังคำตอบ AI = ไม่ค้าง · อายุนับจากเวลาที่ AI ได้คำตอบ', () => {
    const yes = (aiH: number, staffH: number | null) => ({
      created_at: hoursAgo(300),
      called: true,
      ai_outcome: 'confirmed',
      ai_at: hoursAgo(aiH),
      staff_last_at: staffH === null ? null : hoursAgo(staffH),
    });
    const b = mod.toBacklog([yes(23, null), yes(24, null), yes(72, null), yes(96, null), yes(50, 10), { created_at: hoursAgo(5), called: true, ai_outcome: 'declined', ai_at: hoursAgo(4) }], null, NOW.getTime());
    expect(b.waitingStaff).toEqual({ total: 4, d0: 1, d1_3: 2, over3: 1 });
    expect(b.appointments).toBeNull();
  });

  it('นัดที่รอบันทึกผล ใช้ถังเดียวกับกล่องงาน (เลยนัดยังไม่มีผล) + นัดใน 7 วัน', async () => {
    expect(mod.appointmentBacklogSql()).toContain(sql.OVERVIEW_BUCKETS.overdue_no_result);
    expect(mod.appointmentBacklogSql()).toContain(sql.UPCOMING_7D_NO_RESULT_SQL);
    const body = await build('2026-09');
    expect(body.backlog?.appointments).toEqual({ overdue: 2, next7: 1 });
  });
});

describe('ผลงานรายคน + แถว AI', () => {
  it('นับรายชื่อไม่ซ้ำต่อคน · เก็บไปโทรแยกจากโทรแล้ว · ไม่มีชื่อ = "ไม่ระบุชื่อ"', () => {
    const rows = mod.toStaffRows(
      [
        { kind: 'claim', app_id: 'a1', name: 'แบงค์' },
        { kind: 'log', app_id: 'a1', name: 'แบงค์', reached: true, appt: true },
        { kind: 'hold', app_id: 'a1', name: 'แบงค์', reached: true, appt: false },
        { kind: 'log', app_id: 'a2', name: 'แบงค์', reached: false, appt: false },
        { kind: 'log', app_id: 'a3', name: null, reached: true, appt: false },
      ],
      new Set(['a1']),
    );
    expect(rows[0]).toEqual({ name: 'แบงค์', claimed: 1, called: 2, reached: 1, appointed: 1, showed: 1 });
    expect(rows[1].name).toBe('ไม่ระบุชื่อ');
  });

  it('🔴 แถว AI: ติดต่อสำเร็จ/ตอบว่าสนใจ = ผลล่าสุดในเดือนของรายชื่อนั้น (ติดแล้วโทรซ้ำไม่ติด นับตามผลหลัง)', () => {
    const ai = mod.toAiRow([
      { app_id: 'a1', outcome: 'confirmed', at: '2026-09-10T03:00:00Z', reached: true },
      { app_id: 'a1', outcome: 'no_answer', at: '2026-09-12T03:00:00Z', reached: false },
      { app_id: 'a2', outcome: 'confirmed', at: '2026-09-11T03:00:00Z', reached: true },
    ]);
    expect(ai).toEqual({ called: 2, reached: 1, saidYes: 1 });
  });

  it('ผลโทรของ AI ใช้หลักฐานชุดเดียวกับ "โทรแล้วโดย AI"', () => {
    expect(mod.aiEventsSql()).toContain(sql.AI_RESULT_OF_APP_SQL);
    expect(sql.LATEST_AI_RESULT_LATERAL).toContain(sql.AI_RESULT_OF_APP_SQL);
  });
});
