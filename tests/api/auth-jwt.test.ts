// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { signAuthToken, verifyAuthToken } from '../../api/_lib/auth';

describe('auth JWT', () => {
  beforeEach(() => {
    process.env.AUTH_JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
  });

  it('signs and verifies payload', () => {
    const token = signAuthToken({
      sub: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@example.com',
      role: 'supervisor',
    });
    expect(token.length).toBeGreaterThan(20);
    const decoded = verifyAuthToken(token);
    expect(decoded.sub).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(decoded.email).toBe('test@example.com');
    expect(decoded.role).toBe('supervisor');
  });
});
