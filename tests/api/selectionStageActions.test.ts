// @vitest-environment node
/**
 * Phase 6.5-6.7, 6.9-6.10 — ของบนจอที่ต้องไม่ไหลกลับ
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. **ห้าม Dialog ซ้อน Dialog** — ตัวเลือกหน่วยงานอยู่ในป๊อปที่เป็น Dialog แล้ว
 *    จึงต้องเป็น Popover และต้อง **ใช้เนื้อ picker ตัวเดียวกัน** (ห้ามก๊อปรายการ)
 * 2. แท็บ AI Match ที่ "ลงมือได้" ต้องใช้ **แถบปุ่มและเส้นส่งเดียวกับหน้าจับคู่งาน**
 *    (ห้ามก๊อปตรรกะปุ่ม/เส้นส่ง — ปุ่มเดียวกันคนละพฤติกรรม = บั๊ก)
 * 3. ปุ่มที่ยิงสายจริงต้องมีป๊อปยืนยัน **พร้อมรายชื่อ**
 * 4. กติกา "ใครสนใจ" ต้องมาจาก `applicantCallOutcome` ที่เดียว (ห้ามเทียบ === ในไฟล์หน้า)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { UNIT_PICK_STAGES, needsUnitPick } from '../../src/lib/selectionUnitStage.js';
import { SELECTION_STATUSES } from '../../src/lib/selectionProgress.js';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const stripComments = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('ขั้นที่ต้องเลือกหน่วยงาน (6.6)', () => {
  it('เฉพาะขั้นที่ยังรอหน่วยงานจริง — ไม่รกขั้นหลังจากนั้น', () => {
    expect([...UNIT_PICK_STAGES]).toEqual([
      'boss_review',
      'await_interview_date',
      'await_interview_result',
    ]);
    expect(needsUnitPick('boss_review')).toBe(true);
    expect(needsUnitPick('await_start')).toBe(false);
    expect(needsUnitPick('probation')).toBe(false);
    expect(needsUnitPick('await_inform')).toBe(false);
    expect(needsUnitPick(null)).toBe(false);
    expect(needsUnitPick(undefined)).toBe(false);
  });

  it('ทุกขั้นในลิสต์ต้องเป็นขั้นที่ระบบรู้จักจริง', () => {
    for (const s of UNIT_PICK_STAGES) {
      expect(SELECTION_STATUSES as readonly string[]).toContain(s);
    }
  });
});

describe('ตัวเลือกหน่วยงานในป๊อป (ห้าม Dialog ซ้อน Dialog)', () => {
  const controls = stripComments(read('src/components/recruit-rm/SelectionProgressControls.tsx'));

  it('ใช้ Popover ไม่ใช่ Dialog', () => {
    expect(controls).toContain("from '@/components/ui/popover'");
    expect(controls).not.toMatch(/from '@\/components\/ui\/dialog'/);
    expect(controls).not.toMatch(/from '@\/components\/ui\/alert-dialog'/);
  });

  it('🔴 ใช้เนื้อ picker ตัวเดียวกับหน้า Follow (ไม่ก๊อปรายการหน่วยงาน)', () => {
    expect(controls).toContain('BoardUnitPickerBody');
    // ห้ามมีตรรกะค้นหน่วยงานของตัวเอง
    expect(controls).not.toContain('filterBoardUnits');
  });

  it('เลือกจากรายการเท่านั้น — ไม่มีช่องพิมพ์ชื่อหน่วยงานเอง', () => {
    expect(controls).not.toMatch(/placeholder="[^"]*หน่วยงาน[^"]*"/);
  });

  it('รองรับทั้งคนมีใบสมัครและคนจาก match (6.5)', () => {
    // subject เป็น union สองชนิด — คนมีใบสมัคร (application) กับคนจาก match (person)
    expect(controls).toContain("kind: 'application'");
    expect(controls).toContain("kind: 'person'");
    // เส้นของคนที่ไม่มีใบสมัครต้องยิงเส้นที่คีย์ด้วยเบอร์
    expect(controls).toContain('saveSelectionProgressByPhone');
  });

  it('ขั้น "รอแจ้งเข้า" มีทางไปตั้งตารางโทร (6.9) — เป็นปุ่ม ไม่เด้งเอง', () => {
    expect(controls).toMatch(/status === 'await_inform'/);
    expect(controls).toContain('ไปตั้งตารางโทรแจ้งเข้า');
  });
});

describe('แท็บ AI Match ลงมือได้ (6.7)', () => {
  const tab = stripComments(read('src/pages/jobs/UnitRequestTabPage.tsx'));

  it('ใช้แถบปุ่มเดียวกับหน้าจับคู่งาน (lumosSendActions คุมเหตุผลปุ่ม)', () => {
    expect(tab).toContain('LumosSendBar');
    expect(tab).not.toContain('lumosSendActionStates');
  });

  it('ใช้เส้นส่งเดียวกัน — ไม่ยิง fetch เอง', () => {
    expect(tab).toContain('dispatchLumosCalls');
    expect(tab).not.toMatch(/fetch\(|apiFetch\(/);
  });

  it('🔴 มีป๊อปยืนยันพร้อมรายชื่อก่อนยิงสายจริง', () => {
    expect(tab).toContain('sendConfirm');
    expect(tab).toMatch(/ให้ AI โทรหา \{pickedMatches\.length\} คนนี้\?/);
    expect(tab).toContain('pickedMatches.slice(0, 12)');
  });

  it('ติ๊กได้เฉพาะคนที่มีเบอร์ (ส่ง/ล็อกไม่ได้ถ้าไม่มีเบอร์)', () => {
    expect(tab).toMatch(/disabled=\{!\(m\.mobile \?\? ''\)\.trim\(\)/);
  });

  it('เก็บไปโทรเอง = ล็อกเบอร์ (คนพวกนี้ไม่มีใบสมัครให้ claim)', () => {
    expect(tab).toContain('acquireCallHold');
  });
});

describe('คนสนใจของใบขอในแท็บการติดต่อ (6.10)', () => {
  const tab = stripComments(read('src/pages/jobs/UnitRequestTabPage.tsx'));

  it('ใช้กติกากลาง ไม่เทียบผลโทรเอง', () => {
    expect(tab).toContain('isInterestedApplicant');
    expect(tab).not.toMatch(/last_call_outcome === 'confirmed'/);
  });

  it('บอกชัดว่าเป็นของทั้งใบขอ (ต่างจากถังโทรส่วนตัวที่อยู่ด้านล่าง)', () => {
    expect(tab).toContain('ของทั้งใบขอ');
    expect(tab).toContain('รายการนี้เป็นของคุณคนเดียว');
  });
});
