// @vitest-environment node
/**
 * นำเข้า Excel ใช้ไม่ได้ (เจ้าของแจ้ง 11 ต.ค. 2569) — ต้นเหตุ 2 ชั้น
 * 1. ช่องผู้รับผิดชอบโหลดจาก `/api/app-users` (admin เท่านั้น) ⇒ คนอื่นได้ลิสต์ว่าง ปุ่มนำเข้ากดไม่ได้ตลอด
 *    → เส้นใหม่ `/api/app-user-names` อ่านได้ทุก role · ส่งแค่ id + ชื่อ · คนล็อก BU เห็นแผนกตัวเอง + แอดมิน
 * 2. คนล็อก BU (59/61) โดน 403 ทันที → ใบจำแผนกของคนคีย์แทน (เทสต์อยู่ applicationImportHandler.test.ts)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const dbQuery = vi.fn();
type DeptScope = { mode: 'all' } | { mode: 'code'; code: string } | { mode: 'none' };
const deptScope = vi.fn(async (): Promise<DeptScope> => ({ mode: 'all' }));

vi.mock('../../api/_lib/postgres.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../api/_lib/postgres.js')>();
  return { ...mod, dbQuery: (...a: unknown[]) => dbQuery(...a) };
});
vi.mock('../../api/_lib/departmentScope.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../api/_lib/departmentScope.js')>();
  return { ...mod, loadUserDepartmentScope: () => deptScope() };
});

import { signAuthToken, AUTH_COOKIE_NAME } from '../../api/_lib/auth.js';
import handler from '../../api/_handlers/app-user-names.js';
import { checkApiAccess } from '../../api/_lib/rbac.js';
import { parseResponsibleNames } from '../../src/lib/userApi.js';

function req(role: string, method = 'GET') {
  const token = signAuthToken({ sub: 'u-1', email: 'someone@example.com', role: role as never });
  return { method, headers: { cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}` }, query: {} };
}
function mockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status, json, setHeader: vi.fn() }, status, json };
}

beforeEach(() => {
  process.env.AUTH_JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
  process.env.NODE_ENV = 'development';
  delete process.env.VERCEL_ENV;
  dbQuery.mockReset().mockResolvedValue({ rows: [{ id: 'a', name: 'Somchai Jaidee' }] });
  deptScope.mockReset().mockResolvedValue({ mode: 'all' });
});

describe('/api/app-user-names', () => {
  it('🔴 ทุก role อ่านได้ (staff/opl ด้วย) · เขียนได้แค่ admin · /api/app-users ยังเป็น admin เท่านั้น', () => {
    for (const role of ['staff', 'opl', 'supervisor', 'admin'] as const) {
      expect(checkApiAccess(role, 'app-user-names', 'GET')).toEqual({ ok: true });
    }
    expect(checkApiAccess('supervisor', 'app-user-names', 'POST').ok).toBe(false);
    expect(checkApiAccess('supervisor', 'app-users', 'GET').ok).toBe(false);
  });

  it('คนล็อก BU = แผนกตัวเอง + คนไม่ผูกแผนก · ส่งแค่ id + ชื่อ ไม่มีอีเมล', async () => {
    deptScope.mockResolvedValue({ mode: 'code', code: 'LBD', codes: ['LBD'] });
    const { res, json } = mockRes();
    await handler(req('staff') as never, res as never);
    const [sql, params] = dbQuery.mock.calls[0];
    expect(String(sql)).toMatch(/upper\(trim\(department_code\)\) = any\(\$1::text\[\]\) or department_code is null/);
    expect(String(sql)).not.toMatch(/email/);
    expect(params).toEqual([['LBD']]);
    expect(json.mock.calls[0][0]).toEqual({ users: [{ id: 'a', name: 'Somchai Jaidee' }] });
  });

  it('ล็อกแต่ไม่รู้แผนก = ลิสต์ว่าง ไม่ยิงฐาน', async () => {
    deptScope.mockResolvedValue({ mode: 'none' });
    const { res, json } = mockRes();
    await handler(req('staff') as never, res as never);
    expect(dbQuery).not.toHaveBeenCalled();
    expect(json.mock.calls[0][0]).toEqual({ users: [] });
  });

  it('parseResponsibleNames ทิ้งแถวที่ไม่มี id/ชื่อ · รูปผิด = ว่าง', () => {
    expect(parseResponsibleNames({ users: [{ id: 'a', name: ' ก ' }, { id: '', name: 'ข' }, { id: 'c' }, null] })).toEqual([
      { id: 'a', name: 'ก' },
    ]);
    expect(parseResponsibleNames([])).toEqual([]);
  });

  it('🔴 ป๊อปนำเข้า + เพิ่มข้อมูลผู้สมัคร ห้ามกลับไปโหลดผู้รับผิดชอบจาก /api/app-users', () => {
    for (const f of ['ImportApplicantsDialog.tsx', 'AddApplicantDialog.tsx']) {
      const src = readFileSync(`src/components/recruit-rm/${f}`, 'utf8');
      expect(src).not.toMatch(/apiFetch\('\/api\/app-users/);
      // ฟอร์มเพิ่มผู้สมัครขอเฉพาะสายงานสรรหา (21 ต.ค. 2569) — ยังเป็นเส้นเดียวกัน ไม่กลับไป /api/app-users
      expect(src).toMatch(/fetchResponsibleNames\(('recruiter'|'online')?\)/);
    }
    // นำเข้า Excel = ชื่อเล่นทีม Online (เจ้าของ 28 ต.ค. 2569 "มันต้องชื่อทีม Online สิ" · แทน 27 ต.ค. สายสรรหา)
    const imp = readFileSync('src/components/recruit-rm/ImportApplicantsDialog.tsx', 'utf8');
    expect(imp).toContain("fetchResponsibleNames('online')");
    expect(imp).toContain('{u.label ?? u.name}');
  });
});
