import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/** เจ้าของ 16 พ.ย. 2569 "แก้ข้อ 1 กับ 3 เลย" — หัวการ์ดเรื่องที่ 3 ไม่มีเลข 5 · แท็บภาพรวมไม่โหลดประกาศของกล่องงาน */
describe('หน้าภาพรวม 8 เรื่อง: หัวการ์ด + เปิดหน้าเร็วขึ้น', () => {
  it('การ์ดโพสต์กลุ่มในหน้า 8 เรื่องใช้ชื่อเรื่อง ไม่ใช่ "5." ของโฉมก่อนหน้า', () => {
    const card = readFileSync('src/components/dashboard-trends/stuck/SoPostGroupsCard.tsx', 'utf8');
    expect(card).toContain("title = '5. โพสต์ลงกลุ่ม Facebook'");
    expect(card).toContain('title={title}');
    const topics = readFileSync('src/components/dashboard-trends/topics/RecruitTopicsView.tsx', 'utf8');
    expect(topics).toMatch(/<SoPostGroupsCard[^>]*title=\{TOPIC_TITLES\.fb\}/);
  });

  it('แท็บภาพรวม = ยังไม่ยิงประกาศทั้งก้อน · ไปแท็บอื่นแล้วโหลด', () => {
    const board = readFileSync('src/components/jobs/JobBoardView.tsx', 'utf8');
    expect(board).toContain("useState(view !== 'dashboard')");
    expect(board).toContain('if (!isStaff || !postingsWanted) return;');
    expect(board).toContain('[isStaff, postingsRev, postingsWanted]');
  });
});
