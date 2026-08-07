// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CALL_FOLLOWUP_POLICY,
  isCallOutcome,
  normalizeCallFollowupPolicy,
  resolveCallFollowup,
  shiftOutOfQuietHours,
  type CallFollowupPolicy,
} from '../../src/lib/callFollowupPolicy';

/** 6 ส.ค. 2569 10:00 ตามเวลาไทย = 03:00Z */
const NOW = new Date('2026-08-06T03:00:00.000Z');
const hoursFrom = (base: Date, iso: string) =>
  Math.round(((new Date(iso).getTime() - base.getTime()) / 3600000) * 10) / 10;
/** ชั่วโมงตามเวลาไทยของ ISO */
const bkkHour = (iso: string) => (new Date(iso).getUTCHours() + 7) % 24;

describe('ไม่รับสาย → โทรซ้ำจนครบเพดาน แล้วส่งให้คนตาม', () => {
  for (const outcome of ['no_answer', 'busy', 'unresponsive', 'failed'] as const) {
    it(`${outcome}: ครั้งที่ 1 → นัดโทรซ้ำอีก 24 ชม.`, () => {
      const d = resolveCallFollowup({ outcome, attemptCount: 1, now: NOW });
      expect(d.action).toBe('retry');
      expect(d.nextAttemptAt).toBeTruthy();
      expect(hoursFrom(NOW, d.nextAttemptAt as string)).toBe(24);
      expect(d.reason).toContain('2/3');
    });
  }

  it('ครั้งที่ 2 → ยังซ้ำได้', () => {
    const d = resolveCallFollowup({ outcome: 'no_answer', attemptCount: 2, now: NOW });
    expect(d.action).toBe('retry');
    expect(d.reason).toContain('3/3');
  });

  it('ครั้งที่ 3 (ครบเพดาน) → ต้องคนตาม ไม่โทรซ้ำอีก', () => {
    const d = resolveCallFollowup({ outcome: 'no_answer', attemptCount: 3, now: NOW });
    expect(d.action).toBe('needs_human');
    expect(d.nextAttemptAt).toBeNull();
    expect(d.reason).toContain('ต้องให้คนตาม');
  });

  it('เกินเพดานไปแล้ว (ข้อมูลเพี้ยน) ก็ยังไม่โทรซ้ำ', () => {
    expect(resolveCallFollowup({ outcome: 'no_answer', attemptCount: 99, now: NOW }).action).toBe(
      'needs_human',
    );
  });
});

describe('ขอเลื่อน → นัดใหม่ตามเวลาที่ผู้สมัครบอก', () => {
  it('บอกเวลามา → ใช้เวลานั้น', () => {
    const asked = '2026-08-06T11:00:00.000Z'; // 18:00 ไทย — พ้นช่วงเงียบ
    const d = resolveCallFollowup({
      outcome: 'reschedule_requested',
      attemptCount: 1,
      now: NOW,
      requestedCallbackAt: asked,
    });
    expect(d.action).toBe('retry');
    expect(bkkHour(d.nextAttemptAt as string)).toBe(18);
    expect(d.reason).toContain('ตามเวลาที่นัด');
  });

  it('ไม่บอกเวลา → +4 ชม.', () => {
    const d = resolveCallFollowup({ outcome: 'reschedule_requested', attemptCount: 1, now: NOW });
    expect(hoursFrom(NOW, d.nextAttemptAt as string)).toBe(4);
    expect(d.reason).toContain('ไม่ระบุเวลา');
  });

  it('บอกเวลาที่ผ่านมาแล้ว → ไม่เชื่อ ใช้ค่าเริ่มต้นแทน', () => {
    const d = resolveCallFollowup({
      outcome: 'reschedule_requested',
      attemptCount: 1,
      now: NOW,
      requestedCallbackAt: '2026-08-01T03:00:00.000Z',
    });
    expect(hoursFrom(NOW, d.nextAttemptAt as string)).toBe(4);
  });

  it('เวลาเพี้ยน → ไม่พัง ใช้ค่าเริ่มต้น', () => {
    const d = resolveCallFollowup({
      outcome: 'reschedule_requested',
      attemptCount: 1,
      now: NOW,
      requestedCallbackAt: 'ไม่ใช่เวลา',
    });
    expect(d.action).toBe('retry');
    expect(hoursFrom(NOW, d.nextAttemptAt as string)).toBe(4);
  });

  it('ขอเลื่อนซ้ำจนครบเพดาน → ให้คนโทรปิดเอง', () => {
    const d = resolveCallFollowup({
      outcome: 'reschedule_requested',
      attemptCount: 3,
      now: NOW,
    });
    expect(d.action).toBe('needs_human');
  });
});

describe('ห้ามโทรช่วงเงียบ 20:00–08:00', () => {
  it('24 ชม. ไปตกตอนตี 2 → เลื่อนไป 08:00', () => {
    // 5 ส.ค. 19:00Z = 6 ส.ค. 02:00 ไทย
    const night = new Date('2026-08-05T19:00:00.000Z');
    const d = resolveCallFollowup({ outcome: 'no_answer', attemptCount: 1, now: night });
    expect(bkkHour(d.nextAttemptAt as string)).toBe(8);
  });

  it('ผู้สมัครนัดเองตอน 22:00 ก็ยังถูกเลื่อนออกจากช่วงเงียบ', () => {
    const d = resolveCallFollowup({
      outcome: 'reschedule_requested',
      attemptCount: 1,
      now: NOW,
      requestedCallbackAt: '2026-08-06T15:00:00.000Z', // 22:00 ไทย
    });
    expect(bkkHour(d.nextAttemptAt as string)).toBe(8);
  });

  it('เวลาปกติไม่ถูกขยับ', () => {
    const at = new Date('2026-08-06T07:00:00.000Z'); // 14:00 ไทย
    expect(shiftOutOfQuietHours(at, DEFAULT_CALL_FOLLOWUP_POLICY).getTime()).toBe(at.getTime());
  });

  it('ตั้งช่วงเงียบว่าง (from == to) = ไม่กันเวลา', () => {
    const policy: CallFollowupPolicy = { ...DEFAULT_CALL_FOLLOWUP_POLICY, quietFromHour: 0, quietToHour: 0 };
    const night = new Date('2026-08-05T19:00:00.000Z');
    const d = resolveCallFollowup({ outcome: 'no_answer', attemptCount: 1, now: night, policy });
    expect(hoursFrom(night, d.nextAttemptAt as string)).toBe(24);
  });
});

describe('คุยติดแล้วได้คำตอบ', () => {
  it('สนใจ / รับทราบ → จบเรื่องนี้', () => {
    expect(resolveCallFollowup({ outcome: 'confirmed', attemptCount: 1, now: NOW }).action).toBe('closed');
    expect(resolveCallFollowup({ outcome: 'acknowledged', attemptCount: 1, now: NOW }).action).toBe('closed');
  });

  it('ไม่สนใจงานนี้ → จบแค่ใบนี้ ใบอื่นยังเสนอได้ (ไม่พักเบอร์)', () => {
    const d = resolveCallFollowup({
      outcome: 'declined',
      attemptCount: 1,
      now: NOW,
      declinedScope: 'job',
    });
    expect(d.action).toBe('closed');
    expect(d.suppressUntil).toBeNull();
    expect(d.reason).toContain('ใบขออื่นยังเสนอได้');
  });

  it('ไม่หางานแล้ว → พักเบอร์ 30 วัน ดับทุกใบ', () => {
    const d = resolveCallFollowup({
      outcome: 'declined',
      attemptCount: 1,
      now: NOW,
      declinedScope: 'all',
    });
    expect(d.action).toBe('suppress');
    expect(hoursFrom(NOW, d.suppressUntil as string)).toBe(30 * 24);
  });

  it('declined ที่ไม่บอก scope = ถือว่าไม่เอางานนี้ (ปลอดภัยกว่า ไม่ตัดคนออกจากระบบเอง)', () => {
    const d = resolveCallFollowup({ outcome: 'declined', attemptCount: 1, now: NOW });
    expect(d.action).toBe('closed');
  });

  it('เบอร์ผิด → ต้องคนตาม (โทรซ้ำก็เจอคนเดิม)', () => {
    const d = resolveCallFollowup({ outcome: 'wrong_person', attemptCount: 1, now: NOW });
    expect(d.action).toBe('needs_human');
  });

  it('ยกเลิกโดยคน → จบ ไม่ตามต่อ', () => {
    expect(resolveCallFollowup({ outcome: 'cancelled', attemptCount: 1, now: NOW }).action).toBe('closed');
  });
});

describe('normalize นโยบาย', () => {
  it('ค่าปกติผ่าน · ค่าเกินขอบถูกบีบ · ค่าเพี้ยนใช้ค่าเริ่มต้น', () => {
    expect(normalizeCallFollowupPolicy({ maxAttempts: 5 }).maxAttempts).toBe(5);
    expect(normalizeCallFollowupPolicy({ maxAttempts: 999 }).maxAttempts).toBe(10);
    expect(normalizeCallFollowupPolicy({ maxAttempts: 0 }).maxAttempts).toBe(1);
    expect(normalizeCallFollowupPolicy({ maxAttempts: 'สาม' }).maxAttempts).toBe(3);
    expect(normalizeCallFollowupPolicy(null)).toEqual(DEFAULT_CALL_FOLLOWUP_POLICY);
    expect(normalizeCallFollowupPolicy('x')).toEqual(DEFAULT_CALL_FOLLOWUP_POLICY);
  });

  it('เพดานโทรที่ตั้งเองมีผลจริง', () => {
    const policy = normalizeCallFollowupPolicy({ maxAttempts: 1 });
    expect(resolveCallFollowup({ outcome: 'no_answer', attemptCount: 1, now: NOW, policy }).action).toBe(
      'needs_human',
    );
  });
});

describe('isCallOutcome', () => {
  it('รับเฉพาะค่าที่ Lumos ส่งกลับได้จริง', () => {
    expect(isCallOutcome('no_answer')).toBe(true);
    expect(isCallOutcome('reschedule_requested')).toBe(true);
    expect(isCallOutcome('interested')).toBe(false);
    expect(isCallOutcome(null)).toBe(false);
  });
});
