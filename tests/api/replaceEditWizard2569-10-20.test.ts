/**
 * แท็บส่งคนแทนแก้ไขแบบป๊อป 4 หน้า (เจ้าของ 20 ต.ค. 2569 "ทำแท็บส่งคนแทนให้แก้ไขแบบ 4 หน้าด้วย")
 * + Choice "แก้อันไหนล่าสุดเอาอันนั้น เช่น jarvis แก้ตอน 13.00 แต่ irecruit แก้ตอน 13.01 เอา irecruit"
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseFollowScheduleReplace } from '../../api/_handlers/follow';
import {
  irecruitLabelChanged,
  replaceSlotNote,
  replaceSlotOfEntry,
  replaceStartInputOf,
} from '../../src/lib/irecruitReplaceSync';

const read = (p: string) => readFileSync(p, 'utf8');

describe('ค่าเริ่มของขั้น 3 ตอนแก้ (วันเวลาเข้างาน + ช่องของสาย)', () => {
  it('ช่องของสาย: คีย์ก่อน · ไม่มีคีย์ = หมายเหตุ · แล้วค่อยสายที่', () => {
    expect(replaceSlotOfEntry({ source_ref: 'irecruit-replace:123:lead60:abc', call_round: 5 })).toBe('lead60');
    expect(replaceSlotOfEntry({ source_ref: 'manual-replace:202610210800-ab:lead15:m' })).toBe('lead15');
    expect(replaceSlotOfEntry({ note: 'ยืนยันเวลาเข้างาน 21/10 08:00 น.', call_round: 3 })).toBe('confirm');
    expect(replaceSlotOfEntry({ note: 'เข้างาน 08:00 น.', call_round: 2 })).toBe('lead60');
    expect(replaceSlotOfEntry({ note: null, call_round: 7 })).toBeNull();
  });
  it('วันเวลาเข้างานอ่านกลับจากหมายเหตุที่ระบบเขียน — ทั้งสายคอนเฟิร์มและสายก่อนเข้างาน', () => {
    const wall = { ymd: '2026-10-21', hhmm: '08:00' };
    // คอนเฟิร์ม 16:00 วันก่อน
    expect(replaceStartInputOf({ scheduled_at: '2026-10-20T09:00:00Z', note: replaceSlotNote('confirm', wall) })).toBe('2026-10-21T08:00');
    // ก่อนเข้างาน 1 ชม. (07:00 ไทย)
    expect(replaceStartInputOf({ scheduled_at: '2026-10-21T00:00:00Z', note: replaceSlotNote('lead60', wall) })).toBe('2026-10-21T08:00');
    // คอนเฟิร์มข้ามปี (โทร 31 ธ.ค. เข้างาน 1 ม.ค.)
    expect(replaceStartInputOf({ scheduled_at: '2026-12-31T09:00:00Z', note: 'ยืนยันเวลาเข้างาน 1/1 07:30 น.' })).toBe('2027-01-01T07:30');
    expect(replaceStartInputOf({ scheduled_at: '2026-10-21T00:00:00Z', note: 'โน้ตอื่น' })).toBeNull();
  });
});

describe('แก้ตาราง: หมายเหตุรายสาย (บทพูดอ่านเวลาเข้างานจากหมายเหตุ)', () => {
  it('รับ note รายสาย · ไม่ส่ง = คงเดิม', () => {
    const now = new Date('2026-10-20T00:00:00Z');
    const id = '11111111-1111-4111-8111-111111111111';
    const out = parseFollowScheduleReplace(
      { replace_ids: [id], rounds: [{ id, scheduled_at: '2026-10-21T00:00:00Z', call_mode: 'ai', note: 'เข้างาน 09:00 น.' }] },
      now,
    );
    expect(out.error).toBeNull();
    expect(out.value?.rounds[0].note).toBe('เข้างาน 09:00 น.');
    const keep = parseFollowScheduleReplace({ replace_ids: [id], rounds: [{ id, scheduled_at: '2026-10-21T00:00:00Z', call_mode: 'ai' }] }, now);
    expect(keep.value?.rounds[0]).not.toHaveProperty('note');
  });
  it('server: ส่งคนแทนคงสายที่ตามช่อง · update_set ไม่ทับหมายเหตุของสาย', () => {
    const src = read('api/_handlers/follow.ts');
    expect(src).toContain('const slotRound = replaceSlotRoundOfRef(byId.get(r.id)?.source_ref);');
    expect(src).toContain('const keepNote = anchor.follow_team === FOLLOW_TEAM_REPLACEMENT;');
    // 🔴 เดิมตัด $4 ออกจาก SQL แต่ยังส่งค่า ⇒ Postgres 500 (เจอตอนทดสอบผ่านหน้าจอจริง 20 ต.ค. 2569)
    expect(src).toContain('note = case when $10::boolean then note else $4::text end');
    expect(src).toContain('phone, ...actor, keepNote],');
  });
});

describe('แก้ล่าสุดชนะ: เทียบกับค่าของ iRecruit ตอนดึงล่าสุด ไม่ใช่ค่าบนจอ', () => {
  it('ชื่อ/หน่วยงานของ iRecruit เปลี่ยนจากที่ดึงครั้งก่อนไหม', () => {
    const now = { name: 'นาย ก', siteName: 'ไซต์ A', siteCode: 'A1' };
    expect(irecruitLabelChanged({ irecruit_name: 'นาย ก', irecruit_unit_name: 'ไซต์ A', irecruit_site_code: 'A1' }, now)).toBe(false);
    expect(irecruitLabelChanged({ irecruit_name: 'นาย ข', irecruit_unit_name: 'ไซต์ A', irecruit_site_code: 'A1' }, now)).toBe(true);
    expect(irecruitLabelChanged({ irecruit_name: 'นาย ก', irecruit_unit_name: 'ไซต์ B', irecruit_site_code: 'A1' }, now)).toBe(true);
  });
});

describe('หน้าติดตาม: แท็บส่งคนแทนเปิดป๊อป 4 หน้า', () => {
  const page = read('src/pages/follow/FollowPage.tsx');
  it('ขั้น 3 = วันเวลาเข้างานเดิม + ใครโทรรายสาย · สายที่โทรแล้วล็อก', () => {
    expect(page).toContain("if (entry.follow_team === 'replacement') {");
    expect(page).toContain('setReplaceStartVal(startInit);');
    expect(page).toContain("return [slot, row ? (row.editable ? 'editable' : 'locked') : 'none'];");
    expect(page).toContain('await submitReplaceEdit(editSet.replace, scheduleChanged);');
  });
  it('วันเวลาเข้างานเปลี่ยน = เวลาโทร + หมายเหตุใหม่ · ไม่เปลี่ยน = คงเวลาโทรเดิม', () => {
    expect(page).toContain('const at = sameStart ? row.at : p && !p.past ? p.at.toISOString() : null;');
    expect(page).toContain('...(sameStart ? {} : { note: replaceSlotNote(slot, start) }),');
  });
});
