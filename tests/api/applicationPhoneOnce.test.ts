// @vitest-environment node
/**
 * เบอร์เดียวเข้าระบบได้ครั้งเดียว + จด IP เป็น log (เจ้าของสั่ง 1 ต.ค. 2569)
 *
 * Choice ของเจ้าของ: "แจ้งเลยว่าเคยสมัครไปแล้ว ไม่เอาเบอร์ซ้ำเข้าระบบ" · ขอบเขต "เบอร์เดิม ไม่ว่างานไหน" ·
 * IP "เก็บ Log พอไม่ต้องเอามาโชว์"
 *
 * 🔴 ด่าน:
 * - DB ตัดสิน (partial unique index 132) — API แค่อ่าน 23505 ของ index ตัวนี้ (unique ตัวอื่นไม่นับ)
 * - ใบซ้ำเก่าไม่ลบ ชี้ไปใบแรก (`phone_dup_of`) แล้วตัดออกจาก index
 * - หน้าสมัคร: ชน = 409 ข้อความถึงผู้สมัคร (ไม่บอกรายละเอียดใบเดิม) + log ที่มี IP · สำเร็จก็จด log
 * - log ไม่มีชื่อ/เบอร์ · ปุ่มเพิ่มผู้สมัคร/แก้เบอร์ ชน = 409 ข้อความถึงเจ้าหน้าที่ (ไม่ใช่ 500)
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PHONE_ONCE_INDEX,
  PHONE_ONCE_PUBLIC_MESSAGE,
  PHONE_ONCE_STAFF_MESSAGE,
  isPhoneOnceViolation,
} from '../../src/lib/applicationPhoneOnce.js';

const dbQuery = vi.fn();
const auditAnon = vi.fn(async () => undefined);
const auditAuthed = vi.fn(async () => undefined);

vi.mock('../../api/_lib/postgres.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../api/_lib/postgres.js')>();
  return { ...mod, dbQuery: (...a: unknown[]) => dbQuery(...a) };
});
vi.mock('../../api/_lib/audit.js', () => ({
  auditFromAnonymous: (...a: unknown[]) => auditAnon(...(a as [])),
  auditFromAuthed: (...a: unknown[]) => auditAuthed(...(a as [])),
}));
vi.mock('../../api/_lib/applicationDepartment.js', () => ({ resolveApplicationDepartment: vi.fn(async () => null) }));
vi.mock('../../api/_lib/applicationScope.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../api/_lib/applicationScope.js')>();
  return { ...mod, isApplicationInWriteScope: vi.fn(async () => true) };
});
vi.mock('../../api/_lib/siamrajUnitRequests.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../api/_lib/siamrajUnitRequests.js')>();
  return { ...mod, loadScopedJobIdSet: vi.fn(async () => null) };
});

import { resetRateLimitsForTests } from '../../api/_lib/rateLimit.js';
import { signAuthToken, AUTH_COOKIE_NAME } from '../../api/_lib/auth.js';
import applyHandler from '../../api/_handlers/public/apply.js';
import jobApplicationsHandler from '../../api/_handlers/job-applications.js';

const phoneOnce = Object.assign(new Error('duplicate key'), { code: '23505', constraint: PHONE_ONCE_INDEX });
const otherUnique = Object.assign(new Error('duplicate key'), { code: '23505', constraint: 'some_other_uidx' });

function mockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status, json, setHeader: vi.fn() }, status, json };
}
const publicReq = (body: Record<string, unknown>) => ({
  method: 'POST',
  headers: { 'x-forwarded-for': '203.0.113.7', 'user-agent': 'vitest' },
  query: {},
  body,
});
const staffReq = (method: string, body: Record<string, unknown>) => {
  const token = signAuthToken({ sub: 'u-staff', email: 'staff@example.com', role: 'admin' });
  return { method, headers: { cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}` }, query: {}, body };
};
const applyBody = {
  first_name: 'ทดสอบ',
  last_name: 'ระบบ',
  phone: '0812345678',
  age: 30,
  gender: 'male',
  province: 'กรุงเทพมหานคร',
  district: 'บางนา',
  subdistrict: 'บางนา',
  job_id: 'siamraj-sql:REQ-1',
};

beforeEach(() => {
  process.env.AUTH_JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
  process.env.NODE_ENV = 'development';
  delete process.env.VERCEL_ENV;
  delete process.env.APPLICATION_AUTO_DISPATCH_ENABLED;
  resetRateLimitsForTests();
  dbQuery.mockReset();
  auditAnon.mockClear();
  auditAuthed.mockClear();
});

describe('ตัวจับว่าชนกติกาเบอร์เดียว', () => {
  it('นับเฉพาะ 23505 ของ index เบอร์เดียว — unique ตัวอื่นไม่ใช่', () => {
    expect(isPhoneOnceViolation(phoneOnce)).toBe(true);
    expect(isPhoneOnceViolation(otherUnique)).toBe(false);
    expect(isPhoneOnceViolation(new Error('x'))).toBe(false);
    expect(isPhoneOnceViolation(null)).toBe(false);
  });

  it('🔴 migration 132: partial unique index + ใบซ้ำเก่าไม่ลบ แค่ชี้ไปใบแรก', () => {
    const sql = readFileSync(new URL('../../migrations/132_application_phone_once.sql', import.meta.url), 'utf8');
    expect(sql).toContain(`create unique index if not exists ${PHONE_ONCE_INDEX}`);
    expect(sql).toMatch(/where phone_e164 is not null and phone_dup_of is null/);
    expect(sql).toMatch(/set phone_dup_of = r\.first_id/);
    expect(sql).not.toMatch(/^\s*delete from/im);
  });

  it('ข้อความหน้าสมัครไม่บอกรายละเอียดใบเดิม', () => {
    expect(PHONE_ONCE_PUBLIC_MESSAGE).toBe('เบอร์นี้เคยสมัครกับเราแล้ว ไม่ต้องสมัครซ้ำ');
  });
});

describe('POST /api/public/apply', () => {
  it('🔴 เบอร์มีในระบบแล้ว ⇒ 409 + ข้อความถึงผู้สมัคร + จด log (IP มาจากบริบท log) ไม่มีชื่อ/เบอร์', async () => {
    dbQuery.mockImplementation((sql: string) =>
      /insert into/i.test(sql) ? Promise.reject(phoneOnce) : Promise.resolve({ rows: [] }),
    );
    const { res, status, json } = mockRes();
    await applyHandler(publicReq(applyBody) as never, res as never);
    expect(status).toHaveBeenCalledWith(409);
    expect(json.mock.calls[0][0].message).toBe(PHONE_ONCE_PUBLIC_MESSAGE);
    expect(auditAnon).toHaveBeenCalledTimes(1);
    const [req, actor, event] = auditAnon.mock.calls[0] as unknown as [{ headers: Record<string, string> }, unknown, Record<string, unknown>];
    expect(req.headers['x-forwarded-for']).toBe('203.0.113.7');
    expect(actor).toEqual({ userName: 'หน้าสมัครงาน' });
    expect(event).toMatchObject({ action: 'public_application.duplicate_rejected', entityType: 'job_application' });
    expect(JSON.stringify(event)).not.toMatch(/0812345678|ทดสอบ/);
  });

  it('สมัครสำเร็จ ⇒ 201 + จด log ของใบนั้น', async () => {
    dbQuery.mockImplementation((sql: string) =>
      /insert into/i.test(sql) ? Promise.resolve({ rows: [{ id: 'app-1' }] }) : Promise.resolve({ rows: [] }),
    );
    const { res, status } = mockRes();
    await applyHandler(publicReq(applyBody) as never, res as never);
    expect(status).toHaveBeenCalledWith(201);
    const event = (auditAnon.mock.calls[0] as unknown as [unknown, unknown, Record<string, unknown>])[2];
    expect(event).toMatchObject({ action: 'public_application.submit', entityId: 'app-1', after: { job_id: 'siamraj-sql:REQ-1' } });
  });

  it('unique ตัวอื่นชน ⇒ ไม่ตอบว่าเคยสมัคร (ส่งต่อเป็น error ปกติ)', async () => {
    dbQuery.mockImplementation((sql: string) =>
      /insert into/i.test(sql) ? Promise.reject(otherUnique) : Promise.resolve({ rows: [] }),
    );
    const { res, status } = mockRes();
    await applyHandler(publicReq(applyBody) as never, res as never);
    expect(status).not.toHaveBeenCalledWith(409);
  });
});

describe('ปุ่มเพิ่มข้อมูลผู้สมัคร + แก้เบอร์', () => {
  it('🔴 เพิ่มผู้สมัครเบอร์ซ้ำ ⇒ 409 ข้อความถึงเจ้าหน้าที่ (ไม่ใช่ 500)', async () => {
    dbQuery.mockImplementation((sql: string) =>
      /insert into/i.test(sql) ? Promise.reject(phoneOnce) : Promise.resolve({ rows: [] }),
    );
    const { res, status, json } = mockRes();
    await jobApplicationsHandler(
      staffReq('POST', { first_name: 'ก', last_name: 'ข', phone: '0812345678', age: 30, gender: 'female' }) as never,
      res as never,
    );
    expect(status).toHaveBeenCalledWith(409);
    expect(json.mock.calls[0][0].message).toBe(PHONE_ONCE_STAFF_MESSAGE);
  });

  it('ข้อมูลไม่ครบยังตอบข้อความเดิมทุกคำ (ยกกติกาไป staffApplicationInput แล้ว)', async () => {
    const { res, status, json } = mockRes();
    await jobApplicationsHandler(
      staffReq('POST', { first_name: 'ก', last_name: 'ข', phone: '0812345678', age: 30 }) as never,
      res as never,
    );
    expect(status).toHaveBeenCalledWith(400);
    expect(json.mock.calls[0][0].message).toBe('กรุณาเลือกเพศ');
  });

  it('🔴 แก้เบอร์เป็นเบอร์ที่มีใบอยู่แล้ว ⇒ 409 ไม่ใช่ 500', async () => {
    dbQuery.mockImplementation((sql: string) => {
      if (/select phone, job_id, department_code/i.test(sql)) {
        return Promise.resolve({ rows: [{ phone: '0899999999', job_id: 'J1', department_code: 'LBD' }] });
      }
      if (/update .* set phone = \$2/i.test(sql)) return Promise.reject(phoneOnce);
      return Promise.resolve({ rows: [] });
    });
    const { res, status, json } = mockRes();
    await jobApplicationsHandler(
      staffReq('PATCH', { id: '11111111-1111-4111-8111-111111111111', phone: '0812345678' }) as never,
      res as never,
    );
    expect(status).toHaveBeenCalledWith(409);
    expect(json.mock.calls[0][0].message).toBe(PHONE_ONCE_STAFF_MESSAGE);
  });
});
