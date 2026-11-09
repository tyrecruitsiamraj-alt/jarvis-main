// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CALL_FOLLOWUP_POLICY,
  isCallOutcome,
  nextRetryAt,
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

describe('ไม่รับสาย → โทรซ้ำเป็นรอบจนครบเพดาน แล้วส่งให้คนตาม (27 ต.ค. 2569)', () => {
  for (const outcome of ['no_answer', 'busy', 'unresponsive', 'failed'] as const) {
    it(`${outcome}: สายที่ 1 (10:00) → โทรซ้ำอีก 10 นาที (สายที่ 2/18)`, () => {
      const d = resolveCallFollowup({ outcome, attemptCount: 1, now: NOW });
      expect(d.action).toBe('retry');
      expect(new Date(d.nextAttemptAt as string).getTime() - NOW.getTime()).toBe(10 * 60_000);
      expect(d.reason).toContain('2/18');
      expect(d.reason).toContain('วันนี้ 10:10');
    });
  }

  it('สายที่ 3 ไม่ติด (จบรอบ 1) → อีก 2 ชม.', () => {
    const d = resolveCallFollowup({ outcome: 'no_answer', attemptCount: 3, now: NOW });
    expect(d.action).toBe('retry');
    expect(hoursFrom(NOW, d.nextAttemptAt as string)).toBe(2);
  });

  it('สายที่ 18 (ครบเพดาน) → ต้องคนตาม ไม่โทรซ้ำอีก', () => {
    const d = resolveCallFollowup({ outcome: 'no_answer', attemptCount: 18, now: NOW });
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
      attemptCount: 18,
      now: NOW,
    });
    expect(d.action).toBe('needs_human');
  });
});

describe('ห้ามโทรช่วงเงียบ 20:00–08:00', () => {
  it('ไม่รับสายตอนตี 2 → โทรซ้ำอีก 10 นาที ไม่เลื่อนไปเช้า (ถอดช่วงโทร 08:00–20:00 · เจ้าของ 9 พ.ย. 2569 "ไม่จำกัดเลย")', () => {
    // 5 ส.ค. 19:00Z = 6 ส.ค. 02:00 ไทย
    const night = new Date('2026-08-05T19:00:00.000Z');
    const d = resolveCallFollowup({ outcome: 'no_answer', attemptCount: 1, now: night });
    expect(Date.parse(d.nextAttemptAt as string) - night.getTime()).toBe(10 * 60_000);
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
  it('รวมโทรได้ = สายต่อรอบ × รอบต่อวัน × วัน (ตั้ง maxAttempts ตรง ๆ ไม่มีผล) · ค่าเกินขอบถูกบีบ · ค่าเพี้ยนใช้ค่าเริ่มต้น', () => {
    expect(DEFAULT_CALL_FOLLOWUP_POLICY.maxAttempts).toBe(18);
    expect(normalizeCallFollowupPolicy({ maxAttempts: 5 }).maxAttempts).toBe(18);
    expect(normalizeCallFollowupPolicy({ roundCalls: 2, roundsPerDay: 1, retryDays: 2 }).maxAttempts).toBe(4);
    expect(normalizeCallFollowupPolicy({ roundCalls: 99 }).roundCalls).toBe(5);
    expect(normalizeCallFollowupPolicy({ roundGapMinutes: 1 }).roundGapMinutes).toBe(10);
    // ช่วงโทรได้ถอดแล้ว (9 พ.ย. 2569) — ค่าเก่าที่บันทึกไว้ไม่มีผล
    expect(normalizeCallFollowupPolicy({ callFrom: '08:00', callTo: '20:00' })).not.toHaveProperty('callFrom');
    expect(normalizeCallFollowupPolicy(null)).toEqual(DEFAULT_CALL_FOLLOWUP_POLICY);
    expect(normalizeCallFollowupPolicy('x')).toEqual(DEFAULT_CALL_FOLLOWUP_POLICY);
  });

  it('เพดานโทรที่ตั้งเองมีผลจริง', () => {
    const policy = normalizeCallFollowupPolicy({ roundCalls: 1, roundsPerDay: 1, retryDays: 1 });
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
 * ═══ โทรซ้ำเป็นรอบ (เจ้าของ 27 ต.ค. 2569) ═══
 * > *"กรอกมาตอนไหนก็โทรเลย ถ้าไม่รับก็โทรซ้ำ 3 รอบ ถ้าไม่รับก็บวกไปอีก 2 ชม … ไปรอโทรวันถัดไป คนละเวลา"*
 * Choice: เว้น 10 นาที · เช้าสลับบ่าย · โทรแค่ 08:00–20:00
 */
describe('โทรซ้ำเป็นรอบ 3 สาย × 2 รอบ × 3 วัน', () => {
  const bkk = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 16).replace('T', ' ');
  /** ไล่ทั้ง 18 สาย: กรอก `startIso` แล้วไม่รับทุกสาย — คืนเวลาไทยของทุกสาย */
  /** แบบเดิม: ครบรอบของวัน = โทรวันถัดไป (ตั้งค่า "วันถัดไป") */
  const NEXT = normalizeCallFollowupPolicy({ retryDayMode: 'next' });
  const chain = (startIso: string, policy: CallFollowupPolicy = NEXT) => {
    const out: string[] = [];
    let at = new Date(startIso);
    for (let n = 1; n <= 18; n += 1) {
      out.push(bkk(at));
      if (n < 18) at = nextRetryAt(at, n, policy);
    }
    return out;
  };

  it('ค่าเริ่ม = เสาร์-อาทิตย์ (เจ้าของ 4 พ.ย. 2569) · บันทึกค่าเพี้ยน = ค่าเริ่ม', () => {
    expect(DEFAULT_CALL_FOLLOWUP_POLICY.retryDayMode).toBe('weekend');
    expect(normalizeCallFollowupPolicy({ retryDayMode: 'tomorrow' }).retryDayMode).toBe('weekend');
    expect(normalizeCallFollowupPolicy({ retryDayMode: 'next' }).retryDayMode).toBe('next');
  });

  it('เสาร์-อาทิตย์: กรอกอังคาร → อังคาร · เสาร์ · อาทิตย์ แล้วครบ 3 วัน (จ–ศ เหลือแต่รายชื่อใหม่)', () => {
    const W = normalizeCallFollowupPolicy({});
    const c = chain('2026-10-27T02:00:00Z', W);
    expect(c.slice(5, 8)).toEqual(['2026-10-27 11:40', '2026-10-31 13:00', '2026-10-31 13:10']);
    expect(c.slice(11, 14)).toEqual(['2026-10-31 15:40', '2026-11-01 09:00', '2026-11-01 09:10']);
    expect(c[17]).toBe('2026-11-01 11:40');
    // ครบ 18 สาย = ส่งให้คนตาม (ไม่โทรต่อ)
    expect(resolveCallFollowup({ outcome: 'no_answer', attemptCount: 18, now: new Date('2026-11-01T04:40:00Z'), policy: W }).action).toBe('needs_human');
  });

  it('เสาร์-อาทิตย์: กรอกเสาร์ → อาทิตย์ → เสาร์หน้า · กรอกอาทิตย์ → เสาร์หน้า', () => {
    const W = normalizeCallFollowupPolicy({});
    const sat = chain('2026-10-31T02:00:00Z', W);
    expect([sat[6], sat[12]]).toEqual(['2026-11-01 13:00', '2026-11-07 09:00']);
    const sun = chain('2026-11-01T02:00:00Z', W);
    expect([sun[6], sun[12]]).toEqual(['2026-11-07 13:00', '2026-11-08 09:00']);
  });

  it('ไม่มีเวลาห้ามโทร: กรอกพุธ 19:00 → รอบสอง 21:20 วันเดียวกัน → เสาร์ → อาทิตย์ (เจ้าของ 9 พ.ย. 2569 "เขากรอกมาตอนนั้นแปลว่าสะดวกคุยเวลานั้น")', () => {
    const W = normalizeCallFollowupPolicy({});
    const c = chain('2026-10-28T12:00:00Z', W);
    expect(c.slice(0, 7)).toEqual(['2026-10-28 19:00', '2026-10-28 19:10', '2026-10-28 19:20', '2026-10-28 21:20', '2026-10-28 21:30', '2026-10-28 21:40', '2026-10-31 09:00']);
    // ครบ 18 สายภายในอาทิตย์เดียวกัน · หลังวันแรกเป็นเสาร์/อาทิตย์เท่านั้น
    const dow = (s: string) => new Date(`${s.replace(' ', 'T')}:00Z`).getUTCDay();
    expect(c.slice(6).every((s) => dow(s) === 6 || dow(s) === 0)).toBe(true);
    expect(c[17].slice(0, 10)).toBe('2026-11-01');
  });

  it('ข้อความเหตุบอกวันจริง: โทรซ้ำวันเสาร์', () => {
    const d = resolveCallFollowup({ outcome: 'no_answer', attemptCount: 6, now: new Date('2026-10-27T04:40:00Z') });
    expect(d.reason).toBe('ยังไม่ติด — โทรซ้ำครั้งที่ 7/18 วันเสาร์ 13:00');
    expect(resolveCallFollowup({ outcome: 'no_answer', attemptCount: 1, now: new Date('2026-10-27T02:00:00Z') }).reason).toBe('ยังไม่ติด — โทรซ้ำครั้งที่ 2/18 วันนี้ 09:10');
  });

  it('กรอก 09:00 → วันแรกเช้า · วันถัดไปบ่าย · วันที่สามเช้า', () => {
    expect(chain('2026-10-27T02:00:00Z')).toEqual([
      '2026-10-27 09:00', '2026-10-27 09:10', '2026-10-27 09:20', '2026-10-27 11:20', '2026-10-27 11:30', '2026-10-27 11:40',
      '2026-10-28 13:00', '2026-10-28 13:10', '2026-10-28 13:20', '2026-10-28 15:20', '2026-10-28 15:30', '2026-10-28 15:40',
      '2026-10-29 09:00', '2026-10-29 09:10', '2026-10-29 09:20', '2026-10-29 11:20', '2026-10-29 11:30', '2026-10-29 11:40',
    ]);
  });

  it('กรอก 23:00 → รอบสองตี 1:20 (ไม่จำกัดเวลา · เจ้าของเลือก "ไม่จำกัดเลย")', () => {
    const c = chain('2026-10-27T16:00:00Z');
    expect(c.slice(0, 4)).toEqual(['2026-10-27 23:00', '2026-10-27 23:10', '2026-10-27 23:20', '2026-10-28 01:20']);
  });

  it('ตั้งค่าเองมีผล: 2 สาย/รอบ เว้น 30 นาที รอบเดียวต่อวัน', () => {
    const p: CallFollowupPolicy = normalizeCallFollowupPolicy({ roundCalls: 2, roundGapMinutes: 30, roundsPerDay: 1, retryDays: 2, retryDayMode: 'next' });
    expect(bkk(nextRetryAt(new Date('2026-10-27T02:00:00Z'), 1, p))).toBe('2026-10-27 09:30');
    expect(bkk(nextRetryAt(new Date('2026-10-27T02:30:00Z'), 2, p))).toBe('2026-10-28 13:00');
  });
});
