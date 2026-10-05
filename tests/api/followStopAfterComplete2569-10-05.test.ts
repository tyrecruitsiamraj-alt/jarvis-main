/**
 * ปิดงานแล้ว server หยุดสายที่เหลือ (เจ้าของ 5 ต.ค. 2569 — วัดย้อน 30 วัน: ถึงแล้ว 56 · ไปแล้ว 55 · ยกเลิก 3 สายยังโดน AI โทรต่อ)
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(join(process.cwd(), 'api/_handlers/follow.ts'), 'utf8');
const complete = src.slice(src.indexOf('async function completeFollow'), src.indexOf('async function stopRemainingFollowRounds'));
const stop = src.slice(src.indexOf('async function stopRemainingFollowRounds'), src.indexOf('async function stopRemainingFollowRounds') + 4000);

describe('completeFollow → stopRemainingFollowRounds', () => {
  it('ทุกผล = วันนั้น · ทั้งชุดรับเฉพาะผลยกเลิก', () => {
    expect(complete).toContain("outcome === 'cancelled' && body?.stop_scope === 'set' ? 'set' : 'day'");
    expect(complete).toContain('stopRemainingFollowRounds(done, stopScope)');
    expect(complete).toContain('stopped_error: true');
  });
  it('เลือกพี่น้องชุดเดียวกัน (group_id / plan_ref) ที่ยังไม่ถึงเวลา · วันนั้น = วันเวลาไทยเดียวกัน · ถอนคิว+Lumos ด้วยตัวเดียวกับปุ่มยกเลิก', () => {
    expect(stop).toContain('f.scheduled_at > now()');
    expect(stop).toContain("timezone('Asia/Bangkok', f.scheduled_at)");
    expect(stop).toContain('cancelFollowReminder(sid, staffNameOfPhone)');
    expect(stop).toContain('[doneId, ...ids]');
  });
});
