import { describe, expect, it } from 'vitest';
import {
  UNIT_SECTOR_FILTER_OPTIONS,
  UNIT_SECTOR_FILTER_VALUES,
  matchesAnyUnitSectorFilter,
} from '@/lib/unitSector';
import { buildJobListSearchParams, parseJobListSearchParams } from '@/lib/jobListPageState';

describe('matchesAnyUnitSectorFilter — ตัวกรองราชการ/เอกชน หน้ารายการใบขอ', () => {
  it('ไม่เลือกอะไร = ผ่านทุกใบ (ทั้งหมด)', () => {
    expect(matchesAnyUnitSectorFilter('government', [])).toBe(true);
    expect(matchesAnyUnitSectorFilter(null, [])).toBe(true);
  });

  it('เลือกค่าจริงแล้วกรองตรงค่า', () => {
    expect(matchesAnyUnitSectorFilter('government', ['government'])).toBe(true);
    expect(matchesAnyUnitSectorFilter('private', ['government'])).toBe(false);
  });

  it('🔴 ยังไม่ระบุต้องหาได้ด้วย unset — และ null/undefined/ค่ามั่ว นับเป็น unset เหมือนกัน', () => {
    expect(matchesAnyUnitSectorFilter(null, ['unset'])).toBe(true);
    expect(matchesAnyUnitSectorFilter(undefined, ['unset'])).toBe(true);
    // ใบที่ระบุแล้วต้องไม่หลุดเข้าถัง unset
    expect(matchesAnyUnitSectorFilter('private', ['unset'])).toBe(false);
  });

  it('เลือกหลายค่าได้ (OR)', () => {
    const f = ['private', 'unset'] as const;
    expect(matchesAnyUnitSectorFilter('private', f)).toBe(true);
    expect(matchesAnyUnitSectorFilter(null, f)).toBe(true);
    expect(matchesAnyUnitSectorFilter('government', f)).toBe(false);
  });

  it('ตัวเลือกบนจอครบ 3 อัน และตรงกับชุดค่าที่ URL ยอมรับ', () => {
    expect(UNIT_SECTOR_FILTER_OPTIONS.map((o) => o.value)).toEqual([
      'government',
      'private',
      'unset',
    ]);
    expect([...UNIT_SECTOR_FILTER_VALUES].sort()).toEqual(
      UNIT_SECTOR_FILTER_OPTIONS.map((o) => o.value).sort(),
    );
    for (const o of UNIT_SECTOR_FILTER_OPTIONS) expect(o.label.trim()).toBeTruthy();
  });
});

describe('sectorFilter ใน URL ของหน้ารายการ', () => {
  it('อ่าน/เขียน param `sec` ได้ครบวง (แชร์ลิงก์แล้วตัวกรองยังติด)', () => {
    const parsed = parseJobListSearchParams(new URLSearchParams('sec=government,unset'));
    expect(parsed.sectorFilter).toEqual(['government', 'unset']);
    const out = buildJobListSearchParams({ ...parsed, sectorFilter: ['private'] });
    expect(out.get('sec')).toBe('private');
  });

  it('ค่ามั่วใน URL ถูกทิ้ง ไม่ทำให้ตัวกรองเพี้ยน', () => {
    const parsed = parseJobListSearchParams(new URLSearchParams('sec=hacker,private'));
    expect(parsed.sectorFilter).toEqual(['private']);
  });

  it('🔴 ไม่ชนกับ `sc` (เจ้าหน้าที่คัดสรร) — param คนละตัว', () => {
    const parsed = parseJobListSearchParams(new URLSearchParams('sec=private&sc=ตั้ม'));
    expect(parsed.sectorFilter).toEqual(['private']);
    expect(parsed.screenerFilter).toEqual(['ตั้ม']);
  });
});
