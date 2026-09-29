// @vitest-environment node
/**
 * GET /api/team-online — หน้า "ทีม Online" (29 ก.ย. 2569 · รอบ 2 ปฏิทิน + เทียบ BU)
 * 🔴 ด่าน: ผู้ใช้ถูกล็อกแผนก = BU ของตัวเองเสมอ (ทุกก้อน รวมตารางต่อ BU) · การ์ดคนใช้งานยังเป็นทุก BU ·
 *    ก้อนล้มแยกกัน (null + เหตุ ห้าม 0 ปลอม) · ติดตรงไหน: เลขที่ชนใบล่วงหน้าไม่จับคู่ ·
 *    🔴 ผลสายสัมภาษณ์ AI ("confirmed") ไม่ใช่นัด — นัด = บันทึกนัดของเจ้าหน้าที่ (`HAS_APPOINTMENT_SQL`) เท่านั้น (แก้รอบ 4) ·
 *    ผลมาตามนัดที่ยังไม่เคยบันทึก = null · คิวรีใช้นิยามกลาง (ผลโทร/ยกเลิก/Lead)
 * รอบ 4: ใบเปิด = ชุดเดียวกับหัวกล่องงาน (ใบที่ RM รับทราบแล้วไม่นับ) · เลน + ใบไม่มีผู้สมัคร · ผู้สมัครมาจากไหน/มาแล้วยังไง ·
 *    งานที่ต้องทำใช้ยอดทั้งสิทธิ์ (`scope`/`backlogScope`) · รายชื่อเฉพาะหัวหน้า/admin
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
// feed ตัวเดียวกับกล่องงาน (สำเนาร่วม + ของแนบ) — ตัวจริงแนบสถานะทำงาน/หมายเหตุให้แล้ว ที่นี่ส่งแถวของเทสต์ตรง ๆ
vi.mock('../../api/_handlers/siamraj-unit-requests.js', () => ({
  readUnitRequestListThroughCache: async (...a: unknown[]) => ({ value: await listSiamrajUnitRequests(...a), fetchedAt: Date.now(), source: 'live' }),
}));
vi.mock('../../api/_lib/siamrajSqlServerPrequests.js', () => ({ PREQUEST_ID_PREFIX: 'siamraj-pre:' }));
vi.mock('../../api/_lib/requestTrendRows.js', () => ({
  loadRequestTrendPayload: (...a: unknown[]) => loadRequestTrendPayload(...a),
  requestTrendDataFrom: (today: string) => `${Number(today.slice(0, 4)) - 2}-01-01`,
}));

const mod = await import('../../api/_handlers/team-online.js');
const handler = mod.default as unknown as (req: unknown, res: unknown) => Promise<void>;

const FEED = [
  { id: 'siamraj-sql:R1', externalId: 'R1', status: 'open', site_code: '65LBDL0143', position_units: 2, request_date: '2026-09-10' },
  { id: 'siamraj-sql:R9', externalId: 'R9', status: 'open', site_code: '66LML0011', position_units: 5, request_date: '2026-05-01' },
  { id: 'siamraj-pre:R2', status: 'open', site_code: '', position_units: 3, request_date: '2026-09-27' },
  // ERP พาไปเริ่มงานแล้ว (สถานะทำงานที่กล่องงานแนบมา) — ไม่ใช่ "ยังต้องหาคน" · ไม่นับว่ายังไม่มีผู้สมัคร
  { id: 'siamraj-sql:R5', externalId: 'R5', status: 'open', site_code: '66LML0011', position_units: 1, request_date: '2026-01-01', work_status: 'daily_work' },
  // RM รับทราบแล้ว (feed ส่ง status closed มาด้วย) — ห้ามนับเป็นใบเปิด (กล่องงานก็ไม่โชว์)
  { id: 'siamraj-sql:R7', externalId: 'R7', status: 'closed', site_code: '65LBDL0143', position_units: 9, request_date: '2026-09-01' },
];

/** ใบสมัคร (ข้อเท็จจริงจากนิพจน์กลาง) — ช่วงนี้ LBD 2 ใบ · ใบเก่าของ LM ติดต่อได้ยังไม่ได้นัด (อยู่ในงานค้างเท่านั้น) */
const APPS = [
  {
    id: '11', job_id: 'siamraj-sql:R1', ymd: '2026-09-20', created_at: '2026-09-20T03:00:00Z', is_lead: false, referral_source: 'facebook',
    bu: 'LBD', called: true, in_queue: false, held_or_claimed: false, latest_class: 'success', has_appointment: false, wait_hours: '0.5',
  },
  {
    id: '12', job_id: 'siamraj-sql:R1', ymd: '2026-09-28', created_at: '2026-09-28T03:00:00Z', is_lead: false, referral_source: null,
    bu: 'LBD', called: false, in_queue: false, held_or_claimed: false, latest_class: null, has_appointment: false, wait_hours: null,
  },
  {
    id: '13', job_id: 'siamraj-sql:R9', ymd: '2026-03-02', created_at: '2026-03-02T03:00:00Z', is_lead: false, referral_source: 'tiktok',
    bu: '66LML', called: true, in_queue: false, held_or_claimed: false, latest_class: 'success', has_appointment: false, wait_hours: '30',
  },
];

let showedRecorded = false;

/** ตอบตามคิวรี — แยกด้วยข้อความที่มีแค่คิวรีนั้น */
function fakeDb(sql: string) {
  if (sql.includes('as wait_hours')) return { rows: APPS };
  if (sql.includes('released_at is not null')) return { rows: [{ job_id: 'siamraj-sql:R1', request_no: 'R1' }] };
  if (sql.includes('from audit_logs') && sql.includes('min(created_at)')) return { rows: [{ ymd: '2026-07-01' }] };
  if (sql.includes('from lumos_dispatch_queue') && sql.includes('min(created_at)')) return { rows: [{ ymd: '2026-08-16' }] };
  if (sql.includes('with ev as')) {
    return {
      rows: [
        { uid: 'u1', ymd: '2026-09-20' },
        { uid: 'u2', ymd: '2026-09-21' },
        { uid: 'u3', ymd: '2026-08-10' },
      ],
    };
  }
  if (sql.includes('coalesce(u.is_active')) {
    return {
      rows: [
        { id: 'u1', dept: 'LBD', role: 'staff', active: true, created_ymd: '2026-07-01', display_name: 'หนึ่ง' },
        { id: 'u2', dept: 'LM', role: 'supervisor', active: true, created_ymd: '2026-07-01', display_name: 'สอง' },
        { id: 'u3', dept: 'LBD', role: 'opl', active: true, created_ymd: '2026-07-01', display_name: 'สาม' },
      ],
    };
  }
  if (sql.includes('q.job_ref, q.person_ref')) {
    return {
      rows: [
        { ymd: '2026-09-20', bu: 'LBD', job_ref: 'siamraj-sql:R1', person_ref: 'app-a1', cancelled: false, outcome: 'confirmed', summary: null, reply: null },
        { ymd: '2026-09-21', bu: 'LBD', job_ref: 'follow', person_ref: 'follow-1', cancelled: false, outcome: 'no_answer', summary: null, reply: null },
        { ymd: '2026-09-22', bu: 'LM', job_ref: 'siamraj-sql:R9', person_ref: 'card-1', cancelled: true, outcome: null, summary: null, reply: null },
      ],
    };
  }
  if (sql.includes('from recruit_postings p')) {
    return {
      rows: [
        { job_id: 'siamraj-sql:R1', ymd: '2026-09-15', bu: 'LBD', applicants: 2 },
        // เลขที่ชนใบล่วงหน้าที่ยังเปิด — ห้ามจับกับใบขอ R2 ของ ERP
        { job_id: 'siamraj-sql:R2', ymd: '2026-09-16', bu: 'LBD', applicants: 1 },
      ],
    };
  }
  if (sql.includes('count(*)::int as applicants')) {
    return {
      rows: [
        { job_id: 'siamraj-sql:R1', applicants: 2, appointed: 0, showed: 0 },
        { job_id: 'siamraj-sql:R2', applicants: 1, appointed: 1, showed: 0 },
      ],
    };
  }
  if (sql.includes('select a.job_id, q.person_ref')) {
    return {
      rows: [{ job_id: 'siamraj-sql:R1', person_ref: 'app-a1', cancelled: false, outcome: 'confirmed', summary: null, reply: null }],
    };
  }
  if (sql.includes('exists(select 1 from application_appointment_results')) return { rows: [{ has: showedRecorded }] };
  return { rows: [] };
}

function run(query: Record<string, string> = {}, role = 'admin') {
  const json = vi.fn();
  const res = { status: vi.fn(() => ({ json })), setHeader: vi.fn() };
  return handler({ method: 'GET', user: { sub: `u${Math.random()}`, role }, query }, res).then(() => json.mock.calls[0]?.[0]);
}

/** เส้นจำผล 60 วิต่อ (ขอบเขต, พารามิเตอร์, BU) ⇒ เลื่อนนาฬิกาข้ามแคชทุกเคส (ปลอมแค่ Date) */
let tick = 0;
beforeEach(() => {
  tick += 1;
  showedRecorded = false;
  vi.useFakeTimers({ toFake: ['Date'] });
  // 29 ก.ย. 2569 10:00 ไทย + เลื่อนทีละ 2 นาที (ยังอยู่วันเดียวกัน)
  vi.setSystemTime(new Date(Date.UTC(2026, 8, 29, 3, 0, 0) + tick * 120_000));
  dbQuery.mockReset().mockImplementation(async (sql: string) => fakeDb(sql));
  loadMatchingBuScope.mockReset().mockResolvedValue({ mode: 'all' });
  listSiamrajUnitRequests.mockReset().mockResolvedValue(FEED);
  loadRequestTrendPayload.mockReset().mockResolvedValue({
    range: { from: '2024-01-01', to: '2027-03-30' },
    requests: [
      { requestNo: 'R1', submittedDate: '2026-09-10', cohortDate: '2026-10-01', departmentCode: 'LBD', positions: 2 },
      { requestNo: 'R2', submittedDate: '2026-09-11', cohortDate: '2026-09-11', departmentCode: 'LBD', positions: 1 },
      { requestNo: 'R9', submittedDate: '2026-09-12', cohortDate: '2026-09-12', departmentCode: 'LM', positions: 5 },
      { requestNo: 'R0', submittedDate: '2026-08-20', cohortDate: '2026-08-20', departmentCode: 'LM', positions: 4 },
    ],
    informs: [],
    source: 'fresh',
    ageSeconds: 0,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ช่วงเวลา + ขอบเขต + BU', () => {
  it('พารามิเตอร์ปฏิทินถึงตัวคิด · ค่าผิด = ค่าตั้งต้น 30 วัน', async () => {
    const body = await run({ from: '2026-09-01', to: '2026-09-29', grain: 'week', compare: 'lastYear', bu: 'lml' });
    expect(body.window.range).toEqual({ from: '2026-09-01', to: '2026-09-29' });
    expect(body.window.grain).toBe('week');
    expect(body.window.previous.from).toBe('2025-09-01');
    expect(body.bu).toBe('LM');
    const def = await run({ grain: 'nope' });
    expect(def.window.range).toEqual({ from: '2026-08-31', to: '2026-09-29' });
  });

  it('🔴 ผู้ใช้ถูกล็อกแผนก = BU ของตัวเองทุกก้อน · การ์ดคนใช้งานยังเป็นทุก BU', async () => {
    loadMatchingBuScope.mockResolvedValue({ mode: 'code', code: 'LM' });
    const body = await run({ bu: 'LBD' });
    expect(body.bu).toBe('LM');
    expect(body.users.byBu.map((r: { bu: string }) => r.bu)).toEqual(['LM']);
    expect(body.requests.byBu.map((r: { bu: string }) => r.bu)).toEqual(['LM']);
    expect(body.lumos.byBu.every((r: { bu: string }) => r.bu === 'LM')).toBe(true);
    expect(body.funnel.map((r: { bu: string }) => r.bu)).toEqual(['LM']);
    expect(body.byBu.map((r: { bu: string }) => r.bu)).toEqual(['LM']);
    expect(body.requests.positions.cur).toBe(5);
    expect(body.users.total.cur).toBe(2);
  });

  it('ยังไม่ผูกแผนก = ไม่มีตัวเลข + บอกเหตุ ไม่ยิงคิวรี', async () => {
    loadMatchingBuScope.mockResolvedValue({ mode: 'none' });
    const body = await run({});
    expect(body.users).toBeNull();
    expect(body.errors.funnel).toContain('ยังไม่ได้ผูกแผนก');
    expect(dbQuery).not.toHaveBeenCalled();
  });
});

describe('ตัวเลขประกอบจากแถวจริง', () => {
  it('คนใช้งาน % ต่อ BU + บทบาท · อัตราที่ขอเข้า · Lumos ทุกเลน (ยกเลิกไม่นับ) · แถวไม่ระบุ BU ท้ายตาราง BU', async () => {
    const body = await run({});
    expect(body.errors).toEqual({});
    const lbd = body.users.byBu.find((r: { bu: string }) => r.bu === 'LBD');
    expect(lbd).toMatchObject({ accounts: 2, users: 1, pct: 0.5 });
    expect(lbd.roles.map((r: { role: string }) => r.role)).toEqual(['staff', 'opl']);
    expect(body.requests.positions.cur).toBe(8);
    expect(body.requests.requests.cur).toBe(3);
    expect(body.lumos.total).toMatchObject({ sent: 2, called: 2, success: 1 });
    expect(body.lumos.lanes.follow.sent).toBe(1);
    expect(body.lumos.coverage.prev).toBe('partial');
    expect(body.byBu.at(-1).bu).toBe('');
    expect(body.bu_options.map((o: { bu: string }) => o.bu)).not.toContain('');
  });

  it('🔴 ติดตรงไหน: เลขที่ชนใบล่วงหน้าไม่จับคู่ · ผลสายสัมภาษณ์ AI ไม่ใช่นัด · ผลมาตามนัดที่ไม่เคยบันทึก = null', async () => {
    const body = await run({});
    const lbd = body.funnel.find((r: { bu: string }) => r.bu === 'LBD');
    // R1 (Gen link + ผู้สมัคร + AI คุยแล้วสนใจ แต่ยังไม่มีบันทึกนัด) · R2 เลขที่ชนใบล่วงหน้า = ไม่จับอะไรเลย (นัดของมันไม่ไหลมา R2 ของ ERP)
    // ⚠️ รอบ 1–3 เคยนับ "confirmed" ของสายสัมภาษณ์ AI เป็นนัด ⇒ ขึ้น "นัด 4" ทั้งที่ไม่มีบันทึกนัดสักใบ
    expect(lbd.counts).toMatchObject({ requests: 2, genLink: 1, applicants: 1, aiCalled: 1, interested: 1, appointed: 0, showed: null });
    showedRecorded = true;
    const later = await run({ grain: 'day' });
    expect(later.funnel.find((r: { bu: string }) => r.bu === 'LBD').counts.showed).toBe(0);
  });

  it('🔴 ERP ล่ม = ใบขอเข้า null + ติดตรงไหน null (บอกเหตุ) · ก้อนอื่นยังขึ้น', async () => {
    loadRequestTrendPayload.mockRejectedValue(new Error('ERP down'));
    const body = await run({ grain: 'month' });
    expect(body.requests).toBeNull();
    expect(body.funnel).toBeNull();
    expect(body.errors.requests).toBeTruthy();
    expect(body.errors.funnel).toBeTruthy();
    expect(body.lumos).not.toBeNull();
    expect(body.users).not.toBeNull();
  });

  it('🔴 ใบเปิด = ชุดเดียวกับหัวกล่องงาน — ใบที่ RM รับทราบแล้ว (status closed) ไม่นับ', async () => {
    const body = await run({});
    const lbd = body.byBu.find((r: { bu: string }) => r.bu === 'LBD');
    expect(lbd).toMatchObject({ openNow: 1, remaining: 2 });
    expect(body.lanes.scope.open).toBe(4);
  });

  it('เลนกล่องงาน + ใบยังไม่มีผู้สมัครแยกอายุ · ยอดทั้งสิทธิ์ (scope) ไม่ตามตัวกรอง BU · ลิงก์ใบพกรหัส ERP', async () => {
    const body = await run({ bu: 'LBD' });
    // ทั้งสิทธิ์: R1 ปล่อยแล้วมีผู้สมัคร · R9 ยังไม่ปล่อย ไม่มีผู้สมัคร (ค้าง 151 วัน) ·
    // R2 ใบล่วงหน้า = มีผู้สมัคร 1 จากประกาศที่เก็บคีย์ siamraj-sql:R2 (ทางถอยเลขที่ใบ — ตัวเดียวกับเลขบนการ์ดกล่องงาน)
    // R5 เริ่มงานแล้ว (work_status daily_work) = started ไม่ใช่ sourcing · ไม่นับว่ายังไม่มีผู้สมัคร
    expect(body.lanes.scope).toMatchObject({ open: 4, sourcing: 2, started: 1, applied: 1, silent: 0, noApplicants: 1, oldestDays: 151 });
    expect(body.lanes.scope.aging).toMatchObject({ d0_3: 0, d91: 1 });
    // ตามตัวกรอง BU ของหน้า = LBD อย่างเดียว
    expect(body.lanes.total).toMatchObject({ open: 1, applied: 1, noApplicants: 0 });
    expect(body.lanes.byBu.map((r: { bu: string }) => r.bu)).toEqual(expect.arrayContaining(['LBD', 'LM', '']));
    const all = await run({});
    expect(all.lanes.oldest[0]).toMatchObject({ id: 'siamraj-sql:R9', externalId: 'R9', requestNo: 'R9', ageDays: 151 });
  });

  it('ผู้สมัคร: มาจากไหน · มาแล้วยังไง ตามช่วง · งานค้างตอนนี้ทุกวันที่สมัคร · งานที่ต้องทำใช้ยอดทั้งสิทธิ์', async () => {
    const body = await run({ bu: 'LBD' });
    expect(body.applicants.total.cur).toBe(2);
    expect(body.applicants.sources).toEqual({ facebook: 1, '': 1 });
    expect(body.applicants.stages).toMatchObject({ success_unscheduled: 1, untouched: 1 });
    expect(body.applicants.waitMedianHours).toBe(0.5);
    // ตามตัวกรอง BU (LBD) vs ทั้งสิทธิ์ (มีใบเก่าของ LM ที่ติดต่อได้ยังไม่ได้นัด)
    expect(body.applicants.backlog.stages.success_unscheduled).toBe(1);
    expect(body.applicants.backlogScope.stages.success_unscheduled).toBe(2);
    expect(body.applicants.byBu.find((r: { bu: string }) => r.bu === 'LM')?.total.cur ?? 0).toBe(0);
  });

  it('🔴 รายชื่อคนใช้งาน: หัวหน้า/admin ได้ชื่อ · เจ้าหน้าที่ได้ null (เซิร์ฟเวอร์ตัดสิน)', async () => {
    const admin = await run({});
    expect(admin.people.map((p: { name: string }) => p.name)).toEqual(expect.arrayContaining(['หนึ่ง', 'สอง', 'สาม']));
    // ใช้ในช่วงนี้ไม่ได้ (u3 ใช้ล่าสุด ส.ค.) ขึ้นก่อน
    expect(admin.people[0]).toMatchObject({ id: 'u3', days: 0 });
    const sup = await run({ grain: 'week' }, 'supervisor');
    expect(sup.people).not.toBeNull();
    const staff = await run({ grain: 'month' }, 'staff');
    expect(staff.people).toBeNull();
  });

  it('feed ล่ม = ตารางต่อ BU null + บอกเหตุ · การ์ดยังขึ้น', async () => {
    listSiamrajUnitRequests.mockRejectedValue(new Error('feed down'));
    const body = await run({ grain: 'quarter' });
    expect(body.byBu).toBeNull();
    expect(body.errors.byBu).toContain('ใบขอที่เปิดอยู่');
    expect(body.postings).not.toBeNull();
  });
});

describe('โครงคิวรี (นิยามกลาง)', () => {
  it('คนใช้งาน: รวมร่องรอยทุกตาราง · ต่อกับตารางผู้ใช้ · ไม่มีคู่ updated_by ของงานติดตาม · วันไทย', () => {
    const sql = mod.usersSql();
    for (const [t] of mod.ACTIVITY_SOURCES) expect(sql).toContain(`from ${t}`);
    expect(sql).toContain('join users u on u.id = ev.uid');
    expect(mod.ACTIVITY_SOURCES.some(([t, u]) => t === 'follow_entries' && u === 'updated_by')).toBe(false);
    expect(sql).toContain("to_char(timezone('Asia/Bangkok', ev.at), 'YYYY-MM-DD')");
  });

  it('Lumos: ผลจาก last_outcome ก่อน result · ยกเลิกตัวกลาง · วันที่เข้าคิว · ห้ามเขียน result is null', () => {
    const sql = mod.queueSql();
    expect(sql).toContain("coalesce(q.last_outcome, q.result->>'outcome')");
    expect(sql).toContain("q.status = 'cancelled'");
    expect(sql).toContain("to_char(timezone('Asia/Bangkok', q.created_at), 'YYYY-MM-DD')");
    expect(sql).not.toMatch(/result is null/);
    // ติดตรงไหน: สายของผู้สมัครทุกช่องทาง (ไม่แยกสายสัมภาษณ์) — ผลสายไม่ได้ใช้ตัดสิน "นัด" แล้ว
    expect(mod.funnelCallsSql()).not.toContain('q.channel');
    expect(mod.funnelJobsSql()).toContain('c.ok and c.appointment_at is not null');
  });

  it('ประกาศ/ติดตรงไหน: ผู้สมัครไม่นับ Lead (ตัวเดียวกับการ์ดกล่องงาน) · BU จากไซต์ก่อนแผนก', () => {
    expect(mod.postingsSql()).toContain('not coalesce(a.is_lead, false)');
    expect(mod.postingsSql()).toContain('left join job_site_map m on m.job_id = fp.job_id');
    expect(mod.funnelJobsSql()).toContain('not coalesce(a.is_lead, false)');
    expect(mod.accountsSql()).toContain('u.department_code');
  });
});
