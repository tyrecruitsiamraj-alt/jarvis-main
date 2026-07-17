import { describe, expect, it } from 'vitest';
import { parseLenientJson } from '../../api/_lib/jsonRepair';

describe('parseLenientJson', () => {
  it('parses clean JSON as-is', () => {
    expect(parseLenientJson('{"a": 1, "b": "x"}')).toEqual({ a: 1, b: 'x' });
  });

  it('recovers from an unescaped backslash (markdown-style \\_ \\*)', () => {
    const text = '{"note": "ต้องเช็ค \\_ข้อมูล\\_ ให้ครบ"}';
    expect(() => parseLenientJson(text)).not.toThrow();
  });

  it('recovers from a truncated (cut-off) response by closing open brackets', () => {
    const text = '{"a": 1, "list": ["x", "y"';
    const parsed = parseLenientJson<{ a: number; list: string[] }>(text);
    expect(parsed.a).toBe(1);
    expect(parsed.list).toEqual(['x', 'y']);
  });

  it('recovers from trailing garbage after the object closes (regression: real candidate-spec failure)', () => {
    // Reproduces the observed failure: model appends an extra closing brace + a stray
    // markdown code-fence marker after the JSON object is already complete.
    const text = '{"job_family_code": "D", "compensation_note": "สูงกว่าค่าเฉลี่ย"}}\n```';
    const parsed = parseLenientJson<{ job_family_code: string }>(text);
    expect(parsed.job_family_code).toBe('D');
  });

  it('recovers from leading prose before the JSON object', () => {
    const text = 'นี่คือผลการวิเคราะห์:\n{"a": 1}';
    expect(parseLenientJson<{ a: number }>(text).a).toBe(1);
  });

  it('throws when nothing resembles JSON at all', () => {
    expect(() => parseLenientJson('ขอโทษครับ ไม่สามารถวิเคราะห์ได้')).toThrow();
  });
});
