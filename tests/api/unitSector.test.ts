// @vitest-environment node
/**
 * ประเภทหน่วยงาน ราชการ/เอกชน (migration 108 · เจ้าของเคาะ 25 ส.ค. 2569)
 *
 * ด่านที่ห้ามหลุด:
 * 1. มีสองค่าเท่านั้น ตรงกับ CHECK ของ migration — เพิ่มค่าที่สามต้องมี migration ใหม่
 * 2. 🔴 "ยังไม่ระบุ" ต้องไม่ถูกอ่านเป็น "เอกชน" — ห้ามมี default
 * 3. 🔴 ค่ามั่ว (undefined) ต้องแยกจากการล้างค่า (null) ให้ขาด
 *    ถ้ารวมกัน ค่ามั่วจะกลายเป็นล้างค่า แล้วของที่ทีมระบุไว้หายเงียบ
 * 4. นับความครบที่ระดับหน่วยงาน ไม่ใช่ระดับใบขอ (ไซต์เดียวมีหลายใบ)
 */
import { describe, expect, it } from 'vitest';
import {
  UNIT_SECTORS,
  UNIT_SECTOR_LABEL,
  UNIT_SECTOR_OPTIONS,
  UNIT_SECTOR_UNSET_LABEL,
  isUnitSector,
  normalizeUnitSector,
  sectorCoverage,
  unitSectorLabel,
} from '../../src/lib/unitSector.js';

describe('ชุดค่า', () => {
  it('มีสองค่าเท่านั้น ตรงกับ CHECK ของ migration 108', () => {
    expect([...UNIT_SECTORS]).toEqual(['government', 'private']);
    expect(UNIT_SECTOR_LABEL.government).toBe('ราชการ');
    expect(UNIT_SECTOR_LABEL.private).toBe('เอกชน');
  });

  it('ตัวเลือก dropdown เรียงคงที่ ไม่สลับที่', () => {
    expect(UNIT_SECTOR_OPTIONS.map((o) => o.value)).toEqual(['government', 'private']);
    expect(UNIT_SECTOR_OPTIONS.every((o) => o.label.trim().length > 0)).toBe(true);
  });

  it('ตรวจค่าถูก/ผิด', () => {
    expect(isUnitSector('government')).toBe(true);
    expect(isUnitSector('private')).toBe(true);
    expect(isUnitSector('bank')).toBe(false);
    expect(isUnitSector('รัฐวิสาหกิจ')).toBe(false);
    expect(isUnitSector(null)).toBe(false);
    expect(isUnitSector(1)).toBe(false);
  });
});

describe('🔴 ยังไม่ระบุ ต้องไม่กลายเป็นเอกชน', () => {
  it('ค่าว่างอ่านว่า "ยังไม่ระบุ" ไม่ใช่คำตอบจริง', () => {
    expect(unitSectorLabel(null)).toBe(UNIT_SECTOR_UNSET_LABEL);
    expect(unitSectorLabel(undefined)).toBe(UNIT_SECTOR_UNSET_LABEL);
    expect(unitSectorLabel(null)).not.toBe(UNIT_SECTOR_LABEL.private);
    expect(unitSectorLabel(null)).not.toBe(UNIT_SECTOR_LABEL.government);
  });

  it('มีค่าแล้วอ่านเป็นคำไทยที่เจ้าของเคาะ', () => {
    expect(unitSectorLabel('government')).toBe('ราชการ');
    expect(unitSectorLabel('private')).toBe('เอกชน');
  });
});

describe('🔴 ค่ามั่ว ต้องไม่กลายเป็นการล้างค่า', () => {
  it('ค่าถูกต้อง คืนค่านั้น', () => {
    expect(normalizeUnitSector('government')).toBe('government');
    expect(normalizeUnitSector(' private ')).toBe('private');
  });

  it('null / ว่าง = ล้างค่ากลับไปยังไม่ระบุ', () => {
    expect(normalizeUnitSector(null)).toBeNull();
    expect(normalizeUnitSector('')).toBeNull();
    expect(normalizeUnitSector('   ')).toBeNull();
  });

  it('ค่ามั่ว = undefined (ผู้เรียกต้อง 400 ห้ามเงียบ ห้ามล้างค่า)', () => {
    expect(normalizeUnitSector('bank')).toBeUndefined();
    expect(normalizeUnitSector('DROP TABLE')).toBeUndefined();
    expect(normalizeUnitSector(123)).toBeUndefined();
    expect(normalizeUnitSector(undefined)).toBeUndefined();
    expect(normalizeUnitSector({})).toBeUndefined();
    // ตัวสำคัญ: ค่ามั่วต้องไม่เท่ากับ null (ซึ่งแปลว่าล้างค่า)
    expect(normalizeUnitSector('bank')).not.toBeNull();
  });
});

describe('นับความครบที่ระดับหน่วยงาน', () => {
  it('ไซต์เดียวมีหลายใบ นับเป็นหน่วยงานเดียว', () => {
    const jobs = ['67LBDL0208', '67LBDL0208', '67LBDL0208', '66LML0011'];
    const got = sectorCoverage(jobs, { '67LBDL0208': 'government' });
    expect(got).toEqual({ total: 2, filled: 1, missing: 1 });
  });

  it('ค่าว่าง/null ในรายการไม่ถูกนับเป็นหน่วยงาน', () => {
    expect(sectorCoverage(['', null, undefined, '  '], {})).toEqual({
      total: 0,
      filled: 0,
      missing: 0,
    });
  });

  it('ระบุครบแล้ว missing = 0', () => {
    const got = sectorCoverage(['A', 'B'], { A: 'private', B: 'government' });
    expect(got).toEqual({ total: 2, filled: 2, missing: 0 });
  });
});
