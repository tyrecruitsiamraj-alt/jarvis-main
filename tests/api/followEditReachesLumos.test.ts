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
  it('ส่งใหม่ทุกแผนที่โดนแก้ (ไม่ใช่แค่แผนของแถวที่เปิด) · ล้มต้องบอกจอ', () => {
    expect(handler).toContain('const otherIds = [...new Set([...phoneAppliedIds, ...samePlanIds])];');
    expect(handler).toContain('lumos_other_failed: otherPlansFailed');
    expect(dialog).toContain('saved.lumos_other_failed');
  });
  it('🔴 เพิ่มสายจากป๊อปแก้ไข = ผ่านเส้นแก้ตารางทั้งชุด ไม่ใช่ POST ทีละสาย', () => {
    expect(dialog).not.toContain('createFollowEntry(');
    expect(dialog).toContain('scheduleReplaceBody(editable, [...draft, ...addedRows])');
  });
});
