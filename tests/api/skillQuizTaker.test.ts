/**
 * แบบทดสอบ: ลิงก์เดียวต่อชุด + คนทำกรอกข้อมูล + ใครเห็นชุด (เจ้าของ 16 พ.ย. 2569 แบบ Knowa)
 */
import { describe, expect, it } from 'vitest';
import {
  ageOn,
  canSeeQuizSet,
  isValidThaiCitizenId,
  maskCitizenId,
  parseQuizResumeInput,
  parseQuizTakerInput,
  parseQuizViewers,
  quizViewerMode,
} from '../../src/lib/skillQuizTaker';
import { decryptPii, encryptPii, hashPii } from '../../api/_lib/piiCipher';

// เลขบัตรตัวอย่างที่หลักตรวจสอบถูก (ไม่ใช่ของคนจริง)
const ID_OK = '1101700230708';
const ID_BAD = '1101700230707';
const TODAY = '2026-11-16';

const form = {
  firstName: '  สมชาย ',
  lastName: 'ใจดี',
  phone: '081-234-5678',
  age: 31,
  citizenId: '1-1017-00230-70-8',
  birthDate: '1995-03-02',
};

describe('เลขบัตรประชาชน', () => {
  it('ตรวจหลักตรวจสอบ', () => {
    expect(isValidThaiCitizenId(ID_OK)).toBe(true);
    expect(isValidThaiCitizenId(ID_BAD)).toBe(false);
    expect(isValidThaiCitizenId('123')).toBe(false);
  });
  it('เจ้าหน้าที่เห็นแค่ท้ายบัตร', () => {
    expect(maskCitizenId(ID_OK)).toBe('x-xxxx-xxxxx-70-8');
    expect(maskCitizenId(null)).toBe('');
  });
});

describe('อายุ', () => {
  it('ยังไม่ถึงวันเกิดปีนี้ = ลบหนึ่ง', () => {
    expect(ageOn('1995-11-17', TODAY)).toBe(30);
    expect(ageOn('1995-11-16', TODAY)).toBe(31);
    expect(ageOn('1995-02-31', TODAY)).toBeNull();
  });
});

describe('ฟอร์มก่อนเริ่มทำ', () => {
  it('ครบ = ตัดช่องว่าง เก็บเลขล้วน', () => {
    const r = parseQuizTakerInput(form, TODAY);
    expect(r).toEqual({ ok: true, value: { firstName: 'สมชาย', lastName: 'ใจดี', phone: '0812345678', age: 31, citizenId: ID_OK, birthDate: '1995-03-02' } });
  });
  it('บอกช่องที่ต้องแก้ตามลำดับบนจอ', () => {
    expect(parseQuizTakerInput({ ...form, firstName: '' }, TODAY)).toEqual({ ok: false, message: 'ใส่ชื่อ' });
    expect(parseQuizTakerInput({ ...form, phone: '12345' }, TODAY)).toEqual({ ok: false, message: 'ใส่เบอร์โทร 10 หลัก' });
    expect(parseQuizTakerInput({ ...form, age: 0 }, TODAY)).toEqual({ ok: false, message: 'ใส่อายุ' });
    expect(parseQuizTakerInput({ ...form, citizenId: ID_BAD }, TODAY)).toEqual({ ok: false, message: 'เลขบัตรประชาชนไม่ถูกต้อง' });
    expect(parseQuizTakerInput({ ...form, birthDate: '' }, TODAY)).toEqual({ ok: false, message: 'เลือกวันเดือนปีเกิด' });
    expect(parseQuizTakerInput({ ...form, birthDate: '2020-01-01' }, TODAY)).toEqual({ ok: false, message: 'ตรวจวันเดือนปีเกิดอีกครั้ง' });
  });
  it('เข้าซ้ำใช้แค่เลขบัตร + วันเกิด', () => {
    expect(parseQuizResumeInput({ citizenId: ID_OK, birthDate: '1995-03-02' }, TODAY)).toEqual({ ok: true, value: { citizenId: ID_OK, birthDate: '1995-03-02' } });
    expect(parseQuizResumeInput({ citizenId: ID_BAD, birthDate: '1995-03-02' }, TODAY).ok).toBe(false);
  });
});

describe('ใครเห็นชุด', () => {
  const BUS = ['SN', 'DS', 'LM', 'LBA', 'LBD'];
  const U1 = '11111111-1111-1111-1111-111111111111';
  const U2 = '22222222-2222-2222-2222-222222222222';
  it('อ่านค่าจากฟอร์ม', () => {
    expect(parseQuizViewers({ mode: 'all', bus: ['LBD'] }, BUS)).toEqual({ ok: true, value: { bus: [], userIds: [] } });
    expect(parseQuizViewers({ mode: 'bu', bus: ['lbd', 'XX', 'LBD'] }, BUS)).toEqual({ ok: true, value: { bus: ['LBD'], userIds: [] } });
    expect(parseQuizViewers({ mode: 'bu', bus: [] }, BUS)).toEqual({ ok: false, message: 'เลือก BU ที่เห็นชุดนี้' });
    expect(parseQuizViewers({ mode: 'people', userIds: [U1, 'x'] }, BUS)).toEqual({ ok: true, value: { bus: [], userIds: [U1] } });
    expect(parseQuizViewers({ mode: 'people', userIds: [] }, BUS)).toEqual({ ok: false, message: 'เลือกคนที่เห็นชุดนี้' });
    expect(quizViewerMode({ bus: ['LBD'], userIds: [] })).toBe('bu');
  });
  it('ทั้ง BU / รายคน / ทุกคน · คนสร้างกับ Admin เห็นเสมอ', () => {
    const staff = { userId: U2, isAdmin: false, codes: ['LBA'] };
    const bu = { viewer_bus: ['LBD'], viewer_user_ids: [], created_by_user_id: U1 };
    expect(canSeeQuizSet(bu, staff)).toBe(false);
    expect(canSeeQuizSet(bu, { ...staff, codes: ['LBA', 'LBD'] })).toBe(true);
    expect(canSeeQuizSet(bu, { ...staff, userId: U1 })).toBe(true);
    expect(canSeeQuizSet(bu, { ...staff, isAdmin: true, codes: null })).toBe(true);
    const people = { viewer_bus: [], viewer_user_ids: [U1], created_by_user_id: null };
    expect(canSeeQuizSet(people, staff)).toBe(false);
    expect(canSeeQuizSet(people, { ...staff, userId: U1 })).toBe(true);
    expect(canSeeQuizSet({ viewer_bus: [], viewer_user_ids: [], created_by_user_id: null }, staff)).toBe(true);
  });
});

describe('เข้ารหัสเลขบัตร', () => {
  it('ถอดกลับได้ · แฮชคงที่และไม่ใช่เลขเดิม', () => {
    process.env.AUTH_JWT_SECRET ||= 'test-secret';
    const enc = encryptPii(ID_OK);
    expect(enc).not.toContain(ID_OK);
    expect(decryptPii(enc)).toBe(ID_OK);
    expect(decryptPii('v1:bad')).toBeNull();
    expect(hashPii('skill_quiz', ID_OK)).toBe(hashPii('skill_quiz', ID_OK));
    expect(hashPii('skill_quiz', ID_OK)).not.toContain(ID_OK);
    expect(hashPii('other', ID_OK)).not.toBe(hashPii('skill_quiz', ID_OK));
  });
});
