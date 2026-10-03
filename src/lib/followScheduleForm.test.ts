/**
 * ฟอร์มเพิ่ม · โหมด "ตารางหลายวัน" (เจ้าของ Choice 1 ต.ค. 2569)
 * 🔴 ด่าน: หนึ่งสาย = หนึ่งแถว (สร้างผ่าน `buildScheduleCalls` ตัวเดียวกับสรุปบนจอ) · ส่งแผนละวันผ่าน `createFollowRounds` ·
 *    ช่อง "ไม่โทร" ต่อวัน · ตั้งเวลารายวันได้ · ไม่มีประโยค "รับสายยืนยันแล้ววันนั้นหยุด" (ของจริง AI โทรครบทุกสาย)
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const page = fs.readFileSync(path.resolve(__dirname, '..', 'pages/follow/FollowPage.tsx'), 'utf8');

describe('FollowPage — ตารางหลายวัน', () => {
  it('🔴 สายมาจาก buildScheduleCalls ตัวเดียว (สรุปบนจอ = สิ่งที่ส่ง) · ส่งแผนละวัน ไม่ใช่แถวละวัน', () => {
    expect(page).toContain('const scheduleCalls = (): ScheduleCall[] =>');
    // 3 ต.ค. 2569: loop เปลี่ยนรูปเป็นนับ index (บอกความคืบ "วันที่ 2/5" + วันล้มทำต่อ) — ยังส่งแผนละวันเหมือนเดิม
    expect(page).toMatch(/for \(const \[dayIdx, \{ day, calls: dayCalls \}\] of byDay\.entries\(\)\)/);
    expect(page).toContain('const byDay = scheduleCallsByDay(sendCalls);');
    expect(page).toContain('rounds: dayCalls.map((c) => ({');
    expect(page).not.toContain('createFollowEntry(');
    expect(page).not.toMatch(/call_times:\s*rounds/);
  });

  it('🔴 วันที่ล้มห้ามพาทั้งชุดล้ม (3 ต.ค. 2569 — "ลงแผนเป็นเดือนแล้วแผนหาย") · มีปุ่มลองใหม่เฉพาะวันที่ล้ม', () => {
    expect(page).toContain('failedDays.push(day);');
    expect(page).toContain('failedCalls.push(...dayCalls);');
    expect(page).toContain('ลองใหม่เฉพาะวันที่ไม่สำเร็จ');
    // ชุดใหญ่ใช้เวลานาน — ปุ่มบันทึกต้องบอกความคืบ ไม่ใช่ปล่อยให้จออ่านว่าค้าง
    expect(page).toMatch(/setSubmitProgress\(`วันที่ \$\{dayIdx \+ 1\}\/\$\{byDay\.length\}`\)/);
  });

  it('🔴 ช่องที่สามต่อวัน "ไม่โทร" (ข้ามวัน) อยู่คู่ AI โทร / คนโทร', () => {
    expect(page).toContain("{ value: 'ai', label: 'AI โทร'");
    expect(page).toContain("{ value: 'manual', label: 'คนโทร'");
    expect(page).toContain("{ value: 'off', label: 'ไม่โทร'");
  });

  it('🔴 ตั้งเวลารายวันได้ (สวิตช์) · เวลาของวันอ่านจากตัวเดียว', () => {
    expect(page).toContain("'ตั้งเวลารายวัน'");
    expect(page).toContain('const timesOfScheduleDay = (day: string): string[] =>');
    expect(page).toContain('timesByDay: perDayTimes');
  });

  it('ไม่มีประโยค "รับสายยืนยันแล้ววันนั้นหยุด พรุ่งนี้โทรต่อ" บนจอแล้ว (วัด 1 ต.ค.: AI โทรครบทุกสาย 51/51)', () => {
    expect(page).not.toMatch(/\{' · '\}รับสายยืนยันแล้ววันนั้นหยุด/);
  });
});
