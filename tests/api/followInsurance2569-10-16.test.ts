/**
 * บรรทัดประกันแบบใบขอที่พิมพ์ (เจ้าของ 16 ต.ค. 2569 "อยากได้รายละเอียด แบบตามรูป" ·
 * "ตัวเลขมันก็ต้องตามกล่อง Checkbox ที่ติ๊กอะ")
 * 🔴 ข้อความ/ตัวเลขของ P/A มาจากช่องที่ติ๊กในใบขอ (`is_pa1..4`) เท่านั้น · อื่น ๆ = ข้อความที่ใบขอเขียนเอง
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PA_OPTION_TEXT, insuranceLines, paCoverage } from '../../src/lib/followInsurance';

const ROWS = [
  { name: 'รถ (ระบุทะเบียน)', whoPay1: 'ลูกค้าจ่าย', amount: 4000, remark: 'ประกันภัยชั้น 3+ และ พรบ. (ธนาคารฯเป็นผู้รับผิดชอบ)' },
  { name: 'P/A', whoPay1: 'SO.จ่าย', amount: 0, remark: 'งบประมาณ 1,200 บาท/คน/ปี' },
];

describe('บรรทัดประกันตามรูปใบขอ (OPL6910047)', () => {
  it('ประเภท · ใครจ่าย · ยอด/ครั้ง · หมายเหตุ + ความคุ้มครอง P/A ที่ติ๊ก (ข้อ 4)', () => {
    expect(insuranceLines(ROWS, { is_pa1: 'N', is_pa2: 'N', is_pa3: 'N', is_pa4: 'Y', is_pa99: 'N' })).toEqual([
      'รถ (ระบุทะเบียน) · ลูกค้าจ่าย · 4,000 บาท/ครั้ง · ประกันภัยชั้น 3+ และ พรบ. (ธนาคารฯเป็นผู้รับผิดชอบ)',
      'P/A · SO.จ่าย · งบประมาณ 1,200 บาท/คน/ปี',
      'P/A คุ้มครอง: กรณีเสียชีวิตจากอุบัติเหตุ จำนวนเงินเอาประกันอุบัติเหตุ 200,000 บาท กรณีเสียชีวิตอื่น ๆ ไม่ใช่เนื่องจากอุบัติเหตุ จำนวนเงินเอาประกันชีวิต 100,000 บาท และมีค่ารักษาพยาบาลเนื่องจากอุบัติเหตุ 20,000 บาท/ครั้ง',
    ]);
  });
});

describe('🔴 ตัวเลขตามช่องที่ติ๊ก', () => {
  it('ติ๊กข้อไหน ขึ้นข้อนั้น (ตัวเลขของข้อนั้น) · ไม่ติ๊ก = ไม่ขึ้นความคุ้มครอง', () => {
    expect(paCoverage({ is_pa1: 'Y' })).toEqual([PA_OPTION_TEXT[1]]);
    expect(PA_OPTION_TEXT[1]).toContain('100,000 บาท');
    expect(paCoverage({ is_pa2: 'Y' })).toEqual([PA_OPTION_TEXT[2]]);
    expect(PA_OPTION_TEXT[2]).toContain('200,000 บาท');
    expect(paCoverage({ is_pa3: 'Y' })).toEqual([PA_OPTION_TEXT[3]]);
    expect(PA_OPTION_TEXT[3]).toContain('20,000 บาท/ครั้ง');
    expect(paCoverage({ is_pa1: 'N', is_pa2: 'N', is_pa3: 'N', is_pa4: 'N', is_pa99: 'N' })).toEqual([]);
    expect(insuranceLines(ROWS, null).some((l) => l.startsWith('P/A คุ้มครอง'))).toBe(false);
  });

  it('ติ๊กหลายข้อ = ขึ้นครบตามลำดับแบบฟอร์ม · อื่น ๆ = ข้อความที่ใบขอเขียน ("ไมมี" ไม่ขึ้น)', () => {
    const remark = 'กรณีเสียชีวิตจากอุบัติเหตุ จำนวนเงินเอาประกันอุบัติเหตุ 150,000 บาท';
    expect(paCoverage({ is_pa3: 'Y', is_pa1: 'Y', is_pa99: 'Y', pa99_remark: remark })).toEqual([PA_OPTION_TEXT[1], PA_OPTION_TEXT[3], remark]);
    expect(paCoverage({ is_pa99: 'Y', pa99_remark: 'ไมมี' })).toEqual([]);
  });

  it('ติ๊กไว้แต่ใบขอไม่มีแถว P/A — ยังบอกความคุ้มครอง · ยอด 0 ไม่ขึ้น "0 บาท/ครั้ง"', () => {
    const lines = insuranceLines([ROWS[0]], { is_pa2: 'Y' });
    expect(lines[1]).toBe(`P/A คุ้มครอง: ${PA_OPTION_TEXT[2]}`);
    expect(insuranceLines([ROWS[1]])[0]).not.toContain('0 บาท/ครั้ง');
  });
});

describe('ต่อจริง', () => {
  it('อ่านใครจ่าย/ยอด/ช่องติ๊กจาก ERP · ช่องในฟอร์มหลายบรรทัด 1500 ตัวอักษร', () => {
    const src = readFileSync('api/_lib/followUnitInfo.ts', 'utf8');
    expect(src).toContain('left join st_ms_who_pay w1 on w1.who_pay_code = g.who_pay_code1');
    expect(src).toContain('select top 1 is_pa1, is_pa2, is_pa3, is_pa4, is_pa99, pa99_remark from st_request_p2');
    const page = readFileSync('src/pages/follow/FollowPage.tsx', 'utf8');
    expect(page).toContain("setInsuranceType(info.insurance.join('\\n'));");
    expect(page).toMatch(/<Textarea\s+id="followInsurance"[\s\S]{0,120}maxLength=\{1500\}/);
  });
});
