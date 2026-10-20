// @vitest-environment node
/**
 * แก้ไขรายการติดตามด้วยป๊อป 4 หน้าเดียวกับตอนเพิ่ม (เจ้าของ 20 ต.ค. 2569 · Choice "ทั้งชุดของคนนั้น")
 * ตรวจเขียนจริงแล้ว (สายคนโทร ไม่ส่ง AI · ลบด้วย id): ชื่อ/เบอร์/หน่วยงาน/ประกัน/ลูกค้า ลงทุกสาย · เบอร์เจ้าหน้าที่รายสาย · สายใหม่ได้ประกัน/ลูกค้าด้วย
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseFollowScheduleReplace } from '../../api/_handlers/follow';

const read = (p: string) => readFileSync(p, 'utf8');
const NOW = new Date('2026-10-20T03:00:00Z');
const future = '2026-10-25T03:00:00Z';

describe('แก้ตารางทั้งชุด: เบอร์เจ้าหน้าที่รายสาย', () => {
  it('รับ staff_phone ต่อสาย · ไม่ส่ง = คงเดิม · เบอร์สั้น/เบอร์ตัวอย่าง = ไม่รับ', () => {
    const ok = parseFollowScheduleReplace({ replace_ids: [], rounds: [{ scheduled_at: future, call_mode: 'manual', staff_phone: '0811111119' }] }, NOW);
    expect(ok.value?.rounds[0].staffPhone).toBe('0811111119');
    const keep = parseFollowScheduleReplace({ replace_ids: [], rounds: [{ scheduled_at: future, call_mode: 'ai' }] }, NOW);
    expect('staffPhone' in (keep.value?.rounds[0] ?? {})).toBe(false);
    expect(parseFollowScheduleReplace({ replace_ids: [], rounds: [{ scheduled_at: future, staff_phone: '123' }] }, NOW).error).toBeTruthy();
    expect(parseFollowScheduleReplace({ replace_ids: [], rounds: [{ scheduled_at: future, staff_phone: '0812345678' }] }, NOW).error).toBeTruthy();
  });
});

describe('แก้ข้อมูลคนทั้งชุด (update_set)', () => {
  const src = read('api/_handlers/follow.ts');
  it('ทุกสายที่ยังไม่ปิด · เบอร์ผู้รับเฉพาะสายอนาคต · ส่งแผนครั้งเดียว (replan:false เมื่อแก้ตารางต่อ)', () => {
    expect(src).toContain("if (action === 'update_set') return await updateFollowSet(req, res, body);");
    expect(src).toContain('recipient_phone = case when scheduled_at > now() then $7 else recipient_phone end');
    expect(src).toContain('where ${setWhere} and cancelled_at is null and completed_at is null');
    expect(src).toContain('if (body.replan !== false)');
  });
  it('สายใหม่จากการแก้ตารางได้วันเริ่มงาน/ประกัน/ลูกค้าจากสายเดิม', () => {
    expect(src).toContain('insuranceType: anchor.insurance_type ?? null,');
  });
});

describe('หน้าติดตาม: ปุ่มแก้ไขเปิดป๊อป 4 หน้า', () => {
  const page = read('src/pages/follow/FollowPage.tsx');
  it('ทุกปุ่มแก้ไขผ่าน startEdit (ส่งคนแทนด้วย 20 ต.ค. 2569) · หัวป๊อปเป็นแก้ไข · ขั้นกดข้ามได้ · บันทึกได้ทุกขั้น', () => {
    expect(page).not.toMatch(/onEditRound=\{\(round\) => setEditing\(/);
    expect(page).toContain('startEdit(entry);');
    expect(page).toContain('const startEdit = (entry: FollowEntry) => openEditWizard(entry);');
    expect(page).toContain("{editSet ? 'แก้ไขรายการติดตาม' : 'เพิ่มคนที่ต้องการติดตาม'}");
    expect(page).toContain('disabled={!editSet && s.step > step}');
    expect(page).toContain("'บันทึกการแก้ไข'");
  });
  it('รอบเดิมจำ id คู่กับเวลาเสมอ (เพิ่ม/ลบรอบขยับพร้อมกัน)', () => {
    expect(page).toContain('setRoundIds((prev) => [...prev, null]);');
    expect(page).toContain('setRoundIds((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));');
  });
});
