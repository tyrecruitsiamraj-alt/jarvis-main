import { describe, it, expect } from 'vitest';
import { checkApiAccess, meetsMinimumRole, minimumRoleFor, isReadOnlyRole } from '../../api/_lib/rbac';
import { canAccessPath, canAccessDashboard, canAssignJobStaff, canEditOperationalData, minimumRoleForPath, roleHomePath } from '../../src/lib/rbac';

describe('api rbac matrix', () => {
  it('staff cannot create jobs (supervisor+ only)', () => {
    expect(checkApiAccess('staff', 'jobs', 'POST').ok).toBe(false);
    expect(checkApiAccess('supervisor', 'jobs', 'POST').ok).toBe(true);
  });

  it('staff can read jobs and create candidates', () => {
    expect(checkApiAccess('staff', 'jobs', 'GET').ok).toBe(true);
    expect(checkApiAccess('staff', 'candidates', 'POST').ok).toBe(true);
    expect(checkApiAccess('staff', 'candidates', 'PATCH').ok).toBe(false);
  });

  it('opl is read-only — GET allowed, mutations blocked', () => {
    expect(isReadOnlyRole('opl')).toBe(true);
    expect(checkApiAccess('opl', 'jobs', 'GET').ok).toBe(true);
    expect(checkApiAccess('opl', 'candidates', 'GET').ok).toBe(true);
    expect(checkApiAccess('opl', 'candidates', 'POST').ok).toBe(false);
    expect(checkApiAccess('opl', 'jobs', 'POST').ok).toBe(false);
    expect(checkApiAccess('opl', 'siamraj-unit-notes', 'POST').ok).toBe(false);
    expect(checkApiAccess('opl', 'work-calendar', 'POST').ok).toBe(false);
    expect(checkApiAccess('opl', 'driver-care', 'POST', 'log').ok).toBe(false);
  });

  it('supervisor cannot access admin settings APIs', () => {
    expect(checkApiAccess('supervisor', 'app-users', 'GET').ok).toBe(false);
    expect(checkApiAccess('supervisor', 'audit-logs', 'GET').ok).toBe(false);
    expect(checkApiAccess('supervisor', 'job-staff', 'POST').ok).toBe(true);
    expect(checkApiAccess('admin', 'app-users', 'GET').ok).toBe(true);
  });

  it('staff cannot assign recruiter/screener but can reach unit notes API (grant-gated on write)', () => {
    expect(checkApiAccess('staff', 'siamraj-unit-assignments', 'GET').ok).toBe(true);
    expect(checkApiAccess('staff', 'siamraj-unit-assignments', 'POST').ok).toBe(false);
    expect(checkApiAccess('supervisor', 'siamraj-unit-assignments', 'POST').ok).toBe(true);
    expect(checkApiAccess('staff', 'siamraj-unit-notes', 'POST').ok).toBe(true);
    expect(checkApiAccess('supervisor', 'siamraj-unit-notes', 'POST').ok).toBe(true);
  });

  it('clients: staff read, supervisor write including create', () => {
    expect(minimumRoleFor('clients', 'GET')).toBe('staff');
    expect(minimumRoleFor('clients', 'PATCH')).toBe('supervisor');
    expect(minimumRoleFor('clients', 'POST')).toBe('supervisor');
    expect(minimumRoleFor('clients', 'DELETE')).toBe('supervisor');
    expect(checkApiAccess('supervisor', 'clients', 'PATCH').ok).toBe(true);
    expect(checkApiAccess('supervisor', 'clients', 'POST').ok).toBe(true);
    expect(checkApiAccess('supervisor', 'clients', 'DELETE').ok).toBe(true);
  });

  it('driver-care: staff can log actions, supervisor recalculates', () => {
    expect(checkApiAccess('staff', 'driver-care', 'POST', 'log').ok).toBe(true);
    expect(checkApiAccess('staff', 'driver-care-recalculate', 'POST').ok).toBe(false);
    expect(checkApiAccess('supervisor', 'driver-care-recalculate', 'POST').ok).toBe(true);
  });

  it('role hierarchy', () => {
    expect(meetsMinimumRole('admin', 'staff')).toBe(true);
    expect(meetsMinimumRole('staff', 'admin')).toBe(false);
    expect(meetsMinimumRole('opl', 'staff')).toBe(true);
    expect(meetsMinimumRole('opl', 'supervisor')).toBe(false);
    expect(meetsMinimumRole('staff', 'opl')).toBe(false);
  });
});

describe('frontend route rbac', () => {
  it('maps role homes', () => {
    expect(roleHomePath('opl')).toBe('/opl');
    expect(roleHomePath('staff')).toBe('/staff');
    expect(roleHomePath('supervisor')).toBe('/supervisor');
    expect(roleHomePath('admin')).toBe('/admin');
  });

  it('opl can access staff-level read routes but not write-only paths', () => {
    expect(canAccessPath('opl', '/settings')).toBe(false);
    expect(canAccessPath('opl', '/dashboard')).toBe(true);
    expect(canAccessPath('opl', '/wl/employees/add')).toBe(false);
    expect(canAccessPath('opl', '/admin')).toBe(false);
    expect(canAccessPath('opl', '/jobs')).toBe(true);
    expect(canAccessPath('opl', '/matching/candidates')).toBe(true);
  });

  it('staff cannot access admin settings or supervisor-only routes', () => {
    expect(canAccessPath('staff', '/settings')).toBe(false);
    expect(canAccessPath('staff', '/dashboard')).toBe(true);
    expect(canAccessPath('staff', '/wl/employees/add')).toBe(false);
    expect(canAccessPath('staff', '/admin')).toBe(false);
    expect(canAccessPath('staff', '/jobs')).toBe(true);
  });

  it('supervisor cannot access admin settings but can use operational routes', () => {
    expect(canAccessPath('supervisor', '/settings')).toBe(false);
    expect(canAccessPath('supervisor', '/admin')).toBe(false);
    expect(canAccessPath('supervisor', '/dashboard')).toBe(true);
    expect(canAccessPath('supervisor', '/wl/employees/add')).toBe(true);
    expect(canAccessPath('supervisor', '/jobs/abc')).toBe(true);
    expect(canAccessPath('supervisor', '/driver-care/resources')).toBe(true);
  });

  it('admin can access all guarded routes', () => {
    expect(canAccessPath('admin', '/settings')).toBe(true);
    expect(canAccessPath('admin', '/dashboard')).toBe(true);
    expect(canAccessPath('admin', '/admin')).toBe(true);
  });

  it('minimum roles for sensitive paths', () => {
    expect(minimumRoleForPath('/settings')).toBe('admin');
    expect(minimumRoleForPath('/dashboard')).toBe('staff');
    expect(minimumRoleForPath('/matching/candidates')).toBe('staff');
  });

  it('dashboard and edit/assign helpers', () => {
    expect(canAccessDashboard('staff')).toBe(true);
    expect(canAccessDashboard('supervisor')).toBe(true);
    expect(canAccessDashboard('admin')).toBe(true);
    expect(canAccessDashboard(null)).toBe(false);
    expect(canAssignJobStaff('staff')).toBe(false);
    expect(canAssignJobStaff('supervisor')).toBe(true);
    expect(canEditOperationalData('opl')).toBe(false);
    expect(canEditOperationalData('staff')).toBe(false);
    expect(canEditOperationalData('supervisor')).toBe(true);
  });
});
