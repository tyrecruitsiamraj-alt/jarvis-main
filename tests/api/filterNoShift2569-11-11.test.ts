// @vitest-environment node
/**
 * ติ๊กตัวกรองแล้วปุ่มห้ามเลื่อน (เจ้าของ 11 พ.ย. 2569 "ปุ่มมันขยับ … เม้าต้องขยับตามเพื่อกดอีกรอบ ไม่เอาแบบนี้")
 * วัดบนจอก่อนแก้: ติ๊กแรก ตัวเลือกเลื่อนลง 7px (ป้ายเลขบนหัวข้อสูง 24.5 > ตัวหนังสือ 18) + บรรทัด "เหลือ N รายชื่อ" โผล่ดันลงอีกบรรทัด
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const panel = readFileSync('src/components/jobs/BoardFilterPanel.tsx', 'utf8');

describe('แถบตัวกรองไม่เลื่อนตอนติ๊ก', () => {
  it('หัวข้อจองความสูงเท่าป้ายเลข', () => {
    expect(panel.match(/<span className="flex min-h-6 items-center gap-2">/g)).toHaveLength(2);
  });
  it('บรรทัดผลลัพธ์จองที่ไว้เสมอ ยังไม่ติ๊ก = ซ่อนตัวหนังสือ ไม่ถอดบรรทัด', () => {
    expect(panel).toContain("selected === 0 && 'invisible'");
    expect(panel).not.toContain('{selected > 0 && resultText ?');
  });
});
