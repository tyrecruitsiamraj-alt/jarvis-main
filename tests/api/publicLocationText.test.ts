// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { hasContactInfo, scrubPublicLocation } from '../../src/lib/publicLocationText.js';

/**
 * เคสจริงจากฐาน production 22 ก.ย. 2569 — 6 ประกาศที่มีชื่อ/เบอร์คนฝังในช่องที่อยู่
 * (เจ้าของเห็นบนหน้าสมัครสาธารณะเอง แล้วสั่งให้แก้)
 */
const REAL_1 =
  'จังหวัด: ชลบุรี ชื่อสาขา: ธนาคารกรุงศรี สาขาฮาร์เบอร์มอล์ล แหลมฉบัง รหัสสาขา: 629 ' +
  'ทะเบียนรถ: ณนิชานันท์ ภานุสิทธิ์โสภน (ผู้จัดการสาขา) เบอร์ติดต่อ 096-226-1515 ' +
  'คุณ เบญจมาศ ค่าม่วง (ผู้ช่วย) เบอร์ติดต่';

const REAL_2 =
  'ธนาคาร กรุงศรีอยุธยา จำกัด (มหาชน) , พระราม 3 และกรุงเทพฯ และปริมณฑล, ต่าง จังหวัด ' +
  'WF 000127/2026 จังหวัด: กทม. OC Code: 123 ทะเบียนรถ: 2 ขฏ 5518 คุณเกวลิน วุฒิมานพ 085-352-8999';

describe('ตัดข้อมูลติดต่อออกจากสถานที่ก่อนขึ้นหน้าสาธารณะ', () => {
  it('🔴 เคสจริงที่เจ้าของเห็น — ชื่อผู้จัดการ/ผู้ช่วยและเบอร์ต้องหายหมด', () => {
    const out = scrubPublicLocation(REAL_1);
    expect(out).toBe('จังหวัด: ชลบุรี ชื่อสาขา: ธนาคารกรุงศรี สาขาฮาร์เบอร์มอล์ล แหลมฉบัง รหัสสาขา: 629');
    expect(out).not.toContain('เบญจมาศ');
    expect(out).not.toContain('ณนิชานันท์');
    expect(out).not.toContain('096');
  });

  it('🔴 เคสจริงใบที่สอง — ทะเบียนรถ ชื่อคน เบอร์ ต้องหาย แต่ที่อยู่อยู่ครบ', () => {
    const out = scrubPublicLocation(REAL_2);
    expect(out).toContain('ธนาคาร กรุงศรีอยุธยา');
    expect(out).toContain('พระราม 3');
    expect(out).toContain('OC Code: 123');
    expect(out).not.toContain('เกวลิน');
    expect(out).not.toContain('085');
    expect(out).not.toContain('5518');
  });

  it('⚠️ เลขเอกสารกับรหัสสาขาไม่ใช่เบอร์ — ห้ามโดนตัด', () => {
    expect(scrubPublicLocation('จังหวัด: กทม. WF 000127/2026 OC Code: 123')).toBe(
      'จังหวัด: กทม. WF 000127/2026 OC Code: 123',
    );
    expect(scrubPublicLocation('รหัสสาขา: 629 ชั้น 2 ห้อง 305')).toBe('รหัสสาขา: 629 ชั้น 2 ห้อง 305');
  });

  it('ที่อยู่ล้วนไม่ถูกแตะสักตัว', () => {
    const plain = 'บริษัท กันยงอีเลคทริก จำกัด (มหาชน) ถนนบางนา-ตราด กม.20 ตำบลบางโฉลง อำเภอบางพลี จังหวัดสมุทรปราการ';
    expect(scrubPublicLocation(plain)).toBe(plain);
    expect(hasContactInfo(plain)).toBe(false);
  });

  it('เบอร์รูปแบบต่าง ๆ จับได้หมด', () => {
    expect(scrubPublicLocation('โรงงานนวนคร 0817101603')).toBe('โรงงานนวนคร');
    expect(scrubPublicLocation('สำนักงานใหญ่ 02 296 6523')).toBe('สำนักงานใหญ่');
    expect(scrubPublicLocation('ไซต์ A +66812345678')).toBe('ไซต์ A');
    expect(scrubPublicLocation('ไซต์ B 096-226-1515')).toBe('ไซต์ B');
  });

  it('ตัดแล้วเก็บกวาดตัวคั่นท้ายให้ด้วย', () => {
    expect(scrubPublicLocation('ไซต์ C, ติดต่อคุณสมชาย')).toBe('ไซต์ C');
    expect(scrubPublicLocation('ไซต์ D · เบอร์ติดต่อ 081-111-2222')).toBe('ไซต์ D');
  });

  it('ค่าว่าง/ไม่ใช่สตริง = คืนสตริงว่าง ไม่พัง', () => {
    expect(scrubPublicLocation(null)).toBe('');
    expect(scrubPublicLocation(undefined)).toBe('');
    expect(scrubPublicLocation('   ')).toBe('');
    expect(hasContactInfo(null)).toBe(false);
  });

  it('ตัดแล้วไม่เหลืออะไร = คืนค่าว่าง (ผู้เรียกตัดสินเองว่าจะทำยังไงต่อ)', () => {
    expect(scrubPublicLocation('เบอร์ติดต่อ 081-111-2222')).toBe('');
  });

  it('hasContactInfo บอกได้ว่ามีของต้องตัดไหม', () => {
    expect(hasContactInfo(REAL_1)).toBe(true);
    expect(hasContactInfo('โรงงานนวนคร')).toBe(false);
  });
});
