/**
 * race ที่เจอจริง (11 ต.ค. 2569 17:08) — รอบดึง iRecruit ส่งแผนของสายที่ "พัก AI" เพิ่งเปลี่ยนเป็นคนโทร
 * ⇒ 18 สายเป็นคนโทรแต่ AI โทรไปแล้ว · แก้: ดึง / พัก AI / AI เริ่มโทรตั้งแต่ ใช้ล็อกเดียว เดินทีละงาน
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync('api/_lib/irecruitReplaceSync.ts', 'utf8');
const pg = readFileSync('api/_lib/postgres.ts', 'utf8');

describe('ล็อกรอบดึงส่งคนแทน', () => {
  it('สามงานใช้คีย์ล็อกเดียวกัน', () => {
    expect(src).toContain('return withSessionLock(REPLACE_SYNC_LOCK_KEY, () => runIrecruitReplaceSyncUnlocked(opts));');
    expect(src).toContain('return withSessionLock(REPLACE_SYNC_LOCK_KEY, () => enforceReplaceAiPausedUnlocked(now));');
  });
  it('🔴 ข้างในไม่เรียกตัวที่ล็อกซ้อน (ล็อก session คนละ connection = ค้างรอตัวเอง)', () => {
    const body = src.slice(src.indexOf('async function runIrecruitReplaceSyncUnlocked'));
    const end = body.indexOf('\nexport async function ');
    const inner = end > 0 ? body.slice(0, end) : body;
    expect(inner).not.toMatch(/\benforceReplaceAi(Paused|From)\(|\brunIrecruitReplaceSync\(/);
  });
  it('ล็อกปลดเสมอแม้งานข้างในล้ม', () => {
    expect(pg).toMatch(/finally \{\s*await client\.query\('select pg_advisory_unlock\(\$1\)', \[key\]\)/);
  });
});
