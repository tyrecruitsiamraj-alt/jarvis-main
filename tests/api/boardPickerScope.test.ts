// @vitest-environment node
/**
 * ขอบเขตรายชื่อของ picker หน้า Follow (F5b) — เจ้าของกำหนด:
 * ทุกถัง **ยกเว้น Checklist** + ตัดคนที่ **แจ้งเข้าแล้ว** (`is_inform='Y'`)
 *
 * พังเงียบที่คุมไว้: เผลอเอา Checklist เข้ามา = ไปตามคนที่ยังสมัครไม่เสร็จ
 * (งานของเลนสรรหา ไม่ใช่ของตารางโทรตาม) · เผลอไม่ตัดคนแจ้งเข้าแล้ว = โทรตามคนที่ได้งานไปแล้ว
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
const handler = fs.readFileSync(path.join(root, 'api/_handlers/matching-board-candidates.ts'), 'utf8');

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

  it('ตัดคนที่แจ้งเข้าแล้ว', () => {
    expect(pickerBlock).toContain('excludeInformed: true');
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
});
