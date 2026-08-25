/**
 * ขั้นในกระบวนการจ้าง + เช็คลิสต์เตรียมเข้างาน (094 · ข้อ 5–7)
 *
 * พังเงียบที่คุมไว้:
 * - เอาไปปนกับ `status` เดิม (new/contacted/…) → ตัวเลขทุกหน้าที่นับจาก status เพี้ยน
 * - เก็บ `false` ลง jsonb → "ไม่เคยแตะ" กับ "ติ๊กแล้วเอาออก" แยกไม่ออก
 * - ค่าเพี้ยนจาก DB หลุดขึ้นจอ
 */
import { describe, expect, it } from 'vitest';
import {
  INFORM_PLAN_KEY,
  PREP_CHECKLIST_ITEMS,
  PREP_CHECKLIST_LABEL,
  SELECTION_STATUSES,
  SELECTION_STATUS_CLASS,
  SELECTION_STATUS_LABEL,
  isPrepChecklistKey,
  isPrepChecklistComplete,
  isSelectionStatus,
  normalizePrepChecklist,
  prepChecklistProgress,
  togglePrepChecklist,
} from '@/lib/selectionProgress';
import { APPLICATION_STATUSES } from '@/lib/publicApplicationsApi';

describe('6 ขั้นตามที่เจ้าของสั่ง', () => {
  it('ครบ 6 ขั้น เรียงตามลำดับที่คนเดินจริง', () => {
    expect(SELECTION_STATUSES.map((s) => SELECTION_STATUS_LABEL[s])).toEqual([
      'รอนายพิจารณา',
      'รอนัดวันสัมภาษณ์',
      'รอผลสัมภาษณ์',
      'รอเริ่มงาน',
      'เรียนงาน',
      'รอแจ้งเข้า',
    ]);
  });

  it('🔴 ไม่ทับกับ `status` เดิม — คนละชุดค่าโดยสิ้นเชิง', () => {
    for (const s of SELECTION_STATUSES) {
      expect(APPLICATION_STATUSES as readonly string[]).not.toContain(s);
    }
  });

  it('ทุกขั้นมีสี และมีคู่ dark: ครบ (กติกาชิปของโปรเจกต์)', () => {
    for (const s of SELECTION_STATUSES) {
      expect(SELECTION_STATUS_CLASS[s]).toContain('dark:');
    }
  });

  it('กันค่าที่ไม่รู้จัก', () => {
    expect(isSelectionStatus('probation')).toBe(true);
    expect(isSelectionStatus('รอนายพิจารณา')).toBe(false); // ป้ายไทยไม่ใช่ค่า
    expect(isSelectionStatus(null)).toBe(false);
    expect(isSelectionStatus('')).toBe(false);
  });
});

describe('เช็คลิสต์ 6 ข้อตามที่เจ้าของสั่ง (เดิม 5 + "ทำบัตร")', () => {
  it('ครบ 6 ข้อ ชื่อ+ลำดับตรงตามที่สั่ง', () => {
    expect(PREP_CHECKLIST_ITEMS.map((k) => PREP_CHECKLIST_LABEL[k])).toEqual([
      'ลงแผนแจ้งเข้า',
      'ผลคดี',
      'ผลตรวจสุขภาพ',
      'เบิกเสื้อ',
      'แจ้งประกัน',
      // เจ้าของเคาะเพิ่มข้อที่ 6 (22 ส.ค. 2569) — ต่อท้าย ไม่แทรกกลาง (ลำดับคือลำดับบนจอ)
      'ทำบัตร',
    ]);
    expect(INFORM_PLAN_KEY).toBe('inform_plan');
  });

  it('ติ๊กแล้วเอาออกได้ — คืนก้อนใหม่เสมอ ไม่แก้ของเดิม', () => {
    const a = {};
    const b = togglePrepChecklist(a, 'uniform');
    expect(b).toEqual({ uniform: true });
    expect(a).toEqual({});
    expect(togglePrepChecklist(b, 'uniform')).toEqual({});
  });

  it('🔴 ไม่เก็บ false — คีย์ที่ไม่มี = ยังไม่ติ๊ก อยู่แล้ว', () => {
    expect(normalizePrepChecklist({ uniform: false, insurance: true })).toEqual({ insurance: true });
    expect(togglePrepChecklist({ uniform: true }, 'uniform')).toEqual({});
  });

  it('กันค่าเพี้ยนจาก DB — คีย์แปลก/ค่าที่ไม่ใช่ true ถูกทิ้ง', () => {
    expect(
      normalizePrepChecklist({ uniform: true, ไม่รู้จัก: true, case_result: 'yes', insurance: 1 }),
    ).toEqual({ uniform: true });
    expect(normalizePrepChecklist(null)).toEqual({});
    expect(normalizePrepChecklist([1])).toEqual({});
    expect(normalizePrepChecklist('x')).toEqual({});
  });

  it('นับความคืบหน้าถูก และครบ 6 ข้อถึงจะนับว่าเสร็จ', () => {
    expect(prepChecklistProgress({})).toEqual({ done: 0, total: 6 });
    expect(prepChecklistProgress({ uniform: true, insurance: true })).toEqual({ done: 2, total: 6 });
    // 🔴 ครบ 5 ข้อเดิมยังไม่พอแล้ว — ต้องมีทำบัตรด้วย
    const oldFive = { inform_plan: true, case_result: true, health_check: true, uniform: true, insurance: true };
    expect(isPrepChecklistComplete(oldFive)).toBe(false);
    expect(isPrepChecklistComplete({ ...oldFive, id_card: true })).toBe(true);
    expect(isPrepChecklistComplete({ uniform: true })).toBe(false);
    const all = Object.fromEntries(PREP_CHECKLIST_ITEMS.map((k) => [k, true]));
    expect(isPrepChecklistComplete(all)).toBe(true);
  });

  it('ค่าขยะไม่ทำให้ยอดเฟ้อ', () => {
    expect(prepChecklistProgress({ ไม่รู้จัก: true } as never)).toEqual({ done: 0, total: 6 });
  });

  it('isPrepChecklistKey กันคีย์แปลก', () => {
    expect(isPrepChecklistKey('health_check')).toBe(true);
    expect(isPrepChecklistKey('อะไรก็ไม่รู้')).toBe(false);
  });
});
