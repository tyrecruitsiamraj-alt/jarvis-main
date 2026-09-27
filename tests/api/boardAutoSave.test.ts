// @vitest-environment node
/**
 * 🔴 Auto-save ป๊อปแก้ข้อมูลประกาศ + ช่องหมายเหตุ (เจ้าของเคาะ 22 ก.ย. 2569:
 * "เซฟดราฟต์เอาไว้เสมอ") · pin โครงไว้กันย้อนกลับเป็นบันทึกมือล้วน
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

describe('ช่องหมายเหตุ — auto-save', () => {
  it('debounce 1500ms + flush ตอน unmount', () => {
    expect(NOTE).toContain('1500');
    expect(NOTE).toContain('persistRef');
    // มี effect คืน cleanup ที่เรียก persist ตอน unmount
    expect(NOTE).toMatch(/return\s*\(\)\s*=>\s*\{\s*\/\/[^\n]*\n\s*void persistRef\.current\(\)/);
  });
  it('ยังกัน persist ซ้ำเมื่อไม่ dirty (มี guard lastSaved)', () => {
    expect(NOTE).toContain("if (trimmed === lastSaved.current.trim()) return;");
  });
});
