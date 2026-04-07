// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { withAuth } from '../../api/_lib/http';

describe('withAuth', () => {
  beforeEach(() => {
    process.env.AUTH_JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
  });

  it('returns 401 when cookie is missing', async () => {
    const inner = vi.fn();
    const handler = withAuth(inner, { roles: ['admin'] });
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const res = { status };
    await handler({ method: 'GET', headers: {} }, res);
    expect(inner).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalled();
  });
});
