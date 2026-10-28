import { describe, expect, it } from 'vitest';
import { regionOfProvince } from '../../src/lib/bkkRegion';

describe('กรุงเทพ+ปริมณฑล / ต่างจังหวัด (เจ้าของ 28 ต.ค. 2569 Choice "กรุงเทพ + ปริมณฑล")', () => {
  it('กรุงเทพ + 5 จังหวัดปริมณฑล = กรุงเทพ', () => {
    for (const p of ['กรุงเทพมหานคร', 'กรุงเทพ', 'นนทบุรี', 'ปทุมธานี', 'สมุทรปราการ', 'สมุทรสาคร', 'นครปฐม']) expect(regionOfProvince(p)).toBe('bkk');
  });
  it('จังหวัดอื่น = ต่างจังหวัด · อ่านไม่ออก/ว่าง = ไม่ระบุ', () => {
    expect(regionOfProvince('ยโสธร')).toBe('upcountry');
    expect(regionOfProvince('ชลบุรี')).toBe('upcountry');
    expect(regionOfProvince('')).toBe('unknown');
    expect(regionOfProvince(null)).toBe('unknown');
    expect(regionOfProvince('ไม่ระบุ')).toBe('unknown');
  });
});
