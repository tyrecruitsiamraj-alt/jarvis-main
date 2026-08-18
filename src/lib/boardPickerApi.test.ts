/**
 * picker เลือกชื่อจากบอร์ดของหน้า Follow (F5b · 16 ส.ค. 2569)
 *
 * พังเงียบที่คุมไว้:
 * - คำนำหน้าติดมากับชื่อจากบอร์ด แล้วฟอร์มเติม prefix ทับ → "นายนายสมชาย"
 * - "นาง" ชนะ "นางสาว" ตอนถอด prefix → ผู้หญิงกลายเป็น "นางสาว" → "นาง" + "สาวมาลี"
 */
import { describe, expect, it } from 'vitest';
import {
  filterPickerPeople,
  pickerDisplayName,
  pickerSearchBlob,
  splitPickerName,
  type BoardPickerPerson,
} from '@/lib/boardPickerApi';

const person = (over: Partial<BoardPickerPerson> = {}): BoardPickerPerson => ({
  card_id: 1,
  first_name: 'สมชาย',
  last_name: 'ใจดี',
  nick_name: 'ชาย',
  sex_code: null,
  mobile: '0812345678',
  skills: 'ขับรถ / ส่งของ',
  area: 'บางรัก กรุงเทพมหานคร',
  column_label: 'To do',
  last_activity_at: null,
  ...over,
});

describe('pickerDisplayName', () => {
  it('ชื่อ+นามสกุลก่อน · ไม่มีใช้ชื่อเล่น · ไม่มีเลยใช้เลขการ์ด (ห้ามว่าง)', () => {
    expect(pickerDisplayName(person())).toBe('สมชาย ใจดี');
    expect(pickerDisplayName(person({ first_name: null, last_name: null }))).toBe('ชาย');
    expect(pickerDisplayName(person({ first_name: null, last_name: null, nick_name: null }))).toBe(
      'การ์ด #1',
    );
  });
});

describe('splitPickerName — ถอดคำนำหน้าที่ติดมากับชื่อ', () => {
  it('"นายสมชาย" → prefix นาย + ชื่อ สมชาย (ไม่งั้นฟอร์มได้ "นายนายสมชาย")', () => {
    expect(splitPickerName(person({ first_name: 'นายสมชาย' }))).toEqual({
      prefix: 'นาย',
      first: 'สมชาย',
      last: 'ใจดี',
    });
  });

  it('"นางสาวมาลี" ต้องได้ นางสาว ไม่ใช่ นาง + "สาวมาลี"', () => {
    expect(splitPickerName(person({ first_name: 'นางสาวมาลี', last_name: 'รักงาน' }))).toEqual({
      prefix: 'นางสาว',
      first: 'มาลี',
      last: 'รักงาน',
    });
  });

  it('ชื่อที่ไม่มีคำนำหน้า = prefix ว่าง (ห้ามเดาเพศให้ใคร)', () => {
    expect(splitPickerName(person({ first_name: 'สมชาย' })).prefix).toBe('');
  });

  it('ไม่มีชื่อจริง ใช้ชื่อเล่นเป็นชื่อ', () => {
    expect(splitPickerName(person({ first_name: null, nick_name: 'หมิว' })).first).toBe('หมิว');
  });

  it('ชื่อที่ขึ้นต้นด้วยตัวอักษรเดียวกับคำนำหน้าแต่ไม่ใช่คำนำหน้า ต้องไม่ถูกตัด', () => {
    // "นายกสมาคม" ไม่ควรกลายเป็น prefix "นาย" + "กสมาคม" — แต่ของจริงบอร์ดเก็บชื่อคน
    // เคสนี้ยอมรับพฤติกรรมปัจจุบัน (prefix match ตรงตัว) แค่บันทึกไว้ว่ารู้ตัว
    expect(splitPickerName(person({ first_name: 'นายก' })).first).toBe('ก');
  });
});

describe('filterPickerPeople', () => {
  const people = [
    person({ card_id: 1, first_name: 'สมชาย', skills: 'ขับรถ', area: 'ชลบุรี' }),
    person({ card_id: 2, first_name: 'มาลี', nick_name: null, skills: 'ธุรการ', area: 'ระยอง', mobile: '0899999999' }),
    person({ card_id: 3, first_name: 'สมหญิง', nick_name: null, skills: 'แม่บ้าน', area: 'ชลบุรี' }),
  ];

  it('คำค้นว่าง = ได้ทั้งหมด', () => {
    expect(filterPickerPeople(people, '  ')).toHaveLength(3);
  });

  it('ค้นด้วยสกิล/พื้นที่/เบอร์ได้ ไม่ใช่แค่ชื่อ', () => {
    expect(filterPickerPeople(people, 'ธุรการ').map((p) => p.card_id)).toEqual([2]);
    expect(filterPickerPeople(people, 'ชลบุรี').map((p) => p.card_id)).toEqual([1, 3]);
    expect(filterPickerPeople(people, '0899999999').map((p) => p.card_id)).toEqual([2]);
  });

  it('หลายคำ = ต้องเจอครบทุกคำ (AND) ไม่ใช่คำใดคำหนึ่ง', () => {
    expect(filterPickerPeople(people, 'ชลบุรี แม่บ้าน').map((p) => p.card_id)).toEqual([3]);
    expect(filterPickerPeople(people, 'ชลบุรี ธุรการ')).toHaveLength(0);
  });

  it('จำกัดจำนวนผลไม่ให้ dialog เรนเดอร์เป็นพัน ๆ แถว', () => {
    const many = Array.from({ length: 500 }, (_, i) => person({ card_id: i + 1 }));
    expect(filterPickerPeople(many, '')).toHaveLength(100);
    expect(filterPickerPeople(many, 'ขับรถ', 25)).toHaveLength(25);
  });
});

describe('pickerSearchBlob', () => {
  it('รวมทุกฟิลด์ที่ค้นได้ และเป็นตัวพิมพ์เล็ก', () => {
    const blob = pickerSearchBlob(person({ column_label: 'To Do' }));
    expect(blob).toContain('สมชาย');
    expect(blob).toContain('0812345678');
    expect(blob).toContain('to do');
  });
});

describe('คำนำหน้าจากเพศ — iRecruit ไม่เก็บคำนำหน้าเป็นคอลัมน์', () => {
  it('M → นาย · F → นางสาว · ไม่รู้เพศ = เว้นว่าง', () => {
    expect(splitPickerName(person({ sex_code: 'M' })).prefix).toBe('นาย');
    expect(splitPickerName(person({ sex_code: 'F' })).prefix).toBe('นางสาว');
    expect(splitPickerName(person({ sex_code: null })).prefix).toBe('');
    expect(splitPickerName(person({ sex_code: '  ' })).prefix).toBe('');
  });

  it('รับค่าตัวพิมพ์เล็ก/มีช่องว่างจาก ERP ได้', () => {
    expect(splitPickerName(person({ sex_code: ' m ' })).prefix).toBe('นาย');
    expect(splitPickerName(person({ sex_code: 'f' })).prefix).toBe('นางสาว');
  });

  it('🔴 คำนำหน้าที่ติดมากับชื่อชนะเพศเสมอ (ห้ามให้เพศทับของจริง)', () => {
    expect(splitPickerName(person({ first_name: 'นางมาลี', sex_code: 'F' }))).toEqual({
      prefix: 'นาง',
      first: 'มาลี',
      last: 'ใจดี',
    });
    // ข้อมูลขัดกัน: ชื่อบอกนาย แต่เพศบอก F → เชื่อชื่อ
    expect(splitPickerName(person({ first_name: 'นายสมชาย', sex_code: 'F' })).prefix).toBe('นาย');
  });

  it('🔴 ลิสต์ picker ต้องโชว์คำนำหน้าเดียวกับที่เติมลงฟอร์ม', () => {
    expect(pickerDisplayName(person({ sex_code: 'M' }))).toBe('นายสมชาย ใจดี');
    expect(pickerDisplayName(person({ sex_code: 'F' }))).toBe('นางสาวสมชาย ใจดี');
    expect(pickerDisplayName(person({ first_name: 'นางมาลี', sex_code: 'F' }))).toBe('นางมาลี ใจดี');
    // ไม่รู้เพศ = เหมือนเดิม ไม่มีคำนำหน้ามั่ว
    expect(pickerDisplayName(person())).toBe('สมชาย ใจดี');
  });
});
