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
      codes: ['LBD'],
    });
  });

  it('หลาย BU (26 ต.ค. 2569): BU หลัก + BU เพิ่ม · ตัดซ้ำ/รหัสขยะ · กรองใบขอทุก BU ในสิทธิ์', () => {
    const scope = departmentScopeFromUser({ role: 'staff', department_code: 'LBD', extra_department_codes: ['lba', 'LBD', 'XX'] });
    expect(scope).toEqual({ mode: 'code', code: 'LBD', codes: ['LBD', 'LBA'] });
    expect(jobAllowedByDepartmentScope({ department_code: 'LBA' }, scope)).toBe(true);
    expect(jobAllowedByDepartmentScope({ department_code: 'LM' }, scope)).toBe(false);
    expect(sqlServerDepartmentScopeClause(scope)).toEqual({
      sql: 'AND RTRIM(SS.department_code) IN (@scopeDept0, @scopeDept1)',
      params: { scopeDept0: 'LBD', scopeDept1: 'LBA' },
    });
    // แอดมินไม่สน BU เพิ่ม — เห็นทุก BU อยู่แล้ว
    expect(departmentScopeFromUser({ role: 'admin', department_code: 'LBD', extra_department_codes: ['LBA'] })).toEqual({ mode: 'all' });
  });

  it('blocks unscoped non-admin users until they pick a department', () => {
    expect(departmentScopeFromUser({ role: 'supervisor', department_code: null })).toEqual({
      mode: 'none',
    });
  });

  it('filters jobs by department scope', () => {
    const scope = { mode: 'code' as const, code: 'LBD', codes: ['LBD'] };
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

describe('หน้าสรุปดูทีละ BU (pickDashboardBu · 26 ต.ค. 2569)', () => {
  it('แอดมินตามที่ขอ · BU เดียวล็อก · หลาย BU สลับได้เฉพาะในสิทธิ์ (ขอนอกสิทธิ์ = BU หลัก)', async () => {
    const { pickDashboardBu } = await import('../../api/_lib/homeBuSql');
    expect(pickDashboardBu({ mode: 'all' }, 'LBA')).toEqual({ bu: 'LBA', forcedBu: null, choices: null });
    expect(pickDashboardBu({ mode: 'all' }, undefined)).toEqual({ bu: null, forcedBu: null, choices: null });
    expect(pickDashboardBu({ mode: 'code', code: 'LBD', codes: ['LBD'] }, 'LBA')).toEqual({ bu: 'LBD', forcedBu: 'LBD', choices: null });
    const multi = { mode: 'code' as const, code: 'LBD', codes: ['LBD', 'LM'] };
    expect(pickDashboardBu(multi, 'LML')).toEqual({ bu: 'LM', forcedBu: null, choices: ['LBD', 'LM'] });
    expect(pickDashboardBu(multi, 'LBA')).toEqual({ bu: 'LBD', forcedBu: null, choices: ['LBD', 'LM'] });
    expect(pickDashboardBu(multi, null)).toEqual({ bu: 'LBD', forcedBu: null, choices: ['LBD', 'LM'] });
  });
});
