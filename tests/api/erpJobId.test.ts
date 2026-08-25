// @vitest-environment node
/**
 * `isErpJobId` — ด่านที่ตัดสินว่า id ไปคิวรี ERP หรือตารางฝั่งเรา
 *
 * 🔴 ทำไมต้องมีเทสต์: เดิมแต่ละ handler เขียน `startsWith` เองแล้ว **ลืมใบล่วงหน้า
 * (`siamraj-pre:`) ทุกที่** → id ใบล่วงหน้าหลุดไปคิวรีตาราง `jarvis_rm.*` ที่คีย์เป็น uuid
 * แล้ว **ตาย 500** (ไม่ใช่ 404 ที่อ่านรู้เรื่อง) · เจอตอนแก้บั๊ก pre:/sql: 23 ส.ค. 2569
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isErpJobId } from '../../api/_lib/siamrajUnitRequests.js';

describe('isErpJobId', () => {
  it('รับ prefix ทั้งสามแบบที่ระบบสร้างจริง', () => {
    expect(isErpJobId('siamraj-sql:OPL6908001')).toBe(true);
    expect(isErpJobId('siamraj-pre:LBM6908001')).toBe(true);
    expect(isErpJobId('siamraj:12345')).toBe(true);
  });

  it('เว้นวรรคหน้า-หลังไม่ทำให้หลุด', () => {
    expect(isErpJobId('  siamraj-pre:LBM6908001  ')).toBe(true);
  });

  it('uuid ของฝั่งเราไม่ใช่ ERP', () => {
    expect(isErpJobId('4ca893dc-ae01-4955-be35-3afbf2ce653a')).toBe(false);
    expect(isErpJobId('')).toBe(false);
    expect(isErpJobId('OPL6908001')).toBe(false);
  });

  it('คำที่ขึ้นต้นคล้ายกันแต่ไม่มี : ไม่นับ', () => {
    expect(isErpJobId('siamrajsomething')).toBe(false);
  });
});

describe('handler ที่แตะ id ใบขอต้องใช้ตัวกลางนี้ (ห้ามเช็ค prefix เอง)', () => {
  const files = ['api/_handlers/jobs.ts', 'api/_handlers/job-assignments.ts'];

  it.each(files)('%s ใช้ isErpJobId ไม่ใช่ startsWith เอง', (f) => {
    const src = readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).toContain('isErpJobId');
    // 🔴 เช็ค prefix เอง = ลืมใบล่วงหน้าอีกรอบ
    expect(code).not.toMatch(/startsWith\('siamraj/);
  });
});
