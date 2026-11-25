// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * แบบทดสอบ: กันเดาวันเกิด + ลิงก์หมดอายุ (เจ้าของ 25 พ.ย. 2569 ตรวจความปลอดภัยลิงก์)
 * เดิมรู้เลขบัตร + มีลิงก์ชุด = เดาวันเกิดได้เรื่อย ๆ (เพดานต่อ IP) แล้วเข้าไปทำข้อสอบแทนเจ้าของ
 */
const dbQuery = vi.fn();
vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: (...a: unknown[]) => dbQuery(...a), dbTransaction: vi.fn() }));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));

const { resumeQuizAttempt, isQuizAttemptExpired, QUIZ_RESUME_MAX_FAILS } = await import('../../api/_lib/skillQuiz.js');

const NOW = new Date('2026-11-25T03:00:00.000Z');
const row = (o: Record<string, unknown> = {}) => ({
  id: '5b1f0c2e-1d3a-4c8b-9f00-000000000001',
  token: 'Qz8xK2mP0vR7tY1wE4uI9oA3',
  bd: '1990-05-14',
  fails: 0,
  locked_until: null,
  created_at: '2026-11-24T03:00:00.000Z',
  submitted_at: null,
  ...o,
});

beforeEach(() => dbQuery.mockReset());

describe('เข้าซ้ำด้วยเลขบัตร + วันเกิด', () => {
  it('ตรง = ได้ลิงก์เดิม · เคยผิดมาก่อน = ล้างนับ', async () => {
    dbQuery.mockResolvedValueOnce({ rows: [row({ fails: 2 })] }).mockResolvedValue({ rows: [] });
    expect(await resumeQuizAttempt('set-1', 'hash', '1990-05-14', NOW)).toEqual({ kind: 'ok', token: 'Qz8xK2mP0vR7tY1wE4uI9oA3' });
    expect(String(dbQuery.mock.calls[1][0])).toContain('set resume_fail_count = 0, resume_locked_until = null');
  });
  it('วันเกิดผิด = นับเพิ่มในฐาน · ครบเพดานแล้วฐานบอกว่าล็อก', async () => {
    dbQuery.mockResolvedValueOnce({ rows: [row({ fails: QUIZ_RESUME_MAX_FAILS - 1 })] }).mockResolvedValueOnce({ rows: [{ locked: true }] });
    expect(await resumeQuizAttempt('set-1', 'hash', '1990-05-15', NOW)).toEqual({ kind: 'locked' });
    expect(dbQuery.mock.calls[1][1]).toEqual([row().id, 5, 24]);
  });
  it('ล็อกอยู่ = ไม่ตรวจวันเกิดเลย แม้กรอกถูก', async () => {
    dbQuery.mockResolvedValueOnce({ rows: [row({ locked_until: '2026-11-25T20:00:00.000Z' })] });
    expect(await resumeQuizAttempt('set-1', 'hash', '1990-05-14', NOW)).toEqual({ kind: 'locked' });
    expect(dbQuery).toHaveBeenCalledTimes(1);
  });
  it('ไม่มีใบของเลขบัตรนี้ = ไม่พบ (ไม่นับ) · ลิงก์เกิน 7 วัน = หมดอายุ', async () => {
    dbQuery.mockResolvedValueOnce({ rows: [] });
    expect(await resumeQuizAttempt('set-1', 'hash', '1990-05-14', NOW)).toEqual({ kind: 'miss' });
    dbQuery.mockResolvedValueOnce({ rows: [row({ created_at: '2026-11-17T02:00:00.000Z' })] });
    expect(await resumeQuizAttempt('set-1', 'hash', '1990-05-14', NOW)).toEqual({ kind: 'expired' });
  });
});

describe('ลิงก์ใบข้อสอบหมดอายุ 7 วัน (เฉพาะใบที่ยังไม่ส่ง)', () => {
  it('7 วันพอดียังได้ · เกิน = หมดอายุ · ส่งแล้วไม่หมดอายุ', () => {
    expect(isQuizAttemptExpired({ created_at: '2026-11-18T03:00:00.000Z', submitted_at: null }, NOW)).toBe(false);
    expect(isQuizAttemptExpired({ created_at: '2026-11-18T02:59:00.000Z', submitted_at: null }, NOW)).toBe(true);
    expect(isQuizAttemptExpired({ created_at: '2026-10-01T00:00:00.000Z', submitted_at: '2026-10-01T01:00:00.000Z' }, NOW)).toBe(false);
  });
  it('เส้นสาธารณะ: เปิด/ส่ง/เข้าซ้ำ ตอบ 410 เมื่อหมดอายุ · ล็อกตอบ 429', () => {
    const h = readFileSync(resolve(__dirname, '../../api/_handlers/public/skill-quiz.ts'), 'utf8');
    expect(h.match(/if \(isQuizAttemptExpired\(a\)\) return sendError\(res, 410, 'expired', EXPIRED\);/g)).toHaveLength(2);
    expect(h).toContain("if (found.kind === 'locked') return sendError(res, 429, 'locked', RESUME_LOCKED);");
    const m = readFileSync(resolve(__dirname, '../../migrations/199_skill_quiz_resume_guard.sql'), 'utf8');
    expect(m).not.toMatch(/^\s*(drop|delete|update|truncate)\b/im);
  });
});
