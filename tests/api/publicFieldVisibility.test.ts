// @vitest-environment node
/**
 * 🔴 ติ๊กว่าหน้าสาธารณะเห็นช่องไหน (เจ้าของเคาะ 22 ก.ย. 2569 นิยามกล่องงานข้อ 3)
 * กติกา: ไม่ตั้ง = โชว์ · เก็บเฉพาะช่องที่ติ๊กออก (false) · คุมแค่การแสดงผล ไม่ลบค่า
 */
import { describe, expect, it } from 'vitest';
import {
  PUBLIC_TOGGLE_FIELDS,
  publicFieldVisible,
  readPublicVisibility,
} from '../../src/lib/publicFieldVisibility.js';
import { cleanFieldOverrides } from '../../api/_lib/siamrajUnitNotes.js';
import type { JobRequest } from '../../src/types/index.js';

const job = (vis?: unknown): JobRequest =>
  ({ id: 'j1', field_overrides: vis === undefined ? null : { public_visibility: vis } } as JobRequest);

describe('publicFieldVisible — ไม่ตั้ง = โชว์', () => {
  it('ไม่มี field_overrides = โชว์ทุกช่อง', () => {
    for (const f of PUBLIC_TOGGLE_FIELDS) expect(publicFieldVisible(job(), f)).toBe(true);
  });
  it('ติ๊กออกเฉพาะเงิน = เงินซ่อน ช่องอื่นโชว์', () => {
    const j = job({ income: false });
    expect(publicFieldVisible(j, 'income')).toBe(false);
    expect(publicFieldVisible(j, 'benefits')).toBe(true);
    expect(publicFieldVisible(j, 'ot')).toBe(true);
  });
  it('true ที่ชัดแจ้งก็โชว์ (เฉพาะ false เท่านั้นที่ซ่อน)', () => {
    expect(publicFieldVisible(job({ income: true }), 'income')).toBe(true);
  });
});

describe('readPublicVisibility — เอาไปตั้ง checkbox', () => {
  it('null = ทุกช่อง true', () => {
    const r = readPublicVisibility(null);
    for (const f of PUBLIC_TOGGLE_FIELDS) expect(r[f]).toBe(true);
  });
  it('ช่องที่ false อ่านกลับเป็น false', () => {
    const r = readPublicVisibility({ benefits: false });
    expect(r.benefits).toBe(false);
    expect(r.income).toBe(true);
  });
});

describe('sanitizer ฝั่ง API — เก็บเฉพาะ false ที่รู้จัก', () => {
  it('เก็บเฉพาะคีย์ที่ติ๊กออก true ไม่ถูกเก็บ (กัน jsonb บวม)', () => {
    const out = cleanFieldOverrides({
      public_visibility: { income: false, benefits: true, ot: false },
    });
    expect(out?.public_visibility).toEqual({ income: false, ot: false });
  });
  it('คีย์แปลกถูกตัดทิ้ง', () => {
    const out = cleanFieldOverrides({ public_visibility: { hacker: false, income: false } });
    expect(out?.public_visibility).toEqual({ income: false });
  });
  it('ไม่มีช่องไหน false = null (ไม่เก็บ)', () => {
    const out = cleanFieldOverrides({ public_visibility: { income: true } });
    expect(out?.public_visibility ?? null).toBeNull();
  });
  it('public_visibility ไม่ทำให้ของเดิม (gender) หาย', () => {
    const out = cleanFieldOverrides({ gender: 'M', public_visibility: { income: false } });
    expect(out?.gender).toBe('M');
    expect(out?.public_visibility).toEqual({ income: false });
  });
});
