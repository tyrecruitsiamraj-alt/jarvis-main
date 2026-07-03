import { describe, it, expect } from 'vitest';
import { isValidEnglishName, sanitizeEnglishName } from '../../src/lib/englishName';

describe('englishName', () => {
  it('sanitizes non-English characters', () => {
    expect(sanitizeEnglishName('สมชาย')).toBe('');
    expect(sanitizeEnglishName('Johnสมชาย')).toBe('John');
    expect(sanitizeEnglishName("O'Brien")).toBe("O'Brien");
    expect(sanitizeEnglishName('Mary-Jane')).toBe('Mary-Jane');
  });

  it('validates English names', () => {
    expect(isValidEnglishName('John')).toBe(true);
    expect(isValidEnglishName('Mary Jane')).toBe(true);
    expect(isValidEnglishName("O'Brien")).toBe(true);
    expect(isValidEnglishName('Jean-Luc')).toBe(true);
    expect(isValidEnglishName('สมชาย')).toBe(false);
    expect(isValidEnglishName('John123')).toBe(false);
    expect(isValidEnglishName('')).toBe(false);
  });
});
