/**
 * แผงโพสต์เอง / สร้างลิงก์ — รายคนขึ้นก่อนกลุ่ม (เจ้าของ 19 พ.ย. 2569 "อันนี้จะรู้ได้ไงว่าใครเป็นคนทำ")
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('แผงโพสต์เอง: ใครทำ', () => {
  it('ตาราง แยกรายคน (ผู้รับผิดชอบ) อยู่ก่อน แยกกลุ่ม / ช่องทาง · ตารางย้อนกลับใช้หัว ผู้รับผิดชอบ', () => {
    const src = readFileSync('src/components/dashboard-trends/topics/SelfLinksPanel.tsx', 'utf8');
    const person = src.indexOf("totalsTable('แยกรายคน', people, 'ผู้รับผิดชอบ')");
    const group = src.indexOf("totalsTable('แยกกลุ่ม / ช่องทาง', groups, 'กลุ่ม / ช่องทาง')");
    expect(person).toBeGreaterThan(0);
    expect(person).toBeLessThan(group);
    expect(src).not.toContain('คนสร้างลิงก์</TableHead>');
  });
});
