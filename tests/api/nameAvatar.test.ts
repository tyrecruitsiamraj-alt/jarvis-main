import { describe, it, expect } from 'vitest';
import { AVATAR_COLORS, avatarColor, nameInitials } from '../../src/lib/nameAvatar';

describe('nameInitials', () => {
  it('ชื่อไทยเอา 2 อักขระแรกของชื่อต้น ไม่เอานามสกุล', () => {
    expect(nameInitials('สมชาย ใจเพชร')).toBe('สม');
    expect(nameInitials('วารุณี พงษ์สวัสดิ์')).toBe('วา');
  });

  it('ชื่ออังกฤษเอาอักษรแรกของชื่อ + นามสกุล', () => {
    expect(nameInitials('Korawit Phomchantuek')).toBe('KP');
    expect(nameInitials('madonna')).toBe('MA');
  });

  it('ชื่อว่าง/ช่องว่างล้วน ได้ขีดกลาง ไม่ใช่วงกลมเปล่า', () => {
    expect(nameInitials('')).toBe('—');
    expect(nameInitials('   ')).toBe('—');
  });
});

describe('avatarColor', () => {
  it('ชื่อเดิมได้สีเดิมทุกครั้ง (สีต้องไม่ขึ้นกับลำดับแถวหรือการเรียกซ้ำ)', () => {
    const a = avatarColor('ธนกร วัฒนชัย');
    expect(avatarColor('ธนกร วัฒนชัย')).toBe(a);
    expect(AVATAR_COLORS).toContain(a as (typeof AVATAR_COLORS)[number]);
  });

  it('คนละชื่อกระจายได้หลายสี ไม่กองอยู่สีเดียว', () => {
    const names = ['สมชาย ใจเพชร', 'วารุณี พงษ์สวัสดิ์', 'ประวิทย์ สายทองคำ', 'ธนกร วัฒนชัย', 'อรทัย บุญประเสริฐ'];
    expect(new Set(names.map(avatarColor)).size).toBeGreaterThan(1);
  });
});
