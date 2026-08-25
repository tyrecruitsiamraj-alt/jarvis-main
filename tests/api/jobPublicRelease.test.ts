// @vitest-environment node
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
