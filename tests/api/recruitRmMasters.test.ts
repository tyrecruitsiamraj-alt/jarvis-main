// @vitest-environment node
/**
 * ค่าคงที่ของงานสรรหา (RM) ที่คัดลอกจากระบบเดิม — `src/lib/recruitRmMasters.ts`
 *
 * เทสต์ชุดนี้ทำหน้าที่ "ยาม" สองเรื่อง:
 *   1) ค่าที่ดูเหมือนพิมพ์ผิดของระบบเดิมต้องอยู่เหมือนเดิม (`monix` ตัวเล็ก ·
 *      `ธุรการเจาะจงLBD` ติดกัน) — ถ้ามีคนมา "แก้ให้สวย" ข้อมูลจะเทียบข้ามระบบไม่ได้
 *   2) ค่าที่ยิงมาจาก client ต้องถูกกรองเสมอ ไม่ให้ค่านอก master ลงฐาน
 */
import { describe, expect, it } from 'vitest';
import {
  RM_EDUCATION_LEVELS,
  RM_LICENSE_TYPES,
  RM_SPECIFIC_TYPES,
  cleanRmLicenseTypes,
  isRmFormType,
  isRmSpecificType,
  normalizeRmPhone,
  rmFormTypeLabel,
} from '../../src/lib/recruitRmMasters';

describe('ค่าที่คัดลอกจากระบบเดิม — ห้ามแก้ถ้อยคำเอง', () => {
  it('ข้อมูลเจาะจงครบ 19 ค่า และคงตัวสะกดเดิมที่ดูเหมือนพิมพ์ผิด', () => {
    expect(RM_SPECIFIC_TYPES).toHaveLength(19);
    // ระบบเดิมเก็บเป็น 'monix' ตัวเล็กทั้งหมด — แก้เป็น Monix แล้วเทียบข้ามระบบไม่ตรง
    expect(RM_SPECIFIC_TYPES).toContain('monix');
    // ระบบเดิมเขียนติดกันไม่มีเว้นวรรค
    expect(RM_SPECIFIC_TYPES).toContain('ธุรการเจาะจงLBD');
    expect(RM_SPECIFIC_TYPES).toContain('พนักงานทดแทน LBA (ประชาสัมพันธ์,ธุรการ)');
  });

  it('ใบขับขี่ 6 ค่า เรียงตาม value 1–6 ของระบบเดิม', () => {
    expect(RM_LICENSE_TYPES).toEqual([
      'ใบขับขี่บุคคล ชั่วคราว',
      'ใบขับขี่บุคคล 5 ปี',
      'ใบขับขี่สาธารณะ',
      'ใบขับขี่ ท.2',
      'ใบขับขี่ ท.3',
      'ใบขับขี่ ท.4',
    ]);
  });

  it('วุฒิการศึกษา 8 ค่า และต้องมี "ไม่มีวุฒิการศึกษา" (ฟอร์มสาธารณะไม่มีตัวนี้)', () => {
    expect(RM_EDUCATION_LEVELS).toHaveLength(8);
    expect(RM_EDUCATION_LEVELS[0]).toBe('ไม่มีวุฒิการศึกษา');
  });

  it('ไม่มีค่าซ้ำในทุก master — ซ้ำแล้ว dropdown เลือกผิดตัวเงียบ ๆ', () => {
    for (const list of [RM_SPECIFIC_TYPES, RM_LICENSE_TYPES, RM_EDUCATION_LEVELS]) {
      expect(new Set(list).size).toBe(list.length);
    }
  });
});

describe('isRmSpecificType — ค่านอก master ห้ามลงฐาน', () => {
  it('ค่าใน master ผ่าน', () => {
    expect(isRmSpecificType('Lost Lead')).toBe(true);
    expect(isRmSpecificType('เจาะจง (ฟรี)')).toBe(true);
  });

  it('ค่าที่ใกล้เคียงแต่ไม่ตรงเป๊ะ ต้องไม่ผ่าน', () => {
    expect(isRmSpecificType('Monix')).toBe(false); // ตัวใหญ่ ไม่ใช่ของเดิม
    expect(isRmSpecificType('เจาะจง')).toBe(false); // ขาด (ฟรี)
    expect(isRmSpecificType('ธุรการเจาะจง LBD')).toBe(false); // มีเว้นวรรคเกิน
    expect(isRmSpecificType('')).toBe(false);
    expect(isRmSpecificType(null)).toBe(false);
  });
});

describe('cleanRmLicenseTypes — กรอง+เรียง+ตัดซ้ำ', () => {
  it('เรียงตาม master ไม่ใช่ตามที่ client ส่งมา (รายงานจะได้ลำดับเดียวกันทุกใบ)', () => {
    expect(cleanRmLicenseTypes(['ใบขับขี่ ท.4', 'ใบขับขี่บุคคล 5 ปี'])).toEqual([
      'ใบขับขี่บุคคล 5 ปี',
      'ใบขับขี่ ท.4',
    ]);
  });

  it('ทิ้งค่าขยะและค่าซ้ำ', () => {
    expect(cleanRmLicenseTypes(['ใบขับขี่ ท.2', 'ใบขับขี่ ท.2', 'ใบขับขี่จักรยาน', 42, null])).toEqual([
      'ใบขับขี่ ท.2',
    ]);
  });

  it('ไม่ใช่ array → array ว่าง (ไม่ throw ให้ API ล้ม)', () => {
    expect(cleanRmLicenseTypes(undefined)).toEqual([]);
    expect(cleanRmLicenseTypes('ใบขับขี่ ท.2')).toEqual([]);
  });
});

describe('normalizeRmPhone — ระบบเดิมบังคับครบ 10 หลัก', () => {
  it('10 หลักผ่าน · ตัดขีด/เว้นวรรคให้', () => {
    expect(normalizeRmPhone('0812345678')).toBe('0812345678');
    expect(normalizeRmPhone('081-234-5678')).toBe('0812345678');
    expect(normalizeRmPhone('081 234 5678')).toBe('0812345678');
  });

  it('ไม่ครบ 10 หลัก หรือเกิน → null (ห้ามปล่อยเบอร์โทรไม่ได้ลงฐาน)', () => {
    expect(normalizeRmPhone('081234567')).toBeNull();
    expect(normalizeRmPhone('08123456789')).toBeNull();
    expect(normalizeRmPhone('')).toBeNull();
    expect(normalizeRmPhone(null)).toBeNull();
  });

  it('เบอร์บ้าน 9 หลักไม่ผ่าน — ตรงกับกติกาเดิมของระบบ RM', () => {
    expect(normalizeRmPhone('021234567')).toBeNull();
  });
});

describe('ประเภทฟอร์มการสมัคร', () => {
  it('รับแค่ rm / global', () => {
    expect(isRmFormType('rm')).toBe(true);
    expect(isRmFormType('global')).toBe(true);
    expect(isRmFormType('RM')).toBe(false);
    expect(isRmFormType('')).toBe(false);
  });

  it('ป้ายไทยตรงกับระบบเดิม · ค่าที่อ่านไม่ออก (ประกาศเก่าก่อน migration) = ทั่วไป', () => {
    expect(rmFormTypeLabel('rm')).toBe('ทั่วไป');
    expect(rmFormTypeLabel('global')).toBe('แนบเอกสารได้');
    expect(rmFormTypeLabel(null)).toBe('ทั่วไป');
  });
});
