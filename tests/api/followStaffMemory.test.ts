import { describe, it, expect } from 'vitest';
import {
  directoryPhoneForName,
  isDirectoryName,
  phoneForStaffName,
  rememberedPhoneForName,
  nameForPhone,
  staffNameForPhone,
  staffNameOptions,
  staffNameOptionsAll,
} from '../../src/lib/followStaffMemory';
import type { FollowStaffContact } from '../../src/lib/followStaffContactsApi';
import type { StaffDirectoryEntry } from '../../src/lib/jobStaffRemote';

/**
 * ความจำ ชื่อ→เบอร์ ของเจ้าหน้าที่ติดตาม (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-9)
 */

let seq = 0;
const c = (name: string, phone: string): FollowStaffContact => {
  seq += 1;
  return { id: `id-${seq}`, name, phone, created_by_name: null, created_at: '' };
};

describe('rememberedPhoneForName', () => {
  it('คืนเบอร์ที่จำล่าสุดของชื่อ (API เรียง created_at asc → ตัวหลังชนะ)', () => {
    const list = [c('คิว', '0811111111'), c('บี', '0822222222'), c('คิว', '0899999999')];
    expect(rememberedPhoneForName('คิว', list)).toBe('0899999999');
    expect(rememberedPhoneForName('บี', list)).toBe('0822222222');
  });

  it('เทียบชื่อไม่สนตัวพิมพ์/ช่องว่างหัวท้าย · ไม่เจอ = null', () => {
    const list = [c(' คิว ', '0811111111')];
    expect(rememberedPhoneForName('คิว', list)).toBe('0811111111');
    expect(rememberedPhoneForName('ไม่มี', list)).toBeNull();
    expect(rememberedPhoneForName('', list)).toBeNull();
  });

  it('ข้ามแถวที่เบอร์ว่าง', () => {
    const list = [c('คิว', '   '), c('คิว', '0811111111')];
    expect(rememberedPhoneForName('คิว', list)).toBe('0811111111');
  });
});

describe('nameForPhone', () => {
  it('ย้อนหาชื่อจากเบอร์ (เทียบตรงตัว) — ใช้ตอนเปิดแก้รายการเก่าที่มีแต่เบอร์', () => {
    const list = [c('คิว', '0811111111'), c('บี', '021234567 ต่อ 101')];
    expect(nameForPhone('0811111111', list)).toBe('คิว');
    expect(nameForPhone('021234567 ต่อ 101', list)).toBe('บี');
    expect(nameForPhone('0899999999', list)).toBeNull();
    expect(nameForPhone('', list)).toBeNull();
  });
});

describe('staffNameOptions', () => {
  it('รวมชื่อคัดสรร + ชื่อในความจำ · unique (ไม่สนตัวพิมพ์) · เรียง ก-ฮ', () => {
    const screeners = ['บี', 'คิว'];
    const contacts = [c('คิว', '08x'), c('เอ', '08y')];
    expect(staffNameOptions(screeners, contacts)).toEqual(['คิว', 'บี', 'เอ']);
  });

  it('ตัดชื่อว่าง/ซ้ำทิ้ง', () => {
    expect(staffNameOptions(['คิว', ' คิว ', ''], [])).toEqual(['คิว']);
  });
});

/**
 * สมุดเบอร์จากหน้าผู้ใช้งาน (23 ก.ย. 2569) — เจ้าของเคาะว่า **หน้าผู้ใช้งานคือตัวจริง**
 * เคสจริงที่ต้องคุม: ความจำเดิมของ "ครีม" มี 3 เบอร์ ตั้งค่าที่หน้าผู้ใช้งานแล้วต้องชนะ
 */
const d = (name: string, phone: string, lanes: string[] = ['screener']): StaffDirectoryEntry => ({
  name,
  phone,
  lanes,
});

describe('สมุดเบอร์ (หน้าผู้ใช้งาน) ชนะความจำเดิม', () => {
  const contacts = [c('ครีม', '0614073657'), c('ครีม', '0626012097'), c('ครีม', '0614142141')];

  it('ยังไม่ได้ตั้งค่า = ใช้ความจำเดิม (เบอร์ล่าสุด)', () => {
    expect(phoneForStaffName('ครีม', [], contacts)).toBe('0614142141');
  });

  it('ตั้งค่าแล้ว = เบอร์จากหน้าผู้ใช้งานชนะ ความจำเดิมที่ปนกันเลิกถูกใช้', () => {
    expect(phoneForStaffName('ครีม', [d('ครีม', '0888888888')], contacts)).toBe('0888888888');
  });

  it('เทียบชื่อไม่สนตัวพิมพ์/ช่องว่างหัวท้าย', () => {
    expect(directoryPhoneForName('  Cream ', [d('cream', '0812345678')])).toBe('0812345678');
  });

  it('ชื่อที่ยังไม่ได้ตั้งค่า = ไม่นับว่าอยู่ในสมุดเบอร์ (ยังจำจากที่พิมพ์เองได้)', () => {
    const dir = [d('ครีม', '0888888888')];
    expect(isDirectoryName('ครีม', dir)).toBe(true);
    expect(isDirectoryName('กุ้งนาง', dir)).toBe(false);
  });
});

describe('staffNameForPhone — ย้อนหาชื่อของรายการเก่าที่เก็บแต่เบอร์', () => {
  it('สมุดเบอร์ก่อน', () => {
    expect(staffNameForPhone('0888888888', [d('ครีม', '0888888888')], [])).toBe('ครีม');
  });

  it('ไม่มีในสมุดเบอร์ = ตกไปใช้ความจำเดิม', () => {
    expect(staffNameForPhone('0929939635', [], [c('วิว', '0929939635')])).toBe('วิว');
  });

  it('ไม่รู้จักเลย = null (ห้ามเดาชื่อ)', () => {
    expect(staffNameForPhone('0700000000', [d('ครีม', '0888888888')], [])).toBeNull();
  });
});

describe('staffNameOptionsAll', () => {
  it('รวมชื่อจากสมุดเบอร์ + คัดสรร + ความจำเดิม โดยไม่ซ้ำ', () => {
    const out = staffNameOptionsAll([d('ครีม', '0888888888')], ['วิว', 'ครีม'], [c('อ้อแอ้', '0614142141')]);
    expect(out).toEqual(['ครีม', 'วิว', 'อ้อแอ้']);
  });

  it('สมุดเบอร์ว่าง = ได้ผลเท่าเดิมทุกประการ (ทางถอยตอนยังกรอกไม่ครบ)', () => {
    const screeners = ['วิว', 'ครีม'];
    const contacts = [c('อ้อแอ้', '0614142141')];
    expect(staffNameOptionsAll([], screeners, contacts)).toEqual(
      staffNameOptions(screeners, contacts),
    );
  });
});
