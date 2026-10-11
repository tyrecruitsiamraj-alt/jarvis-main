/** QA รอบ 2 ข้อ 20 (12 ต.ค. 2569) — เลือกชื่อจาก ERP: ค้นล้มยังโชว์ผลเก่า · เลือกแล้วไม่เติมหน่วยงาน · รายการกว้างเกินกล่อง */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const picker = readFileSync('src/components/follow/ErpPersonPicker.tsx', 'utf8');
const page = readFileSync('src/pages/follow/FollowPage.tsx', 'utf8');

describe('เลือกชื่อจาก ERP', () => {
  it('ค้นล้ม = ล้างผลเก่าก่อนบอกเหตุ', () => {
    expect(picker).toMatch(/setPeople\(null\);\s*setError\(friendlyErrorText\(e, 'ค้นรายชื่อไม่สำเร็จ'\)\)/);
  });
  it('แถวตัดบรรทัดในกล่อง', () => {
    expect(picker).toContain('whitespace-normal break-words');
  });
  it('เลือกแล้วเติมหน่วยงาน (ช่องว่างเท่านั้น) · รหัสไซต์เมื่อชื่อตรงหน่วยเดียว', () => {
    expect(page).toContain("if (site && !unitName.trim()) {");
    expect(page).toContain("setSiteCode(hits.length === 1 ? hits[0].siteCode : '');");
  });
});
