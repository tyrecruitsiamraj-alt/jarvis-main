// @vitest-environment node
/**
 * สวัสดิการที่ AI พูดได้ (15 ส.ค. 2569) — จุดที่ห้ามหลุด:
 * ตาราง st_request_p3_rate มีแถว "ค่าปรับขาดงาน / มาสาย / เงินชดเชย" ปนกับสวัสดิการ
 * ถ้าหลุดไปในบทพูด = AI บอกผู้สมัครว่า "งานนี้มีค่าปรับขาดงาน 533 บาท" ทันทีที่โทร
 * → whitelist เท่านั้น: รู้จักถึงพูด ไม่รู้จัก = เงียบ
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { requestNoFromJobRef, speakableBenefitLine,
  speakableBenefitChips } from '../../api/_lib/siamrajJobBenefits.js';

// ชุดจริงจากฐาน 15 ส.ค. (ใบ LMO6908004) — มีทั้งของพูดได้และห้ามพูดปนกัน
const REAL_ROWS = [
  { fee_name: 'นขฤ.ฟรี (ปกส.)', fee_rate: 410 },
  { fee_name: 'เงินชดเชยลาป่วย (ปกส)', fee_rate: 410 },
  { fee_name: 'เงินชดเชยพักร้อน (ปกส)', fee_rate: 410 },
  { fee_name: 'ค่าปรับขาดงาน (ตามอัตรา)', fee_rate: 410 },
  { fee_name: 'ค่าล่วงเวลา(สูตร)', fee_rate: 51.25 },
  { fee_name: 'ค่าล่วงเวลา 1.5 เท่า', fee_rate: 76.88 },
  { fee_name: 'ค่าล่วงเวลา 2.0 เท่า', fee_rate: 102.5 },
  { fee_name: 'ค่าล่วงเวลา 3.0 เท่า', fee_rate: 153.75 },
  { fee_name: 'ค่าเบี้ยขยัน', fee_rate: 13.64 },
  { fee_name: 'ค่ารถ/ค่าเดินทาง/TAXI', fee_rate: 30 },
  { fee_name: 'ค่าแทนงาน (ไซด์)', fee_rate: 550 },
];

describe('speakableBenefitLine — whitelist เท่านั้น', () => {
  it('ใบจริง: ได้โอทีชม.ละ (ปัดเต็ม) + เบี้ยขยัน + ค่าเดินทาง — ไม่มีค่าปรับ/ชดเชยหลุด', () => {
    const line = speakableBenefitLine(REAL_ROWS);
    expect(line).toContain('โอทีชั่วโมงละประมาณ 77 บาท');
    expect(line).toContain('เบี้ยขยัน');
    expect(line).toContain('ค่าเดินทาง');
    // 🔴 ของห้ามพูด — หลุดเมื่อไหร่คือหายนะทางโทรศัพท์
    expect(line).not.toContain('ปรับ');
    expect(line).not.toContain('ชดเชย');
    expect(line).not.toContain('มาสาย');
    expect(line).not.toContain('แทนงาน');
    expect(line).not.toContain('นขฤ');
  });

  it('ค่าโทรศัพท์/ค่ากะ/ค่าอาหาร/ค่าครองชีพ → บอกว่า "มี" (ไม่บอกเลข — หน่วยไม่แน่)', () => {
    const line = speakableBenefitLine([
      { fee_name: 'ค่าโทรศัพท์', fee_rate: 300 },
      { fee_name: 'ค่ากะ (ดึก)', fee_rate: 80 },
      { fee_name: 'ค่าอาหาร', fee_rate: 40 },
      { fee_name: 'ค่าครองชีพ', fee_rate: 66.67 },
    ]);
    expect(line).toContain('ค่าโทรศัพท์');
    expect(line).toContain('ค่ากะ');
    expect(line).toContain('ค่าอาหาร');
    expect(line).toContain('ค่าครองชีพ');
    expect(line).not.toContain('300');
    expect(line).not.toContain('80');
  });

  it('ไม่มีอะไรพูดได้ → คืนสตริงว่าง (ไม่พูดว่า "ไม่มี")', () => {
    expect(speakableBenefitLine([{ fee_name: 'ค่าปรับขาดงาน (ตามอัตรา)', fee_rate: 500 }])).toBe('');
    expect(speakableBenefitLine([])).toBe('');
  });

  it('อัตรา 0/ติดลบ ไม่นับว่ามี', () => {
    expect(speakableBenefitLine([{ fee_name: 'ค่าเบี้ยขยัน', fee_rate: 0 }])).toBe('');
    expect(speakableBenefitLine([{ fee_name: 'ค่าล่วงเวลา 1.5 เท่า', fee_rate: 0 }])).toBe('');
  });

  it('โอทีเลือกเฉพาะ 1.5 เท่า (หน่วยต่อชั่วโมงแน่นอน) — 2.0/3.0/สูตร ไม่เอาเลขมาปน', () => {
    const line = speakableBenefitLine([
      { fee_name: 'ค่าล่วงเวลา 2.0 เท่า', fee_rate: 102.5 },
      { fee_name: 'ค่าล่วงเวลา 3.0 เท่า', fee_rate: 153.75 },
    ]);
    expect(line).toBe(''); // ไม่มี 1.5 = ไม่พูดเรื่องโอที (กันเข้าใจผิดว่าเรตปกติ)
  });
});

describe('requestNoFromJobRef', () => {
  it('siamraj-sql:OPL6908026 → OPL6908026', () => {
    expect(requestNoFromJobRef('siamraj-sql:OPL6908026')).toBe('OPL6908026');
  });
  it('รูปอื่น → null (ใบขอฝั่งเราเอง/ขยะ ไม่ยิง ERP มั่ว)', () => {
    expect(requestNoFromJobRef('internal-123')).toBeNull();
    expect(requestNoFromJobRef('siamraj-sql:')).toBeNull();
    expect(requestNoFromJobRef('')).toBeNull();
  });
});

/**
 * 🔴 เจ้าของย้ำ 16 ส.ค. 2569: "โชว์อัตราจ่ายนะไม่ใช่อัตราเบิก"
 * `payment_rate` = จ่ายพนักงาน · `draw_rate` = เบิกลูกค้า — คนละเลขจริง ๆ
 * (วัดฐาน 16 ส.ค.: 309,977 แถว เบิกสูงกว่าจ่าย 154,362 · เบิกต่ำกว่าจ่าย 140,173)
 * หยิบผิดคอลัมน์ = บอกเลขผิดให้ผู้สมัคร + เผยราคาขายให้คนนอก
 */
describe('ห้ามหยิบอัตราเบิกมาใช้', () => {
  const src = fs.readFileSync(
    path.join(import.meta.dirname, '../../api/_lib/siamrajJobBenefits.ts'),
    'utf8',
  );

  it('คิวรีดึง payment_rate (อัตราจ่าย)', () => {
    expect(src).toContain('C.payment_rate as fee_rate');
  });

  it('ไม่มี draw_rate / draw_tor_percent อยู่ในคิวรีเลย', () => {
    const sqlOnly = src.slice(src.indexOf('SELECT'), src.indexOf('`,', src.indexOf('SELECT')));
    expect(sqlOnly).not.toMatch(/draw_rate/);
    expect(sqlOnly).not.toMatch(/draw_tor_percent/);
  });
});

/**
 * ชิปบนหน้าสมัครสาธารณะ (เจ้าของเคาะ 16 ส.ค. 2569 — "เอาเหมือนที่ AI พูด")
 * ⚠️ ต้องเดินตามกติกาเดียวกับประโยคเป๊ะ — สองจอพูดคนละเลข = เรื่องใหญ่
 */
describe('speakableBenefitChips — หน้าสาธารณะ', () => {
  it('โอที 1.5 บอกเลข (ปัดจำนวนเต็ม) · รายการอื่นบอกแค่ชื่อ', () => {
    expect(
      speakableBenefitChips([
        { fee_name: 'ค่าล่วงเวลา 1.5 เท่า', fee_rate: 76.88 },
        { fee_name: 'ค่าเบี้ยขยัน', fee_rate: 500 },
        { fee_name: 'ค่ารถ/ค่าเดินทาง/TAXI (อัตรา 1)', fee_rate: 50 },
      ]),
    ).toEqual(['โอที ~77 บาท/ชม.', 'เบี้ยขยัน', 'ค่าเดินทาง']);
  });

  it('ไม่มีอะไรพูดได้ = ชิปว่าง (ไม่ใช่ชิปว่า "ไม่มีสวัสดิการ")', () => {
    expect(speakableBenefitChips([{ fee_name: 'ค่าปรับขาดงาน (ตามจำนวนเงิน)', fee_rate: 500 }])).toEqual([]);
    expect(speakableBenefitChips([])).toEqual([]);
  });

  it('ห้ามหลุดรายการต้องห้าม — ค่าปรับ/มาสาย/ชดเชย/เงินเดือน', () => {
    const chips = speakableBenefitChips([
      { fee_name: 'ค่าปรับขาดงาน (ตามจำนวนเงิน)', fee_rate: 500 },
      { fee_name: 'ค่าปรับมาสาย (ตามอัตรา)', fee_rate: 50 },
      { fee_name: 'ชดเชยพักร้อน (ไม่ใช้แล้ว)', fee_rate: 400 },
      { fee_name: 'เงินเดือน (1)', fee_rate: 15000 },
      { fee_name: 'ค่าเบี้ยขยัน', fee_rate: 500 },
    ]);
    expect(chips).toEqual(['เบี้ยขยัน']);
  });

  it('โอที 2.0/3.0 ไม่โผล่เป็นตัวเลข (หน่วยไม่ชัดเท่า 1.5)', () => {
    expect(speakableBenefitChips([{ fee_name: 'ค่าล่วงเวลา 2.0 เท่า', fee_rate: 102.5 }])).toEqual([]);
  });

  it('parity กับประโยคที่ AI พูด — มีชิป ⟺ มีประโยค (สองจอห้ามพูดคนละเรื่อง)', () => {
    const cases = [
      [{ fee_name: 'ค่าล่วงเวลา 1.5 เท่า', fee_rate: 76.88 }],
      [{ fee_name: 'ค่าเบี้ยขยัน', fee_rate: 500 }],
      [{ fee_name: 'ค่าปรับขาดงาน (ตามจำนวนเงิน)', fee_rate: 500 }],
      [{ fee_name: 'ค่าโทรศัพท์', fee_rate: 0 }],
      [],
    ];
    for (const rates of cases) {
      expect(speakableBenefitChips(rates).length > 0).toBe(speakableBenefitLine(rates) !== '');
    }
  });

  it('อัตรา 0 = ไม่มีจริง ไม่นับ (ทั้งชิปและประโยค)', () => {
    expect(speakableBenefitChips([{ fee_name: 'ค่าเบี้ยขยัน', fee_rate: 0 }])).toEqual([]);
  });
});
