/**
 * หน้าจับคู่งานเข้าชุดกับหน้าอื่น (เจ้าของ 1 พ.ย. 2569 Choice 3 ข้อ)
 * ชิปกรองหน้าตาเดียวกับโพสต์ประกาศ · สีชุดกลาง · ปุ่มกลาง · /matching พาไปจับคู่งาน · ตัวกรอง "ชนิดใบขอ"
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('src/pages/matching/MatchingPage.tsx', 'utf8');

describe('หน้าจับคู่งาน', () => {
  it('ชิปกรอง: เลขไม่ระบายสี + หน่วยใบ (แบบหน้าโพสต์ประกาศ)', () => {
    expect(page).toContain("`${c.count.toLocaleString('th-TH')} ใบ`");
    expect(page).not.toContain('TONE[c.tone].value');
  });
  it('ไม่มีสีดิบ · ขนาดตัวอักษรใช้สเกลกลาง', () => {
    expect(page).not.toMatch(/(text|bg|border)-(red|amber|emerald|sky|slate|orange|blue|green|rose|violet|teal|gray)-\d{2,3}/);
    expect(page).not.toMatch(/text-\[\d+px\]/);
  });
  it('ปุ่มเปลี่ยนหน้า/บันทึก/ยกเลิก ใช้ปุ่มกลาง', () => {
    for (const label of ['← ก่อนหน้า', 'ถัดไป →', 'ยืนยันและบันทึก', 'บันทึกเงื่อนไขและสาขา']) {
      const at = page.indexOf(label);
      expect(page.lastIndexOf('<Button', at)).toBeGreaterThan(page.lastIndexOf('<button', at));
    }
  });
  it('ปุ่มสถานะเสนอคน (ติดต่อแล้ว · จองตัว · ลงงานแล้ว · ไม่ผ่าน · ยกเลิกการจอง) ใช้ปุ่มกลาง · ที่ยังเป็น <button> มีแค่การ์ดคนทั้งใบ', () => {
    for (const st of ['contacted', 'reserved', 'placed', 'rejected']) {
      const at = page.indexOf(`openBoardProposalAction(jobDetail, candDetail, '${st}')`);
      expect(page.lastIndexOf('<Button', at)).toBeGreaterThan(page.lastIndexOf('<button', at));
    }
    expect(page).not.toContain('CANDIDATE_ACTION_BUTTON_CLASS');
    expect(page.match(/<button\b/g) ?? []).toHaveLength(1);
  });
  it('/matching พาไปหน้าจับคู่งาน · หน้าการ์ด 2 ใบถอดแล้ว', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).toContain('<Route path="/matching" element={<MatchingMovedRedirect view="match" />} />');
    expect(app).not.toContain('MatchingDashboard');
  });
  it('ตัวกรองโพสต์ประกาศ "ชนิดใบขอ"', () => {
    expect(readFileSync('src/lib/boardFilters.ts', 'utf8')).toContain("label: 'ชนิดใบขอ',");
  });
});
