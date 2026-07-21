// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  normalizeThaiPhone,
  validatePublicApplication,
} from '../../api/_lib/publicApplications';

describe('normalizeThaiPhone', () => {
  it('accepts plain 10-digit mobile numbers', () => {
    expect(normalizeThaiPhone('0812345678')).toBe('0812345678');
  });

  it('strips separators and spaces', () => {
    expect(normalizeThaiPhone('081-234-5678')).toBe('0812345678');
    expect(normalizeThaiPhone('081 234 5678')).toBe('0812345678');
  });

  it('normalizes +66 prefix to leading zero', () => {
    expect(normalizeThaiPhone('+66812345678')).toBe('0812345678');
    expect(normalizeThaiPhone('66812345678')).toBe('0812345678');
  });

  it('accepts 9-digit landline numbers', () => {
    expect(normalizeThaiPhone('021234567')).toBe('021234567');
  });

  it('rejects invalid input', () => {
    expect(normalizeThaiPhone('12345')).toBeNull();
    expect(normalizeThaiPhone('8123456789')).toBeNull();
    expect(normalizeThaiPhone('')).toBeNull();
    expect(normalizeThaiPhone(undefined)).toBeNull();
  });
});

describe('validatePublicApplication', () => {
  const base = { full_name: 'สมชาย ใจดี', phone: '0812345678' };

  it('accepts a minimal valid application', () => {
    const result = validatePublicApplication(base);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.fullName).toBe('สมชาย ใจดี');
      expect(result.value.phone).toBe('0812345678');
      expect(result.value.jobId).toBeNull();
      expect(result.value.note).toBeNull();
    }
  });

  it('keeps job snapshot fields when provided', () => {
    const result = validatePublicApplication({
      ...base,
      job_id: 'sr-123',
      job_title: 'พนักงานขับรถ · สาขาบางนา',
      unit_name: 'สาขาบางนา',
      position_interest: 'พนักงานขับรถ',
      note: 'สะดวกเริ่มงานทันที',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.jobId).toBe('sr-123');
      expect(result.value.unitName).toBe('สาขาบางนา');
      expect(result.value.positionInterest).toBe('พนักงานขับรถ');
      expect(result.value.note).toBe('สะดวกเริ่มงานทันที');
    }
  });

  it('rejects missing or too-short name', () => {
    expect(validatePublicApplication({ ...base, full_name: '' }).ok).toBe(false);
    expect(validatePublicApplication({ ...base, full_name: 'ก' }).ok).toBe(false);
    expect(validatePublicApplication({ phone: base.phone }).ok).toBe(false);
  });

  it('rejects invalid phone', () => {
    expect(validatePublicApplication({ ...base, phone: '12345' }).ok).toBe(false);
    expect(validatePublicApplication({ full_name: base.full_name }).ok).toBe(false);
  });

  it('rejects non-object bodies', () => {
    expect(validatePublicApplication(null).ok).toBe(false);
    expect(validatePublicApplication('text').ok).toBe(false);
  });
});
