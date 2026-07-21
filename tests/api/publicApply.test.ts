// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  normalizeAge,
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

describe('normalizeAge', () => {
  it('accepts numbers and numeric strings within range', () => {
    expect(normalizeAge(25)).toBe(25);
    expect(normalizeAge('40')).toBe(40);
    expect(normalizeAge('40.9')).toBe(40);
  });

  it('rejects out-of-range and invalid values', () => {
    expect(normalizeAge(14)).toBeNull();
    expect(normalizeAge(81)).toBeNull();
    expect(normalizeAge('abc')).toBeNull();
    expect(normalizeAge(undefined)).toBeNull();
  });
});

describe('validatePublicApplication', () => {
  const base = {
    title_prefix: 'นาย',
    first_name: 'สมชาย',
    last_name: 'ใจดี',
    phone: '0812345678',
    age: 30,
    gender: 'male',
    province: 'กรุงเทพมหานคร',
    district: 'บางรัก',
    subdistrict: 'สีลม',
  };

  it('accepts a full valid application and composes full_name', () => {
    const result = validatePublicApplication(base);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.titlePrefix).toBe('นาย');
      expect(result.value.firstName).toBe('สมชาย');
      expect(result.value.lastName).toBe('ใจดี');
      expect(result.value.fullName).toBe('นายสมชาย ใจดี');
      expect(result.value.phone).toBe('0812345678');
      expect(result.value.age).toBe(30);
      expect(result.value.gender).toBe('male');
      expect(result.value.province).toBe('กรุงเทพมหานคร');
      expect(result.value.district).toBe('บางรัก');
      expect(result.value.subdistrict).toBe('สีลม');
    }
  });

  it('allows an empty/invalid title prefix (nullable)', () => {
    const result = validatePublicApplication({ ...base, title_prefix: 'ดร.' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.titlePrefix).toBeNull();
      expect(result.value.fullName).toBe('สมชาย ใจดี');
    }
  });

  it('keeps job snapshot and optional fields when provided', () => {
    const result = validatePublicApplication({
      ...base,
      postal_code: '10500',
      job_id: 'sr-123',
      job_title: 'พนักงานขับรถ · สาขาบางนา',
      unit_name: 'สาขาบางนา',
      position_interest: 'พนักงานขับรถ',
      note: 'สะดวกเริ่มงานทันที',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.postalCode).toBe('10500');
      expect(result.value.jobId).toBe('sr-123');
      expect(result.value.unitName).toBe('สาขาบางนา');
      expect(result.value.note).toBe('สะดวกเริ่มงานทันที');
    }
  });

  it('rejects missing name parts', () => {
    expect(validatePublicApplication({ ...base, first_name: '' }).ok).toBe(false);
    expect(validatePublicApplication({ ...base, last_name: '  ' }).ok).toBe(false);
  });

  it('rejects invalid phone', () => {
    expect(validatePublicApplication({ ...base, phone: '12345' }).ok).toBe(false);
  });

  it('rejects invalid age', () => {
    expect(validatePublicApplication({ ...base, age: 10 }).ok).toBe(false);
    expect(validatePublicApplication({ ...base, age: 'x' }).ok).toBe(false);
  });

  it('rejects invalid gender', () => {
    expect(validatePublicApplication({ ...base, gender: 'unknown' }).ok).toBe(false);
  });

  it('requires the full address cascade', () => {
    expect(validatePublicApplication({ ...base, province: '' }).ok).toBe(false);
    expect(validatePublicApplication({ ...base, district: '' }).ok).toBe(false);
    expect(validatePublicApplication({ ...base, subdistrict: '' }).ok).toBe(false);
  });

  it('rejects non-object bodies', () => {
    expect(validatePublicApplication(null).ok).toBe(false);
    expect(validatePublicApplication('text').ok).toBe(false);
  });
});
