// @vitest-environment node
/**
 * 🔴 แก้อะไรต้องไปแก้ที่ Lumos ด้วย (เจ้าของ 7 ต.ค. 2569 Journey ข้อ 3) — ช่องโหว่ที่ตรวจเจอ:
 * 1. เปลี่ยนเบอร์ทั้งชุด 30 วัน แต่ส่งแผนใหม่ให้ Lumos แค่วันเดียว
 * 2. แก้เบอร์/ชื่อที่สาย 2 ของวัน — แผน Lumos ใช้ของหัวขบวน (สาย 1) ⇒ Lumos ไม่เห็น
 * 3. เพิ่มสายจากป๊อปแก้ไข = POST ทีละสาย ⇒ ไม่มีชุด ไม่มีเลขสาย ยกเลิกทั้งชุดไม่โดน
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const handler = readFileSync(new URL('../../api/_handlers/follow.ts', import.meta.url), 'utf8');
const dialog = readFileSync(new URL('../../src/components/follow/FollowEditDialog.tsx', import.meta.url), 'utf8');

describe('แก้แล้ว Lumos ต้องรู้ทุกแผน', () => {
  it('เปลี่ยนเบอร์/ชื่อ = สายอื่นในแผนเดียวกันเปลี่ยนตาม', () => {
    expect(handler).toContain('if (phoneChanged || nameChanged)');
    expect(handler).toContain('samePlanIds = mates.map((m) => m.id);');
  });
  /**
   * 🔴 7 ต.ค. 2569 เจ้าของ "แก้ไขเวลาแล้ว ไม่โทรตามเวลาที่แก้" — วัดจริง: สายที่โทรไปแล้ว/คิวยกเลิกแล้วย้ายไปอนาคต ไม่ถึง Lumos ·
   * แก้หลายแถวของคนเดียวกัน = 3 แผนเวลาเดียวกัน + แผนเก่าถือเวลาเดิม (โทร 09:25 แล้ว 10:27)
   * ⇒ ป๊อปแก้ไขใช้ตัวเดียวกับแก้ตาราง: ทุกสาย AI ที่รอโทรของคนนี้ในวันที่โดนแก้ ส่งแผนละวัน ยกเลิกแผนเดิมทุกตัวก่อน
   */
  it('ส่งใหม่ทั้งวันของคนนี้ด้วยตัวเดียวกับแก้ตาราง · สายที่โทรไปแล้วย้ายไปอนาคต = คืนเข้าคิว · ล้มต้องบอกจอ', () => {
    expect(handler).toContain('planResync = await replanPersonDays(updated, [before.scheduled_at, updated.scheduled_at], [id, ...phoneAppliedIds, ...samePlanIds]);');
    expect(handler).toContain("and person_ref = $1 and status in ('failed', 'completed')");
    expect(handler).toMatch(/async function replanPersonDays[\s\S]*replanFollowSetWithLumos\(/);
    expect(handler).toContain('lumos_other_failed: otherPlansFailed');
    expect(dialog).toContain('saved.lumos_other_failed');
  });
  it('🔴 เพิ่มสายจากป๊อปแก้ไข = ผ่านเส้นแก้ตารางทั้งชุด ไม่ใช่ POST ทีละสาย', () => {
    expect(dialog).not.toContain('createFollowEntry(');
    expect(dialog).toContain('scheduleReplaceBody(editable, [...draft, ...addedRows])');
  });
});

describe('🔴 ป๊อปแก้ไข: คนเดียวกันห้ามสองสายนาทีเดียวกัน (7 ต.ค. 2569 เจอ 3 สาย 09:25)', () => {
  it('ตรวจตอนเปลี่ยนเวลา · เบอร์ + ทีมเดียวกัน · 409', () => {
    expect(handler).toContain("date_trunc('minute', scheduled_at) = date_trunc('minute', $2::timestamptz)");
    expect(handler).toContain('คนนี้มีอีกสายเวลาเดียวกันอยู่แล้ว');
  });
});

describe('🔴 ทดสอบผ่านจอ 7 ต.ค. 2569', () => {
  const cal = readFileSync(new URL('../../src/components/follow/FollowPlanningCalendar.tsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../../src/pages/follow/FollowPage.tsx', import.meta.url), 'utf8');
  it('กดลงผลแล้วแถวค้างในตาราง (ไม่งั้นคำถาม "จบเรื่องนี้เลยไหม" หายไปกับแถว)', () => {
    expect(cal).toContain('pinnedKeys.has(p.row.group.key) ? null : followDayPersonDone(p)');
    expect(cal).toContain('onRecord={(o) => recordStaffResult(round, o, row)}');
  });
  it('ตารางคนโทรทั้งหมด ปุ่มบันทึกไม่พูดว่าส่ง AI', () => {
    expect(page).toContain("? !scheduleCalls().some((c) => c.callMode === 'ai')");
    expect(page).toContain("? replaceAiOn === false || !Object.values(replaceModes).includes('ai')");
  });
});
