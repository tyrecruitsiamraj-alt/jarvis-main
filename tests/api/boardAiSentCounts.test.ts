// @vitest-environment node
/**
 * 🔴 การ์ดกล่องงานบอก "ส่ง AI แล้ว x/y คน" (เจ้าของเคาะ 22 ก.ย. 2569 นิยามข้อ 6)
 *
 * handler คุย Postgres ตรง — SQL จริงถูกวัดกับฐาน production แล้ว (ใบที่มีผู้สมัคร
 * ส่งครบ 1/1 · ใบ lead/ไม่มี job_id ไม่ถูกนับ) · เทสต์นี้ pin โครงไว้กันย้อนกลับ
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');
const HANDLER = read('api/_handlers/job-applications.ts');
const CLIENT = read('src/lib/publicApplicationsApi.ts');

describe('SQL ของ aiCounts ต้องแม่นและไม่โกหก', () => {
  it('🔴 sent จับด้วย person_ref = app-<id> (ไม่พึ่งเบอร์ที่ซ้ำข้ามใบได้)', () => {
    const at = HANDLER.indexOf('let aiCounts');
    expect(at).toBeGreaterThan(-1);
    const block = HANDLER.slice(at, at + 900);
    expect(block).toContain("'app-' || a.id::text");
    expect(block).toContain('q.person_ref =');
  });

  it('🔴 total = ชุดเดียวกับ counts บนการ์ด (job_id not null · not is_lead)', () => {
    const at = HANDLER.indexOf('let aiCounts');
    const block = HANDLER.slice(at, at + 900);
    expect(block).toContain('a.job_id is not null and not a.is_lead');
  });

  it('🔴 อ่านไม่ได้ = ไม่ส่งคีย์ ไม่ใช่ส่งศูนย์', () => {
    const at = HANDLER.indexOf('let aiCounts');
    const block = HANDLER.slice(at, at + 1100);
    expect(block).toContain('aiCounts = undefined;');
    // response ต่อคีย์เฉพาะเมื่อมีค่า
    expect(HANDLER).toContain('...(aiCounts ? { aiCounts } : {}),');
  });

  it('เคารพ department scope เหมือนตัวนับอื่น', () => {
    const at = HANDLER.indexOf('let aiCounts');
    const block = HANDLER.slice(at, at + 900);
    expect(block).toContain('scopedJobIds');
  });
});

describe('ฝั่ง client ต้องรับ aiCounts และมี default ปลอดภัย', () => {
  it('type + ส่งต่อ + fallback ครบ', () => {
    expect(CLIENT).toContain('aiCounts: Record<string, { sent: number; total: number }>');
    expect(CLIENT).toContain('aiCounts: body.aiCounts ?? {}');
    // fallback ตอน !r.ok ต้องมี aiCounts ด้วย
    const at = CLIENT.indexOf('if (!r.ok) return {');
    expect(CLIENT.slice(at, at + 120)).toContain('aiCounts: {}');
  });
});
