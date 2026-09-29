// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildReleaseIndex, requestNoOf, type JobRelease } from '@/lib/jobPublicReleaseApi';

/**
 * ทะเบียน "ปล่อยใบขอขึ้นหน้าสาธารณะ" (Phase 5 · เจ้าของเคาะ 22 ส.ค. 2569 — ทุกใบต้องกดปล่อย)
 *
 * 🔴 ที่ต้องล็อกแน่นสุดคือ **กับดัก pre:/sql:** ของโปรเจกต์นี้:
 * feed ให้ใบล่วงหน้าเป็น `siamraj-pre:LBM...` แต่ของฝั่งเราบางที่เก็บ `siamraj-sql:LBM...`
 * ถ้าเทียบ id เต็มอย่างเดียว ใบล่วงหน้าที่ปล่อยแล้วจะ **ไม่ขึ้นหน้าสาธารณะ** ทั้งกอง
 * (เป็นบั๊กเดิมที่ทำให้ชิป "ปล่อยลิงก์แล้ว" ไม่ติดกับใบล่วงหน้ามาก่อน)
 */

const rel = (job_id: string, request_no: string | null = null): JobRelease => ({
  job_id,
  request_no,
  released_at: '2026-08-23T00:00:00.000Z',
  released_by_name: 'tester@example.com',
  note: null,
});

describe('requestNoOf', () => {
  it('ตัด prefix ออกได้ทุกแบบ', () => {
    expect(requestNoOf('siamraj-sql:OPL6908001')).toBe('OPL6908001');
    expect(requestNoOf('siamraj-pre:LBM6908001')).toBe('LBM6908001');
    expect(requestNoOf('OPL6908001')).toBe('OPL6908001');
  });
});

describe('buildReleaseIndex', () => {
  it('ทะเบียนว่าง = ไม่มีใบไหนปล่อย (พฤติกรรมตั้งต้นที่เจ้าของสั่ง)', () => {
    const idx = buildReleaseIndex([]);
    expect(idx.count).toBe(0);
    expect(idx.has('siamraj-sql:OPL6908001')).toBe(false);
  });

  it('เจอด้วย id เต็ม', () => {
    const idx = buildReleaseIndex([rel('siamraj-sql:OPL6908001', 'OPL6908001')]);
    expect(idx.has('siamraj-sql:OPL6908001')).toBe(true);
    expect(idx.has('siamraj-sql:OPL9999999')).toBe(false);
  });

  it('🔴 ปล่อยด้วย prefix หนึ่ง แล้ว feed ส่ง prefix อีกแบบ — ต้องยังเจอ (กับดัก pre:/sql:)', () => {
    const idx = buildReleaseIndex([rel('siamraj-sql:LBM6908001', 'LBM6908001')]);
    expect(idx.has('siamraj-pre:LBM6908001'), 'ใบล่วงหน้าที่ปล่อยแล้วต้องขึ้น').toBe(true);

    const flipped = buildReleaseIndex([rel('siamraj-pre:LBM6908002', 'LBM6908002')]);
    expect(flipped.has('siamraj-sql:LBM6908002')).toBe(true);
  });

  it('แถวเก่าที่ไม่มี request_no ก็ยังเทียบได้ (แยกเลขที่จาก id เอง)', () => {
    const idx = buildReleaseIndex([rel('siamraj-sql:OPL6908003', null)]);
    expect(idx.has('siamraj-pre:OPL6908003')).toBe(true);
  });

  it('ไม่จับผิดใบที่เลขที่ต่างกันแม้ขึ้นต้นเหมือนกัน', () => {
    const idx = buildReleaseIndex([rel('siamraj-sql:OPL690800', 'OPL690800')]);
    expect(idx.has('siamraj-sql:OPL6908001')).toBe(false);
  });
});

/**
 * ═══ ดึงลงจากหน้าสาธารณะ (เจ้าของเคาะ 29 ก.ย. 2569) ═══
 * *"ถ้าอันไหนต้องการเอาออกจากหน้าสาธารณะต้องมีปุ่มให้ย้อนกลับมาได้"* → ปุ่มบนหัวป๊อป ข้างป้าย "ปล่อยแล้ว"
 * + ดึง 81 ใบที่ปล่อยตอนทดลองโดยไม่มี Gen link ลง (migration 126 · คืนกลับได้ทั้งชุด)
 */
describe('ดึงลงจากหน้าสาธารณะ — ปุ่มย้อนกลับ + ถอน 81 ใบที่ปล่อยตอนทดลอง', () => {
  const read = (rel: string) => readFileSync(resolve(__dirname, '../..', rel), 'utf8');
  const popup = read('src/pages/jobs/BoardPostingPage.tsx');
  const m126 = read('migrations/126_withdraw_trial_releases_2569_09_29.sql');
  const m127 = read('migrations/127_close_stale_match_retries_2569_09_29.sql');

  it('ป๊อปไล่งาน: ใบที่ปล่อยแล้วมีปุ่มดึงลงข้างป้ายเลย (ไม่ต้องไล่ไปขั้น 4) · ปุ่มเล็กแบบกล่องงาน · ปุ่มเดิมขั้น 4 ยังอยู่', () => {
    const badge = popup.indexOf('✓ ปล่อยขึ้นหน้าสาธารณะแล้ว');
    const headerButton = popup.indexOf("'ดึงลงจากหน้าสาธารณะ'");
    expect(badge).toBeGreaterThan(-1);
    expect(headerButton).toBeGreaterThan(badge);
    const between = popup.slice(badge, headerButton);
    expect(between).toContain('size="xs"');
    expect(between).toContain('toggleRelease(false)');
    expect(popup).toContain("'ดึงประกาศลงจากหน้าสาธารณะ'");
  });

  it('🔴 migration 126: id เต็มเท่านั้น 81 ใบ · ใบที่มี Gen link ระหว่างนี้ไม่ดึงลง · สำรองแถวก่อนลบ (คืนกลับได้)', () => {
    const ids = m126.match(/\('siamraj-[a-z]+:[A-Z0-9]+'\)/g) ?? [];
    expect(ids).toHaveLength(81);
    expect(new Set(ids).size).toBe(81);
    expect(m126).toContain('where r.job_id = t.job_id');
    expect(m126).not.toMatch(/request_no\s*=|regexp_replace/);
    expect(m126).toContain('not exists (select 1 from recruit_postings p where p.job_id = r.job_id)');
    expect(m126).toContain('create table if not exists job_public_releases_backup_126');
    expect(m126).toMatch(/returning r\.\*[\s\S]*insert into job_public_releases_backup_126/);
    expect(m126).toContain('on conflict (job_id) do nothing');
  });

  it('🔴 migration 127: ปิดธงโทรซ้ำค้าง ส.ค. 37 แถวด้วย id · เฉพาะที่ยังค้างแบบเดิมจริง · ไม่แตะสถานะคิว', () => {
    const list = m127.match(/where id in \(([^)]*)\)/)?.[1] ?? '';
    expect(list.split(',').map((x) => x.trim()).filter(Boolean)).toHaveLength(37);
    expect(m127).toContain("set followup_state = 'closed'");
    expect(m127).toContain("and followup_state = 'retry_scheduled'");
    expect(m127).toContain("and status = 'delivered'");
    expect(m127).toContain('and result is null');
    expect(m127).not.toMatch(/set[\s\S]*status = 'cancelled'/);
    expect(m127).not.toMatch(/like '%/);
  });
});
