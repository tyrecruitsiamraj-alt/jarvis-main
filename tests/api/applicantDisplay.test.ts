import { describe, expect, it } from 'vitest';
import { applicantAddressLine, applicantFactLine } from '../../src/lib/applicantDisplay';

describe('applicantFactLine — ตัวคั่นต้องไม่ลอย และบรรทัดต้องคาดเดาได้', () => {
  it('ไม่มีข้อมูลเลย → สตริงว่าง (ผู้เรียกเป็นคนใส่ขีดเอง)', () => {
    expect(applicantFactLine({})).toBe('');
  });

  it('มีแต่เพศ (ฟิลด์ที่ 2) → ต้องไม่มีจุดนำหน้า', () => {
    // บั๊กเดิม: ทุก span เขียน '· ' ติดหัวตัวเอง คนที่ไม่มีอายุแต่มีเพศจึงได้ "· ชาย"
    const line = applicantFactLine({ gender: 'male' });
    expect(line).toBe('ชาย');
    expect(line.startsWith('·')).toBe(false);
  });

  it('มีแต่ฟิลด์กลาง (วุฒิ) → ไม่มีทั้งจุดหน้าและจุดหลัง', () => {
    const line = applicantFactLine({ education: 'ปวส.' });
    expect(line).toBe('ปวส.');
    expect(line.endsWith('·')).toBe(false);
  });

  it('ครบทุกฟิลด์ → ลำดับและตัวคั่นถูกต้อง', () => {
    expect(
      applicantFactLine({
        age: 28,
        gender: 'female',
        weight_kg: 50,
        height_cm: 160,
        education: 'ปริญญาตรี',
        position_interest: 'ธุรการ',
      }),
    ).toBe('อายุ 28 ปี · หญิง · 50 กก. · 160 ซม. · ปริญญาตรี · สนใจ ธุรการ');
  });

  it('เพศที่ไม่รู้จักคืนค่าดิบ ไม่ทิ้งข้อมูล', () => {
    expect(applicantFactLine({ gender: 'x' as 'male' })).toBe('x');
  });

  it('อายุ/น้ำหนัก/ส่วนสูง เป็น 0 ถือว่าไม่มีข้อมูล ไม่ใช่คำตอบ', () => {
    // ล็อกพฤติกรรมที่ตั้งใจ — กันคนแก้เป็น `?? ` แล้วหน้าเว็บโชว์ "อายุ 0 ปี"
    expect(applicantFactLine({ age: 0, weight_kg: 0, height_cm: 0 })).toBe('');
  });

  it('ตัดหัวท้ายของข้อความที่คนกรอกมา', () => {
    expect(applicantFactLine({ education: '  ม.6  ' })).toBe('ม.6');
  });
});

describe('applicantAddressLine', () => {
  it('ที่อยู่ครบ → เว้นวรรคเดียวคั่น', () => {
    expect(
      applicantAddressLine({
        subdistrict: 'บางรัก',
        district: 'บางรัก',
        province: 'กรุงเทพมหานคร',
        postal_code: '10500',
      }),
    ).toBe('บางรัก บางรัก กรุงเทพมหานคร 10500');
  });

  it('มีบางส่วน → ไม่มีเว้นวรรคซ้อน', () => {
    const line = applicantAddressLine({ province: 'ชลบุรี', postal_code: '20000' });
    expect(line).toBe('ชลบุรี 20000');
    expect(line).not.toContain('  ');
  });

  it('ว่างหมด → สตริงว่าง', () => {
    expect(applicantAddressLine({})).toBe('');
    expect(applicantAddressLine({ province: '   ' })).toBe('');
  });
});
