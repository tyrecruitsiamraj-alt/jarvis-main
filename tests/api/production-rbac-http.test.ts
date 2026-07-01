// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withRbac } from '../../api/_lib/http.js';
import { signAuthToken, AUTH_COOKIE_NAME } from '../../api/_lib/auth.js';
import { checkApiAccess } from '../../api/_lib/rbac.js';
import { canAccessPath } from '../../src/lib/rbac.js';

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

function authedReq(role: 'staff' | 'supervisor' | 'admin', method = 'GET') {
  const token = signAuthToken({
    sub: USER_ID,
    email: `${role}@example.com`,
    role,
  });
  return {
    method,
    headers: { cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}` },
    query: {},
  };
}

function mockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status, json }, status, json };
}

describe('production RBAC — API 403', () => {
  beforeEach(() => {
    process.env.AUTH_JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
    process.env.NODE_ENV = 'development';
    delete process.env.VERCEL_ENV;
  });

  it('staff cannot read audit logs (admin only)', async () => {
    const inner = vi.fn();
    const handler = withRbac(inner, 'audit-logs');
    const { res, status, json } = mockRes();
    await handler(authedReq('staff'), res);
    expect(inner).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Forbidden' }),
    );
  });

  it('staff cannot POST jobs', async () => {
    expect(checkApiAccess('staff', 'jobs', 'POST').ok).toBe(false);
    const inner = vi.fn();
    const handler = withRbac(inner, 'jobs');
    const { res, status } = mockRes();
    await handler(authedReq('staff', 'POST'), res);
    expect(inner).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });

  it('supervisor cannot read app-users (admin only)', async () => {
    const inner = vi.fn();
    const handler = withRbac(inner, 'app-users');
    const { res, status } = mockRes();
    await handler(authedReq('supervisor'), res);
    expect(inner).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });

  it('admin can reach audit logs handler', async () => {
    const inner = vi.fn(async () => undefined);
    const handler = withRbac(inner, 'audit-logs');
    const { res, status } = mockRes();
    await handler(authedReq('admin'), res);
    expect(inner).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalledWith(403);
  });
});

describe('production RBAC — frontend routes', () => {
  it('staff cannot access admin settings page', () => {
    expect(canAccessPath('staff', '/settings')).toBe(false);
    expect(canAccessPath('staff', '/admin')).toBe(false);
  });

  it('supervisor cannot access admin settings', () => {
    expect(canAccessPath('supervisor', '/settings')).toBe(false);
    expect(canAccessPath('supervisor', '/admin')).toBe(false);
  });

  it('admin can access admin settings', () => {
    expect(canAccessPath('admin', '/settings')).toBe(true);
    expect(canAccessPath('admin', '/admin')).toBe(true);
  });
});
