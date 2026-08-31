import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  PUBLIC_FORBIDDEN_FIELDS,
  publicSafeAddress,
  publicSafeAddressParts,
} from '../../src/lib/publicJobPrivacy';

/**
 * ตัวกรองสุดท้ายก่อนข้อมูลใบขอออกหน้าสาธารณะ
 *
 * 🔴 เทสต์ชุดนี้เกิดจากของจริงที่วัดเจอ 29 ส.ค. 2569 — เส้น `/api/public/jobs`
 * ตอบ 200 ให้คนที่ไม่ล็อกอิน พร้อมชื่อพนักงาน 102 ชื่อ · เบอร์คนของลูกค้า 32 ใบ ·
 * ทะเบียนรถ 20 ใบ · รหัสภายใน — ทั้งหมดมาจากที่อยู่ดิบของระบบงานหลัก
 *
 * ข้อความตัวอย่างข้างล่างคัดโครงมาจากของจริง **แต่เปลี่ยนชื่อ/เบอร์/ทะเบียนเป็นของสมมุติ**
 * (ห้ามเอาข้อมูลคนจริงมาแปะไว้ใน repo)
 */

/** ที่อยู่ดิบแบบที่ระบบงานหลักคีย์มาจริง — มีของต้องห้ามครบทุกชนิด */
const RAW_WITH_SECRETS =
  'ธนาคารตัวอย่าง จำกัด (มหาชน) , พระราม 3 และกรุงเทพฯ และปริมณฑล, ต่าง จังหวัด ' +
  'WF 000127/2026 จังหวัด: สระบุรี ชื่อสาขา: เขตธุรกิจ SME สาขาภูมิภาค 201 ' +
  'รหัสสาขา: 700 OC Code: 123 ทะเบียนรถ: 4ขภ4076 ' +
  'ผู้ดูแลประจำหน่วยงาน: คุณสมมุติ นามสมมุติ 0645653914 sommut.n@example.com';

describe('ที่อยู่ที่ปล่อยออกหน้าสาธารณะ — ประกอบใหม่จากช่องที่อนุญาตเท่านั้น', () => {
  it('ที่อยู่ดิบที่มีเบอร์/ทะเบียน/อีเมล/รหัสภายใน ต้องไม่มีอะไรหลุดออกมาสักชิ้น', () => {
    const out = publicSafeAddress({ location_address: RAW_WITH_SECRETS });

    expect(out).not.toMatch(/\d{9,}/); // เบอร์โทรแบบไม่มีขีด
    expect(out).not.toMatch(/0\d{1,2}[-\s]?\d{3}[-\s]?\d{3,4}/); // เบอร์โทรแบบมีขีด
    expect(out).not.toMatch(/@/); // อีเมล
    expect(out).not.toMatch(/ทะเบียนรถ/);
    expect(out).not.toMatch(/OC\s*Code/i);
    expect(out).not.toMatch(/รหัสสาขา/);
    expect(out).not.toMatch(/WF\s*\d/);
    expect(out).not.toMatch(/ผู้ดูแล/);
    expect(out).not.toMatch(/สมมุติ/); // ชื่อคน
  });

  it('ยังบอกจังหวัดที่ถอดได้จากที่อยู่ดิบ — กรองแล้วต้องไม่ใช่ค่าว่างเปล่าเสมอไป', () => {
    const parts = publicSafeAddressParts({ location_address: RAW_WITH_SECRETS });
    expect(parts.province).toBe('สระบุรี');
  });

  it('ช่องที่เจ้าหน้าที่กรอกเองชนะที่อยู่ดิบเสมอ', () => {
    const out = publicSafeAddress({
      location_address: RAW_WITH_SECRETS,
      override_province: 'ชลบุรี',
      override_district: 'ศรีราชา',
      override_subdistrict: 'ทุ่งสุขลา',
    });
    expect(out).toBe('ต.ทุ่งสุขลา อ.ศรีราชา จ.ชลบุรี');
    expect(out).not.toMatch(/สระบุรี/);
  });

  it('กรอกมาบางช่องก็ใช้เท่าที่มี ไม่ไปหยิบที่อยู่ดิบมาเติม', () => {
    expect(publicSafeAddress({ location_address: RAW_WITH_SECRETS, override_province: 'ระยอง' })).toBe(
      'จ.ระยอง',
    );
  });

  it('🔴 ถอดจังหวัดไม่ได้ = คืนค่าว่าง ห้ามถอยไปใช้ที่อยู่ดิบ', () => {
    const junk = 'ตึกเอ ชั้น 3 ติดต่อ คุณสมมุติ 081-234-5678 ทะเบียนรถ 1กก1234';
    expect(publicSafeAddress({ location_address: junk })).toBe('');
  });

  it('ไม่มีที่อยู่เลย = คืนค่าว่าง ไม่พัง', () => {
    expect(publicSafeAddress({})).toBe('');
    expect(publicSafeAddress({ location_address: null })).toBe('');
    expect(publicSafeAddress({ location_address: '   ' })).toBe('');
  });
});

describe('เส้นสาธารณะห้ามส่งช่องต้องห้าม', () => {
  const file = fs.readFileSync(path.join(process.cwd(), 'api/_handlers/public/jobs.ts'), 'utf8');

  /**
   * สแกนเฉพาะ **ตัวคำตอบ** ที่ `toPublicJob` ประกอบ — ไม่ใช่ทั้งไฟล์
   * (ชื่อช่องต้องห้ามโผล่ใน `type JobRow` ได้ตามปกติ เพราะนั่นคือของที่ "อ่านเข้ามา"
   * เรื่องที่ห้ามคือ "ส่งออกไป")
   */
  const start = file.indexOf('function toPublicJob');
  const end = file.indexOf('\n}', start);
  const source = file.slice(start, end);

  it('หาตัวประกอบคำตอบเจอ (กันเทสต์ผ่านลอย ๆ ตอนมีคนเปลี่ยนชื่อฟังก์ชัน)', () => {
    expect(start).toBeGreaterThan(-1);
    expect(source).toMatch(/unit_name/);
  });

  /**
   * `toPublicJob` หยิบทีละช่องด้วยชื่อ — ถ้ามีใครเผลอเพิ่ม `resigned_employee_name:` กลับเข้าไป
   * เทสต์นี้จะจับได้ทันที
   */
  for (const field of PUBLIC_FORBIDDEN_FIELDS) {
    it(`ไม่ส่ง ${field} ออกไป`, () => {
      const emitted = new RegExp(`^\\s*${field}\\s*:`, 'm');
      expect(source).not.toMatch(emitted);
    });
  }

  it('ที่อยู่ต้องผ่านตัวกรองเสมอ ห้ามส่ง location_address ดิบ', () => {
    expect(source).toMatch(/location_address:\s*publicSafeAddress\(/);
    expect(source).not.toMatch(/location_address:\s*r\.location_address/);
  });
});
