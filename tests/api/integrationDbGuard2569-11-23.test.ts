/**
 * 🔴 23 พ.ย. 2569: เทสต์ส่งเอกสาร (ล้างตาราง) เคยรันไปโดนฐานจริง เพราะ api/_lib/env.ts อ่าน .env.local แล้วเขียนทับ DATABASE_URL
 * กันไว้ 2 ชั้น — ห้ามถอด
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('เทสต์ที่ล้างตารางต้องไม่มีทางถึงฐานจริง', () => {
  it('harness ปิดตัวโหลด .env.local ของระบบ', () => {
    expect(readFileSync('tests/integration/documents/harness.ts', 'utf8')).toContain("process.env.JARVIS_SKIP_LOCAL_ENV = '1'");
    expect(readFileSync('api/_lib/env.ts', 'utf8')).toContain("process.env.JARVIS_SKIP_LOCAL_ENV === '1'");
  });
  it('resetAll ถามฐานที่ต่ออยู่จริงก่อนล้าง (ชื่อฐาน _docs/_test · เครื่องนี้)', () => {
    const src = readFileSync('tests/integration/documents/fixtures.ts', 'utf8');
    expect(src).toMatch(/export async function resetAll\(\): Promise<void> \{\n {2}await assertLocalTestDb\(\);/);
    expect(src).toContain('select current_database() as db, inet_server_addr()::text as addr');
  });
});
