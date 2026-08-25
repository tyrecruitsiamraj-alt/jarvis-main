// @vitest-environment node
/**
 * worker กันชื่อดอง — เทสต์ **โครงสร้าง/สวิตช์** (ไม่ยิงของจริง ฐาน dev = production)
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. **ปิดโดยค่าเริ่มต้น** — worker นี้ถอด claim ของคนจริงและยิงสายจริง
 *    (บทเรียน 19 ส.ค. 2569: ยามเฝ้าบนเครื่อง dev เด้ง "ERP ผิดปกติ" เข้าฐาน production)
 * 2. เข้าคิวผ่าน `enqueueLumosInterviewForApplications` → `insertQueueItems` เท่านั้น
 *    (คอขวดเดียวที่มีด่าน held/suppressed/declined/quiet-hours ครบ) — ห้าม insert เอง
 * 3. ปั๊ม `call_choice` **ก่อน** ส่ง ไม่ใช่หลัง (ล้มกลางทางแล้วห้ามยิงซ้ำคนเดิม)
 * 4. นับแถวด้วย `RETURNING` — `dbQuery` ของโปรเจกต์ไม่มี `rowCount`
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isClaimGuardEnabled } from '../../api/_lib/callChoiceWorker.js';

const SRC = readFileSync(new URL('../../api/_lib/callChoiceWorker.ts', import.meta.url), 'utf8');

/**
 * โค้ดจริงโดยไม่มีคอมเมนต์ — ต้องตัดก่อนตรวจ "ห้ามมีคำนี้" ทุกครั้ง
 * ไม่งั้นคอมเมนต์ที่อธิบายกับดัก (เช่น "dbQuery ไม่มี rowCount") ทำเทสต์ตกเอง
 */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('สวิตช์', () => {
  it('ไม่ตั้ง env = ปิด (fail-safe ไปทางไม่ทำ)', () => {
    const prev = process.env.CLAIM_GUARD_ENABLED;
    delete process.env.CLAIM_GUARD_ENABLED;
    expect(isClaimGuardEnabled()).toBe(false);
    process.env.CLAIM_GUARD_ENABLED = 'false';
    expect(isClaimGuardEnabled()).toBe(false);
    process.env.CLAIM_GUARD_ENABLED = 'maybe';
    expect(isClaimGuardEnabled()).toBe(false);
    if (prev === undefined) delete process.env.CLAIM_GUARD_ENABLED;
    else process.env.CLAIM_GUARD_ENABLED = prev;
  });

  it('เปิดได้ด้วย true/1/yes/on (ชุดเดียวกับ worker ตัวอื่น)', () => {
    const prev = process.env.CLAIM_GUARD_ENABLED;
    for (const v of ['true', '1', 'yes', 'on', 'TRUE', ' On ']) {
      process.env.CLAIM_GUARD_ENABLED = v;
      expect(isClaimGuardEnabled()).toBe(true);
    }
    if (prev === undefined) delete process.env.CLAIM_GUARD_ENABLED;
    else process.env.CLAIM_GUARD_ENABLED = prev;
  });
});

describe('โครงสร้างโค้ด (กับดักที่เคยเจ็บจริง)', () => {
  it('ใช้นิยามถังจาก OVERVIEW_BUCKETS ไม่เขียนเงื่อนไข claim ดองซ้ำ', () => {
    expect(SRC).toContain('OVERVIEW_BUCKETS.claimed_idle');
    expect(SRC).toContain('OVERVIEW_BUCKETS.awaiting_call_choice');
    // ห้ามเขียน interval '1 day' ของตัวเองมาตัดสินว่าใครดอง (นิยามอยู่ที่ถังที่เดียว)
    // ⚠️ ต้องกั้น `a.` ไว้ด้วย — `unclaimed_at` (ของกองรอเลือก ซึ่งกำหนดเวลาที่นี่ถูกต้อง)
    // มีคำว่า claimed_at อยู่ในตัว เผลอ match แล้วเทสต์ตกทั้งที่โค้ดถูก
    expect(CODE).not.toMatch(/a\.claimed_at\s*<\s*now\(\)\s*-\s*interval/);
  });

  it('เข้าคิวผ่านคอขวดเดิมเท่านั้น — ห้าม insert ลงตารางคิวเอง', () => {
    expect(CODE).toContain('enqueueLumosInterviewForApplications');
    expect(CODE).not.toMatch(/insert\s+into\s+.*lumos_dispatch_queue/i);
  });

  it('ปั๊ม call_choice = auto_ai ก่อนส่ง (อยู่ใน UPDATE ที่ returning แถวไปส่ง)', () => {
    const autoSend = SRC.slice(SRC.indexOf('async function autoSendToAi'));
    const stampAt = autoSend.indexOf("call_choice = 'auto_ai'");
    const enqueueAt = autoSend.indexOf('enqueueLumosInterviewForApplications');
    expect(stampAt).toBeGreaterThan(-1);
    expect(enqueueAt).toBeGreaterThan(stampAt);
  });

  it('นับแถวด้วย RETURNING (dbQuery ไม่มี rowCount)', () => {
    expect(CODE).toContain('returning');
    expect(CODE).not.toContain('rowCount');
  });

  it('เก็บชื่อคนที่โดนถอดไว้ก่อนล้าง claim (ไม่งั้นชื่อหายไปกับ update)', () => {
    expect(SRC).toContain('unclaimed_from_name = a.claimed_by_name');
  });

  it('เตือนหัวหน้าทั้ง admin และ supervisor + มี dedupeKey กันเตือนซ้ำ', () => {
    expect(SRC).toMatch(/notifyRoles\(\s*\['admin',\s*'supervisor'\]/);
    expect(SRC).toContain('unclaimDedupeKey');
  });

  it('อ่าน flag ใหม่ทุกรอบ — ปิดสวิตช์แล้วมีผลโดยไม่ต้องรีสตาร์ต', () => {
    const loop = SRC.slice(SRC.indexOf('while (!stopped)'));
    expect(loop).toContain('isClaimGuardEnabled()');
  });

  it('รอบที่ล้มต้องเก็บ error ไว้ในผล ไม่ใช่กลืนเงียบ', () => {
    expect(SRC).toContain('run.error');
    expect(SRC).toContain('migration 104');
  });
});

describe('สตาร์ทที่จุดเดียวกับ worker ตัวอื่น', () => {
  it('server/local-api.ts เรียก startClaimGuardWorker()', () => {
    const server = readFileSync(new URL('../../server/local-api.ts', import.meta.url), 'utf8');
    expect(server).toContain('startClaimGuardWorker');
  });
});
