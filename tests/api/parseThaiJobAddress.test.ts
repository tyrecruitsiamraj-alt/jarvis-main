import { describe, it, expect } from 'vitest';
import {
  inferDistrictFromAddress,
  inferProvinceFromAddress,
  inferSubdistrictFromAddress,
  normalizeJobLocationText,
  parseThaiAddressParts,
} from '../../src/lib/parseThaiJobAddress';
import { districtMatchesFilter } from '../../src/lib/districtMatch';

describe('parseThaiJobAddress cleaning', () => {
  it('normalizes glued ERP work_place text', () => {
    const raw =
      'โรงพยาบาลเปาโล สมุทรปราการ123 หมู่ที่ 8 ถนนศรีนครินทร์ ตำบลบางเมือง อำเภอเมืองสมุทรปราการ จ.สมุทรปราการ 10270';
    const n = normalizeJobLocationText(raw);
    expect(n).toContain('ตำบล');
    expect(n).toContain('อำเภอ');
    expect(inferProvinceFromAddress(raw)).toBe('สมุทรปราการ');
    expect(inferDistrictFromAddress(raw)).toMatch(/เมืองสมุทรปราการ/);
    expect(inferSubdistrictFromAddress(raw)).toMatch(/บางเมือง/);
  });

  it('parses Bangkok khueng/khet and กทม alias', () => {
    const raw =
      'บริษัท รักษาความปลอดภัย ไทยซีคอม จำกัด เลขที่ 989 อาคารคิงบริดจ์ ถนนพระราม 3 แขวงบางโพงพาง เขตยานนาวา กทม';
    const parts = parseThaiAddressParts(raw);
    expect(parts.province).toBe('กรุงเทพมหานคร');
    expect(parts.district).toMatch(/ยานนาวา/);
    expect(parts.subdistrict).toMatch(/บางโพงพาง/);
  });

  it('parses จังหวัด: label used by bank job sheets', () => {
    expect(inferProvinceFromAddress('จังหวัด: พิษณุโลก รหัสสาขา : 700')).toBe('พิษณุโลก');
    expect(inferProvinceFromAddress('จังหวัด : สงขลา ชื่อสาขา : หาดใหญ่')).toBe('สงขลา');
  });

  it('matches district filter against official names', () => {
    const addr = '500/103 หมู่ 3 ตำบลตาสิทธิ์ อำเภอปลวกแดง จังหวัดระยอง 21140';
    expect(districtMatchesFilter(addr, 'ปลวกแดง')).toBe(true);
    expect(districtMatchesFilter(addr, 'อำเภอปลวกแดง')).toBe(true);
  });
});
