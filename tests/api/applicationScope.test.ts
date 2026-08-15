// @vitest-environment node
/**
 * สิทธิ์ "เขียน" ใบสมัครต้องตรงกับด่านอ่าน (buildApplicationsListQuery) — ยึด
 * loadScopedJobIdSet อย่างเดียวไม่พอ เพราะเซ็ตนั้นสร้างจากใบขอที่เปิดอยู่
 * ใบขอปิด → job หลุดจากเซ็ต → ต้องยอมผ่านทางแผนกที่ใบจำไว้ (082)
 */
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

const { isApplicationInWriteScope } = await import('../../api/_lib/applicationScope.js');

const user = { sub: 'u1', role: 'staff' as const };

describe('isApplicationInWriteScope', () => {
  beforeEach(() => {
    loadScopedJobIdSet.mockReset();
    loadUserDepartmentScope.mockReset();
  });

  it('admin (scope = null) → ผ่านทุกใบ ไม่ต้องเช็คแผนก', async () => {
    loadScopedJobIdSet.mockResolvedValue(null);
    expect(await isApplicationInWriteScope(user, { job_id: 'x', department_code: null })).toBe(true);
    expect(loadUserDepartmentScope).not.toHaveBeenCalled();
  });

  it('ใบขอยังเปิด (job อยู่ในเซ็ต) → ผ่าน', async () => {
    loadScopedJobIdSet.mockResolvedValue(new Set(['siamraj-sql:OPL1']));
    expect(
      await isApplicationInWriteScope(user, { job_id: 'siamraj-sql:OPL1', department_code: 'LBD' }),
    ).toBe(true);
  });

  it('ใบขอปิด (job หลุดจากเซ็ต) แต่แผนกตรง → ผ่าน (กติกา 082)', async () => {
    loadScopedJobIdSet.mockResolvedValue(new Set(['siamraj-sql:OTHER']));
    loadUserDepartmentScope.mockResolvedValue({ mode: 'code', code: 'LBD' });
    expect(
      await isApplicationInWriteScope(user, { job_id: 'siamraj-sql:CLOSED', department_code: 'lbd' }),
    ).toBe(true);
  });

  it('ใบขอปิด + แผนกไม่ตรง → 403 (deny)', async () => {
    loadScopedJobIdSet.mockResolvedValue(new Set(['siamraj-sql:OTHER']));
    loadUserDepartmentScope.mockResolvedValue({ mode: 'code', code: 'LBD' });
    expect(
      await isApplicationInWriteScope(user, { job_id: 'siamraj-sql:CLOSED', department_code: 'LBA' }),
    ).toBe(false);
  });

  it('ไม่มี job และไม่มี department_code → deny', async () => {
    loadScopedJobIdSet.mockResolvedValue(new Set(['x']));
    loadUserDepartmentScope.mockResolvedValue({ mode: 'code', code: 'LBD' });
    expect(await isApplicationInWriteScope(user, { job_id: null, department_code: null })).toBe(false);
  });
});
