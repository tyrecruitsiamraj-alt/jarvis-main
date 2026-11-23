/**
 * ตัวแปลงข้อความ OCR → ช่องข้อมูล (ส่งเอกสารผ่าน LINE · 22 พ.ย. 2569)
 * ข้อความทดสอบ = ผลที่ Tesseract อ่านได้จริงจากภาพบัตรจำลองของชุดส่งต่อ (ไม่ใช่เอกสารราชการ · เลขบัตรเป็น 0 ทั้งหมด)
 */
import { describe, expect, it } from 'vitest';
import { OCR_ENGINE, readOcrFields } from './ocrFields';
import { thaiProvinces } from './thaiAddress';

const ID_TEXT =
  'ปัตรประชาชนตัวอย่าง - ไม่ใช่เอกสารราชการ\nเลขประจําตัวประชาชน 0000000000000\nชือตัวและชื่อสกุล นาย ทดลอง อ่านเอกสาร\nName Mr. TEST\n\nLast name DOCUMENT\n\nเกิดวันที 15 มกราคม 2538\n\nDate of Birth 15 Jan 1995\n\nทีอยู่ 99/1แขวงพระบรมมหาราชวัง\n\nเขตพระนคร กรุงเทพมหานคร 10200\n\nวันออกบัตร 10 Jan 2021\n\nวันหมดอายุ 14 Jan 2030\n';
const LICENSE_TEXT =
  'ใบขับขีตัวอย่าง - ไม่ใช่เอกสารราชการ\nเลขทีใบขับขี 00000000\n\nเลขประจําตัวประชาชน 0000000000000\nชื้อ นาย ทดลอง อ่านเอกสาร\n\nประเภท รถยนต์ส่วนบุคคล\n\nวันทีอนุญาต 10 Jan 2021\n\nวันสินอายุ 14 Jan 2030\n';

describe('readOcrFields', () => {
  it('บัตรประชาชน: อ่านชื่อ เลขบัตร วันเกิด (พ.ศ. → ค.ศ.) วันออก/หมดอายุ และที่อยู่ถึงตำบล', () => {
    const d = readOcrFields(ID_TEXT, 'id', 93);
    expect(d.engine).toBe(OCR_ENGINE);
    expect(d.fields).toMatchObject({
      prefix: 'นาย',
      firstName: 'ทดลอง',
      lastName: 'อ่านเอกสาร',
      nationalId: '0000000000000',
      dob: '1995-01-15',
      idIssued: '2021-01-10',
      idExpiry: '2030-01-14',
      firstNameEn: 'TEST',
      lastNameEn: 'DOCUMENT',
    });
    expect(d.address).toMatchObject({ house: '99/1', provinceId: '1', districtId: '1001', subdistrictId: '100101', postalCode: '10200' });
    expect(d.text).toBe(ID_TEXT.trim());
  });

  it('ใบขับขี่: ให้เฉพาะข้อมูลใบอนุญาต + เลขบัตรไว้เทียบ ไม่มีชื่อ/ที่อยู่ (ไม่เขียนทับข้อมูลบุคคล)', () => {
    const d = readOcrFields(LICENSE_TEXT, 'license', 93);
    expect(d.fields).toMatchObject({ licenseNumber: '00000000', licenseType: 'รถยนต์ส่วนบุคคล', licenseIssued: '2021-01-10', licenseExpiry: '2030-01-14', nationalId: '0000000000000' });
    expect(d.fields.firstName).toBeUndefined();
    expect(d.fields.lastName).toBeUndefined();
    expect(d.address.provinceId).toBe('');
  });

  it('OCR อ่านไม่ได้เลย: ทุกช่องว่าง ไม่มีค่าตัวอย่าง และมีคำเตือน', () => {
    const d = readOcrFields('', 'id', 0);
    expect(Object.values(d.fields).every((v) => v === undefined)).toBe(true);
    expect(d.address).toEqual({ house: '', moo: '', soi: '', road: '', provinceId: '', districtId: '', subdistrictId: '', postalCode: '' });
    expect(d.warnings.length).toBeGreaterThan(0);
    expect(d.warnings[0]).toContain('ถ่ายใหม่');
  });

  it('เจอเลข 13 หลักหลายชุด: ไม่เลือกให้', () => {
    const d = readOcrFields('เลขบัตร 1234567890123\nเลขอีกชุด 9876543210123', 'id', 90);
    expect(d.fields.nationalId).toBeUndefined();
    expect(d.warnings.join(' ')).toContain('หลายชุด');
  });

  it('ที่อยู่จับคู่ไม่ครบ: เลือกให้เท่าที่ชัด ที่เหลือเว้นว่าง', () => {
    const d = readOcrFields('ที่อยู่ 99/1 จังหวัดเชียงใหม่', 'id', 80);
    expect(d.address.provinceId).toBe('38');
    expect(d.address.districtId).toBe('');
    expect(d.address.subdistrictId).toBe('');
    expect(d.address.postalCode).toBe('');
  });

  it('ทะเบียนบ้าน: เป็นภาพประกอบ ไม่ให้ช่องข้อมูลบุคคล', () => {
    const d = readOcrFields(ID_TEXT, 'house', 95);
    expect(d.fields).toEqual({});
    expect(d.address.provinceId).toBe('');
  });

  it('ภาพไม่ชัด (ความมั่นใจต่ำ): เตือนให้ถ่ายใหม่ ไม่อ้างว่าอ่านผ่าน', () => {
    const d = readOcrFields(ID_TEXT, 'id', 22);
    expect(d.warnings[0]).toContain('อ่านภาพได้ไม่ชัด');
  });

  it('ชื่อที่แยกไม่ได้ชัด (มากกว่าสองคำ): ไม่เดาชื่อ/นามสกุล', () => {
    const d = readOcrFields('ชื่อตัวและชื่อสกุล นาย ทดลอง ณ อ่านเอกสาร', 'id', 90);
    expect(d.fields.firstName).toBeUndefined();
    expect(d.warnings.join(' ')).toContain('แยกไม่ชัด');
  });

  it('เลขไทยถูกแปลงเป็นเลขอารบิก', () => {
    const d = readOcrFields('เลขประจำตัวประชาชน ๑๒๓๔๕๖๗๘๙๐๑๒๑', 'id', 90);
    expect(d.fields.nationalId).toBe('1234567890121');
  });
});

describe('ข้อความจริงจาก Tesseract ในเบราว์เซอร์ (บัตรจำลอง 22 พ.ย. 2569)', () => {
  // ข้อความที่ OCR อ่านได้จริงจากภาพบัตรจำลอง (ข้อมูลสมมติทั้งหมด) — ป้ายที่อยู่อ่านเพี้ยน · "ำ" แยกเป็นสองตัว · วันที่ติดป้าย · 0 เป็นตัว O
  const ID_TEXT =
    'บัตรประจําตัวประชาชน Thai National ID Card\nเลขประจําตัวประชาชน 0 0000 01234 56 9\n\nชื่อตัวและชื่อสกุล นาย ทดลอง อ่านเอกสาร\n\nName Mr. Thodlong\n\nLast name Anekkasan\n\nเกิดวันที่ 15 ม.ค. 2538\n\nfag] 99/1 หมู่ 2 ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ\nวันออกบัตร 10 ม.ค. 2563\n\nวันหมดอายุ14 ม.ค. 2573';
  const LICENSE_TEXT =
    'ใบอนุญาตขับรถยนต์ส่วนบุคคล\n\nเลขที่ 65001234\n\nวันที่อนุญาต1มี.ค. 2565\n\nวันสิ้นอายุ 1 มี.ค. 2572\n\nชื่อ นาย ทดลอง อ่านเอกสาร\n\nเลขประจําตัวประชาชน 0 OOOO 01234 56 9';

  it('บัตรประชาชน: ป้ายที่อยู่อ่านไม่ออกก็ยังหาที่อยู่จากบรรทัดที่มีจังหวัด+อำเภอได้', () => {
    const r = readOcrFields(ID_TEXT, 'id', 93);
    expect(r.fields).toMatchObject({ prefix: 'นาย', firstName: 'ทดลอง', lastName: 'อ่านเอกสาร', nationalId: '0000001234569', dob: '1995-01-15', idIssued: '2020-01-10', idExpiry: '2030-01-14' });
    expect(r.address.house).toBe('99/1');
    expect(r.address.moo).toBe('2');
    expect(r.address.provinceId).not.toBe('');
    expect(r.address.subdistrictId).not.toBe('');
    expect(r.address.postalCode).toBe('10540');
    expect(r.warnings.join()).not.toMatch(/ที่อยู่/);
  });

  it('ใบขับขี่: วันที่ติดป้ายอ่านได้ · ไม่หยิบวันหมดอายุบรรทัดถัดไปมาเป็นวันออก · 0 ที่อ่านเป็น O ยังเป็นเลขบัตร', () => {
    const r = readOcrFields(LICENSE_TEXT, 'license', 93);
    expect(r.fields.licenseIssued).toBe('2022-03-01');
    expect(r.fields.licenseExpiry).toBe('2029-03-01');
    expect(r.fields.nationalId).toBe('0000001234569');
  });

  it('วันออกอ่านไม่ได้ = ว่าง (ไม่เอาวันของบรรทัดอื่นมาใส่)', () => {
    const r = readOcrFields('วันที่อนุญาต ??\nวันสิ้นอายุ 1 มี.ค. 2572', 'license', 80);
    expect(r.fields.licenseIssued).toBeUndefined();
    expect(r.fields.licenseExpiry).toBe('2029-03-01');
  });

  it('วรรณยุกต์ก่อนสระ ("ท่ี") จัดให้เป็นแบบปกติก่อนจับคำ', () => {
    const r = readOcrFields('ท่ีอยู่ 12 ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ', 'id', 80);
    expect(r.address.house).toBe('12');
  });
});

describe('บัตรจำลองแบบบัตรจริง (OCR ในเบราว์เซอร์ 23 พ.ย. 2569)', () => {
  // ข้อความที่ OCR อ่านได้จริงจากภาพบัตรจำลอง (ข้อมูลสมมติทั้งหมด) — ชื่ออังกฤษอยู่บรรทัดเดียวกัน · "ต." อ่านเป็น "3." · ป้าย "วันบัตรหมดอายุ"
  const ID_TEXT =
    'บัตรประจําตัวประชาชน\n\nThai National ID Card\n\nเลขประจําตัวประชาชน1 1037 00456 78 3\n\nชื่อตัวและชื่อสกุล นาย สมชาย ทดสอบดี\n\nName Mr. Somchai Last name Thodsobdee\n\nเกิดวันที่ 15 ม.ค. 2533 Date of Birth 15 Jan. 1990\nศาสนา พุทธ\n\nที่อยู่ 99/1 หมู่ที่ 4 3.บางพลีใหญ่\n\nอ.บางพลี จ.สมุทรปราการ\n\nวันออกบัตร10 ก.พ. 2565 วันบัตรหมดอายุ14 ม.ค. 2574';
  const nameOf = (subdistrictId: string) =>
    thaiProvinces.flatMap((p) => p.districts).flatMap((d) => d.subdistricts).find((s) => s.id === subdistrictId)?.name;

  it('ชื่อ-นามสกุลอังกฤษบรรทัดเดียวกัน แยกได้ · วันบัตรหมดอายุอ่านได้ · ตำบลที่ "ต." เพี้ยนยังจับได้ในอำเภอเดียวกัน', () => {
    const r = readOcrFields(ID_TEXT, 'id', 92);
    expect(r.fields).toMatchObject({
      prefix: 'นาย',
      firstName: 'สมชาย',
      lastName: 'ทดสอบดี',
      firstNameEn: 'Somchai',
      lastNameEn: 'Thodsobdee',
      nationalId: '1103700456783',
      dob: '1990-01-15',
      idIssued: '2022-02-10',
      idExpiry: '2031-01-14',
    });
    expect(r.address).toMatchObject({ house: '99/1', moo: '4', postalCode: '10540' });
    expect(nameOf(r.address.subdistrictId)).toBe('บางพลีใหญ่');
    expect(r.warnings).toEqual([]);
  });

  it('ชื่อตำบลอ่านไม่ออก: ไม่เลือกตำบลที่ชื่อเดียวกับอำเภอ', () => {
    const r = readOcrFields('ที่อยู่ 5 3.??? อ.บางบัวทอง จ.นนทบุรี', 'id', 80);
    expect(r.address.districtId).not.toBe('');
    expect(r.address.subdistrictId).toBe('');
  });

  it('"ต." เพี้ยนแต่ชื่อตำบลอ่านได้: เลือกตำบลนั้น (ไม่สับกับตำบลชื่อเดียวกับอำเภอ)', () => {
    const r = readOcrFields('ที่อยู่ 5 3.บางรักใหญ่ อ.บางบัวทอง จ.นนทบุรี', 'id', 80);
    expect(nameOf(r.address.subdistrictId)).toBe('บางรักใหญ่');
  });

  it('ใบขับขี่: OCR อ่าน "อนุญาต" เป็น "อนุณาต" ยังได้วันที่อนุญาต', () => {
    const r = readOcrFields('ใบอนุญาตขับรถยนต์ส่วนบุคคล (ตัวอย่าง)\nเลขที่ 65001234\n\nวันที่อนุณาต 1 มี.ค. 2565\n\nวันสิ้นอายุ 1 มี.ค. 2572\n\nเลขประจําตัวประชาชน 11037 00456 78 3', 'license', 90);
    expect(r.fields).toMatchObject({ licenseNumber: '65001234', licenseIssued: '2022-03-01', licenseExpiry: '2029-03-01', nationalId: '1103700456783' });
  });
});
