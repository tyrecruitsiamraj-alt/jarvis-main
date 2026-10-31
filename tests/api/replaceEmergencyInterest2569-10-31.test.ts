/**
 * เบอร์ฉุกเฉินงานส่งคนแทน = คนกด "ความสนใจ" ใน iRecruit (เจ้าของ 31 ต.ค. 2569)
 * *"ดูว่าใครเป็นคนกด มันเหมือนเป็นคนปิดงาน ต้องใช้คนนั้นในการโทรเบอร์ฉุกเฉิน ไม่ใช่คนเปิดงานแล้ว"*
 * Choice: ยังไม่กด = คนเปิดใบไปก่อน · รายชื่อให้ AI โทรมาก่อน · สายเดิมเปลี่ยนเป็นคนกด + ส่งแผนใหม่
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync('api/_lib/irecruitReplaceSync.ts', 'utf8');

describe('คนกดความสนใจ', () => {
  it('อ่านขั้นที่ 2 ของใบที่ลงสถานะแล้ว (W = ยังไม่กด ช่องคนยังเป็นคนเปิดใบ)', () => {
    expect(src).toContain("LTRIM(RTRIM(it.item_level)) = '2' AND ISNULL(it.item_status, 'W') <> 'W'");
    expect(src).toContain('COALESCE(iu.email, ia.email) AS interest_email');
  });

  it('ลำดับเบอร์: รายชื่อให้ AI โทร → คนกดความสนใจ → คนแก้ใบล่าสุด → คนเพิ่มแผน', () => {
    const at = src.indexOf('listed?.emergency ??');
    const block = src.slice(at, at + 400);
    const order = ['listed?.emergency', 'r.interest_email', 'r.updater_email', 'r.adder_email'].map((k) => block.indexOf(k));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('สายเดิมที่ระบบตั้ง: เบอร์ไม่ตรง = เปลี่ยน · สายที่เจ้าหน้าที่แก้เองไม่แตะ · สาย AI ที่ส่งแล้วส่งแผนใหม่', () => {
    expect(src).toContain('or (f.updated_by is null and f.scheduled_at > $3::timestamptz');
    expect(src).toContain("right(regexp_replace(f.staff_phone, '\\\\D', '', 'g'), 9) <> right(regexp_replace(v.phone, '\\\\D', '', 'g'), 9)");
    expect(src).toContain('replanFollowSetWithLumos({ memberIds: replan, cancelledIds: [], resolveStaffName: staffNameOfPhone })');
  });
});
