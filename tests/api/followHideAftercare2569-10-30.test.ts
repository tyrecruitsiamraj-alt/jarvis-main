/**
 * หน้าติดตาม: สายถามความเป็นอยู่หลังเริ่มงานไม่ขึ้นในแผน (เจ้าของ 30 ต.ค. 2569
 * "โทรติดตามหลังเริ่มงานไม่ต้องการให้โชว์อยู่ในแผนหน้าติดตามคนเริ่มใหม่ มันจะงง")
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('หน้าติดตามไม่โชว์สายหลังเริ่มงาน', () => {
  const page = readFileSync('src/pages/follow/FollowPage.tsx', 'utf8');
  it('ชุดของแท็บ (ปฏิทิน · แผน · ตัวเลข) ตัดหัวข้อหลังเริ่มงานออก', () => {
    expect(page).toContain('const scopeItems = useMemo(() => scopeAllItems.filter((e) => !isAftercareTopic(e.topic)), [scopeAllItems]);');
  });
  it('การ์ดติดตามครบยังได้ชุดเต็ม — ปุ่มตามต่อ/ไม่ตามต่อของรอบหลังเริ่มงานไม่หาย', () => {
    expect(page).toContain('groups={completedPeople}');
  });
});
