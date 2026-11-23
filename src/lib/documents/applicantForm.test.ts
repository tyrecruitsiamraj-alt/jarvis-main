/**
 * ฟอร์มส่งเอกสารของผู้สมัคร — กติกาที่ห้ามผ่อน (ส่งเอกสารผ่าน LINE · 22 พ.ย. 2569)
 * DOC-021/022/024/025 OCR เติมเฉพาะที่อ่านได้ · ใบขับขี่ไม่ทับข้อมูลบุคคล · DOC-023 เลขบัตรขัดกันแสดงให้เห็น ไม่แก้ให้
 * DOC-029 ที่อยู่เหมือนทะเบียนบ้าน = คัดลอกค่าจริง · DOC-032 ไม่มีคำตอบที่เลือกให้ล่วงหน้า · DOC-036 แก้ข้อมูลหลังลงนาม = ลงนามใหม่
 */
import { describe, expect, it } from 'vitest';
import {
  ageOn,
  blankForm,
  clearDraft,
  confirmSlotImage,
  editForm,
  editPerson,
  loadDraft,
  nationalIdConflict,
  packetBody,
  saveDraft,
  setConsent,
  setSlotFile,
  setSlotOcr,
  stepError,
  type ApplicantForm,
} from './applicantForm';
import { DOC_TYPES, UPLOAD_KINDS, type UploadKind } from './documentTypes';
import type { ApplicantState, DraftFileView } from './documentViews';
import { OCR_ENGINE, type OcrResult } from './ocrFields';
import { validatePacket } from './packetValidation';
import { emptyAddress } from './thaiAddress';

const TODAY = '2026-11-22';
const ADDRESS = { house: '99/1', moo: '', soi: '', road: '', provinceId: '1', districtId: '1001', subdistrictId: '100101', postalCode: '10200' };
const file = (kind: UploadKind, n = 1): DraftFileView => ({ id: `0000000${n}-0000-4000-8000-00000000000${UPLOAD_KINDS.indexOf(kind) + 1}`, kind, mime: 'image/jpeg', size: 90_000, sha256: 'a'.repeat(64) });
const ocr = (fields: OcrResult['fields'], address = emptyAddress()): OcrResult => ({ engine: OCR_ENGINE, confidence: 81, text: 'ข้อความจำลอง', fields, address, warnings: [], processedAt: '2026-11-22T03:00:00.000Z' });
const DOCS = DOC_TYPES.map((d) => ({ id: d.id, title: d.title, answers: d.answers.map((a) => ({ value: a.value, label: a.label })), pages: 1, hash: `h-${d.id}` }));
const STATE = { inviteKey: 'abcdef0123456789', noticeVersion: 'notice-v1', documents: DOCS, drafts: [] as DraftFileView[] } as unknown as ApplicantState;
const CTX = { today: TODAY, documents: DOCS };

/** ฟอร์มครบพร้อมส่ง (ข้อมูลสมมติ · เลขบัตรผ่านหลักตรวจ) */
function complete(): ApplicantForm {
  let f = blankForm();
  f = { ...f, noticeAccepted: true };
  for (const kind of UPLOAD_KINDS) {
    f = setSlotFile(f, kind, file(kind), []);
    f = setSlotOcr(f, kind, file(kind).id, kind === 'house' ? null : ocr({}));
    f = confirmSlotImage(f, kind, true);
  }
  for (const [k, v] of Object.entries({ prefix: 'นาย', firstName: 'ทดลอง', lastName: 'อ่านเอกสาร', dob: '1995-01-15', nationalId: '0000012345679', phone: '0800000000' })) {
    f = editPerson(f, k as never, v);
  }
  f = editForm(f, { registered: { ...ADDRESS }, sameAsRegistered: true });
  f = { ...f, reviewed: true };
  for (const d of DOC_TYPES) f = setConsent(f, d.id, d.answers[0].value);
  return { ...f, signMethod: 'typed', signName: 'ทดลอง อ่านเอกสาร', signatureIntent: true, senderRelation: 'self', confirmed: true };
}

describe('ฟอร์มส่งเอกสาร', () => {
  it('DOC-032 ไม่มีคำตอบที่เลือกให้ล่วงหน้า — ยังไม่ตอบ = ไปต่อไม่ได้', () => {
    const f = blankForm();
    expect(f.consents).toEqual({});
    expect(stepError(f, 2, CTX)).toMatch(/เลือกคำตอบของ/);
  });

  it('ขั้นแรกต้องยอมรับข้อตกลง + แนบครบ 3 ใบ + ยืนยันภาพทุกใบ + อ่านเสร็จ', () => {
    let f = blankForm();
    expect(stepError(f, 0, CTX)).toMatch(/ข้อตกลง/);
    f = { ...f, noticeAccepted: true };
    expect(stepError(f, 0, CTX)).toMatch(/แนบภาพบัตรประชาชน/);
    f = setSlotFile(f, 'id', file('id'), []);
    f = setSlotFile(f, 'license', file('license'), []);
    f = setSlotFile(f, 'house', file('house'), []);
    expect(stepError(f, 0, CTX)).toMatch(/รออ่านภาพ/);
    f = setSlotOcr(f, 'id', file('id').id, null);
    f = setSlotOcr(f, 'license', file('license').id, null);
    expect(stepError(f, 0, CTX)).toMatch(/ติ๊กยืนยัน/);
    for (const k of UPLOAD_KINDS) f = confirmSlotImage(f, k, true);
    expect(stepError(f, 0, CTX)).toBeNull();
  });

  it('DOC-022 OCR อ่านไม่ได้ = ช่องว่าง ไม่มีค่าตัวอย่าง · อ่านได้แค่บางช่อง = เติมแค่ช่องนั้น', () => {
    let f = setSlotFile(blankForm(), 'id', file('id'), []);
    f = setSlotOcr(f, 'id', file('id').id, null);
    expect(f.person.firstName).toBe('');
    expect(f.person.nationalId).toBe('');
    expect(f.slots.id?.status).toBe('manual');
    f = setSlotOcr(setSlotFile(f, 'id', file('id', 2), []), 'id', file('id', 2).id, ocr({ firstName: 'ทดลอง' }));
    expect(f.person.firstName).toBe('ทดลอง');
    expect(f.person.lastName).toBe('');
  });

  it('DOC-021/025 เปลี่ยนภาพบัตร = ล้างช่องจากบัตรใบเดิม (เบอร์มือถือไม่ได้มาจากบัตร คงไว้) · ผลอ่านของภาพเก่าที่มาช้าถูกทิ้ง', () => {
    let f = setSlotFile(blankForm(), 'id', file('id'), []);
    f = setSlotOcr(f, 'id', file('id').id, ocr({ firstName: 'ทดลอง', nationalId: '0000012345679' }, { ...ADDRESS }));
    f = editPerson(f, 'phone', '0800000000');
    f = setSlotFile(f, 'id', file('id', 2), []);
    expect(f.person.firstName).toBe('');
    expect(f.person.nationalId).toBe('');
    expect(f.registered).toEqual(emptyAddress());
    expect(f.person.phone).toBe('0800000000');
    const late = setSlotOcr(f, 'id', file('id').id, ocr({ firstName: 'ผลของภาพเก่า' }));
    expect(late.person.firstName).toBe('');
  });

  it('DOC-024 ใบขับขี่เติมเฉพาะช่องใบขับขี่ · เลข 13 หลักบนใบขับขี่เก็บแยก ไม่ทับเลขบัตร · DOC-023 ขัดกัน = แสดงให้เห็น', () => {
    let f = setSlotOcr(setSlotFile(blankForm(), 'id', file('id'), []), 'id', file('id').id, ocr({ firstName: 'ทดลอง', nationalId: '0000012345679' }));
    f = setSlotOcr(setSlotFile(f, 'license', file('license'), []), 'license', file('license').id, ocr({ firstName: 'ชื่อบนใบขับขี่', nationalId: '1111111111119', licenseNumber: '65001234' }));
    expect(f.person.firstName).toBe('ทดลอง');
    expect(f.person.nationalId).toBe('0000012345679');
    expect(f.person.licenseNationalId).toBe('1111111111119');
    expect(f.person.licenseNumber).toBe('65001234');
    expect(nationalIdConflict(f)).toBe(true);
    expect(f.person.nationalId).toBe('0000012345679');
  });

  it('DOC-036 แก้ข้อมูล/คำตอบหลังลงนาม = ลายเซ็นและคำยืนยันเดิมใช้ไม่ได้', () => {
    const signed = complete();
    const edited = editPerson(signed, 'phone', '0811111111');
    expect([edited.signName, edited.signatureIntent, edited.confirmed, edited.reviewed]).toEqual(['', false, false, false]);
    const answered = setConsent(signed, 'background', 'no');
    expect([answered.signName, answered.signatureIntent, answered.confirmed]).toEqual(['', false, false]);
    expect(answered.reviewed).toBe(true);
  });

  it('ชุดที่หน้าเว็บส่ง = ผ่านตัวตรวจตัวเดียวกับเซิร์ฟเวอร์ · DOC-029 เหมือนทะเบียนบ้าน = คัดลอกค่าจริง', () => {
    const body = packetBody(complete(), STATE);
    const packet = validatePacket(body, { today: TODAY, noticeVersion: 'notice-v1', templates: Object.fromEntries(DOCS.map((d) => [d.id, d.hash])) });
    expect(packet.addresses.current).toEqual(packet.addresses.registered);
    expect(packet.addresses.current).not.toBe(packet.addresses.registered);
    expect(packet.consents.ex).toBe('yes');
    expect(packet.ocr.house.status).toBe('manual');
    expect(packet.ocr.id.status).toBe('read');
  });

  it('DOC-032 คำตอบ "ไม่ยินยอม" ส่งตามจริง ลายเซ็นไม่เปลี่ยนให้', () => {
    let f = setConsent(complete(), 'background', 'no');
    f = { ...f, signName: 'ทดลอง อ่านเอกสาร', signatureIntent: true, confirmed: true };
    const packet = validatePacket(packetBody(f, STATE), { today: TODAY, noticeVersion: 'notice-v1', templates: Object.fromEntries(DOCS.map((d) => [d.id, d.hash])) });
    expect(packet.consents.background).toBe('no');
  });

  it('อายุคิดจากวันเกิด ไม่ให้กรอกซ้ำ', () => {
    expect(ageOn('1995-01-15', TODAY)).toBe(31);
    expect(ageOn('1995-11-23', TODAY)).toBe(30);
    expect(ageOn('', TODAY)).toBeNull();
  });

  it('จำที่กรอกไว้ในแท็บ ไม่จำลายเซ็น · ภาพที่เซิร์ฟเวอร์ไม่มีแล้วถูกทิ้ง ต้องตรวจใหม่', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    const f = complete();
    saveDraft(storage, STATE.inviteKey, 3, f);
    expect([...store.values()][0]).not.toContain('ทดลอง อ่านเอกสาร"');
    const drafts = UPLOAD_KINDS.map((k) => file(k));
    const back = loadDraft(storage, { ...STATE, drafts });
    expect(back?.step).toBe(3);
    expect(back?.form.signName).toBe('');
    expect(back?.form.signatureIntent).toBe(false);
    expect(back?.form.person.firstName).toBe('ทดลอง');
    const replaced = loadDraft(storage, { ...STATE, drafts: drafts.map((d) => (d.kind === 'id' ? file('id', 9) : d)) });
    expect(replaced?.step).toBe(0);
    expect(replaced?.form.slots.id?.imageConfirmed).toBe(false);
    expect(replaced?.form.reviewed).toBe(false);
    clearDraft(storage, STATE.inviteKey);
    expect(loadDraft(storage, STATE)).toBeNull();
  });
});
