// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  companyEmailRequiredMessage,
  getCompanyEmailDomains,
  isCompanyEmail,
  isCompanyEmailLoginEnforced,
} from '../../api/_lib/companyEmail.js';

describe('company email policy', () => {
  const env = { ...process.env };

  beforeEach(() => {
    delete process.env.JARVIS_COMPANY_EMAIL_DOMAINS;
    delete process.env.EMAIL_SENDER;
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it('derives allowed domain from EMAIL_SENDER', () => {
    process.env.EMAIL_SENDER = 'no-reply-support@siamraj.com';
    expect(getCompanyEmailDomains()).toEqual(['siamraj.com']);
    expect(isCompanyEmail('user@siamraj.com')).toBe(true);
    expect(isCompanyEmail('user@gmail.com')).toBe(false);
    expect(isCompanyEmailLoginEnforced()).toBe(true);
    expect(companyEmailRequiredMessage()).toContain('@siamraj.com');
  });

  it('supports explicit domain list override', () => {
    process.env.JARVIS_COMPANY_EMAIL_DOMAINS = 'siamraj.com,example.co.th';
    expect(isCompanyEmail('a@example.co.th')).toBe(true);
    expect(isCompanyEmail('a@other.com')).toBe(false);
  });
});
