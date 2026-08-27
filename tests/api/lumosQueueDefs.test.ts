/**
 * เทสต์คุมกติกา "หนึ่งเมตริก หนึ่งนิยาม" ของคิวโทร Lumos
 *
 * 🔴 **บั๊กที่เทสต์ชุดนี้เกิดมาเพื่อกัน** (วัดฐานจริง 26 ส.ค. 2569):
 * หน้าแรกขึ้น *"สายที่ส่ง AI ไปแล้วเงียบ 37 ราย"* พร้อมกับบอร์ดบนจอเดียวกันที่บอก
 * *"รอผลจาก Lumos 0"* — เพราะ `matching-flow-summary` เขียน `result is null` เอง
 * ส่วน `office-floor` เขียน `coalesce(last_outcome, ...)` · วัดฐานได้ 38 vs 0
 * และบอร์ด Lumos ใช้ `count(result)` เป็น "ได้ผลแล้ว" จึงรายงาน 3/59 ทั้งที่จริง 40/40
 *
 * ⚠️ เทสต์นี้ตรวจ **รูปของ SQL ที่ประกอบออกมา** ไม่ได้ยิงฐาน — ยิงฐานจริงคือหน้าที่ของ
 * การตรวจด้วยมือ (กติกาโปรเจกต์: ห้ามให้เทสต์แตะฐาน production)
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  queueActive,
  queueCancelled,
  queueHasResult,
  queueOutcome,
  queuePending,
  queueResultAt,
  queueSentAt,
  queueStale,
  queueStalePending,
  queueWaiting,
} from '../../api/_lib/lumosQueueDefs';

const ROOT = path.resolve(__dirname, '../..');

describe('นิยามกลางของคิว Lumos', () => {
  it('ผลของสายอ่านจาก last_outcome ก่อนเสมอ แล้วค่อยถอยไป result->>outcome', () => {
    expect(queueOutcome('q')).toBe(`coalesce(q.last_outcome, q.result->>'outcome')`);
    // ไม่มี alias = คิวรีที่ select จากตารางเดียว
    expect(queueOutcome('')).toBe(`coalesce(last_outcome, result->>'outcome')`);
  });

  it('"มีผลแล้ว" ต้องไม่ใช่แค่ result is null — ไม่งั้นสายที่คนบันทึกผลเองจะหายไป', () => {
    const sql = queueHasResult('q');
    expect(sql).toContain('last_outcome');
    expect(sql).not.toMatch(/\bresult is null\b/);
  });

  it('"ยกเลิก" นับทั้ง status และ outcome — แล้ว active ต้องเป็นส่วนเติมเต็มของมัน', () => {
    expect(queueCancelled('q')).toContain(`q.status = 'cancelled'`);
    expect(queueCancelled('q')).toContain(`= 'cancelled'`);
    expect(queueActive('q')).toBe(`(not ${queueCancelled('q')})`);
  });

  it('รอโทร / รอผลกลับ แยกกันด้วย status และทั้งคู่ต้องยังไม่มีผล', () => {
    expect(queuePending('q')).toContain(`q.status = 'pending'`);
    expect(queueWaiting('q')).toContain(`q.status = 'delivered'`);
    for (const sql of [queuePending('q'), queueWaiting('q')]) {
      expect(sql).toContain(`coalesce(q.last_outcome, q.result->>'outcome') is null`);
    }
  });

  it('เกณฑ์ "เงียบ" ต่างกันได้ตามจอ แต่ต้องต่อยอดจากนิยาม "ยังไม่มีผล" ตัวเดียวกัน', () => {
    const oneDay = queueStale("'1 day'", 'q');
    const twoDays = queueStale("'2 days'", 'q');
    expect(oneDay).toContain(queueWaiting('q'));
    expect(twoDays).toContain(queueWaiting('q'));
    expect(oneDay).toContain(`interval '1 day'`);
    expect(twoDays).toContain(`interval '2 days'`);
  });

  it('เวลาส่งออก/เวลาได้ผล ถอยไปใช้ updated_at ให้แถวก่อน migration 088', () => {
    expect(queueSentAt('q')).toBe('coalesce(q.first_delivered_at, q.updated_at)');
    expect(queueResultAt('q')).toBe('coalesce(q.first_result_at, q.updated_at)');
  });

  it('รอส่งออกนานเกินกำหนด ต่อยอดจาก "รอโทร" และดูจาก next_attempt_at ก่อน created_at', () => {
    const sql = queueStalePending("'2 days'", 'q');
    expect(sql).toContain(queuePending('q'));
    expect(sql).toContain('coalesce(q.next_attempt_at, q.created_at)');
  });
});

/**
 * 🔴 ด่านกันคนเขียนเงื่อนไขเอง — ถ้าเทสต์ข้อนี้แดง แปลว่ามีคนกำลังสร้าง
 * "นิยามที่สอง" ขึ้นมาอีก ซึ่งคือต้นเหตุที่ทำให้จอสองอันเถียงกันมาแล้ว
 */
describe('ห้ามมีนิยามที่สองของ "มีผลแล้ว" ในเส้นที่นับสายของหน้าแรก', () => {
  const GUARDED = [
    'api/_handlers/matching-flow-summary.ts',
    'api/_handlers/office-floor.ts',
    'api/_handlers/office-team.ts',
  ];

  it.each(GUARDED)('%s ไม่เช็ค status เปล่า ๆ โดยไม่ดูว่ามีผลแล้วหรือยัง', (rel) => {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
      .replace(/^\s*--.*$/gm, '');
    /**
     * 🔴 วัดฐาน 26 ส.ค. 2569: 8 แถวมี `status='pending'` ทั้งที่มีผลกลับครบแล้ว
     * ⇒ ใครนับ `status = 'pending'` ลอย ๆ จะรายงาน "รอส่งให้ AI โทร 8 สาย"
     * ทั้งที่ไม่มีใครรอสักคน · ต้องผ่าน `queuePending()` เท่านั้น
     */
    // จับเฉพาะตารางคิว (alias `q.` หรือไม่มี alias) — `p.status` เป็นตารางคำขอโพส คนละเรื่อง
    expect(code).not.toMatch(/(?:\bq\.status|(?<![a-z]\.)\bstatus)\s*=\s*'pending'/);
  });

  it.each(GUARDED)('%s ไม่เขียน result is null / count(result) เอง', (rel) => {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    // ตัดคอมเมนต์ออกก่อน — ไฟล์พวกนี้ "เล่าเรื่องบั๊ก" ด้วยคำเหล่านี้โดยตั้งใจ
    // (ทั้งคอมเมนต์ JS และคอมเมนต์ `--` ที่อยู่ในสตริง SQL)
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
      .replace(/^\s*--.*$/gm, '');
    expect(code).not.toMatch(/\bresult is null\b/);
    expect(code).not.toMatch(/count\(result\)/);
  });

  it.each(GUARDED)('%s import นิยามกลางมาใช้จริง', (rel) => {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    expect(src).toContain('lumosQueueDefs.js');
  });
});
