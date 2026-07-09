// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: vi.fn(),
}));

vi.mock('../../api/_lib/rateLimit.js', () => ({
  rateLimitOrReject: vi.fn(() => true),
}));

vi.mock('../../api/_lib/passwordReset.js', () => ({
  createPasswordResetToken: vi.fn(async () => 'reset-token-secret'),
}));

vi.mock('../../api/_lib/logger.js', () => ({
  logInfo: vi.fn(),
}));

const { authVerifyPassword } = vi.hoisted(() => ({
  authVerifyPassword: vi.fn(async () => true),
}));

vi.mock('../../api/_lib/auth.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../api/_lib/auth.js')>();
  return {
    ...mod,
    verifyPassword: authVerifyPassword,
  };
});

import { dbQuery } from '../../api/_lib/postgres.js';
import devRoleHandler from '../../api/_handlers/auth/dev-role.js';
import registerHandler from '../../api/_handlers/auth/register.js';
import forgotPasswordHandler from '../../api/_handlers/auth/forgot-password.js';
import loginHandler from '../../api/_handlers/auth/login.js';

const ROOT = join(__dirname, '../..');
const JWT_SECRET = 'test-secret-key-at-least-32-characters-long';

function mockRes() {
  const json = vi.fn();
  const setHeader = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status, setHeader, json }, status, json, setHeader };
}

describe('production auth handlers', () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env.AUTH_JWT_SECRET = JWT_SECRET;
    vi.clearAllMocks();
    authVerifyPassword.mockResolvedValue(true);
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it('blocks /api/auth/dev-role in production runtime', async () => {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL_ENV = 'production';
    process.env.JARVIS_DEV_ROLE_LOGIN = 'true';

    const { res, status, json } = mockRes();
    await devRoleHandler({ method: 'POST', body: { role: 'admin' } }, res);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Not found' }),
    );
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it('blocks public register when explicitly disabled', async () => {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL_ENV = 'production';
    process.env.JARVIS_ALLOW_PUBLIC_REGISTER = 'false';

    const { res, status, json } = mockRes();
    await registerHandler(
      {
        method: 'POST',
        body: {
          email: 'new@example.com',
          password: 'Secret123!',
          first_name: 'New',
          last_name: 'User',
        },
      },
      res,
    );

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Forbidden' }),
    );
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it('login sets HttpOnly cookie and does not return token in JSON body', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.VERCEL_ENV;

    vi.mocked(dbQuery).mockResolvedValue({
      rows: [
        {
          id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          email: 'staff@example.com',
          password_hash: '$2a$10$hash',
          role: 'staff',
          full_name: 'Staff User',
          is_active: true,
          created_at: new Date('2026-01-01'),
        },
      ],
    });

    const { res, status, json, setHeader } = mockRes();
    await loginHandler(
      {
        method: 'POST',
        body: { email: 'staff@example.com', password: 'correct' },
      },
      res,
    );

    expect(status).toHaveBeenCalledWith(200);
    const body = json.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body.user).toBeTruthy();
    expect(body.token).toBeUndefined();
    expect(body.accessToken).toBeUndefined();
    expect(setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringContaining('jarvis_auth='),
    );
    expect(String(setHeader.mock.calls[0]?.[1])).toContain('HttpOnly');
  });

  it('forgot-password never returns reset token or temporary password', async () => {
    vi.mocked(dbQuery).mockResolvedValue({
      rows: [{ id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', is_active: true }],
    });

    const { res, status, json } = mockRes();
    await forgotPasswordHandler(
      { method: 'POST', body: { email: 'user@example.com' } },
      res,
    );

    expect(status).toHaveBeenCalledWith(200);
    const body = json.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(typeof body.message).toBe('string');
    expect(body.token).toBeUndefined();
    expect(body.resetToken).toBeUndefined();
    expect(body.temporaryPassword).toBeUndefined();
    expect(body.password).toBeUndefined();
  });

  it('frontend AuthContext does not persist JWT in localStorage', () => {
    const src = readFileSync(join(ROOT, 'src/contexts/AuthContext.tsx'), 'utf8');
    expect(src).not.toMatch(/localStorage\.setItem\([^)]*token/i);
    expect(src).not.toMatch(/localStorage\.getItem\([^)]*token/i);
  });

  it('apiFetch sends cookies for session auth', () => {
    const src = readFileSync(join(ROOT, 'src/lib/apiFetch.ts'), 'utf8');
    expect(src).toContain("credentials: 'include'");
  });
});
