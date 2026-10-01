// @vitest-environment node
/**
 * แก้ข้อมูลผู้สมัครจากป๊อปรายละเอียด (เจ้าของสั่ง 1 ต.ค. 2569)
 * *"แก้ไขได้แต่ถ้าบันทึกก็เก็บ Log ด้วยว่าใครแก้ไข แต่ไม่ต้องโชว์ Log"*
 *
 * 🔴 ด่าน:
 * - ส่ง/เขียน **เฉพาะช่องที่เปลี่ยน** (ไม่มีอะไรเปลี่ยน = ไม่เขียน ไม่จด log)
 * - **เบอร์แก้จากที่นี่ไม่ได้** (คีย์ของล็อกโทร/คิว) — ช่องที่ไม่รู้จักโดนปฏิเสธทั้งก้อน
 * - ช่วงอายุ/น้ำหนัก/ส่วนสูง ชุดเดียวกับฟอร์มสมัครสาธารณะ
 * - ใบขับขี่คำเก่านอกรายการ **คงไว้ได้** (ไม่ทำข้อมูลหาย) แต่เติมคำนอกรายการใหม่ไม่ได้
 */
import { describe, expect, it } from 'vitest';
import {
  PROFILE_LICENSE_OPTIONS,
  changedProfilePatch,
  parseProfilePatch,
  profileDraftOf,
  profileFullName,
  profilePatchFromDraft,
} from '../../src/lib/applicantProfileEdit.js';

const row = {
  title_prefix: 'นาย',
  first_name: 'สมชาย',
  last_name: 'ใจดี',
  full_name: 'นายสมชาย ใจดี',
  gender: 'male',
  age: 33,
  line_id: null,
  province: 'กรุงเทพมหานคร',
  district: null,
  education: 'ปวส',
  license_types: ['ใบขับขี่บุคคล 5 ปี'],
  weight_kg: '70.0',
  height_cm: 172,
  note: null,
};

describe('ค่าตั้งต้นของฟอร์ม', () => {
  it('ข้อมูลใบ → ข้อความตามช่อง', () => {
    expect(profileDraftOf(row)).toEqual({
      title_prefix: 'นาย',
      first_name: 'สมชาย',
      last_name: 'ใจดี',
      gender: 'male',
      age: '33',
      line_id: '',
      province: 'กรุงเทพมหานคร',
      district: '',
      education: 'ปวส',
      license_types: ['ใบขับขี่บุคคล 5 ปี'],
      weight_kg: '70.0',
      height_cm: '172',
      note: '',
    });
  });

  it('ใบเก่าไม่มีชื่อ/นามสกุลแยก ⇒ แตกจากชื่อเต็ม', () => {
    const d = profileDraftOf({ full_name: 'สมหญิง รักงาน ดีมาก', first_name: null, last_name: null });
    expect([d.first_name, d.last_name]).toEqual(['สมหญิง', 'รักงาน ดีมาก']);
  });

  it('ชื่อเต็มแบบฟอร์มสมัครสาธารณะ — คำนำหน้าติดชื่อ', () => {
    expect(profileFullName('นางสาว', 'มานี', 'มีนา')).toBe('นางสาวมานี มีนา');
    expect(profileFullName(null, 'มานี', 'มีนา')).toBe('มานี มีนา');
  });
});

describe('ตรวจค่าที่ส่งมา (ตัวเดียวกันทั้งหน้าเว็บและ API)', () => {
  it('🔴 แก้เบอร์จากที่นี่ไม่ได้ — ช่องที่ไม่รู้จักโดนปฏิเสธ', () => {
    expect(parseProfilePatch({ phone: '0812345678' })).toEqual({ ok: false, message: 'แก้ช่อง phone จากที่นี่ไม่ได้' });
    expect(parseProfilePatch({ status: 'rejected' })).toMatchObject({ ok: false });
  });

  it('ชื่อ/นามสกุลว่างไม่ได้ · ช่องข้อความอื่นว่าง = ล้างค่า (null)', () => {
    expect(parseProfilePatch({ first_name: '  ' })).toEqual({ ok: false, message: 'กรุณากรอกชื่อ' });
    expect(parseProfilePatch({ line_id: '  ', note: '' })).toEqual({ ok: true, patch: { line_id: null, note: null } });
  });

  it('อายุ 15–80 จำนวนเต็ม · น้ำหนัก/ส่วนสูงตามช่วงฟอร์มสมัคร · ว่าง = ล้างค่า', () => {
    expect(parseProfilePatch({ age: '34' })).toEqual({ ok: true, patch: { age: 34 } });
    expect(parseProfilePatch({ age: '14' })).toEqual({ ok: false, message: 'อายุต้องอยู่ระหว่าง 15–80 ปี' });
    expect(parseProfilePatch({ age: '33.5' })).toMatchObject({ ok: false });
    expect(parseProfilePatch({ weight_kg: '68.25' })).toEqual({ ok: true, patch: { weight_kg: 68.3 } });
    expect(parseProfilePatch({ height_cm: '500' })).toEqual({ ok: false, message: 'ส่วนสูงต้องอยู่ระหว่าง 80–260' });
    expect(parseProfilePatch({ weight_kg: '' })).toEqual({ ok: true, patch: { weight_kg: null } });
  });

  it('เพศ ชาย/หญิง/อื่น ๆ เท่านั้น', () => {
    expect(parseProfilePatch({ gender: 'female' })).toEqual({ ok: true, patch: { gender: 'female' } });
    expect(parseProfilePatch({ gender: 'x' })).toEqual({ ok: false, message: 'เพศไม่ถูกต้อง' });
  });

  it('🔴 ใบขับขี่: คำในรายการได้ · คำเก่าที่ใบมีอยู่แล้วคงไว้ได้ · คำนอกรายการใหม่ไม่ได้ · เรียงตามรายการกลาง', () => {
    const [a, , , b] = PROFILE_LICENSE_OPTIONS;
    expect(parseProfilePatch({ license_types: [b, a] })).toEqual({ ok: true, patch: { license_types: [a, b] } });
    expect(parseProfilePatch({ license_types: ['ใบขับขี่เรือ'] })).toEqual({
      ok: false,
      message: 'ไม่รู้จักใบขับขี่ "ใบขับขี่เรือ"',
    });
    expect(parseProfilePatch({ license_types: ['ใบขับขี่เก่า', a] }, ['ใบขับขี่เก่า'])).toEqual({
      ok: true,
      patch: { license_types: [a, 'ใบขับขี่เก่า'] },
    });
  });
});

describe('เหลือเฉพาะช่องที่เปลี่ยนจริง', () => {
  it('ค่าเดิม (เลขในรูปข้อความ/ลำดับใบขับขี่สลับ) ⇒ ไม่ถือว่าเปลี่ยน', () => {
    expect(
      changedProfilePatch(row, { age: 33, weight_kg: 70, license_types: ['ใบขับขี่บุคคล 5 ปี'], province: 'กรุงเทพมหานคร' }),
    ).toEqual({});
  });

  it('เปลี่ยนจริง ⇒ ได้เฉพาะช่องนั้น', () => {
    expect(changedProfilePatch(row, { age: 34, province: 'กรุงเทพมหานคร', line_id: 'somchai' })).toEqual({
      age: 34,
      line_id: 'somchai',
    });
  });

  it('ฟอร์ม → ค่าที่จะส่ง: เฉพาะช่องที่แก้ + ข้อความผิดตัวแรก', () => {
    const base = profileDraftOf(row);
    expect(profilePatchFromDraft(base, { ...base })).toEqual({ patch: {}, error: null });
    expect(profilePatchFromDraft(base, { ...base, age: '34', district: 'บางนา' })).toEqual({
      patch: { age: 34, district: 'บางนา' },
      error: null,
    });
    expect(profilePatchFromDraft(base, { ...base, age: '200' })).toEqual({
      patch: {},
      error: 'อายุต้องอยู่ระหว่าง 15–80 ปี',
    });
  });
});
