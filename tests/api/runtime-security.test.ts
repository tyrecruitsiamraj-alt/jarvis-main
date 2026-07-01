// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isProductionRuntime,
  isDevRoleLoginAllowed,
  isPublicRegistrationAllowed,
} from '../../api/_lib/runtime';
import { checkRateLimit, resetRateLimitsForTests } from '../../api/_lib/rateLimit';

describe('runtime security', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('treats VERCEL_ENV=production as production', () => {
    process.env.NODE_ENV = 'development';
    process.env.VERCEL_ENV = 'production';
    expect(isProductionRuntime()).toBe(true);
    expect(isDevRoleLoginAllowed()).toBe(false);
    expect(isPublicRegistrationAllowed()).toBe(false);
  });

  it('allows public register in production when explicitly enabled', () => {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL_ENV = 'production';
    process.env.JARVIS_ALLOW_PUBLIC_REGISTER = 'true';
    expect(isPublicRegistrationAllowed()).toBe(true);
  });

  it('allows dev-role only when explicitly enabled outside production', () => {
    process.env.NODE_ENV = 'development';
    process.env.VERCEL_ENV = 'preview';
    process.env.JARVIS_DEV_ROLE_LOGIN = 'true';
    expect(isDevRoleLoginAllowed()).toBe(true);
  });

  it('blocks dev-role when flag is not true', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.VERCEL_ENV;
    delete process.env.JARVIS_DEV_ROLE_LOGIN;
    expect(isDevRoleLoginAllowed()).toBe(false);
  });
});

describe('rate limit', () => {
  beforeEach(() => resetRateLimitsForTests());

  it('blocks after max attempts', () => {
    expect(checkRateLimit('login:test', 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit('login:test', 2, 60_000).allowed).toBe(true);
    const blocked = checkRateLimit('login:test', 2, 60_000);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterSec).toBeGreaterThan(0);
    }
  });
});
