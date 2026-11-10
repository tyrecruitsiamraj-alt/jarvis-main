/**
 * เจ้าของ 10 พ.ย. 2569 "หน้าหลัก หรือ ทุกหน้าเลยมั้งโหลดช้ามาก"
 * วัดแล้ว: ข้อเท็จจริงต่อใบสมัครอ่านล็อกโทรทั้งตาราง 6 รอบต่อใบ (~3.4 วิ) · หน้าหลักดึงก้อนที่ไม่มีการ์ดไหนใช้ (~3 วิ)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('หน้าช้า', () => {
  it('ดัชนีล็อกโทรด้วยรหัสใบ — เพิ่มอย่างเดียว', () => {
    const sql = readFileSync('migrations/174_call_holds_ref_idx.sql', 'utf8');
    expect(sql).toMatch(/create index if not exists candidate_call_holds_ref_idx\s+on candidate_call_holds \(source, candidate_ref\)/);
    expect(sql).not.toMatch(/drop |delete |update |alter /i);
  });
  it('หน้าหลักไม่ดึง /api/home-ai-share ก้อนหลักที่ไม่มีการ์ดใช้', () => {
    const page = readFileSync('src/pages/HomeOverviewPage.tsx', 'utf8');
    // ยิงได้ที่เดียว ใต้ `if (v5)` (โฉมต้นแบบใช้การ์ดดูแลหลังเริ่มงาน/จับคู่งาน) — หน้าหลักเดิมต้องไม่ยิง
    expect(page.split('fetchHomeAiShare(').length - 1).toBe(1);
    expect(page).toMatch(/if \(v5\) \{\s*setAiV5\(null\);\s*fetchHomeAiShare\(/);
  });
});
