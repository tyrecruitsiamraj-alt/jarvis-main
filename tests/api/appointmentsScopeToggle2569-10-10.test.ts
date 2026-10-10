// @vitest-environment node
/**
 * แท็บติดตามนัดหมาย: ปุ่ม "ของฉัน / ทุกคน" (QA รอบ 2 ข้อ 4 · เจ้าของ Choice 10 ต.ค. 2569)
 *
 * เจอจริง: admin เห็นนัด 1 ใบ แต่ภาพรวมนับ 8 — 6 ใบเป็นของหัวหน้าคนหนึ่งที่เก็บไว้ (claim) · ที่เหลือคือนัดค้างนิยามเก่า
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. "ของใครของมัน" ยังเป็นค่าเริ่ม — เรียกแบบเดิม (ไม่ส่ง param) ต้องได้ SQL เดิมทุกเงื่อนไข
 * 2. `scope=all` ผ่อนเฉพาะ supervisor ขึ้นไป · staff/opl ส่งมาก็ได้ลิสต์เดิม (ไม่ใช่ 403 — หน้าเว็บไม่พัง)
 * 3. ผ่อนแล้วได้ **เฉพาะแถวนัด** — ไม่งั้นใบที่คนอื่นเก็บโผล่ในแท็บผู้สมัคร แล้วกด "เก็บไปโทรเอง" ได้ 409
 * 4. หน้าเว็บ: ปุ่มเป็น ToggleGroup ของ shadcn · คำบนปุ่ม "ของฉัน" / "ทุกคน" เท่านั้น · โผล่เฉพาะ supervisor ขึ้นไป
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();

vi.mock('../../api/_lib/postgres.js', async (orig) => ({
  ...(await orig<typeof import('../../api/_lib/postgres.js')>()),
  dbQuery: (...a: unknown[]) => dbQuery(...a),
}));
vi.mock('../../api/_lib/siamrajUnitRequests.js', async (orig) => ({
  ...(await orig<typeof import('../../api/_lib/siamrajUnitRequests.js')>()),
  loadScopedJobIdSet: vi.fn(async () => null),
}));
vi.mock('../../api/_lib/departmentScope.js', async (orig) => ({
  ...(await orig<typeof import('../../api/_lib/departmentScope.js')>()),
  loadUserDepartmentScope: vi.fn(async () => ({ mode: 'all' })),
}));
vi.mock('../../api/_lib/applicationBoardLink.js', () => ({ loadBoardPhoneSet: vi.fn(async () => null) }));

import { signAuthToken, AUTH_COOKIE_NAME, type UserRole } from '../../api/_lib/auth.js';
import handler, { buildApplicationsListQuery, wantsEveryoneAppointments } from '../../api/_handlers/job-applications.js';
import {
  RM_APPOINTMENT_SCOPES,
  RM_APPOINTMENT_SCOPE_LABEL,
  RM_TAB_STATUSES,
  canSeeEveryoneAppointments,
  isRmAppointmentScope,
} from '../../src/lib/recruitRm.js';

function req(role: UserRole, query: Record<string, string>) {
  const token = signAuthToken({ sub: 'u-viewer', email: 'viewer@example.com', role });
  return {
    method: 'GET',
    headers: { cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}` },
    query,
  };
}
function mockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status, json, setHeader: vi.fn() }, status, json };
}
/** คิวรีลิสต์ที่ยิงจริง (ตัวแรกที่อ่านจากตารางใบสมัครแล้ว limit 500) */
const listCall = () => dbQuery.mock.calls.find((c) => /order by created_at desc limit 500/.test(String(c[0])));

async function get(role: UserRole, query: Record<string, string>) {
  const { res, status } = mockRes();
  await handler(req(role, query) as never, res as never);
  expect(status).toHaveBeenCalledWith(200);
  const call = listCall();
  expect(call, 'ต้องยิงคิวรีลิสต์').toBeTruthy();
  return { sql: String(call![0]), params: (call![1] ?? []) as unknown[] };
}

beforeEach(() => {
  process.env.AUTH_JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
  process.env.NODE_ENV = 'development';
  delete process.env.VERCEL_ENV;
  dbQuery.mockReset().mockResolvedValue({ rows: [] });
});

describe('สิทธิ์ของ ?view=appointments&scope=all', () => {
  const all = { view: 'appointments', scope: 'all' };

  it('supervisor / admin ผ่าน · staff / opl / ไม่รู้ role ไม่ผ่าน', () => {
    expect(wantsEveryoneAppointments(all, 'admin')).toBe(true);
    expect(wantsEveryoneAppointments(all, 'supervisor')).toBe(true);
    expect(wantsEveryoneAppointments(all, 'staff')).toBe(false);
    expect(wantsEveryoneAppointments(all, 'opl')).toBe(false);
    expect(wantsEveryoneAppointments(all, undefined)).toBe(false);
  });

  it('ต้องขอมาครบทั้งสองค่า — ขาดตัวใดตัวหนึ่ง = ลิสต์เดิม', () => {
    expect(wantsEveryoneAppointments({ scope: 'all' }, 'admin')).toBe(false);
    expect(wantsEveryoneAppointments({ view: 'appointments' }, 'admin')).toBe(false);
    expect(wantsEveryoneAppointments({ view: 'contact', scope: 'all' }, 'admin')).toBe(false);
    expect(wantsEveryoneAppointments({}, 'admin')).toBe(false);
    expect(wantsEveryoneAppointments(undefined, 'admin')).toBe(false);
  });

  it('ไม่ปนกับมุมมองที่มีเงื่อนไขของตัวเอง (รายใบ · คลังสำรอง · ถัง drill-down)', () => {
    expect(wantsEveryoneAppointments({ ...all, job_id: 'siamraj-sql:X' }, 'admin')).toBe(false);
    expect(wantsEveryoneAppointments({ ...all, lead: '1' }, 'admin')).toBe(false);
    expect(wantsEveryoneAppointments({ ...all, bucket: 'overdue_no_result' }, 'admin')).toBe(false);
  });
});

describe('GET /api/job-applications — คิวรีที่ยิงจริง', () => {
  it('🔴 staff ส่ง scope=all มา = ลิสต์เดิมเป๊ะ (ยังซ่อนใบที่คนอื่นเก็บ + Lead ของคนอื่น)', async () => {
    const plain = await get('staff', {});
    dbQuery.mockReset().mockResolvedValue({ rows: [] });
    const asked = await get('staff', { view: 'appointments', scope: 'all' });
    expect(asked.sql).toBe(plain.sql);
    expect(asked.params).toEqual(plain.params);
    expect(asked.sql).toContain('claimed_by is null or claimed_by::text = $1');
    expect(asked.sql).toContain('not is_lead or lead_by::text = $1');
    expect(asked.sql).not.toContain("status = 'converted'");
  });

  it('opl ส่ง scope=all มา = ลิสต์เดิม', async () => {
    const asked = await get('opl', { view: 'appointments', scope: 'all' });
    expect(asked.sql).toContain('claimed_by is null');
    expect(asked.sql).not.toContain("status = 'converted'");
  });

  it('🔴 admin เรียกแบบเดิม (ไม่ส่ง param) = ยังของใครของมัน', async () => {
    const plain = await get('admin', {});
    expect(plain.sql).toContain('claimed_by is null or claimed_by::text = $1');
    expect(plain.sql).toContain('not is_lead or lead_by::text = $1');
    expect(plain.sql).not.toContain("status = 'converted'");
  });

  it('supervisor ขอ scope=all = นัดของทุกคน: แถวนัดเท่านั้น · ไม่มีเงื่อนไข claim/Lead · param ตรงกับที่อ้าง', async () => {
    const all = await get('supervisor', { view: 'appointments', scope: 'all' });
    // ตัดเฉพาะ FROM … WHERE (รายชื่อคอลัมน์มี claimed_by/lead_by อยู่แล้ว — ไม่ใช่เงื่อนไข)
    const where = all.sql.slice(all.sql.indexOf('public_job_applications a'));
    expect(where).toContain("status = 'converted'");
    expect(where).not.toContain('claimed_by');
    expect(where).not.toContain('lead_by');
    expect(all.sql).not.toContain('{{');
    const refs = [...all.sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
    expect(refs.length ? Math.max(...refs) : 0).toBe(all.params.length);
  });
});

describe('นิยาม "แถวนัด" ของ server = นิยามแท็บของหน้าเว็บ', () => {
  it("status = 'converted' ตัวเดียวกับ RM_TAB_STATUSES.appointments — ทุกคนครอบของฉันเสมอ", () => {
    expect(RM_TAB_STATUSES.appointments).toEqual(['converted']);
    const q = buildApplicationsListQuery({ jobId: null, scopedJobIds: null, viewerId: 'u1', everyoneAppointments: true });
    for (const s of RM_TAB_STATUSES.appointments ?? []) expect(q.sql).toContain(`status = '${s}'`);
  });
});

describe('หน้าเว็บ: ปุ่ม ของฉัน / ทุกคน', () => {
  const ws = readFileSync(new URL('../../src/components/recruit-rm/RmWorkspace.tsx', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../../src/lib/publicApplicationsApi.ts', import.meta.url), 'utf8');
  const code = ws.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const block = code.slice(code.indexOf('<ToggleGroup'), code.indexOf('</ToggleGroup>'));

  it('คำบนปุ่มตรงตามที่เจ้าของเคาะ · ค่าเริ่ม = ของฉัน', () => {
    expect(RM_APPOINTMENT_SCOPES).toEqual(['mine', 'all']);
    expect(RM_APPOINTMENT_SCOPE_LABEL).toEqual({ mine: 'ของฉัน', all: 'ทุกคน' });
    expect(code).toContain("useState<RmAppointmentScope>('mine')");
    expect(isRmAppointmentScope('all')).toBe(true);
    expect(isRmAppointmentScope('')).toBe(false);
  });

  it('เห็นปุ่มเฉพาะ supervisor ขึ้นไป (opl ไม่เห็น) — กติกาเดียวกับ server', () => {
    expect(canSeeEveryoneAppointments('admin')).toBe(true);
    expect(canSeeEveryoneAppointments('supervisor')).toBe(true);
    expect(canSeeEveryoneAppointments('staff')).toBe(false);
    expect(canSeeEveryoneAppointments('opl')).toBe(false);
    expect(canSeeEveryoneAppointments(null)).toBe(false);
    expect(code).toMatch(/canSeeEveryoneAppointments\(user\?\.role\) && !leadView && !cancelledView \?\s*\(\s*<ToggleGroup/);
  });

  it('ใช้ ToggleGroup ของ shadcn ขนาด xs (เท่าชิปข้าง ๆ) · อยู่ในหัวแท็บติดตามนัดหมายเท่านั้น', () => {
    expect(ws).toContain("from '@/components/ui/toggle-group'");
    expect(block).toContain('type="single"');
    expect(block).toContain('size="xs"');
    expect(block).toContain('RM_APPOINTMENT_SCOPE_LABEL[s]');
    expect(code.match(/<ToggleGroup\b/g)?.length).toBe(1);
    const head = code.slice(code.indexOf("{!bucket && tab === 'appointments' ?"), code.indexOf('<FilterChips', code.indexOf("{!bucket && tab === 'appointments' ?")));
    expect(head).toContain('<ToggleGroup');
    const toggle = readFileSync(new URL('../../src/components/ui/toggle.tsx', import.meta.url), 'utf8');
    expect(toggle).toMatch(/xs: "h-7 /);
  });

  it('ไม่มี hex / radius / spacing สุ่ม / ประโยคอธิบายในก้อนปุ่ม', () => {
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(block).not.toMatch(/rounded-\[|p[xy]?-\[|gap-\[|m[xy]?-\[/);
    expect(block).not.toMatch(/className=/);
  });

  it('ทุกคน = ยิง ?view=appointments&scope=all · ของฉัน = เส้นเดิมไม่มี param เพิ่ม', () => {
    expect(api).toContain("qs.set('view', 'appointments')");
    expect(api).toContain("qs.set('scope', 'all')");
    expect(code).toContain('fetchAllJobApplications(leadView, bucket, cancelledView, everyoneAppointments)');
    expect(code).toMatch(/const everyoneAppointments =\s*tab === 'appointments' &&\s*appointmentScope === 'all' &&\s*canSeeEveryoneAppointments\(user\?\.role\)/);
    expect(code).toMatch(/useEffect\(load, \[[^\]]*everyoneAppointments\]\)/);
  });

  it('🔴 ชุด "ทุกคน" มีแต่แถวนัด — ไม่เอาไปนับให้แท็บอื่น / กองเลือกวิธีโทร', () => {
    expect(code).toMatch(/if \(bucket \|\| everyoneAppointments \|\|/);
    expect(code).toContain('everyoneAppointments ? [] : rows.filter((r) => r.unclaimed_at');
  });

  it('สลับเร็ว ๆ แล้วคำตอบเก่ามาทีหลัง ต้องไม่ทับ (ลำดับคำขอ)', () => {
    expect(code).toContain('const seq = ++loadSeq.current;');
    expect(code).toContain('if (seq === loadSeq.current) setRows(next);');
  });
});
