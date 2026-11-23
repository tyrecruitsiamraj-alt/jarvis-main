/**
 * ตรวจชุดเอกสารก่อนรับ (ส่งเอกสารผ่าน LINE · 22 พ.ย. 2569) — เคสจากชุดทดสอบของต้นแบบ + ช่องว่างที่ต้องปิดก่อนใช้จริง
 */
import { describe, expect, it } from 'vitest';
import { DOCUMENT_FORM_VERSION } from './documentTypes';
import { OCR_ENGINE } from './ocrFields';
import { PacketError, computeAttention, isValidThaiNationalId, stableStringify, validatePacket, type PacketContext } from './packetValidation';
import { emptyAddress, formatAddress, type ThaiAddress } from './thaiAddress';

const ADDRESS: ThaiAddress = { house: '99/1', moo: '', soi: '', road: '', provinceId: '1', districtId: '1001', subdistrictId: '100101', postalCode: '10200' };
const TEMPLATES = { background: 'h-bg', payroll: 'h-pay', privacy: 'h-pri', ex: 'h-ex', reputation: 'h-rep' };
const CTX: PacketContext = { today: '2026-11-22', noticeVersion: 'notice-v1', templates: TEMPLATES };
/** เลขบัตรจำลองที่หลักตรวจถูก (ขึ้นต้น 0 ไม่ออกให้บุคคล) */
const GOOD_ID = '0000012345679';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ชุดทดสอบแก้ทีละช่อง
const packet = (): any => ({
  version: DOCUMENT_FORM_VERSION,
  noticeAccepted: true,
  noticeVersion: 'notice-v1',
  reviewed: true,
  signatureIntent: true,
  confirmed: true,
  senderRelation: 'self',
  addresses: { registered: { ...ADDRESS }, current: { ...ADDRESS }, sameAsRegistered: true },
  person: { prefix: 'นาย', firstName: 'ทดสอบ', lastName: 'ส่งเอกสาร', dob: '1995-01-15', nationalId: GOOD_ID, phone: '0800000000' },
  consents: { background: 'no', privacy: 'no', payroll: 'discuss', ex: 'yes', reputation: 'discuss' },
  templates: { ...TEMPLATES },
  signature: { method: 'typed', name: 'ทดสอบ ส่งเอกสาร', image: '' },
  attachments: [
    { id: '00000000-0000-0000-0000-000000000001', kind: 'id' },
    { id: '00000000-0000-0000-0000-000000000002', kind: 'license' },
    { id: '00000000-0000-0000-0000-000000000003', kind: 'house' },
  ],
  ocr: Object.fromEntries(['id', 'license', 'house'].map((k) => [k, { result: null, status: 'manual', imageConfirmed: true }])),
});
const run = (patch: (p: ReturnType<typeof packet>) => void = () => undefined) => {
  const p = packet();
  patch(p);
  return validatePacket(p, CTX);
};

describe('เลขบัตรประชาชน', () => {
  it('ตรวจหลักสุดท้าย', () => {
    expect(isValidThaiNationalId(GOOD_ID)).toBe(true);
    expect(isValidThaiNationalId('0000012345671')).toBe(false);
    expect(isValidThaiNationalId('0000000000019')).toBe(true);
    expect(isValidThaiNationalId('1234')).toBe(false);
    expect(isValidThaiNationalId('abcdefghijklm')).toBe(false);
  });
});

describe('คำตอบเอกสาร', () => {
  it('คำตอบ ไม่ยินยอม / ขอคุย เก็บตามที่เลือก', () => {
    const p = run();
    expect(p.consents).toEqual({ background: 'no', payroll: 'discuss', privacy: 'no', ex: 'yes', reputation: 'discuss' });
  });
  it('สัญญา EX ไม่ตอบ / ตอบอย่างอื่น = ไม่รับ (ไม่ถือว่ายอมรับเอง)', () => {
    expect(() => run((p) => (p.consents.ex = ''))).toThrow(/สัญญาจ้าง EX/);
    expect(() => run((p) => (p.consents.ex = 'no'))).toThrow(/สัญญาจ้าง EX/);
    expect(() => run((p) => delete p.consents.ex)).toThrow(/สัญญาจ้าง EX/);
  });
  it('ขาดคำตอบฉบับใด = ไม่รับ (ไม่เติมยินยอมให้)', () => {
    expect(() => run((p) => delete p.consents.privacy)).toThrow(/ความยินยอม/);
    expect(() => run((p) => (p.consents.background = 'maybe'))).toThrow(/ตรวจประวัติ/);
  });
  it('ต้นฉบับที่อ่านไม่ใช่รุ่นปัจจุบัน = ต้องเปิดอ่านใหม่', () => {
    const fail = () => run((p) => (p.templates.ex = 'old-hash'));
    expect(fail).toThrow(/เปลี่ยนรุ่น/);
    try {
      fail();
    } catch (e) {
      expect(e).toBeInstanceOf(PacketError);
      expect((e as PacketError).code).toBe('stale_template');
      expect((e as PacketError).status).toBe(409);
    }
    expect(() => run((p) => delete p.templates)).toThrow(/เปลี่ยนรุ่น/);
  });
});

describe('ลายเซ็นและการยืนยัน', () => {
  it('ชื่อผู้ลงนามต้องตรงกับชื่อ-นามสกุลที่กรอก', () => {
    expect(() => run((p) => (p.signature.name = 'คนละ คน'))).toThrow(/ตรงกับชื่อ/);
    expect(run((p) => (p.signature.name = '  ทดสอบ   ส่งเอกสาร ')).signature.name).toBe('ทดสอบ ส่งเอกสาร');
  });
  it('ไม่ติ๊กประสงค์ลงนาม / ไม่ยืนยันตรวจข้อมูล / ไม่ยืนยันส่ง / ไม่รับทราบข้อตกลงการใช้ข้อมูล = ไม่รับ', () => {
    expect(() => run((p) => (p.signatureIntent = false))).toThrow(/ประสงค์ลงนาม/);
    expect(() => run((p) => (p.reviewed = false))).toThrow(/ตรวจข้อมูล/);
    expect(() => run((p) => (p.confirmed = undefined))).toThrow(/ยืนยันการส่ง/);
    expect(() => run((p) => (p.noticeAccepted = false))).toThrow(/ข้อตกลง/);
    expect(() => run((p) => (p.noticeVersion = 'old'))).toThrow(/ข้อตกลง/);
  });
  it('ลายเซ็นเขียนต้องเป็นภาพ PNG แบบ data URL เท่านั้น', () => {
    expect(() => run((p) => (p.signature = { method: 'drawn', name: 'ทดสอบ ส่งเอกสาร', image: 'javascript:alert(1)' }))).toThrow(/ลายเซ็น/);
    expect(() => run((p) => (p.signature = { method: 'drawn', name: 'ทดสอบ ส่งเอกสาร', image: 'data:image/svg+xml;base64,AAAA' }))).toThrow(/ลายเซ็น/);
    expect(() => run((p) => (p.signature.method = 'stamp'))).toThrow(/วิธีลงนาม/);
  });
  it('ต้องบอกว่าส่งเองหรือส่งแทน', () => {
    expect(() => run((p) => (p.senderRelation = 'unknown'))).toThrow(/ส่งเองหรือส่งแทน/);
    expect(run((p) => (p.senderRelation = 'representative')).senderRelation).toBe('representative');
  });
  it('แบบฟอร์มรุ่นเก่า = ไม่รับ', () => {
    expect(() => run((p) => (p.version = 'old'))).toThrow(/เปลี่ยนรุ่น/);
  });
});

describe('ข้อมูลบุคคล', () => {
  it('เลขบัตรไม่ครบ 13 หลัก = ไม่รับ', () => {
    expect(() => run((p) => (p.person.nationalId = '1234'))).toThrow(/13 หลัก/);
  });
  it('เลขบัตรไม่ผ่านหลักตรวจ: ต้องยืนยันเองก่อน แล้วถูกจดว่ายืนยัน', () => {
    expect(() => run((p) => (p.person.nationalId = '1234567890123'))).toThrow(/ไม่ผ่านการตรวจ/);
    const ok = run((p) => {
      p.person.nationalId = '1234567890123';
      p.person.nationalIdConfirmed = true;
    });
    expect(ok.person.nationalIdConfirmed).toBe(true);
    expect(computeAttention(ok, CTX.today).map((a) => a.code)).toContain('national_id_checksum');
    // เลขถูกอยู่แล้ว ไม่จดธงยืนยัน
    expect(run((p) => (p.person.nationalIdConfirmed = true)).person.nationalIdConfirmed).toBeUndefined();
  });
  it('วันเกิดที่ไม่มีจริง / อนาคต = ไม่รับ', () => {
    expect(() => run((p) => (p.person.dob = '1995-02-31'))).toThrow(/วันเกิด/);
    expect(() => run((p) => (p.person.dob = '2026-11-22'))).toThrow(/วันเกิด/);
    expect(() => run((p) => (p.person.dob = '1899-12-31'))).toThrow(/วันเกิด/);
  });
  it('เบอร์มือถือ 10 หลักขึ้นต้น 0', () => {
    expect(() => run((p) => (p.person.phone = '800000000'))).toThrow(/เบอร์มือถือ/);
    expect(() => run((p) => (p.person.phone = '1800000000'))).toThrow(/เบอร์มือถือ/);
  });
  it('ช่องเสริมที่เว้นว่างไม่ถูกเติม · วันที่ต้องเป็นวันจริง · ตลอดชีพไม่มีวันหมดอายุ', () => {
    const p = run((x) => {
      x.person.firstNameEn = '';
      x.person.licenseNumber = ' 65001234 ';
      x.person.idExpiry = '2030-01-14';
      x.person.idLifetime = true;
    });
    expect(p.person.firstNameEn).toBeUndefined();
    expect(p.person.licenseNumber).toBe('65001234');
    expect(p.person.idLifetime).toBe(true);
    expect(p.person.idExpiry).toBeUndefined();
    expect(() => run((x) => (x.person.licenseExpiry = '14/01/2573'))).toThrow(/วันหมดอายุใบขับขี่/);
    expect(() => run((x) => (x.person.idIssued = '2027-01-01'))).toThrow(/วันออกบัตร/);
    expect(() => run((x) => (x.person.licenseNationalId = '12'))).toThrow(/ใบขับขี่/);
  });
  it('คำนำหน้าต้องเลือกจากรายการ', () => {
    expect(() => run((p) => (p.person.prefix = 'ดร.'))).toThrow(/คำนำหน้า/);
  });
});

describe('ที่อยู่', () => {
  it('ติ๊กเหมือนทะเบียนบ้าน = คัดลอกค่าจริงของทะเบียนบ้าน ไม่ใช้ค่าที่ส่งมาคนละชุด', () => {
    const p = run((x) => (x.addresses.current = { ...emptyAddress() }));
    expect(p.addresses.current).toEqual(p.addresses.registered);
    expect(p.addresses.current).not.toBe(p.addresses.registered);
    expect(p.person.currentAddress).toBe(formatAddress(p.addresses.registered));
  });
  it('ไม่ติ๊ก = ที่อยู่ปัจจุบันต้องครบเอง', () => {
    expect(() =>
      run((x) => {
        x.addresses.sameAsRegistered = false;
        x.addresses.current = { ...emptyAddress() };
      }),
    ).toThrow(/บ้านเลขที่/);
  });
  it('ข้อความที่อยู่คิดจากตัวเลือกที่เซิร์ฟเวอร์ตรวจแล้ว — ไม่รับข้อความที่ส่งมาเอง', () => {
    const p = run((x) => (x.person.address = 'ที่อยู่คนละชุด'));
    expect(p.person.address).toBe('99/1 แขวงพระบรมมหาราชวัง เขตพระนคร กรุงเทพมหานคร 10200');
  });
});

describe('ไฟล์แนบและผล OCR', () => {
  it('ต้องครบ 3 ประเภท คนละไฟล์ และยืนยันภาพทุกใบ', () => {
    expect(() => run((p) => p.attachments.pop())).toThrow(/ให้ครบ/);
    expect(() => run((p) => (p.attachments[2].kind = 'id'))).toThrow(/คนละไฟล์/);
    expect(() => run((p) => (p.attachments[0].id = 'not-a-uuid'))).toThrow(/ไม่ถูกต้อง/);
    expect(() => run((p) => (p.ocr.license.imageConfirmed = false))).toThrow(/ใบขับขี่/);
  });
  it('สถานะ "อ่านแล้ว" ต้องมีผลอ่านจริง · ผลอ่านถูกล้างเหลือช่องที่รู้จัก', () => {
    expect(() => run((p) => (p.ocr.id = { status: 'read', imageConfirmed: true, result: null }))).toThrow(/ผลอ่านภาพ/);
    const p = run((x) => {
      x.ocr.id = {
        status: 'read',
        imageConfirmed: true,
        result: { engine: OCR_ENGINE, confidence: 91, text: 'ข้อความ', fields: { firstName: 'ทดสอบ', evil: '<script>' }, address: { house: '1', other: 'x' }, warnings: ['a'], processedAt: '2026-11-22T00:00:00Z', extra: { huge: true } },
      };
    });
    expect(p.ocr.id.result).toEqual({
      engine: OCR_ENGINE,
      confidence: 91,
      text: 'ข้อความ',
      fields: { firstName: 'ทดสอบ' },
      address: { house: '1', moo: '', soi: '', road: '', provinceId: '', districtId: '', subdistrictId: '', postalCode: '' },
      warnings: ['a'],
      processedAt: '2026-11-22T00:00:00Z',
    });
    expect(() => run((x) => (x.ocr.id = { status: 'read', imageConfirmed: true, result: { engine: OCR_ENGINE, text: 'x'.repeat(46_000) } }))).toThrow(/ใหญ่เกิน/);
  });
});

describe('เรื่องที่ HR ต้องดู', () => {
  it('คำตอบปฏิเสธ/ขอคุย · เลขบัตรขัดกับใบขับขี่ · บัตร/ใบขับขี่หมดอายุ', () => {
    const p = run((x) => {
      x.person.licenseNationalId = '0000000000001';
      x.person.idExpiry = '2026-11-21';
      x.person.licenseExpiry = '2020-01-01';
    });
    expect(computeAttention(p, CTX.today)).toEqual([
      { code: 'consent_declined', doc: 'background' },
      { code: 'consent_discuss', doc: 'payroll' },
      { code: 'consent_declined', doc: 'privacy' },
      { code: 'consent_discuss', doc: 'reputation' },
      { code: 'national_id_mismatch' },
      { code: 'id_expired' },
      { code: 'license_expired' },
    ]);
  });
  it('ตอบครบ ข้อมูลไม่ขัดกัน = ไม่มีเรื่องต้องดู (พร้อมนำเข้า) · ตลอดชีพไม่นับว่าหมดอายุ · หมดอายุวันนี้ยังไม่นับ', () => {
    const p = run((x) => {
      x.consents = { background: 'yes', payroll: 'ack', privacy: 'yes', ex: 'yes', reputation: 'yes' };
      x.person.licenseNationalId = GOOD_ID;
      x.person.idExpiry = '2026-11-22';
      x.person.licenseLifetime = true;
      x.person.licenseExpiry = '2000-01-01';
    });
    expect(computeAttention(p, CTX.today)).toEqual([]);
  });
});

describe('แฮชของชุด', () => {
  it('ชุดเดียวกันได้ข้อความเดียวกันเสมอ ไม่ขึ้นกับลำดับช่องที่ส่งมา', () => {
    const a = run();
    const b = validatePacket(Object.fromEntries(Object.entries(packet()).reverse()), CTX);
    expect(stableStringify(a)).toBe(stableStringify(b));
    expect(stableStringify({ b: 1, a: [2, { d: 1, c: undefined }] })).toBe('{"a":[2,{"d":1}],"b":1}');
    expect(stableStringify(run((p) => (p.consents.privacy = 'yes')))).not.toBe(stableStringify(a));
  });
});
