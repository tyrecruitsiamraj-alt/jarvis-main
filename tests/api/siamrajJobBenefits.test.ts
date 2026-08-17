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
  speakableBenefitChips,
  monthlyGuaranteedIncome,
  toMonthlyAmount,
  DAYS_PER_MONTH } from '../../api/_lib/siamrajJobBenefits.js';

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

  it("ตัดฝั่งหักที่ต้นทาง SQL ด้วย what_side <> '2' (ชั้นที่ 1 · เจ้าของสั่ง 'พวกหักๆ ไม่ต้องโชว์')", () => {
    expect(src).toContain(`RTRIM(ISNULL(F.what_side, '')) <> '2'`);
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

/**
 * รายได้ต่อเดือน (เจ้าของสั่ง 16 ส.ค. 2569: "เงินเดือน + รายได้มั่นคง เอาเป็นรายเดือนมาเลย")
 *
 * พังเงียบที่คุมไว้:
 * - นับเงินเดือนสองรอบ (แถว M กับแถว D คือเงินก้อนเดียวกัน 16000 ↔ 533.33)
 * - เอาโอที/เบี้ยเลี้ยง/เบี้ยขยัน มาบวก ทั้งที่ไม่การันตี → ประกาศสัญญาเกินจริง
 * - ค่าแรงรายวันไม่ถูกคูณ 30 → ประกาศโชว์ "฿410" ทั้งที่เป็นค่าแรงต่อวัน (เจอจริง 20/200 ใบ)
 */
describe('monthlyGuaranteedIncome', () => {
  const wageM = { fee_name: 'เงินเดือน', fee_rate: 16000, unit: 'M', is_wage: true };
  const wageDup = { fee_name: 'เงินเดือน', fee_rate: 533.33, unit: 'D', is_wage: false };

  it('ฐานต่อเดือน + รายได้มั่นคงต่อวัน × 30', () => {
    const out = monthlyGuaranteedIncome([
      wageM,
      { fee_name: 'ค่าครองชีพ', fee_rate: 66.67, unit: 'D', is_wage: false },
    ]);
    expect(out.base).toBe(16000);
    expect(out.items).toEqual([{ label: 'ค่าครองชีพ', monthly: 2000 }]);
    expect(out.total).toBe(18000);
  });

  it('🔴 ไม่นับเงินเดือนซ้ำ — แถวเงินเดือนหน่วยวันคือเงินก้อนเดียวกับค่าแรงหลัก', () => {
    const out = monthlyGuaranteedIncome([wageM, wageDup]);
    expect(out.total).toBe(16000);
    expect(out.items).toEqual([]);
  });

  it('ค่าแรงรายวัน (is_wage + หน่วย D) ต้องคูณ 30 — ของจริง 410/วัน = 12,300/เดือน', () => {
    const out = monthlyGuaranteedIncome([{ fee_name: 'ค่าแรง', fee_rate: 410, unit: 'D', is_wage: true }]);
    expect(out.base).toBe(12300);
    expect(out.total).toBe(12300);
  });

  it('ไม่นับของที่ไม่การันตี — โอที เบี้ยขยัน เบี้ยเลี้ยง ค่ากะ นักขัตฤกษ์ รางวัลพิเศษ', () => {
    const out = monthlyGuaranteedIncome([
      wageM,
      { fee_name: 'ค่าล่วงเวลา 1.5 เท่า', fee_rate: 100, unit: 'H', is_wage: false },
      { fee_name: 'ค่าเบี้ยขยัน', fee_rate: 66.67, unit: 'D', is_wage: false },
      { fee_name: 'เบี้ยเลี้ยงค้างคืน', fee_rate: 500, unit: 'D', is_wage: false },
      { fee_name: 'ค่ากะ (ดึก)', fee_rate: 200, unit: 'D', is_wage: false },
      { fee_name: 'ค่าทำงานวันนักขัตฤกษ์', fee_rate: 600, unit: 'D', is_wage: false },
      { fee_name: 'เงินรางวัลพิเศษ', fee_rate: 4500, unit: 'T', is_wage: false },
    ]);
    expect(out.total).toBe(16000);
    expect(out.items).toEqual([]);
  });

  it('ไม่นับเงินชดเชยวันลา (ปกส) — เป็นอัตราตอนลา ไม่ใช่รายได้เพิ่ม', () => {
    const out = monthlyGuaranteedIncome([
      wageM,
      { fee_name: 'เงินชดเชยลาป่วย (ปกส)', fee_rate: 533.33, unit: 'D', is_wage: false },
      { fee_name: 'เงินชดเชยพักร้อน (ปกส)', fee_rate: 533.33, unit: 'D', is_wage: false },
    ]);
    expect(out.total).toBe(16000);
  });

  it('กลุ่มเดียวกันหลายแถว = เอาก้อนมากสุด ไม่บวกกัน (เรตเดียวตั้งไว้หลายแบบ)', () => {
    const out = monthlyGuaranteedIncome([
      wageM,
      { fee_name: 'ค่ารถ/ค่าเดินทาง/TAXI', fee_rate: 50, unit: 'D', is_wage: false },
      { fee_name: 'ค่ารถ/ค่าเดินทาง/TAXI (อัตรา 1)', fee_rate: 60, unit: 'D', is_wage: false },
    ]);
    expect(out.items).toEqual([{ label: 'ค่าเดินทาง', monthly: 1800 }]);
  });

  it('ไม่มีแถวค่าแรงหลัก = total 0 (ห้ามเดา — ผู้เรียกถอยไปใช้เลขเดิม)', () => {
    expect(monthlyGuaranteedIncome([]).total).toBe(0);
    expect(
      monthlyGuaranteedIncome([{ fee_name: 'ค่าครองชีพ', fee_rate: 66.67, unit: 'D', is_wage: false }]).total,
    ).toBe(0);
  });

  it('หน่วยที่แปลงเป็นรายเดือนไม่ได้ = null (ไม่เดา)', () => {
    expect(toMonthlyAmount(100, 'H')).toBeNull();
    expect(toMonthlyAmount(2000, 'T')).toBeNull();
    expect(toMonthlyAmount(100, '')).toBeNull();
    expect(toMonthlyAmount(0, 'M')).toBeNull();
    expect(toMonthlyAmount(16000, 'M')).toBe(16000);
    expect(toMonthlyAmount(100, 'd')).toBe(3000);
  });

  it('ยอดรวมต้องเท่ากับฐาน + รายการย่อยเสมอ (ไม่มีเลขโผล่จากไหนไม่รู้)', () => {
    const out = monthlyGuaranteedIncome([
      wageM,
      { fee_name: 'ค่าครองชีพ', fee_rate: 66.67, unit: 'D', is_wage: false },
      { fee_name: 'ค่าโทรศัพท์', fee_rate: 10, unit: 'D', is_wage: false },
      { fee_name: 'ค่าตำแหน่ง', fee_rate: 200, unit: 'D', is_wage: false },
    ]);
    expect(out.total).toBe(out.base + out.items.reduce((s, i) => s + i.monthly, 0));
  });

  it('DAYS_PER_MONTH = 30 (ตรงกับ fee_divide ที่ ERP ใช้เอง)', () => {
    expect(DAYS_PER_MONTH).toBe(30);
  });
});
