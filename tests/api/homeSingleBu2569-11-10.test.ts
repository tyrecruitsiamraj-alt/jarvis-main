// @vitest-environment node
/**
 * ผู้ใช้ BU เดียวเห็นผู้สมัครบนหน้าหลัก (ตรวจทั้งระบบ 10 พ.ย. 2569 · เจ้าของเลือกแก้ข้อ 2)
 * หน้าส่ง bu=null แต่เซิร์ฟเวอร์ตอบ BU ที่ล็อกไว้ — เดิมเทียบ bu ตรง ๆ แล้วการ์ดผู้สมัคร/ขั้นผู้สมัคร/สถานะประกาศค้าง "กำลังโหลด"
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('หน้าหลัก: ผู้ใช้ BU เดียว', () => {
  it('รับ BU ที่เซิร์ฟเวอร์ล็อกไว้ (ไม่มีตัวเลือก BU) เมื่อหน้าส่ง bu=null', () => {
    const page = readFileSync('src/pages/HomeOverviewPage.tsx', 'utf8');
    expect(page).toContain('r.bu === bu || (bu === null && r.bu != null && !r.buChoices?.length)');
    expect(page).toContain('roBuOk(ro) ? ro : null');
  });
  it('เซิร์ฟเวอร์: ผู้ใช้ BU เดียวได้ bu = BU ของตัวเอง ไม่มีตัวเลือก', () => {
    const sql = readFileSync('api/_lib/homeBuSql.ts', 'utf8');
    expect(sql).toContain('if (!picked.choices) return { ...picked, buSet: picked.bu ? [picked.bu] :');
  });
});
