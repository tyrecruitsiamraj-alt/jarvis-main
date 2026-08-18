// @vitest-environment node
/**
 * ผลปิดงานของรายการติดตาม (095 · ชุดคำใหม่ 101)
 *
 * ทำไมต้องมีเทสต์ parity กับ SQL: กับดักเดิมของโปรเจกต์นี้คือ **CHECK constraint
 * กับค่าในโค้ดหลุดจากกัน** (เจอมาแล้วสองรอบกับ `source` และ `result_scope`)
 * หน้าเว็บส่งค่าที่ฐานไม่รับ = 500 ตอนกดปุ่ม ซึ่งไม่มีใครเจอจนกว่าจะมีคนกดจริง
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FOLLOW_OUTCOMES,
  FOLLOW_OUTCOMES_LEGACY,
  FOLLOW_OUTCOME_ALL,
  FOLLOW_OUTCOME_LABEL,
  FOLLOW_OUTCOME_HINT,
  isFollowOutcome,
  isCurrentFollowOutcome,
  isLostOutcome,
  requiresNote,
} from '../../src/lib/followOutcome.js';

const MIGRATION = new URL('../../migrations/101_follow_outcome_new_set.sql', import.meta.url);

describe('parity กับ CHECK constraint ใน migration 101', () => {
  it('🔴 ค่าที่โค้ดรับได้ (ใหม่+เก่า) = ค่าที่ฐานรับ เป๊ะ ๆ', () => {
    // ⚠️ ตัดคอมเมนต์ `--` ออกก่อนเสมอ — คอมเมนต์ไทยมีวงเล็บได้ (เช่น "ชุดเก่า (095)")
    // ตัวอ่านเดิมหยุดที่ ')' ตัวแรกที่เจอ แล้วสรุปว่าค่าในฐานขาด (เทสต์แดงทั้งที่ SQL ถูก)
    const sql = readFileSync(MIGRATION, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.replace(/--.*$/, ''))
      .join('\n');
    const block = sql.slice(sql.indexOf('outcome_code in ('));
    const inList = block.slice(block.indexOf('(') + 1, block.indexOf(')'));
    const fromSql = [...inList.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(fromSql).toEqual([...FOLLOW_OUTCOME_ALL].sort());
  });

  it('🔴 คำเก่ายังต้องอยู่ใน CHECK — รายการที่ปิดไปแล้วถือรหัสเก่าจริง', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    for (const legacy of FOLLOW_OUTCOMES_LEGACY) {
      expect(sql).toContain(`'${legacy}'`);
    }
  });

  it('ทุกค่าที่อ่านได้มีคำไทย — ไม่มีค่าไหนโผล่เป็นรหัสดิบบนจอ (รวมของเก่า)', () => {
    for (const o of FOLLOW_OUTCOME_ALL) {
      expect(FOLLOW_OUTCOME_LABEL[o]?.trim()).toBeTruthy();
    }
  });

  it('ทุกค่าในชุดที่ให้เลือกมีคำอธิบายบนปุ่มครบ', () => {
    for (const o of FOLLOW_OUTCOMES) {
      expect(FOLLOW_OUTCOME_HINT[o]?.trim()).toBeTruthy();
    }
  });

  it('ครบ 5 คำที่เจ้าของสั่ง 18 ส.ค. 2569 และไม่มีของเก่าปนในชุดที่ให้เลือก', () => {
    expect([...FOLLOW_OUTCOMES]).toEqual(['went', 'arrived', 'cancelled', 'leave', 'postponed']);
    expect(FOLLOW_OUTCOMES).not.toContain('done');
    expect(FOLLOW_OUTCOMES).not.toContain('other');
  });
});

describe('กติกาการใช้ค่า', () => {
  it('รับได้ทั้งชุดใหม่และชุดเก่า (กัน deploy คาบเกี่ยว หน้าเว็บเก่าค้างในเบราว์เซอร์คนใช้)', () => {
    expect(isFollowOutcome('went')).toBe(true);
    expect(isFollowOutcome('done')).toBe(true);
    expect(isFollowOutcome('ไปแล้ว')).toBe(false);
    expect(isFollowOutcome('')).toBe(false);
    expect(isFollowOutcome(null)).toBe(false);
    expect(isFollowOutcome(undefined)).toBe(false);
  });

  it('isCurrentFollowOutcome แยกชุดที่ให้เลือกตอนนี้ออกจากของเก่า', () => {
    expect(isCurrentFollowOutcome('went')).toBe(true);
    expect(isCurrentFollowOutcome('leave')).toBe(true);
    expect(isCurrentFollowOutcome('done')).toBe(false);
    expect(isCurrentFollowOutcome('no_show_start')).toBe(false);
  });

  it('“คนหลุดจากงาน” = ยกเลิก + คำเก่าที่หมายความเดียวกัน', () => {
    expect(isLostOutcome('cancelled')).toBe(true);
    expect(isLostOutcome('job_cancelled')).toBe(true);
    expect(isLostOutcome('no_show_start')).toBe(true);
    // ลา/เลื่อนแล้วยังกลับมาได้ · ไปแล้ว/ถึงแล้ว/เสร็จสิ้น คือจบดี · อื่น ๆ ไม่รู้เรื่องอะไร
    expect(isLostOutcome('leave')).toBe(false);
    expect(isLostOutcome('postponed')).toBe(false);
    expect(isLostOutcome('went')).toBe(false);
    expect(isLostOutcome('arrived')).toBe(false);
    expect(isLostOutcome('done')).toBe(false);
    expect(isLostOutcome('other')).toBe(false);
    expect(isLostOutcome('อะไรไม่รู้')).toBe(false);
  });

  it('บังคับหมายเหตุเฉพาะคำเก่า “อื่น ๆ” — ชุดใหม่ไม่บังคับสักคำ', () => {
    expect(requiresNote('other')).toBe(true);
    for (const o of FOLLOW_OUTCOMES) {
      expect(requiresNote(o)).toBe(false);
    }
  });
});
