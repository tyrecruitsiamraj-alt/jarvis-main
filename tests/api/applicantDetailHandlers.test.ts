// @vitest-environment node
/**
 * ป๊อปรายละเอียดผู้สมัคร — เส้นฝั่ง API (เจ้าของสั่ง 1 ต.ค. 2569)
 *
 * 1. PATCH `/api/job-applications { id, profile }` — แก้ข้อมูล + จด log ว่าใครแก้ (ไม่โชว์บนจอ)
 *    🔴 นอกแผนก = 403 ไม่แตะอะไร · ไม่มีอะไรเปลี่ยน = ไม่เขียน ไม่จด · SQL ประกอบจาก whitelist เท่านั้น
 *    · ชื่อเปลี่ยน ⇒ full_name ใหม่ (ใบเก่าที่ไม่มีชื่อแยกต้องไม่ทำชื่อหาย)
 * 2. GET `?detail_of=<id>` — ประวัติการสมัคร (เบอร์เดียวกัน · กรองสิทธิ์รายใบ) + การโทร · อ่านอย่างเดียว
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
const audit = vi.fn(async () => undefined);
const inScope = vi.fn(async (_u: unknown, r: { department_code?: string | null }) => r.department_code !== 'OTHER');

vi.mock('../../api/_lib/postgres.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../api/_lib/postgres.js')>();
  return { ...mod, dbQuery: (...a: unknown[]) => dbQuery(...a) };
});
vi.mock('../../api/_lib/audit.js', () => ({ auditFromAuthed: (...a: unknown[]) => audit(...(a as [])) }));
vi.mock('../../api/_lib/applicationScope.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../api/_lib/applicationScope.js')>();
  return { ...mod, isApplicationInWriteScope: (u: unknown, r: { department_code?: string | null }) => inScope(u, r) };
});
vi.mock('../../api/_lib/siamrajUnitRequests.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../api/_lib/siamrajUnitRequests.js')>();
  return { ...mod, loadScopedJobIdSet: vi.fn(async () => null) };
});

import { signAuthToken, AUTH_COOKIE_NAME } from '../../api/_lib/auth.js';
import handler from '../../api/_handlers/job-applications.js';

const ID = '11111111-1111-4111-8111-111111111111';
const OTHER_APP = '22222222-2222-4222-8222-222222222222';
const HIDDEN_APP = '33333333-3333-4333-8333-333333333333';

const before = {
  title_prefix: null,
  first_name: null,
  last_name: null,
  full_name: 'สมหญิง รักงาน',
  gender: 'female',
  age: 33,
  line_id: null,
  province: 'กรุงเทพมหานคร',
  district: null,
  education: null,
  license_types: null,
  weight_kg: null,
  height_cm: null,
  note: null,
  job_id: 'J1',
  department_code: 'LBD',
};

function req(method: string, body: Record<string, unknown> | null, query: Record<string, string> = {}) {
  const token = signAuthToken({ sub: 'u-me', email: 'me@example.com', role: 'admin' });
  return {
    method,
    headers: { cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}` },
    query,
    body,
  };
}
function mockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status, json, setHeader: vi.fn() }, status, json };
}
const updates = () => dbQuery.mock.calls.filter((c) => /^\s*update /i.test(String(c[0])));

beforeEach(() => {
  process.env.AUTH_JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
  process.env.NODE_ENV = 'development';
  delete process.env.VERCEL_ENV;
  dbQuery.mockReset();
  audit.mockClear();
  inScope.mockClear();
});

function stubProfile(b: Record<string, unknown> = before) {
  dbQuery.mockImplementation((sql: string) => {
    if (/select title_prefix, first_name, last_name, full_name/i.test(sql)) return Promise.resolve({ rows: [b] });
    if (/^\s*update /i.test(sql)) return Promise.resolve({ rows: [{ id: ID }] });
    // อ่านใบกลับหลังบันทึก (ชุดคอลัมน์กลาง) — คืนแถวขั้นต่ำพอให้ toApplication ทำงาน
    if (/from .*public_job_applications a where a\.id = \$1/i.test(sql)) {
      return Promise.resolve({ rows: [{ id: ID, full_name: 'x', phone: '0812345678', status: 'contacted', created_at: new Date().toISOString(), has_document: false }] });
    }
    return Promise.resolve({ rows: [] });
  });
}

describe('PATCH profile — แก้ข้อมูลผู้สมัคร', () => {
  it('🔴 เปลี่ยนอายุ + ชื่อ ⇒ เขียนเฉพาะช่องที่เปลี่ยน + full_name ใหม่ (ใบเก่าไม่มีชื่อแยก นามสกุลไม่หาย) + จด log ก่อน/หลัง', async () => {
    stubProfile();
    const { res, status, json } = mockRes();
    await handler(req('PATCH', { id: ID, profile: { age: '34', first_name: 'สมศรี' } }) as never, res as never);
    expect(status).toHaveBeenCalledWith(200);
    const [sql, params] = updates()[0] as [string, unknown[]];
    expect(sql).toMatch(/set first_name = \$2, age = \$3, full_name = \$4, updated_at = now\(\) where id = \$1/);
    expect(params).toEqual([ID, 'สมศรี', 34, 'สมศรี รักงาน']);
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0][1]).toEqual({
      action: 'job_application.profile_edit',
      entityType: 'job_application',
      entityId: ID,
      before: { first_name: null, age: 33, full_name: 'สมหญิง รักงาน' },
      after: { first_name: 'สมศรี', age: 34, full_name: 'สมศรี รักงาน' },
    });
    expect(json.mock.calls[0][0].changed).toEqual(['first_name', 'age']);
  });

  it('ไม่มีอะไรเปลี่ยน ⇒ ไม่เขียน ไม่จด log แต่ตอบใบกลับ 200', async () => {
    stubProfile();
    const { res, status } = mockRes();
    await handler(req('PATCH', { id: ID, profile: { age: 33, province: 'กรุงเทพมหานคร' } }) as never, res as never);
    expect(status).toHaveBeenCalledWith(200);
    expect(updates()).toHaveLength(0);
    expect(audit).not.toHaveBeenCalled();
  });

  it('🔴 แก้เบอร์จากเส้นนี้ไม่ได้ ⇒ 400 ไม่เขียน', async () => {
    stubProfile();
    const { res, status } = mockRes();
    await handler(req('PATCH', { id: ID, profile: { phone: '0899999999' } }) as never, res as never);
    expect(status).toHaveBeenCalledWith(400);
    expect(updates()).toHaveLength(0);
  });

  it('🔴 ใบแผนกอื่น ⇒ 403 ไม่เขียน', async () => {
    stubProfile({ ...before, department_code: 'OTHER' });
    const { res, status } = mockRes();
    await handler(req('PATCH', { id: ID, profile: { age: 40 } }) as never, res as never);
    expect(status).toHaveBeenCalledWith(403);
    expect(updates()).toHaveLength(0);
  });

  it('ใบขับขี่ว่าง ⇒ เก็บเป็น null (แบบเดียวกับตอนคีย์ใบใหม่)', async () => {
    stubProfile({ ...before, license_types: ['ใบขับขี่บุคคล 5 ปี'] });
    const { res } = mockRes();
    await handler(req('PATCH', { id: ID, profile: { license_types: [] } }) as never, res as never);
    const [sql, params] = updates()[0] as [string, unknown[]];
    expect(sql).toMatch(/set license_types = \$2,/);
    expect(params).toEqual([ID, null]);
  });
});

describe('GET detail_of — ประวัติการสมัคร + การโทร', () => {
  function stubDetail(opts: { queueFails?: boolean } = {}) {
    dbQuery.mockImplementation((sql: string) => {
      if (/select id, phone_e164, job_id, department_code from/i.test(sql)) {
        return Promise.resolve({ rows: [{ id: ID, phone_e164: '+66812345678', job_id: 'J1', department_code: 'LBD' }] });
      }
      if (/where phone_e164 = \$1 and id <> \$2/i.test(sql)) {
        return Promise.resolve({
          rows: [
            { id: OTHER_APP, created_at: '2026-09-01T03:00:00.000Z', job_id: 'J2', department_code: 'LBD', job_title: 'รปภ.', unit_name: 'หน่วย ก', position_interest: null, status: 'new', channel_label: 'Facebook' },
            { id: HIDDEN_APP, created_at: '2026-08-01T03:00:00.000Z', job_id: 'J3', department_code: 'OTHER', job_title: 'แม่บ้าน', unit_name: null, position_interest: null, status: 'new', channel_label: null },
          ],
        });
      }
      if (/from .*lumos_dispatch_queue/i.test(sql)) {
        if (opts.queueFails) return Promise.reject(Object.assign(new Error('no col'), { code: '42703' }));
        return Promise.resolve({
          rows: [{ id: 7, status: 'completed', created_at: '2026-09-02T03:00:00.000Z', first_result_at: '2026-09-02T03:05:00.000Z', last_result_at: null, last_outcome: 'confirmed', attempt_count: 2, next_attempt_at: null }],
        });
      }
      if (/from .*candidate_call_holds/i.test(sql)) {
        return Promise.resolve({
          rows: [{ id: 'h1', held_at: '2026-09-03T03:00:00.000Z', held_by_name: 'staff@example.com', released_at: null, release_reason: null, result_outcome: null, result_note: null }],
        });
      }
      return Promise.resolve({ rows: [] });
    });
  }

  it('🔴 ประวัติกรองสิทธิ์รายใบ (ใบแผนกอื่นของเบอร์เดียวกันไม่โผล่) + สาย AI + สายที่คนถือ · ไม่มีคำสั่งเขียน', async () => {
    stubDetail();
    const { res, status, json } = mockRes();
    await handler(req('GET', null, { detail_of: ID }) as never, res as never);
    expect(status).toHaveBeenCalledWith(200);
    const body = json.mock.calls[0][0];
    expect(body.history.map((h: { id: string }) => h.id)).toEqual([OTHER_APP]);
    expect(body.aiCalls).toEqual([
      { id: 7, status: 'completed', created_at: '2026-09-02T03:00:00.000Z', result_at: '2026-09-02T03:05:00.000Z', outcome: 'confirmed', attempts: 2, next_attempt_at: null },
    ]);
    expect(body.staffCalls[0]).toMatchObject({ id: 'h1', held_by_name: 'staff@example.com', outcome: null });
    expect(dbQuery.mock.calls.some((c) => /^\s*(update|insert|delete)/i.test(String(c[0])))).toBe(false);
  });

  it('ตารางคิวยังไม่ migrate ⇒ การโทรของ AI เป็นรายการว่าง ไม่ใช่ 500', async () => {
    stubDetail({ queueFails: true });
    const { res, status, json } = mockRes();
    await handler(req('GET', null, { detail_of: ID }) as never, res as never);
    expect(status).toHaveBeenCalledWith(200);
    expect(json.mock.calls[0][0].aiCalls).toEqual([]);
  });

  it('id ไม่ใช่ uuid ⇒ 400', async () => {
    stubDetail();
    const { res, status } = mockRes();
    await handler(req('GET', null, { detail_of: 'abc' }) as never, res as never);
    expect(status).toHaveBeenCalledWith(400);
  });
});
