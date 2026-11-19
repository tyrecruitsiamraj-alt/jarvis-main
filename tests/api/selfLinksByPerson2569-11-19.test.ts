/**
 * แผงโพสต์เอง / สร้างลิงก์ — รู้ว่าใครทำ (เจ้าของ 19 พ.ย. 2569 "อันนี้จะรู้ได้ไงว่าใครเป็นคนทำ")
 * แล้วเปลี่ยนเป็นแบบรายชื่อเข้ามาไปถึงไหน (Choice กล่อง + ตารางกดไล่ลง) — ชั้นสุดท้ายของตาราง = ผู้รับผิดชอบ
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('แผงโพสต์เอง: ใครทำ', () => {
  it('ตารางกดไล่ลง ช่องทาง › กลุ่ม › ผู้รับผิดชอบ · ไม่มีตารางรายคน/กลุ่มแยกกันแล้ว · ตารางย้อนกลับหัว ผู้รับผิดชอบ', () => {
    const src = readFileSync('src/components/dashboard-trends/topics/SelfLinksPanel.tsx', 'utf8');
    expect(src).toContain('<TableHead>ช่องทาง › กลุ่ม › ผู้รับผิดชอบ</TableHead>');
    expect(src).toContain('linkTreeChildren(shown, prefix)');
    expect(src).not.toContain("totalsTable('แยกรายคน'");
    expect(src).not.toContain('คนสร้างลิงก์</TableHead>');
    expect(src).toContain('<TableHead>ผู้รับผิดชอบ</TableHead>');
  });
});
