// @vitest-environment node
/**
 * ผลปิดงานของรายการติดตาม (095)
 *
 * ทำไมต้องมีเทสต์ parity กับ SQL: กับดักเดิมของโปรเจกต์นี้คือ **CHECK constraint
 * กับค่าในโค้ดหลุดจากกัน** (เจอมาแล้วสองรอบกับ `source` และ `result_scope`)
 * หน้าเว็บส่งค่าที่ฐานไม่รับ = 500 ตอนกดปุ่ม ซึ่งไม่มีใครเจอจนกว่าจะมีคนกดจริง
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FOLLOW_OUTCOMES,
  FOLLOW_OUTCOME_LABEL,
  FOLLOW_OUTCOME_HINT,
  isFollowOutcome,
  isLostOutcome,
  requiresNote,
} from '../../src/lib/followOutcome.js';

const MIGRATION = new URL('../../migrations/095_call_stamp_and_follow_outcome.sql', import.meta.url);

describe('parity กับ CHECK constraint ใน migration 095', () => {
  it('🔴 ค่าที่โค้ดส่งได้ = ค่าที่ฐานรับ เป๊ะ ๆ', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    const block = sql.slice(sql.indexOf('outcome_code in ('));
    const inList = block.slice(block.indexOf('(') + 1, block.indexOf(')'));
    const fromSql = [...inList.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(fromSql).toEqual([...FOLLOW_OUTCOMES].sort());
  });

  it('ทุกค่ามีคำไทยบนปุ่มและคำอธิบายครบ (ไม่มีค่าไหนโผล่เป็นรหัสดิบ)', () => {
    for (const o of FOLLOW_OUTCOMES) {
      expect(FOLLOW_OUTCOME_LABEL[o]?.trim()).toBeTruthy();
      expect(FOLLOW_OUTCOME_HINT[o]?.trim()).toBeTruthy();
    }
  });

  it('ครบทั้ง 5 อย่างที่เจ้าของสั่ง', () => {
    expect(FOLLOW_OUTCOMES).toContain('done');
    expect(FOLLOW_OUTCOMES).toContain('job_cancelled');
    expect(FOLLOW_OUTCOMES).toContain('no_show_start');
    expect(FOLLOW_OUTCOMES).toContain('leave');
    expect(FOLLOW_OUTCOMES).toContain('other');
  });
});

describe('กติกาการใช้ค่า', () => {
  it('ค่าที่ไม่รู้จักต้องไม่ผ่าน', () => {
    expect(isFollowOutcome('done')).toBe(true);
    expect(isFollowOutcome('เสร็จสิ้น')).toBe(false);
    expect(isFollowOutcome('')).toBe(false);
    expect(isFollowOutcome(null)).toBe(false);
    expect(isFollowOutcome(undefined)).toBe(false);
  });

  it('“คนหลุดจากงาน” = ยกเลิกงาน + ไม่ไปเริ่มงาน เท่านั้น', () => {
    expect(isLostOutcome('job_cancelled')).toBe(true);
    expect(isLostOutcome('no_show_start')).toBe(true);
    // ลาแล้วยังกลับมาได้ · เสร็จสิ้นคือจบดี · อื่น ๆ ไม่รู้ว่าเรื่องอะไร
    expect(isLostOutcome('leave')).toBe(false);
    expect(isLostOutcome('done')).toBe(false);
    expect(isLostOutcome('other')).toBe(false);
    expect(isLostOutcome('อะไรไม่รู้')).toBe(false);
  });

  it('เฉพาะ “อื่น ๆ” ที่บังคับใส่หมายเหตุ', () => {
    expect(requiresNote('other')).toBe(true);
    for (const o of FOLLOW_OUTCOMES.filter((x) => x !== 'other')) {
      expect(requiresNote(o)).toBe(false);
    }
  });
});
