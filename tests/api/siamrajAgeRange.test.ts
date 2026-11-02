import { describe, it, expect } from 'vitest';
import { parseAgeRange } from '../../api/_lib/siamrajJobMapping.js';

/**
 * ช่วงอายุจากคอลัมน์ `age` ของ ERP (ข้อความอิสระ)
 *
 * เคสจริง 2 พ.ย. 2569: LAM6909001 มีอายุเป็นเลขเดียว เดิมตีเป็น 20–20
 * So Scraping จึงคัดคนตกเพราะอายุ 21 จาก 60 คน — เลขเดียวต้องเป็นขอบล่างเท่านั้น
 */
describe('parseAgeRange', () => {
  it('ช่วงเต็มได้ทั้งสองขอบ', () => {
    expect(parseAgeRange('20-55')).toEqual({ min: 20, max: 55 });
    expect(parseAgeRange('อายุ 22 – 45 ปี')).toEqual({ min: 22, max: 45 });
  });

  it('เลขเดียวเป็นขอบล่าง ไม่ใช่ช่วงปิด', () => {
    expect(parseAgeRange('20')).toEqual({ min: 20 });
    expect(parseAgeRange('20 ปี')).toEqual({ min: 20 });
    expect(parseAgeRange('20 ปีขึ้นไป')).toEqual({ min: 20 });
    expect(parseAgeRange('20')).not.toHaveProperty('max');
  });

  it('คำว่าไม่เกินทำให้เลขเดียวเป็นเพดาน', () => {
    expect(parseAgeRange('ไม่เกิน 45 ปี')).toEqual({ max: 45 });
    expect(parseAgeRange('ต่ำกว่า 50')).toEqual({ max: 50 });
  });

  it('ว่างหรือไม่มีตัวเลข = ไม่ระบุ', () => {
    expect(parseAgeRange('')).toEqual({});
    expect(parseAgeRange(null)).toEqual({});
    expect(parseAgeRange('ไม่จำกัด')).toEqual({});
  });
});
