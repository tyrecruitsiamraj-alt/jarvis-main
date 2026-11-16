// @vitest-environment node
/**
 * ใบ iRecruit คลังกลาง (ไม่ผูกใบขอ · ไม่มีแผนก) — ด่านเขียนต้องตรงด่านอ่าน (16 พ.ย. 2569)
 * เคสจริง: pakkorn (staff · LBD + ดูเพิ่ม 4 BU) เปิดป๊อปผู้สมัครได้ แต่กดบันทึกแล้ว "ไม่มีสิทธิ์เข้าถึงใบสมัครของแผนกอื่น"
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadScopedJobIdSet = vi.fn();
const loadUserDepartmentScope = vi.fn();
vi.mock('../../api/_lib/siamrajUnitRequests.js', () => ({ loadScopedJobIdSet }));
vi.mock('../../api/_lib/departmentScope.js', () => ({
  loadUserDepartmentScope,
  normalizeDepartmentCode: (c?: string | null) => (c || '').trim().toUpperCase() || null,
}));
vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: vi.fn() }));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));
const { isApplicationInWriteScope, isUnassignedIrecruitRow } = await import('../../api/_lib/applicationScope.js');

const user = { sub: 'u1', role: 'staff' as const };

describe('ใบ iRecruit คลังกลาง เขียนได้เหมือนที่อ่านได้', () => {
  beforeEach(() => {
    loadScopedJobIdSet.mockResolvedValue(new Set(['siamraj-sql:OPL6911001']));
    loadUserDepartmentScope.mockResolvedValue({ mode: 'code', code: 'LBD', codes: ['LBD', 'SN', 'DS', 'LM', 'LBA'] });
  });

  it('iRecruit ไม่ผูกใบขอ ไม่มีแผนก → ผ่าน', async () => {
    expect(await isApplicationInWriteScope(user, { job_id: null, department_code: null, created_by_name: 'iRecruit' })).toBe(true);
    expect(await isApplicationInWriteScope(user, { job_id: null, department_code: '  ', created_by_name: 'iRecruit' })).toBe(true);
  });

  it('ไม่ใช่ iRecruit / มีแผนกอื่น / ผูกใบขอนอกสิทธิ์ → ยังกันเหมือนเดิม', async () => {
    expect(await isApplicationInWriteScope(user, { job_id: null, department_code: null, created_by_name: 'pakkorn.k@siamraj.com' })).toBe(false);
    expect(await isApplicationInWriteScope(user, { job_id: null, department_code: 'XX', created_by_name: 'iRecruit' })).toBe(false);
    expect(isUnassignedIrecruitRow({ job_id: 'siamraj-sql:OTHER', department_code: null, created_by_name: 'iRecruit' })).toBe(false);
  });

  it('ไม่มีสิทธิ์ BU เลย (mode none) → ไม่ผ่าน', async () => {
    loadScopedJobIdSet.mockResolvedValue(new Set());
    loadUserDepartmentScope.mockResolvedValue({ mode: 'none' });
    expect(await isApplicationInWriteScope(user, { job_id: null, department_code: null, created_by_name: 'iRecruit' })).toBe(false);
  });

  it('ทุกด่านเขียนอ่าน created_by_name มาด้วย (ไม่งั้นข้อนี้ไม่มีผล)', () => {
    const h = readFileSync('api/_handlers/job-applications.ts', 'utf8');
    expect(h).not.toMatch(/select [^`]*\bjob_id, department_code from \$\{tbl\} where id = \$1/);
    expect(readFileSync('api/_lib/applicationScope.ts', 'utf8').match(/job_id, department_code, created_by_name from/g)?.length).toBe(2);
    expect(readFileSync('api/_handlers/job-application-document.ts', 'utf8')).not.toContain('job_id, department_code from');
  });
});
