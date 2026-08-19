import { describe, it, expect } from 'vitest';
import {
  rememberedPhoneForName,
  nameForPhone,
  staffNameOptions,
} from '../../src/lib/followStaffMemory';
import type { FollowStaffContact } from '../../src/lib/followStaffContactsApi';

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
