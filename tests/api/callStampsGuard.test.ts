// @vitest-environment node
/**
 * Guard ของ migration 088 — เวลาแบบเขียนครั้งเดียว (first_delivered_at / first_result_at /
 * last_result_at / result_at) คือหลักฐาน "โทรแล้ว/เวลารอโทร" ของ dashboard
 *
 * กติกา 2 ข้อที่ไฟล์นี้คุม (พังแล้วเงียบสนิท ระบบตอบ 200 ทุกทาง):
 * 1. **จุด reset ใด ๆ ห้ามแตะคอลัมน์ first_*** — retry (callFollowup) และ revive
 *    (REVIVE_CANCELLED_SET) ล้าง result/delivered_at ได้ แต่ล้าง stamp = ประวัติหายถาวร
 * 2. **จุดบันทึกผลต้อง stamp** — applyLumosResult ต้องมี first_result_at/last_result_at
 *    · recordCallResult ต้องมี result_at
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (p: string) => readFileSync(path.resolve(process.cwd(), p), 'utf8');

/** ตัดคอมเมนต์ออก — ไฟล์พวกนี้อธิบายกับดักไว้ในคอมเมนต์ (คำว่า first_* โผล่ในคำเตือน) */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('--'))
    .join('\n');
}

describe('จุด reset ห้ามแตะ stamp (088)', () => {
  it('REVIVE_CANCELLED_SET (lumosDispatch) ไม่ล้าง first_*/last_result_at', () => {
    const code = stripComments(read('api/_lib/lumosDispatch.ts'));
    const m = code.match(/const REVIVE_CANCELLED_SET = `([\s\S]*?)`/);
    expect(m).toBeTruthy();
    expect(m![1]).not.toMatch(/first_delivered_at|first_result_at|last_result_at/);
  });

  it('retry reset (callFollowup ทั้ง 2 จุด) ไม่ล้าง first_*/last_result_at', () => {
    const code = stripComments(read('api/_lib/callFollowup.ts'));
    const resets = code.match(/set status = 'pending', result = null[\s\S]*?where id = \$1/g) ?? [];
    expect(resets.length).toBeGreaterThanOrEqual(2);
    for (const r of resets) {
      expect(r).not.toMatch(/first_delivered_at|first_result_at|last_result_at/);
    }
  });
});

describe('จุดบันทึกผลต้อง stamp (088)', () => {
  it('applyLumosResult stamp first_result_at แบบ coalesce + last_result_at', () => {
    const code = stripComments(read('api/_lib/lumosDispatch.ts'));
    expect(code).toMatch(/first_result_at = coalesce\(first_result_at, now\(\)\)/);
    expect(code).toMatch(/last_result_at = now\(\)/);
  });

  it('takePendingLumosItems stamp first_delivered_at แบบ coalesce', () => {
    const code = stripComments(read('api/_lib/lumosDispatch.ts'));
    expect(code).toMatch(/first_delivered_at = coalesce\(first_delivered_at, now\(\)\)/);
  });

  it('recordCallResult stamp result_at', () => {
    const code = stripComments(read('api/_lib/candidateCallHolds.ts'));
    expect(code).toMatch(/result_at\s+= now\(\)/);
  });

  it('migration 088 มี backfill ทั้งสองตาราง', () => {
    const sql = read('migrations/088_call_time_stamps.sql');
    expect(sql).toMatch(/first_result_at = updated_at/);
    expect(sql).toMatch(/result_at = coalesce\(updated_at, released_at, held_at\)/);
  });
});
