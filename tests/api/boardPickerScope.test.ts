// @vitest-environment node
/**
 * ขอบเขตรายชื่อของ picker หน้า Follow (F5b) — เจ้าของกำหนด:
 * ทุกถัง **ยกเว้น Checklist**
 *
 * 🔴 18 ส.ค. 2569 (ค่ำ-2) เจ้าของ **กลับคำเรื่องคนที่แจ้งเข้าแล้ว**:
 * *"กล่องเลือกพนักงานเพิ่ม Done Drop เข้าไป"* — เดิม `excludeInformed: true` ตัดคนที่
 * ได้งานแล้วทิ้ง ทำให้ถัง Done เหลือ 51 จาก 235 คน (วัดจริง) แต่คนกลุ่มนั้นคือกลุ่มที่ต้อง
 * ตามเรื่อง "เริ่มงาน / เรียนงาน / เบิกเบี้ยเลี้ยง" พอดี = งานหลักของหน้า Follow
 * → ตอนนี้ **ไม่ตัดแล้ว** แต่ต้องส่ง `is_informed` ไปติดป้ายให้เห็นว่าเขาได้งานแล้ว
 *
 * พังเงียบที่ยังคุมไว้: เผลอเอา Checklist เข้ามา = ไปตามคนที่ยังสมัครไม่เสร็จ
 * (งานของเลนสรรหา ไม่ใช่ของตารางโทรตาม) · เผลอลืมส่ง is_informed = แยกไม่ออกว่าใครมีงานแล้ว
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  boardChecklistColumnId,
  boardPrimaryColumnId,
  boardFallbackColumnId,
  boardReuseColumnId,
  boardInProcessColumnId,
  boardDoneColumnId,
  boardDropColumnId,
} from '../../api/_lib/boardCandidatesSql.js';

const root = path.join(import.meta.dirname, '../..');
const handlerRaw = fs.readFileSync(path.join(root, 'api/_handlers/matching-board-candidates.ts'), 'utf8');

/**
 * ⚠️ **ตรวจเฉพาะโค้ด ไม่ตรวจคอมเมนต์** — เทสต์ชุดนี้อ่านไฟล์เป็นข้อความ
 * คอมเมนต์อธิบายที่พูดถึงชื่อฟิลด์ (เช่นเล่าว่า "เลิกใช้ excludeInformed แล้ว")
 * ทำให้ `not.toContain(...)` แดงทั้งที่โค้ดถูก — โดนมาแล้ว 18 ส.ค. 2569
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

const handler = stripComments(handlerRaw);

/** ตัวโหมด picker เท่านั้น — ตัดตั้งแต่ `picker` ถึงบล็อกถัดไป (`buckets`) */
const pickerBlock = handler.slice(
  handler.indexOf(`getQuery(req, 'picker')`),
  handler.indexOf(`getQuery(req, 'buckets')`),
);

describe('รหัสถังบนบอร์ด (ค่าเริ่มต้นตามบอร์ดจริง)', () => {
  it('Checklist = 1 และไม่ชนกับถังอื่น', () => {
    const others = [
      boardPrimaryColumnId(),
      boardFallbackColumnId(),
      boardReuseColumnId(),
      boardInProcessColumnId(),
      boardDoneColumnId(),
      boardDropColumnId(),
    ];
    expect(boardChecklistColumnId()).toBe(1);
    expect(others).not.toContain(boardChecklistColumnId());
    expect(new Set(others).size).toBe(others.length);
  });
});

describe('โหมด picker ของ /api/matching/board-candidates', () => {
  it('ไม่มีถัง Checklist อยู่ในรายการคอลัมน์', () => {
    expect(pickerBlock).not.toContain('boardChecklistColumnId');
  });

  it('ครบ 6 ถังที่เหลือ', () => {
    for (const fn of [
      'boardPrimaryColumnId',
      'boardFallbackColumnId',
      'boardReuseColumnId',
      'boardInProcessColumnId',
      'boardDoneColumnId',
      'boardDropColumnId',
    ]) {
      expect(pickerBlock).toContain(fn);
    }
  });

  it('🔴 ไม่ตัดคนที่แจ้งเข้าแล้วอีกแล้ว (เจ้าของกลับคำ 18 ส.ค. 2569)', () => {
    expect(pickerBlock).not.toContain('excludeInformed');
  });

  it('🔴 ต้องส่ง is_informed ไปให้หน้าเว็บติดป้าย "แจ้งเข้าแล้ว"', () => {
    expect(pickerBlock).toContain('is_informed');
  });

  it('เอาเฉพาะคนที่มีเบอร์ (ไม่มีเบอร์ = ตั้งตารางโทรไม่ได้)', () => {
    expect(pickerBlock).toMatch(/filter\(\(c\) => \(c\.mobile \|\| ''\)\.trim\(\)\)/);
  });

  it('ไม่ส่งที่อยู่เต็ม/ค่าจ้างที่ขอออกไป (ฟิลด์เท่าที่ picker ใช้)', () => {
    expect(pickerBlock).not.toContain('full_address');
    expect(pickerBlock).not.toContain('required_salary');
  });

  it('โหมด people เดิมยังไม่ถูกกรอง is_inform (หน้า "ผู้สมัคร" ต้องเห็นครบเหมือนเดิม)', () => {
    const peopleBlock = handler.slice(
      handler.indexOf(`getQuery(req, 'people')`),
      handler.indexOf(`getQuery(req, 'picker')`),
    );
    expect(peopleBlock).not.toContain('excludeInformed');
  });

  it('🔴 เลนสรรหา/AI matcher ต้องยังตัดคนที่แจ้งเข้าแล้วอยู่ — ห้ามเอาคนมีงานไปเสนองานใหม่', () => {
    // การกลับคำข้างบนมีผลเฉพาะกล่องเลือกคนของหน้า Follow · เส้นอื่นที่ใช้ตัวเลือกนี้
    // ยังต้องคงไว้ ไม่งั้นคนที่ได้งานแล้วจะถูกเสนองานใหม่/ถูกยิงเข้าคิว AI อีกรอบ
    const others = fs
      .readdirSync(path.join(root, 'api/_lib'))
      .filter((f) => f.endsWith('.ts'))
      .map((f) => stripComments(fs.readFileSync(path.join(root, 'api/_lib', f), 'utf8')))
      .join('\n');
    expect(others).toContain('excludeInformed');
  });
});
