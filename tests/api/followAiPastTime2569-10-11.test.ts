// @vitest-environment node
/**
 * QA รอบ 2 ข้อ 24 (11 ต.ค. 2569) — ตารางหลายวันเริ่มวันนี้ 07:00 ตอนบ่าย เดิมส่งเวลาที่ผ่านไปแล้วให้ Lumos (อาจโทรทันที)
 * 🔴 เลยมาเกิน 10 นาที = คนโทร (AI ไม่โทรย้อนหลัง · กติกาเดียวกับส่งคนแทน) · ค่าเริ่มของฟอร์ม "ตอนนี้" ยังเป็นโทรเลย
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { isFollowAiTimePast } from '../../api/_handlers/follow';

const NOW = new Date('2026-10-11T08:00:00Z');

describe('isFollowAiTimePast', () => {
  it('เลยมาเกิน 10 นาที = ย้อนหลัง · ไม่ถึง 10 นาที/อนาคต = ไม่ใช่', () => {
    expect(isFollowAiTimePast(new Date('2026-10-11T00:00:00Z'), NOW)).toBe(true);
    expect(isFollowAiTimePast(new Date('2026-10-11T07:49:00Z'), NOW)).toBe(true);
    expect(isFollowAiTimePast(new Date('2026-10-11T07:55:00Z'), NOW)).toBe(false);
    expect(isFollowAiTimePast(new Date('2026-10-11T09:00:00Z'), NOW)).toBe(false);
  });

  it('ใช้ทั้งทางหลายสายและสายเดียว ก่อน insert (call_mode ของแถวเป็นคนโทรตั้งแต่สร้าง ไม่เข้าคิว AI)', () => {
    const src = readFileSync('api/_handlers/follow.ts', 'utf8');
    expect(src).toMatch(/\(r\.callMode \?\? base\.callMode\) === 'ai' && isFollowAiTimePast\(r\.when\) \? \{ \.\.\.r, callMode: 'manual' as const \}/);
    expect(src).toMatch(/if \(parsed\.value\.callMode === 'ai' && isFollowAiTimePast\(when\)\) parsed\.value\.callMode = 'manual';\s*let created = await insertFollowRow/);
  });
});
