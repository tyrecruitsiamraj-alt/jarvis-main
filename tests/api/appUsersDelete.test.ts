// @vitest-environment node
/**
 * ลบบัญชีในตั้งค่า › ผู้ใช้งาน (เจ้าของสั่ง 1 ต.ค. 2569 · Choice "ลบจริง")
 * 🔴 ด่าน: admin เท่านั้น · ลบตัวเองไม่ได้ · ลบ admin คนสุดท้ายไม่ได้ (เช็กก่อน + เงื่อนไขใน delete) ·
 *    ชน FK = 409 ให้ใช้ Inactive · ลบสำเร็จต้องลง audit
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: vi.fn(),
  isPgForeignKeyViolation: (e: unknown) =>
    typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '23503',
}));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));
vi.mock('../../api/_lib/audit.js', () => ({ auditFromAuthed: vi.fn(async () => undefined) }));

import { dbQuery } from '../../api/_lib/postgres.js';
import { auditFromAuthed } from '../../api/_lib/audit.js';
import { signAuthToken, AUTH_COOKIE_NAME } from '../../api/_lib/auth.js';
import appUsersHandler from '../../api/_handlers/app-users.js';

const ME = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const OTHER = 'b1ffcd00-1d1c-4ef8-bb6d-6bb9bd380a22';

function req(id: string | undefined, role: 'admin' | 'staff' = 'admin') {
  const token = signAuthToken({ sub: ME, email: `${role}@example.com`, role });
  return {
    method: 'DELETE',
    headers: { cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}` },
    query: id === undefined ? {} : { id },
  };
}

function mockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status, json, setHeader: vi.fn() }, status, json };
}

const row = (over: Record<string, unknown> = {}) => ({
  id: OTHER,
  email: 'other@example.com',
  role: 'staff',
  full_name: 'Other',
  is_active: true,
  created_at: '2026-09-01',
  department_code: 'LBD',
  phone: null,
  nickname: null,
  job_lanes: [],
  ...over,
});

const sqls = () => vi.mocked(dbQuery).mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  process.env.AUTH_JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
  process.env.NODE_ENV = 'development';
  delete process.env.VERCEL_ENV;
  vi.mocked(dbQuery).mockReset();
  vi.mocked(auditFromAuthed).mockClear();
});

describe('DELETE /api/app-users?id=', () => {
  it('ไม่ใช่ admin = 403 ไม่แตะฐาน', async () => {
    const { res, status } = mockRes();
    await appUsersHandler(req(OTHER, 'staff'), res);
    expect(status).toHaveBeenCalledWith(403);
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it('ไม่มี id = 400', async () => {
    const { res, status } = mockRes();
    await appUsersHandler(req(undefined), res);
    expect(status).toHaveBeenCalledWith(400);
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it('🔴 ลบตัวเองไม่ได้ — ไม่แตะฐานเลย', async () => {
    const { res, status, json } = mockRes();
    await appUsersHandler(req(ME), res);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: 'ลบบัญชีตัวเองไม่ได้' }));
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it('หาบัญชีไม่เจอ = 404', async () => {
    vi.mocked(dbQuery).mockResolvedValueOnce({ rows: [] } as never);
    const { res, status } = mockRes();
    await appUsersHandler(req(OTHER), res);
    expect(status).toHaveBeenCalledWith(404);
  });

  it('🔴 admin คนสุดท้ายที่ยังใช้งาน = 400 และไม่ยิง delete', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({ rows: [row({ role: 'admin' })] } as never)
      .mockResolvedValueOnce({ rows: [{ count: '1' }] } as never);
    const { res, status, json } = mockRes();
    await appUsersHandler(req(OTHER), res);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: 'ลบ admin คนสุดท้ายที่ยังใช้งานอยู่ไม่ได้' }));
    expect(sqls().some((s) => /delete from/i.test(s))).toBe(false);
  });

  it('ลบสำเร็จ: delete มีเงื่อนไขกัน admin คนสุดท้ายในตัว · ตอบ 200 · ลง audit user.delete', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({ rows: [row()] } as never)
      .mockResolvedValueOnce({ rows: [{ id: OTHER }] } as never);
    const { res, status, json } = mockRes();
    await appUsersHandler(req(OTHER), res);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ ok: true, id: OTHER });
    const del = sqls().find((s) => /delete from users/i.test(s)) ?? '';
    expect(del).toMatch(/where u\.id = \$1/);
    expect(del).toMatch(/u\.role = 'admin' and u\.is_active = true/);
    expect(vi.mocked(dbQuery).mock.calls.find((c) => /delete from/i.test(String(c[0])))?.[1]).toEqual([OTHER]);
    expect(auditFromAuthed).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'user.delete', entityId: OTHER }),
    );
  });

  it('delete ไม่คืนแถว (มีคนลด admin ไปพร้อมกัน) = 400 ไม่ลง audit', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({ rows: [row({ role: 'admin' })] } as never)
      .mockResolvedValueOnce({ rows: [{ count: '2' }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    const { res, status } = mockRes();
    await appUsersHandler(req(OTHER), res);
    expect(status).toHaveBeenCalledWith(400);
    expect(auditFromAuthed).not.toHaveBeenCalled();
  });

  it('🔴 ชน FK (มีข้อมูลผูกอยู่) = 409 ให้ใช้ Inactive · ไม่ลง audit', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({ rows: [row()] } as never)
      .mockRejectedValueOnce(Object.assign(new Error('fk'), { code: '23503' }));
    const { res, status, json } = mockRes();
    await appUsersHandler(req(OTHER), res);
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: 'บัญชีนี้มีข้อมูลผูกอยู่ ลบไม่ได้ — ใช้ Inactive แทน' }));
    expect(auditFromAuthed).not.toHaveBeenCalled();
  });
});
