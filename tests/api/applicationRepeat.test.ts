// @vitest-environment node
/**
 * สมัครซ้ำต้องรอ 14 วัน — เบอร์เดิม (ทุกทางเข้า) + IP เดิม (หน้าสมัคร) (เจ้าของสั่ง 1 ต.ค. 2569)
 *
 * เจ้าของ: "เรื่องเบอร์ซ้ำอะบล็อคไว้ที่ 14 วันได้ไหม ส่วน Ip ก็กันไว้เผื่อเขาเปลี่ยนมีหลายเบอร์ ... บอกว่าต้องรอ 14 วัน"
 * · Choice "IP ละ 1 ใบใน 14 วัน" · ขอบเขตเบอร์ "เบอร์เดิม ไม่ว่างานไหน"
 *
 * 🔴 ด่าน:
 * - นับวันตามปฏิทินไทย: สมัครวันที่ 1 → สมัครใหม่ได้วันที่ 15 · ข้อความบอกวันนั้น · หน้าสาธารณะไม่บอกรายละเอียดใบเดิม
 * - ตัดสินในธุรกรรมเดียวกับ insert + ล็อกเบอร์ก่อน IP (กดส่งรัว ๆ เข้าได้ใบเดียว · ไม่ deadlock)
 * - IP มาจาก CF-Connecting-IP เท่านั้น (X-Forwarded-For ผู้ส่งปลอมได้ = ทำให้คนอื่นโดนบล็อกได้) · ไม่มี = ข้ามกติกา IP
 * - คอลัมน์ client_ip ยังไม่ migrate (deploy รันโค้ดก่อน migrate) ⇒ ยังสมัครได้ ไม่ตาย
 * - log ของหน้าสมัครมี IP ในบริบท ไม่มีชื่อ/เบอร์ · เพิ่มผู้สมัคร/แก้เบอร์ ติดกติกา = 409 ข้อความถึงเจ้าหน้าที่
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REPEAT_BLOCK_DAYS,
  repeatAllowedFromYmd,
  repeatImportReason,
  repeatPublicMessage,
  repeatStaffMessage,
  repeatWindowSql,
} from '../../src/lib/applicationRepeat.js';

const txQuery = vi.fn();
const dbQuery = vi.fn();
const auditAnon = vi.fn(async () => undefined);
const auditAuthed = vi.fn(async () => undefined);

vi.mock('../../api/_lib/postgres.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../api/_lib/postgres.js')>();
  return {
    ...mod,
    dbQuery: (...a: unknown[]) => dbQuery(...a),
    dbTransaction: async (fn: (c: { query: typeof txQuery }) => Promise<unknown>) => fn({ query: txQuery }),
  };
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
import { applicantClientIp } from '../../api/_lib/applicationRepeatGuard.js';
import applyHandler from '../../api/_handlers/public/apply.js';
import jobApplicationsHandler from '../../api/_handlers/job-applications.js';

const LAST = new Date('2026-10-01T03:00:00Z'); // 1 ต.ค. 2569 10:00 ไทย

function mockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status, json, setHeader: vi.fn() }, status, json };
}
const publicReq = (body: Record<string, unknown>, headers: Record<string, string> = { 'cf-connecting-ip': '203.0.113.7' }) => ({
  method: 'POST',
  headers: { 'user-agent': 'vitest', ...headers },
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
/** จำลอง DB ในธุรกรรม: บอกได้ว่าเบอร์/IP มีใบภายใน 14 วันไหม · insert คืน id */
function stubTx(opts: { phoneLast?: Date | null; ipLast?: Date | null; clientIpMissing?: boolean } = {}) {
  txQuery.mockReset();
  txQuery.mockImplementation((sql: string, params?: unknown[]) => {
    if (/pg_advisory_xact_lock/.test(sql)) return Promise.resolve({ rows: [] });
    if (/where phone_e164 = jarvis_phone_e164_thai\(\$1\)/.test(sql)) return Promise.resolve({ rows: [{ last_at: opts.phoneLast ?? null }] });
    if (/where client_ip = \$1/.test(sql)) {
      if (opts.clientIpMissing) return Promise.reject(Object.assign(new Error('no column'), { code: '42703' }));
      return Promise.resolve({ rows: [{ last_at: opts.ipLast ?? null }] });
    }
    if (/^insert into/i.test(sql)) {
      if (opts.clientIpMissing && /client_ip/.test(sql)) return Promise.reject(Object.assign(new Error('no column'), { code: '42703' }));
      return Promise.resolve({ rows: [{ id: 'app-new', params }] });
    }
    return Promise.resolve({ rows: [] });
  });
}
const calls = (re: RegExp) => txQuery.mock.calls.filter((c) => re.test(String(c[0])));

beforeEach(() => {
  process.env.AUTH_JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
  process.env.NODE_ENV = 'development';
  delete process.env.VERCEL_ENV;
  delete process.env.APPLICATION_AUTO_DISPATCH_ENABLED;
  resetRateLimitsForTests();
  dbQuery.mockReset().mockResolvedValue({ rows: [] });
  auditAnon.mockClear();
  auditAuthed.mockClear();
});

describe('กติกาและข้อความ', () => {
  it('14 วันตามปฏิทินไทย: สมัคร 1 ต.ค. → สมัครใหม่ได้ 15 ต.ค. · ใบตอนตี 1 ไทยไม่เพี้ยนไปวันของ UTC', () => {
    expect(REPEAT_BLOCK_DAYS).toBe(14);
    expect(repeatAllowedFromYmd(LAST)).toBe('2026-10-15');
    expect(repeatAllowedFromYmd(new Date('2026-09-30T18:30:00Z'))).toBe('2026-10-15'); // 1 ต.ค. 01:30 ไทย
    expect(repeatWindowSql()).toBe(
      "(created_at at time zone 'Asia/Bangkok')::date >= ((now() at time zone 'Asia/Bangkok')::date - 13)",
    );
  });

  it('ข้อความบอกว่าต้องรอ 14 วัน + วันที่สมัครใหม่ได้ · หน้าสาธารณะไม่บอกรายละเอียดใบเดิม', () => {
    expect(repeatPublicMessage('phone', LAST)).toBe('เบอร์นี้สมัครกับเราไปแล้ว ต้องรอ 14 วัน สมัครใหม่ได้ตั้งแต่วันที่ 15/10/2569');
    expect(repeatPublicMessage('ip', LAST)).toBe('มีการสมัครจากเครือข่ายนี้ไปแล้ว ต้องรอ 14 วัน สมัครใหม่ได้ตั้งแต่วันที่ 15/10/2569');
    expect(repeatStaffMessage(LAST)).toBe('เบอร์นี้สมัครเข้ามาแล้วเมื่อ 1/10/2569 — ต้องรอ 14 วัน เพิ่มใหม่ได้ตั้งแต่ 15/10/2569');
    expect(repeatImportReason(LAST)).toBe('สมัครเข้ามาแล้วภายใน 14 วัน (ได้ตั้งแต่ 15/10/2569)');
  });

  it('🔴 IP เชื่อแค่ CF-Connecting-IP — X-Forwarded-For ผู้ส่งใส่เองได้ ห้ามใช้บล็อก', () => {
    expect(applicantClientIp({ headers: { 'cf-connecting-ip': '203.0.113.7' } } as never)).toBe('203.0.113.7');
    expect(applicantClientIp({ headers: { 'cf-connecting-ip': '2001:db8::1' } } as never)).toBe('2001:db8::1');
    expect(applicantClientIp({ headers: { 'x-forwarded-for': '1.2.3.4' } } as never)).toBeNull();
    expect(applicantClientIp({ headers: { 'cf-connecting-ip': 'evil; drop' } } as never)).toBeNull();
  });

  it('migration 132: เก็บ client_ip + index · ไม่มี unique index ถาวร · ไม่ลบอะไร', () => {
    const sql = readFileSync(new URL('../../migrations/132_application_client_ip.sql', import.meta.url), 'utf8');
    expect(sql).toMatch(/add column if not exists client_ip text null/);
    expect(sql).toMatch(/create index if not exists public_job_applications_client_ip_idx/);
    expect(sql).not.toMatch(/create unique index/i);
    expect(sql).not.toMatch(/^\s*(delete|update) /im);
  });
});

describe('POST /api/public/apply', () => {
  it('🔴 เบอร์สมัครภายใน 14 วัน ⇒ 409 + บอกวันสมัครใหม่ · ไม่ insert · จด log (มี IP ในบริบท ไม่มีชื่อ/เบอร์)', async () => {
    stubTx({ phoneLast: LAST });
    const { res, status, json } = mockRes();
    await applyHandler(publicReq(applyBody) as never, res as never);
    expect(status).toHaveBeenCalledWith(409);
    expect(json.mock.calls[0][0].message).toBe(repeatPublicMessage('phone', LAST));
    expect(calls(/^insert into/i)).toHaveLength(0);
    const [req, , event] = auditAnon.mock.calls[0] as unknown as [{ headers: Record<string, string> }, unknown, Record<string, unknown>];
    expect(req.headers['cf-connecting-ip']).toBe('203.0.113.7');
    expect(event).toMatchObject({ action: 'public_application.repeat_rejected', after: { kind: 'phone' } });
    expect(JSON.stringify(event)).not.toMatch(/0812345678|ทดสอบ/);
  });

  it('🔴 เบอร์ใหม่แต่ IP เดิมสมัครภายใน 14 วัน ⇒ 409 ข้อความของ IP · ล็อกเบอร์ก่อน IP เสมอ', async () => {
    stubTx({ ipLast: LAST });
    const { res, status, json } = mockRes();
    await applyHandler(publicReq(applyBody) as never, res as never);
    expect(status).toHaveBeenCalledWith(409);
    expect(json.mock.calls[0][0].message).toBe(repeatPublicMessage('ip', LAST));
    const locks = calls(/pg_advisory_xact_lock/).map((c) => String((c[1] as unknown[])[0]));
    expect(locks).toEqual(['apply-phone:+66812345678', 'apply-ip:203.0.113.7']);
  });

  it('ผ่านทั้งสอง ⇒ 201 · บันทึก client_ip ไว้กับใบ · จด log ของใบนั้น', async () => {
    stubTx();
    const { res, status } = mockRes();
    await applyHandler(publicReq(applyBody) as never, res as never);
    expect(status).toHaveBeenCalledWith(201);
    const insert = calls(/^insert into/i)[0];
    expect(String(insert[0])).toMatch(/department_code, client_ip\)/);
    expect((insert[1] as unknown[]).at(-1)).toBe('203.0.113.7');
    expect((auditAnon.mock.calls[0] as unknown as [unknown, unknown, Record<string, unknown>])[2]).toMatchObject({
      action: 'public_application.submit',
      entityId: 'app-new',
    });
  });

  it('ไม่มี CF-Connecting-IP (เครื่อง dev / ยิงตรง) ⇒ ข้ามกติกา IP แต่กติกาเบอร์ยังอยู่', async () => {
    stubTx();
    const { res, status } = mockRes();
    await applyHandler(publicReq(applyBody, { 'x-forwarded-for': '203.0.113.7' }) as never, res as never);
    expect(status).toHaveBeenCalledWith(201);
    expect(calls(/where client_ip = \$1/)).toHaveLength(0);
    expect(calls(/where phone_e164 = jarvis_phone_e164_thai/)).toHaveLength(1);
  });

  it('🔴 client_ip ยังไม่ migrate (deploy รันโค้ดก่อน migrate) ⇒ ข้ามกติกา IP + insert ชุดเดิม · ผู้สมัครยังส่งได้', async () => {
    stubTx({ clientIpMissing: true });
    const { res, status } = mockRes();
    await applyHandler(publicReq(applyBody) as never, res as never);
    expect(status).toHaveBeenCalledWith(201);
    expect(calls(/rollback to savepoint/).length).toBeGreaterThanOrEqual(2);
    const inserts = calls(/^insert into/i).map((c) => String(c[0]));
    expect(inserts.at(-1)).not.toMatch(/client_ip/);
  });
});

describe('ปุ่มเพิ่มข้อมูลผู้สมัคร + แก้เบอร์', () => {
  it('🔴 เพิ่มผู้สมัครเบอร์ที่สมัครภายใน 14 วัน ⇒ 409 ข้อความถึงเจ้าหน้าที่ ไม่ insert', async () => {
    stubTx({ phoneLast: LAST });
    const { res, status, json } = mockRes();
    await jobApplicationsHandler(
      staffReq('POST', { first_name: 'ก', last_name: 'ข', phone: '0812345678', age: 30, gender: 'female' }) as never,
      res as never,
    );
    expect(status).toHaveBeenCalledWith(409);
    expect(json.mock.calls[0][0].message).toBe(repeatStaffMessage(LAST));
    expect(calls(/^insert into/i)).toHaveLength(0);
  });

  it('ข้อมูลไม่ครบยังตอบข้อความเดิมทุกคำ', async () => {
    const { res, status, json } = mockRes();
    await jobApplicationsHandler(
      staffReq('POST', { first_name: 'ก', last_name: 'ข', phone: '0812345678', age: 30 }) as never,
      res as never,
    );
    expect(status).toHaveBeenCalledWith(400);
    expect(json.mock.calls[0][0].message).toBe('กรุณาเลือกเพศ');
  });

  it('🔴 แก้เบอร์เป็นเบอร์ที่สมัครภายใน 14 วัน (ใบอื่น) ⇒ 409 ไม่ update · ไม่นับใบตัวเอง', async () => {
    dbQuery.mockImplementation((sql: string) =>
      /select phone, job_id, department_code/i.test(sql)
        ? Promise.resolve({ rows: [{ phone: '0899999999', job_id: 'J1', department_code: 'LBD' }] })
        : Promise.resolve({ rows: [] }),
    );
    stubTx({ phoneLast: LAST });
    const ID = '11111111-1111-4111-8111-111111111111';
    const { res, status, json } = mockRes();
    await jobApplicationsHandler(staffReq('PATCH', { id: ID, phone: '0812345678' }) as never, res as never);
    expect(status).toHaveBeenCalledWith(409);
    expect(json.mock.calls[0][0].message).toBe(repeatStaffMessage(LAST));
    const check = calls(/where phone_e164 = jarvis_phone_e164_thai/)[0];
    expect((check[1] as unknown[])[1]).toBe(ID);
    expect(calls(/update .* set phone/)).toHaveLength(0);
  });
});
