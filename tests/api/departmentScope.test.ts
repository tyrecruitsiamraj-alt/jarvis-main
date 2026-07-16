import { describe, it, expect } from 'vitest';
import {
  departmentScopeFromUser,
  jobAllowedByDepartmentScope,
  sqlServerDepartmentScopeClause,
} from '../../api/_lib/departmentScope';

describe('departmentScope', () => {
  it('admin always sees all departments', () => {
    expect(departmentScopeFromUser({ role: 'admin', department_code: 'LBD' })).toEqual({ mode: 'all' });
    expect(departmentScopeFromUser({ role: 'admin', department_code: null })).toEqual({ mode: 'all' });
  });

  it('locks non-admin users with a department code', () => {
    expect(departmentScopeFromUser({ role: 'staff', department_code: 'lbd' })).toEqual({
      mode: 'code',
      code: 'LBD',
    });
  });

  it('blocks unscoped non-admin users until they pick a department', () => {
    expect(departmentScopeFromUser({ role: 'supervisor', department_code: null })).toEqual({
      mode: 'none',
    });
  });

  it('filters jobs by department scope', () => {
    const scope = { mode: 'code' as const, code: 'LBD' };
    expect(jobAllowedByDepartmentScope({ department_code: 'LBD' }, scope)).toBe(true);
    expect(jobAllowedByDepartmentScope({ department_code: 'LBA' }, scope)).toBe(false);
    expect(jobAllowedByDepartmentScope({ department_code: 'LBD' }, { mode: 'all' })).toBe(true);
    expect(jobAllowedByDepartmentScope({ department_code: 'LBD' }, { mode: 'none' })).toBe(false);
  });

  it('emits impossible SQL when scope is none', () => {
    expect(sqlServerDepartmentScopeClause({ mode: 'none' })).toEqual({
      sql: 'AND 1 = 0',
      params: {},
    });
  });
});
