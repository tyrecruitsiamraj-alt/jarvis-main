// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { withRbac } from '../../api/_lib/http.js';
import { signAuthToken, AUTH_COOKIE_NAME } from '../../api/_lib/auth.js';
import { checkApiAccess } from '../../api/_lib/rbac.js';

const ROOT = join(__dirname, '../..');
const ADMIN_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

function mockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status, json }, status, json };
}

function adminReq(method: string) {
  const token = signAuthToken({
    sub: ADMIN_ID,
    email: 'admin@example.com',
    role: 'admin',
  });
  return { method, headers: { cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}` } };
}

describe('production audit RBAC', () => {
  beforeEach(() => {
    process.env.AUTH_JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
  });

  it('audit log read is admin-only', () => {
    expect(checkApiAccess('staff', 'audit-logs', 'GET').ok).toBe(false);
    expect(checkApiAccess('supervisor', 'audit-logs', 'GET').ok).toBe(false);
    expect(checkApiAccess('admin', 'audit-logs', 'GET').ok).toBe(true);
  });

  it('client cannot POST audit logs (even as admin)', async () => {
    const inner = vi.fn();
    const handler = withRbac(async (req, res) => {
      if ((req.method || 'GET').toUpperCase() === 'POST') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Audit logs are written by the server on successful mutations',
        });
      }
      await inner(req, res);
    }, 'audit-logs');

    const { res, status, json } = mockRes();
    await handler(adminReq('POST'), res);
    expect(inner).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('server on successful mutations'),
      }),
    );
  });

  it('mutation handlers use server-side audit helpers', () => {
    const driverCareRecalc = readFileSync(
      join(ROOT, 'api/_handlers/driver-care-recalculate.ts'),
      'utf8',
    );
    const jobAssignments = readFileSync(
      join(ROOT, 'api/_lib/jobAssignmentService.ts'),
      'utf8',
    );
    const workCalendar = readFileSync(
      join(ROOT, 'api/_lib/workCalendarService.ts'),
      'utf8',
    );

    expect(driverCareRecalc).toContain('auditFromAuthed');
    expect(jobAssignments).toContain('writeAuditInTx');
    expect(workCalendar).toContain('writeAuditInTx');
  });
});
