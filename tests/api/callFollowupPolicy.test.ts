// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CALL_FOLLOWUP_POLICY,
  isCallOutcome,
  isListedRetryTime,
  nextRetryAt,
  normalizeCallFollowupPolicy,
  normalizeRetryTimes,
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
    it(`${outcome}: ครั้งที่ 1 (10:00) → โทรซ้ำ 12:00 วันเดียวกัน (ค่าเริ่ม · เจ้าของ 26 ต.ค. 2569)`, () => {
      const d = resolveCallFollowup({ outcome, attemptCount: 1, now: NOW });
      expect(d.action).toBe('retry');
      expect(d.nextAttemptAt).toBeTruthy();
      expect(hoursFrom(NOW, d.nextAttemptAt as string)).toBe(2);
      expect(d.reason).toContain('2/3');
      expect(d.reason).toContain('วันนี้ 12:00');
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
  it('ไม่รับสายตอนตี 2 → โทรซ้ำ 12:00 วันนั้น', () => {
    // 5 ส.ค. 19:00Z = 6 ส.ค. 02:00 ไทย
    const night = new Date('2026-08-05T19:00:00.000Z');
    const d = resolveCallFollowup({ outcome: 'no_answer', attemptCount: 1, now: night });
    expect(bkkHour(d.nextAttemptAt as string)).toBe(12);
    expect(hoursFrom(night, d.nextAttemptAt as string)).toBe(10);
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

  it('ตั้งช่วงเงียบว่าง (from == to) = ไม่กันเวลา · มีช่วงเงียบ = เวลาที่ตกช่วงเงียบถูกข้าม', () => {
    const night = new Date('2026-08-05T19:00:00.000Z'); // 02:00 ไทย
    const open: CallFollowupPolicy = { ...DEFAULT_CALL_FOLLOWUP_POLICY, quietFromHour: 0, quietToHour: 0, retryTimes: ['23:00'] };
    expect(bkkHour(resolveCallFollowup({ outcome: 'no_answer', attemptCount: 1, now: night, policy: open }).nextAttemptAt as string)).toBe(23);
    const quiet: CallFollowupPolicy = { ...DEFAULT_CALL_FOLLOWUP_POLICY, retryTimes: ['23:00', '15:00'] };
    expect(bkkHour(resolveCallFollowup({ outcome: 'no_answer', attemptCount: 1, now: night, policy: quiet }).nextAttemptAt as string)).toBe(15);
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
    expect(normalizeCallFollowupPolicy({ maxAttempts: 999 }).maxAttempts).toBe(18); // เพดาน 18 (2 รอบ × 3 สาย × 3 วัน · 27 ต.ค. 2569)
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

/**
 * ═══ ใบสมัคร: โทรซ้ำ "คละช่วงเวลา" (เจ้าของเคาะ 29 ก.ย. 2569: *"โทรซ้ำคละช่วงเวลาจนครบ 3 ครั้ง"*) ═══
 */
describe('เวลาโทรซ้ำจากหน้าตั้งค่า (เจ้าของ 26 ต.ค. 2569 "โทรใหม่ตอนเที่ยง · ตั้งเวลาผ่าน UI")', () => {
  const at = (iso: string) => new Date(iso);
  const p = (retryTimes: string[]): CallFollowupPolicy => ({ ...DEFAULT_CALL_FOLLOWUP_POLICY, quietFromHour: 0, quietToHour: 0, retryTimes });
  it('ค่าเริ่ม = 12:00 · ตัวกรองค่า: ผิดรูปแบบตัดทิ้ง ซ้ำตัดทิ้ง เรียงเวลา ว่าง = 12:00', () => {
    expect(DEFAULT_CALL_FOLLOWUP_POLICY.retryTimes).toEqual(['12:00']);
    expect(normalizeRetryTimes(['17:30', '12:00', '25:00', 'x', '12:00'])).toEqual(['12:00', '17:30']);
    expect(normalizeRetryTimes([])).toEqual(['12:00']);
    expect(normalizeCallFollowupPolicy({ maxAttempts: 3 }).retryTimes).toEqual(['12:00']);
  });
  it('เวลาถัดไปที่ยังไม่ถึง วันเดียวกันได้ · เลยหมดแล้ว = เวลาแรกของวันถัดไป', () => {
    const times = p(['12:00', '17:30']);
    // 09:14 ไทย → 12:00 วันนี้
    expect(nextRetryAt(at('2026-10-26T02:14:00Z'), times).toISOString()).toBe('2026-10-26T05:00:00.000Z');
    // 12:03 ไทย → 17:30 วันนี้
    expect(nextRetryAt(at('2026-10-26T05:03:00Z'), times).toISOString()).toBe('2026-10-26T10:30:00.000Z');
    // 19:34 ไทย → 12:00 พรุ่งนี้
    expect(nextRetryAt(at('2026-10-26T12:34:00Z'), times).toISOString()).toBe('2026-10-27T05:00:00.000Z');
  });
  it('ต้องห่างจากตอนนี้อย่างน้อย 10 นาที (11:55 ไม่นัด 12:00 วันนี้)', () => {
    expect(nextRetryAt(at('2026-10-26T04:55:00Z'), p(['12:00'])).toISOString()).toBe('2026-10-27T05:00:00.000Z');
  });
  it('ตัวส่งซ้ำแยกนัดที่ตรงเวลาในรายการ ออกจากนัดแบบเก่า (10/14/18 · +24 ชม.)', () => {
    expect(isListedRetryTime(at('2026-10-26T05:00:00Z'), p(['12:00']))).toBe(true);
    expect(isListedRetryTime(at('2026-10-26T07:00:00Z'), p(['12:00']))).toBe(false);
    expect(isListedRetryTime(at('2026-10-26T05:00:30Z'), p(['12:00']))).toBe(false);
  });
});
