// @vitest-environment node
/**
 * 🔴 Auto-save ป๊อปแก้ข้อมูลประกาศ (เจ้าของเคาะ 22 ก.ย. 2569: "เซฟดราฟต์เอาไว้เสมอ")
 * · pin โครงไว้กันย้อนกลับเป็นบันทึกมือล้วน
 * ⚠️ **ช่องหมายเหตุไม่ใช่ auto-save แล้ว** (28 ก.ย. 2569: *"หมายเหตุเวลากรอกมันบันทึก Auto อะยังพิมพ์ไม่เสร็จเลย
 * เอาเป็นพิมพ์เสร็จแล้วกดบันทึกเองดีกว่า"* → Choice "จำร่างไว้ในเครื่อง") — ดู describe ท้ายไฟล์
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');
const DIALOG = read('src/components/jobs/EditPublicJobFieldsDialog.tsx');
/** ตัวประกอบ patch + ตัวเทียบ "ฟอร์มต่างจากใบขอไหม" ย้ายมาเป็น lib 27 ก.ย. 2569 (มีเทสต์ของตัวเอง) */
const FORM_LIB = read('src/lib/publicFieldsForm.ts');
const NOTE = read('src/components/jobs/UnitRequestNoteField.tsx');

describe('ป๊อปแก้ข้อมูลประกาศ — auto-save', () => {
  it('มี debounce 1500ms ยิง persist(true) แบบเงียบ', () => {
    // นาฬิกาคืนเป็น null ก่อนยิง (แก้ 27 ก.ย. 2569 — ค่าค้างทำให้ flush ตอน unmount ยิงทั้งที่ไม่มีของค้าง)
    expect(DIALOG).toMatch(
      /setTimeout\(\s*\(\)\s*=>\s*\{?\s*(?:autosaveTimer\.current = null;\s*)?void persistRef\.current\?\.\(true\)/,
    );
    expect(DIALOG).toContain('1500');
  });
  it('🔴 ยิงเฉพาะตอนฟอร์มต่างจากที่บันทึกไว้จริง (เปิดดูเฉย ๆ ห้ามยิง · ห้ามวน)', () => {
    // บั๊กจริง 27 ก.ย. 2569: เปิดขั้น 3 ดูเฉย ๆ แล้ววนบันทึกทุก 1.5 วิ (ใบเดียว 44 ครั้ง)
    expect(DIALOG).toContain('if (!formDiffersFromJob(st)) return;');
    expect(DIALOG).toContain('if (silent && !formDiffersFromJob(st)) return;');
    // ห้ามกลับไปใช้ธง "กำลังเติมค่า" ที่แข่งเวลากับ React
    expect(DIALOG).not.toContain('hydratingRef');
    // ค่าตั้งต้นมาจากใบขอตั้งแต่ render แรก + ผู้เรียกใส่ key ต่อใบ
    expect(DIALOG).toContain('formStateFromJob(job)');
  });
  it('persist แยก silent (auto) กับปุ่ม (ปิดป๊อป)', () => {
    expect(DIALOG).toContain('const persist = async (silent: boolean)');
    expect(DIALOG).toContain('const save = () => void persist(false)');
  });
  it('ปิดป๊อป flush ของค้างก่อน (ห้ามหายเงียบ)', () => {
    expect(DIALOG).toContain('const handleClose');
    const at = DIALOG.indexOf('const handleClose');
    expect(DIALOG.slice(at, at + 300)).toContain('persist(true)');
  });
  it('unmount ระหว่างมีของค้าง flush', () => {
    expect(DIALOG).toContain('void persistRef.current?.(true)');
  });
  it('patch สร้างจากตัวกลางตัวเดียว (spread ของเดิม)', () => {
    expect(FORM_LIB).toContain('export function buildOverridesPatch');
    expect(FORM_LIB).toContain('...existing,');
    expect(DIALOG).toContain("from '@/lib/publicFieldsForm'");
    expect(DIALOG).not.toContain('function buildOverridesPatch');
  });
  it('มีป้ายสถานะ 3 แบบ', () => {
    expect(DIALOG).toContain("autoStatus === 'saving'");
    expect(DIALOG).toContain("autoStatus === 'error'");
    expect(DIALOG).toContain("autoStatus === 'saved'");
  });
});

describe('ช่องหมายเหตุ — กดบันทึกเอง + จำร่างไว้ในเครื่อง (28 ก.ย. 2569)', () => {
  /** ตัดคอมเมนต์ก่อน — ไฟล์เล่าประวัติ auto-save เดิมไว้ด้วยคำพวกนี้โดยตั้งใจ */
  const code = NOTE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('ไม่มีตัวจับเวลาบันทึกเองระหว่างพิมพ์ และไม่ flush ตอนปิด/สลับขั้น', () => {
    expect(code).not.toMatch(/setTimeout\(/);
    expect(code).not.toContain('1500');
    expect(code).not.toContain('persistRef');
  });
  it('ขึ้นฐานเฉพาะตอนกดปุ่ม "บันทึกหมายเหตุ"', () => {
    expect(code).toContain('onClick={() => void persist()}');
    expect(code.match(/persist\(\)/g)?.length).toBe(1);
  });
  it('พิมพ์ต่อได้ระหว่างกำลังบันทึก (ช่องไม่ล็อกตาม saving)', () => {
    expect(code).toContain('disabled={readOnly}');
    expect(code).not.toMatch(/disabled=\{saving \|\| readOnly\}/);
  });
  it('ร่างที่ยังไม่บันทึกจำไว้ในเครื่อง (localStorage ต่อใบ) · บันทึกแล้ว/ยกเลิก = ลบร่าง', () => {
    expect(code).toContain("const DRAFT_PREFIX = 'jarvis:unit-note-draft:'");
    expect(code).toContain('window.localStorage.setItem(DRAFT_PREFIX');
    expect(code).toContain('writeDraft(requestKey, null)');
    expect(code).toContain('ยังไม่ได้บันทึก');
  });
  it('ยังกัน persist ซ้ำเมื่อไม่ dirty (มี guard lastSaved)', () => {
    expect(NOTE).toContain("if (trimmed === lastSaved.current.trim()) return;");
  });
});
