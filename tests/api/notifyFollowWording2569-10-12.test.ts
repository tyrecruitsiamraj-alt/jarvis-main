/**
 * QA รอบ 2 ข้อ 48 (12 ต.ค. 2569) — กระดิ่ง
 * - ผลสายติดตาม (job_ref = follow) เคยเด้ง "X สนใจงาน — รีบติดต่อกลับ · ใบขอ follow" + ลิงก์ /follow ทุกรายการ
 * - ไฟ "Lumos ดึงคิว" ค้างผิดปกติทั้งที่ Lumos เลิกดึงคิวแล้ว (ทุกเส้น push)
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync('api/_lib/callFollowup.ts', 'utf8');
const health = readFileSync('src/lib/systemHealth.ts', 'utf8');

describe('กระดิ่งผลโทร', () => {
  it('ติดตาม "ตอบว่าไป" ไม่เด้ง "สนใจงาน" · ผู้สมัครยังเด้งตามเดิม', () => {
    expect(src).toContain("const isFollow = row.job_ref === 'follow';");
    expect(src).toContain("if (input.outcome === 'confirmed' && !isFollow) {");
  });
  it('ลิงก์ตามชนิด · ไม่มีคำ "ใบขอ follow"', () => {
    expect(src).toContain("const link = isFollow ? '/follow' : '/jobs/board?view=list';");
    // + สายทักทายทั่วไป (job_ref 'greet' · 15 ต.ค. 2569) ไม่พูด "ใบขอ greet"
    expect(src).toMatch(/const where = isFollow\s*\?\s*'ติดตามเริ่มงาน'\s*:\s*row\.job_ref === GREETING_JOB_REF\s*\?\s*'AI ทักทาย \(ยังไม่ผูกใบขอ\)'\s*:\s*`ใบขอ \$\{row\.job_ref\}`;/);
    expect(src).not.toContain("body: `ใบขอ ${row.job_ref}");
  });
});

describe('ไฟสถานะระบบ', () => {
  it('ไม่มีไฟ "Lumos ดึงคิว" แล้ว', () => {
    expect(health).not.toContain("label: 'Lumos ดึงคิว'");
  });
});

describe('เบอร์ผู้สมัครไม่อยู่ใน URL (QA รอบ 2 ข้อ 49)', () => {
  it('หน้าเว็บถามล็อกด้วย POST body · ถอยไป GET เฉพาะ 403 (role อ่านอย่างเดียว)', () => {
    const api = readFileSync('src/lib/callHoldsApi.ts', 'utf8');
    expect(api).toContain("body: JSON.stringify({ action: 'lookup', phones: chunk }),");
    expect(api).toMatch(/if \(r\.status === 403\) \{\s*r = await apiFetch\(`\/api\/matching\/call-holds\?/);
  });
  it('server รับ action lookup ก่อนด่านจับล็อก (ไม่ต้องมี source/ใบขอ)', () => {
    const h = readFileSync('api/_handlers/matching-call-holds.ts', 'utf8');
    expect(h.indexOf("if (body.action === 'lookup')")).toBeGreaterThan(0);
    expect(h.indexOf("if (body.action === 'lookup')")).toBeLessThan(h.indexOf('const source = isCallHoldSource(body.source)'));
  });
});
