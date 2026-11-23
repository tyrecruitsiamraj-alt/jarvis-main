/**
 * ผู้สมัครจาก Scrap ที่ซ่อนชื่อบน JobThai (เจ้าของ 23 พ.ย. 2569) — ขึ้น "ผู้สมัครซ่อนชื่อ" แทน "ไม่มีชื่อ"
 * So Scraping เพิ่ม `"so-candidate-data".candidates.name_hidden` (ค่าเริ่ม false)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCRAP_NAME_HIDDEN, SCRAP_NAME_MISSING, scrapDisplayName } from '@/lib/scrapCandidates';

describe('ชื่อที่ขึ้นบนจอ', () => {
  it('ไม่มีชื่อ + ซ่อนชื่อ = ผู้สมัครซ่อนชื่อ · ไม่มีชื่อแบบอื่น = ไม่มีชื่อ · มีชื่อ = ชื่อเดิมเสมอ', () => {
    expect(scrapDisplayName(null, null, null, true)).toBe('ผู้สมัครซ่อนชื่อ');
    expect(scrapDisplayName('  ', '', null, true)).toBe(SCRAP_NAME_HIDDEN);
    expect(scrapDisplayName(null, null, null, false)).toBe('ไม่มีชื่อ');
    expect(scrapDisplayName(null, null, null, null)).toBe(SCRAP_NAME_MISSING);
    expect(scrapDisplayName('สมมติ ทดสอบ', null, null, true)).toBe('สมมติ ทดสอบ');
    expect(scrapDisplayName(null, 'ตัวอย่าง', 'ระบบ', false)).toBe('ตัวอย่าง ระบบ');
  });

  it('ฝั่งเซิร์ฟเวอร์อ่าน name_hidden แบบกันฐานที่ยังไม่มีคอลัมน์ และใช้ชื่อชุดเดียวทั้งจอและตอนเก็บเข้าการติดต่อ', () => {
    const src = readFileSync('api/_lib/scrapCandidates.ts', 'utf8');
    expect(src).toContain("coalesce((to_jsonb(c)->>'name_hidden')::boolean, false) as name_hidden");
    expect(src).toContain('const name = scrapDisplayName(r.full_name, r.first_name, r.last_name, r.name_hidden);');
    // เก็บเข้าการติดต่อ: ไม่มีชื่อแยก → ใช้ชื่อบนจอ (ผู้สมัครซ่อนชื่อ) ห้ามว่าง
    expect(src).toContain('first_name: name.first || row.full_name');
    expect(src).not.toContain("|| 'ไม่มีชื่อ'");
  });
});
