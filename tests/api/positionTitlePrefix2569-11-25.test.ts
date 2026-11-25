// @vitest-environment node
/**
 * ชื่อตำแหน่ง = ตำแหน่งใน ERP (ที่ไม่ใช่ "พนักงาน") + ประเภทงาน
 * เจ้าของ 25 พ.ย. 2569 "LMO6911017 เปิดมาเป็น หัวหน้าไซต์ แต่ในระบบเราเป็น คนสวน" · Choice "หัวหน้าไซด์ คนสวน"
 */
import { describe, expect, it } from 'vitest';
import { primaryJobRoleLabel } from '../../api/_lib/siamrajJobMapping';

describe('primaryJobRoleLabel', () => {
  it('ตำแหน่งที่ไม่ใช่พนักงานนำหน้าประเภทงาน (คำตาม ERP)', () => {
    expect(primaryJobRoleLabel('คนสวน', 'หัวหน้าไซด์', '014')).toBe('หัวหน้าไซด์ คนสวน');
    expect(primaryJobRoleLabel('ประชาสัมพันธ์', 'แรงงานสำรอง', null)).toBe('แรงงานสำรอง ประชาสัมพันธ์');
  });
  it('"พนักงาน" / ไม่ระบุ / รหัสตัวเลข = ชื่องานเหมือนเดิม · ชื่องานมีคำตำแหน่งแล้วไม่ซ้ำ', () => {
    expect(primaryJobRoleLabel('ขับรถ', 'พนักงาน', '001')).toBe('ขับรถ');
    expect(primaryJobRoleLabel('ขับรถ', 'ไม่ระบุ', null)).toBe('ขับรถ');
    expect(primaryJobRoleLabel('คนสวน', '087', null)).toBe('คนสวน');
    expect(primaryJobRoleLabel('หัวหน้าไซด์งานสวน', 'หัวหน้าไซด์', null)).toBe('หัวหน้าไซด์งานสวน');
  });
  it('ไม่รู้ประเภทงาน = ตำแหน่ง (เหมือนเดิม) · ไม่มีอะไรเลย = undefined', () => {
    expect(primaryJobRoleLabel(null, 'พนักงาน', '001')).toBe('พนักงาน');
    expect(primaryJobRoleLabel(null, null, null)).toBeUndefined();
  });
});
