/**
 * ขั้น 4 ฟอร์มเพิ่มคนติดตาม (เจ้าของ 16 ต.ค. 2569)
 * > *"ประเภทประกัน ทำเป็น Dropdown ดังนี้ ขอหน้า Ui ไว้เพิ่มในอนาคตด้วย ณ ตอนนี้เอาแค่นี้"*
 * > *"ไม่เอาดึงจากเงื่อนไซด์แล้ว"* · *"ลูกค้า ขอพิมพ์ชื่อ-เบอร์โทรเอง ไม่ต้องดึงมาและ"*
 *
 * - ประกัน = dropdown 4 แบบ (PA · PA+PL · PA+PL+ทิพยะ · PA+ทิพยะ) จากตาราง 149 · เพิ่มได้ที่ ตั้งค่าตัวเลือก (supervisor+)
 * - ไม่ดึงประกัน/ลูกค้าจาก ERP แล้ว (ถอดเส้น /api/follow-unit-info)
 * - ค่าเก่าที่ไม่อยู่ในลิสต์ยังเลือกค้างได้ ไม่ถูกล้างเงียบ ๆ
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FOLLOW_INSURANCE_TYPES,
  isUndefinedTable,
  parseInsuranceTypeInput,
} from '../../api/_lib/followInsuranceTypes';
import { insuranceTypeOptions } from '../../src/lib/followInsuranceTypesApi';

const read = (p: string) => readFileSync(p, 'utf8');

describe('รายการตั้งต้น 4 แบบตามที่เจ้าของสั่ง', () => {
  it('ลำดับตรงกันทั้งค่าสำรองในโค้ดและ seed ของ migration 149', () => {
    expect([...DEFAULT_FOLLOW_INSURANCE_TYPES]).toEqual(['PA', 'PA+PL', 'PA+PL+ทิพยะ', 'PA+ทิพยะ']);
    const sql = read('migrations/149_follow_insurance_types.sql');
    for (const [i, name] of DEFAULT_FOLLOW_INSURANCE_TYPES.entries()) {
      expect(sql).toContain(`('${name}', ${(i + 1) * 10}, 'ชุดตั้งต้นของระบบ')`);
    }
    expect(sql).toContain('on follow_insurance_types (lower(trim(name)))');
  });

  it('ฐานยังไม่รัน 149 (42P01) = ถอยไปใช้ชุดตั้งต้น · dropdown ไม่ว่าง', () => {
    expect(isUndefinedTable({ code: '42P01' })).toBe(true);
    expect(isUndefinedTable({ code: '23505' })).toBe(false);
  });
});

describe('เพิ่มประเภทใหม่ (POST)', () => {
  it('ตัดช่องว่าง · ว่าง = ไม่ผ่าน · ยาวเกิน 80 = ไม่ผ่าน', () => {
    expect(parseInsuranceTypeInput({ name: '  PA +  PL ' }).value).toEqual({ name: 'PA + PL' });
    expect(parseInsuranceTypeInput({ name: '   ' }).error).toBe('กรุณากรอกประเภทประกัน');
    expect(parseInsuranceTypeInput({ name: 'ก'.repeat(81) }).error).toContain('ยาวเกินไป');
    expect(parseInsuranceTypeInput(null).error).toBe('Invalid JSON body');
  });

  it('สิทธิ์: อ่านทุกคน · เพิ่มเฉพาะหัวหน้างานขึ้นไป (ชุดเดียวกับเรื่องที่ให้โทรติดตาม) · ชื่อซ้ำ = 409', () => {
    const rbac = read('api/_lib/rbac.ts');
    expect(rbac).toMatch(/case 'follow-topics':\s*case 'follow-insurance-types':/);
    const handler = read('api/_handlers/follow-insurance-types.ts');
    expect(handler).toContain("withRbac(handler, 'follow-insurance-types')");
    expect(handler).toContain("sendError(res, 409, 'Conflict', 'ประเภทประกันนี้มีอยู่ในลิสต์แล้ว')");
  });
});

describe('ฟอร์มขั้น 4', () => {
  const page = read('src/pages/follow/FollowPage.tsx');

  it('ประกันเป็น dropdown (FieldSelect) ไม่ใช่ช่องพิมพ์ · มีตัวเลือก "ไม่ระบุ"', () => {
    expect(page).toMatch(/<FieldSelect\s+id="followInsurance"/);
    expect(page).not.toMatch(/<Textarea\s+id="followInsurance"/);
    // 19 ต.ค. 2569: "ไม่ระบุ" เหลือเฉพาะส่งคนแทน — ติดตามคนเริ่มงานต้องเลือกประกัน
    expect(page).toContain("...(replaceView ? [{ value: '', label: 'ไม่ระบุ' }] : []),");
  });

  it('🔴 ไม่ดึงประกัน/ลูกค้าจาก ERP แล้ว · ช่องลูกค้าพิมพ์เอง', () => {
    expect(page).not.toContain('fetchFollowUnitInfo');
    expect(page).not.toContain('กำลังดึงจาก ERP');
    expect(page).not.toMatch(/setCustomerName\(info\./);
    expect(page).toContain('onChange={(e) => setCustomerName(e.target.value)}');
    expect(page).toContain('onChange={(e) => setCustomerPhone(e.target.value)}');
  });

  it('ตั้งค่าตัวเลือก › เพิ่มประเภทประกัน เปิดป๊อปจัดการรายการ แล้วโหลดตัวเลือกใหม่', () => {
    expect(page).toContain('<Plus aria-hidden /> เพิ่มประเภทประกัน');
    expect(page).toMatch(/<FollowMasterManagerDialog<FollowInsuranceType>[\s\S]*?onChanged=\{\(\) => setInsuranceTypesRev\(\(r\) => r \+ 1\)\}/);
  });

  it('ค่าเก่าที่ไม่อยู่ในลิสต์ (เช่นบรรทัดที่เคยดึงจาก ERP) ยังอยู่ในตัวเลือก ไม่ถูกล้าง', () => {
    const types = DEFAULT_FOLLOW_INSURANCE_TYPES.map((name) => ({ name }));
    expect(insuranceTypeOptions(types, 'PA+PL')).toEqual([...DEFAULT_FOLLOW_INSURANCE_TYPES]);
    expect(insuranceTypeOptions(types, 'P/A · SO.จ่าย')).toEqual([...DEFAULT_FOLLOW_INSURANCE_TYPES, 'P/A · SO.จ่าย']);
    expect(insuranceTypeOptions(types, '')).toEqual([...DEFAULT_FOLLOW_INSURANCE_TYPES]);
  });
});
