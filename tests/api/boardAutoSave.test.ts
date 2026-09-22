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
const NOTE = read('src/components/jobs/UnitRequestNoteField.tsx');

describe('ป๊อปแก้ข้อมูลประกาศ — auto-save', () => {
  it('มี debounce 1500ms ยิง persist(true) แบบเงียบ', () => {
    expect(DIALOG).toMatch(/setTimeout\(\s*\(\)\s*=>\s*\{?\s*void persistRef\.current\?\.\(true\)/);
    expect(DIALOG).toContain('1500');
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
    expect(DIALOG).toContain('function buildOverridesPatch');
    expect(DIALOG).toContain('...existing,');
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
