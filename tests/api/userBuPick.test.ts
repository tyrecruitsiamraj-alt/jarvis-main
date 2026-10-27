/** Dropdown BU ของผู้ใช้ (เจ้าของ 27 ต.ค. 2569 "เอาเป็น Dropdown … เป็น Checkbox ว่าเอา BU ไหนบ้าง") */
import { describe, expect, it } from 'vitest';
import { userBuCodes, userBuLabel, userBuValueOf } from '@/lib/userBuPick';

describe('ติ๊ก BU ใน Dropdown', () => {
  it('คง BU หลักเดิมถ้ายังติ๊ก · เอาหลักออก = ตัวแรกที่เหลือเป็นหลัก · ไม่ติ๊กเลย = ยังไม่ตั้ง', () => {
    expect(userBuValueOf(['LBD', 'LBA'], 'LBA')).toEqual({ department_code: 'LBA', extra_department_codes: ['LBD'] });
    expect(userBuValueOf(['LBA', 'LM'], 'LBD')).toEqual({ department_code: 'LM', extra_department_codes: ['LBA'] });
    expect(userBuValueOf([], 'LBD')).toEqual({ department_code: null, extra_department_codes: [] });
    expect(userBuValueOf(['LBD'], null)).toEqual({ department_code: 'LBD', extra_department_codes: [] });
  });

  it('ป้ายบนปุ่ม: ยังไม่ตั้ง · ทุก BU · รายชื่อ BU', () => {
    expect(userBuLabel(userBuCodes(null, []))).toBe('ยังไม่ตั้ง');
    expect(userBuLabel(userBuCodes('LBD', ['SN', 'DS', 'LM', 'LBA']))).toBe('ทุก BU');
    expect(userBuLabel(userBuCodes('LBD', ['LBA']))).toBe('LBD · LBA');
  });
});
