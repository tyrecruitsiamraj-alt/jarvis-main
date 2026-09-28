import { describe, expect, it } from 'vitest';
import {
  APPLICATION_PUSH_RETRY_DEFAULTS as CFG,
  decideApplicationPushRetry,
  isQuietAt,
  readApplicationPushRetryConfig,
  retryScheduledAt,
} from './applicationPushRetryPolicy';
import { DEFAULT_CALL_FOLLOWUP_POLICY as POLICY } from './callFollowupPolicy';

/** เวลาไทย → Date (ไทยไม่มีเวลาออมแสง) */
const bkk = (s: string) => new Date(`${s}+07:00`);

describe('ช่วงห้ามโทร (นโยบายกลาง 20:00–08:00)', () => {
  it('20:00–07:59 ห้าม · 08:00–19:59 ได้', () => {
    expect(isQuietAt(bkk('2026-09-28T20:00:00'), POLICY)).toBe(true);
    expect(isQuietAt(bkk('2026-09-29T02:14:00'), POLICY)).toBe(true);
    expect(isQuietAt(bkk('2026-09-29T07:59:00'), POLICY)).toBe(true);
    expect(isQuietAt(bkk('2026-09-29T08:00:00'), POLICY)).toBe(false);
    expect(isQuietAt(bkk('2026-09-29T19:59:00'), POLICY)).toBe(false);
  });
});

describe('ส่งซ้ำ / รอ / เลิก', () => {
  it('ส่งไม่ถึงตอนบ่าย ⇒ ยิงซ้ำทันที นัดโทรอีก 10 นาที', () => {
    const now = bkk('2026-09-28T14:01:00');
    const d = decideApplicationPushRetry(bkk('2026-09-28T14:00:00'), CFG, POLICY, now);
    expect(d).toEqual({ action: 'push', scheduledAt: bkk('2026-09-28T14:11:00') });
  });

  it('🔴 ตอนนี้อยู่ในช่วงห้ามโทร ⇒ ไม่ยิงเลย (ไม่มีสายกลางคืนจากตัวส่งซ้ำ)', () => {
    const d = decideApplicationPushRetry(bkk('2026-09-28T21:00:00'), CFG, POLICY, bkk('2026-09-28T21:05:00'));
    expect(d).toEqual({ action: 'wait', reason: 'quiet_hours' });
  });

  it('ส่งไม่ถึงตอน 21:00 ⇒ ยิงตอนเช้า 08:00 นัด 08:10 (ยังไม่เกิน 24 ชม.)', () => {
    const d = decideApplicationPushRetry(bkk('2026-09-28T21:00:00'), CFG, POLICY, bkk('2026-09-29T08:00:00'));
    expect(d).toEqual({ action: 'push', scheduledAt: bkk('2026-09-29T08:10:00') });
  });

  it('นัดไว้ 09:00 (เคสกู้ 3 ใบ) ⇒ คืนนี้รอ · 08:00 ยิงโดยนัด 09:00 ตรง', () => {
    const due = bkk('2026-09-29T09:00:00');
    expect(decideApplicationPushRetry(due, CFG, POLICY, bkk('2026-09-28T20:30:00'))).toEqual({
      action: 'wait',
      reason: 'quiet_hours',
    });
    expect(decideApplicationPushRetry(due, CFG, POLICY, bkk('2026-09-29T08:00:00'))).toEqual({
      action: 'push',
      scheduledAt: due,
    });
  });

  it('นัดไว้ไกลกว่าช่วงยิงล่วงหน้า ⇒ ยังไม่ยิง', () => {
    const d = decideApplicationPushRetry(bkk('2026-09-29T15:00:00'), CFG, POLICY, bkk('2026-09-29T10:00:00'));
    expect(d).toEqual({ action: 'wait', reason: 'not_due_yet' });
  });

  it('🔴 เกิน 24 ชม. นับจากเวลาที่ควรโทร ⇒ เลิกส่ง AI', () => {
    const due = bkk('2026-09-27T15:00:00');
    expect(decideApplicationPushRetry(due, CFG, POLICY, bkk('2026-09-28T14:59:00')).action).toBe('push');
    expect(decideApplicationPushRetry(due, CFG, POLICY, bkk('2026-09-28T15:01:00'))).toEqual({ action: 'give_up' });
  });

  it('เลยเพดานตอนกลางคืนก็เลิกเลย ไม่ต้องรอเช้า (เลิก = ไม่มีสาย)', () => {
    const due = bkk('2026-09-27T21:00:00');
    expect(decideApplicationPushRetry(due, CFG, POLICY, bkk('2026-09-28T20:59:00'))).toEqual({
      action: 'wait',
      reason: 'quiet_hours',
    });
    expect(decideApplicationPushRetry(due, CFG, POLICY, bkk('2026-09-28T21:01:00'))).toEqual({ action: 'give_up' });
  });
});

describe('นัดเวลาโทรของรอบส่งซ้ำ', () => {
  it('ไม่มีนัด ⇒ อีก 10 นาที · อีก 10 นาทีตกช่วงห้าม ⇒ เลื่อนไปเช้า', () => {
    expect(retryScheduledAt(null, bkk('2026-09-28T13:00:00'), POLICY)).toEqual(bkk('2026-09-28T13:10:00'));
    expect(retryScheduledAt(null, bkk('2026-09-28T19:55:00'), POLICY)).toEqual(bkk('2026-09-29T08:00:00'));
  });
});

describe('ค่าตั้งจาก env', () => {
  it('ไม่ได้ตั้ง = ค่าเริ่มต้น (ระวัง Number("") = 0) · ปิดได้ · ตัวเลขถูกบีบเข้าขอบ', () => {
    expect(readApplicationPushRetryConfig({})).toEqual(CFG);
    expect(readApplicationPushRetryConfig({ APPLICATION_PUSH_RETRY_ENABLED: 'false' }).enabled).toBe(false);
    expect(readApplicationPushRetryConfig({ APPLICATION_PUSH_RETRY_GIVE_UP_MIN: '' }).giveUpAfterMinutes).toBe(1440);
    expect(readApplicationPushRetryConfig({ APPLICATION_PUSH_RETRY_GIVE_UP_MIN: '5' }).giveUpAfterMinutes).toBe(60);
  });
});
