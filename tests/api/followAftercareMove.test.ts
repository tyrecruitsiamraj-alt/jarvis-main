// @vitest-environment node
/**
 * การ์ด "ติดตามครบ" → ย้ายไปดูแลหลังเริ่มงาน (เจ้าของสั่ง 1 ต.ค. 2569)
 *
 * Choice ของเจ้าของ: ปุ่ม 3 / 7 / 30 + พิมพ์เอง · **เพิ่มรอบเองได้** · แต่ละรอบตั้งได้ว่า AI หรือคนโทร
 *
 * 🔴 5 ต.ค. 2569 (เจ้าของ): *"ติดตาม 5/ตค ดูแลหลังเริ่มงาน 3 ก็บวกไป พอเลือก 7 ก็บวกต่อจากของ 3 เป็นวันที่ 15"*
 *    + Choice "นับจากวันติดตามวันสุดท้าย" · ปุ่ม 3 / 7 / 15 / 30 · "ไม่ย้าย" มีทางติดตามต่อ
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. วันฐาน = วันติดตามวันสุดท้ายตาม **ปฏิทินไทย** — ก่อน 07:00 ห้ามได้วันของเมื่อวาน
 * 2. จำนวนวันแต่ละรอบ **บวกต่อจากรอบก่อน** (5 ต.ค. + 3 = 8 · + 7 = 15)
 * 3. รอบที่ตกวันเวลาที่ผ่านแล้วต้องถูกจับก่อนส่ง
 * 4. ติดตามต่อ = วันละสาย ติดกัน เริ่มวันถัดจากวันสุดท้าย แต่ไม่ก่อนพรุ่งนี้ · เลขสายต่อจากชุดเดิม
 */
import { describe, expect, it } from 'vitest';
import { AFTERCARE_PRESET_DAYS, AFTERCARE_TOPIC } from '../../src/lib/aftercareRounds.js';
import {
  CONTINUE_DAY_PRESETS,
  buildContinueCalls,
  continueStartYmd,
  firstContinueDraft,
  lastFollowYmd,
  moveRoundDays,
  parseContinueDays,
  validateContinue,
  MOVE_DAY_PRESETS,
  MOVE_DEFAULT_TIME,
  MOVE_MAX_ROUNDS,
  addDaysToYmd,
  bangkokYmd,
  buildMoveCalls,
  firstMoveRound,
  isAftercareTopic,
  nextMoveRound,
  openFollowRounds,
  parseMoveDays,
  validateMoveRounds,
  type MoveRoundDraft,
} from '../../src/lib/followAftercareMove.js';
import { scheduleCallsByDay } from '../../src/lib/followWizard.js';

const r = (days: string, time = '07:00', mode: MoveRoundDraft['mode'] = 'ai'): MoveRoundDraft => ({
  days,
  time,
  mode,
});

describe('ค่าเริ่มต้นของรอบ', () => {
  it('ปุ่มลัด 3 / 7 / 15 / 30 (เจ้าของสั่ง 5 ต.ค.) — แยกจากชุด 3/7/30 ของหน้าดูแลหลังเริ่มงาน', () => {
    expect([...MOVE_DAY_PRESETS]).toEqual([3, 7, 15, 30]);
    expect([...AFTERCARE_PRESET_DAYS]).toEqual([3, 7, 30]);
  });

  it('รอบแรก = อีก 3 วัน · เวลาเดียวกับฟอร์มเพิ่มคน · AI โทร', () => {
    expect(firstMoveRound()).toEqual({ days: '3', time: MOVE_DEFAULT_TIME, mode: 'ai' });
    expect(MOVE_DEFAULT_TIME).toBe('07:00');
  });

  it('กดเพิ่มรอบ ไล่ปุ่มลัดถัดไป (3 → 7 → 15 → 30) เลยแล้วต่ออีก 30 · เวลา/คนโทรตามรอบท้าย', () => {
    expect(nextMoveRound([])).toEqual(firstMoveRound());
    expect(nextMoveRound([r('3', '09:30', 'manual')])).toEqual(r('7', '09:30', 'manual'));
    expect(nextMoveRound([r('3'), r('7')]).days).toBe('15');
    expect(nextMoveRound([r('3'), r('7'), r('15')]).days).toBe('30');
    expect(nextMoveRound([r('30')]).days).toBe('30');
    expect(nextMoveRound([r('10')]).days).toBe('15');
  });

  it('รอบท้ายพิมพ์ค้างอ่านไม่ออก ⇒ เริ่มที่ 3 วันแต่คงเวลา/คนโทร', () => {
    expect(nextMoveRound([r('', '10:00', 'manual')])).toEqual(r('3', '10:00', 'manual'));
  });
});

describe('🔴 บวกต่อกันจากวันติดตามวันสุดท้าย (ตัวอย่างของเจ้าของ)', () => {
  it('ติดตามถึง 5 ต.ค. · 3 → 7 → 15 → 30 = 8 ต.ค. / 15 ต.ค. / 30 ต.ค. / 29 พ.ย.', () => {
    expect(moveRoundDays([r('3'), r('7'), r('15'), r('30')], '2026-10-05')).toEqual([
      '2026-10-08',
      '2026-10-15',
      '2026-10-30',
      '2026-11-29',
    ]);
  });

  it('รอบที่อ่านไม่ออก = null และรอบหลังจากนั้นก็ null (ไม่รู้ว่าต่อจากวันไหน)', () => {
    expect(moveRoundDays([r('3'), r('x'), r('7')], '2026-10-05')).toEqual(['2026-10-08', null, null]);
  });

  it('วันติดตามวันสุดท้าย = สายล่าสุดที่ไม่ยกเลิก ตามวันไทย · ไม่มีสายเลย = วันนี้', () => {
    const today = new Date('2026-10-06T03:00:00Z');
    expect(
      lastFollowYmd(
        [
          { cancelled: false, scheduled_at: '2026-10-03T00:00:00Z' },
          // 5 ต.ค. 01:00 ไทย = 4 ต.ค. UTC
          { cancelled: false, scheduled_at: '2026-10-04T18:00:00Z' },
          { cancelled: true, scheduled_at: '2026-10-09T00:00:00Z' },
        ],
        today,
      ),
    ).toBe('2026-10-05');
    expect(lastFollowYmd([], today)).toBe('2026-10-06');
  });
});

describe('ตรวจฟอร์มก่อนส่ง', () => {
  const now = new Date('2026-10-05T03:00:00Z'); // 5 ต.ค. 10:00 ไทย

  it('จำนวนวันต้องเป็นจำนวนเต็ม 1–365', () => {
    expect(parseMoveDays('7')).toBe(7);
    expect(parseMoveDays(' 30 ')).toBe(30);
    expect(parseMoveDays('0')).toBeNull();
    expect(parseMoveDays('366')).toBeNull();
    expect(parseMoveDays('1.5')).toBeNull();
    expect(parseMoveDays('สาม')).toBeNull();
    expect(parseMoveDays('')).toBeNull();
  });

  it('ข้อความบอกว่ารอบไหนผิด', () => {
    const base = '2026-10-05';
    expect(validateMoveRounds([], base, now)).toBe('ตั้งอย่างน้อย 1 รอบ');
    expect(validateMoveRounds([r('3'), r('0')], base, now)).toBe('รอบที่ 2: ใส่จำนวนวัน 1–365');
    expect(validateMoveRounds([r('3', '25:00')], base, now)).toBe('รอบที่ 1: เวลาไม่ถูกต้อง');
    expect(validateMoveRounds([r('300'), r('70')], base, now)).toBe('รอบที่ 2: รวมเกิน 365 วัน');
    expect(validateMoveRounds([r('3'), r('7'), r('15'), r('30')], base, now)).toBeNull();
    expect(
      validateMoveRounds(Array.from({ length: MOVE_MAX_ROUNDS + 1 }, () => r('1')), base, now),
    ).toBe(`ตั้งได้ไม่เกิน ${MOVE_MAX_ROUNDS} รอบ`);
  });

  it('🔴 กองไว้นานแล้วค่อยกด: รอบที่ตกวันเวลาที่ผ่านมาแล้วกดไม่ได้ + บอกวันที่', () => {
    // ติดตามจบ 25 ก.ย. · +3 = 28 ก.ย. ผ่านไปแล้ว
    expect(validateMoveRounds([r('3')], '2026-09-25', now)).toBe('รอบที่ 1: 28/9/2569 07:00 ผ่านมาแล้ว');
    // วันนี้แต่เวลาผ่านแล้ว
    expect(validateMoveRounds([r('1', '09:00')], '2026-10-04', now)).toBe('รอบที่ 1: 5/10/2569 09:00 ผ่านมาแล้ว');
    expect(validateMoveRounds([r('1', '18:00')], '2026-10-04', now)).toBeNull();
  });
});

describe('วันที่ตามปฏิทินไทย', () => {
  it('🔴 01:30 น. เวลาไทย (ยังเป็นเมื่อวานของ UTC) ต้องได้วันของไทย', () => {
    expect(bangkokYmd(new Date('2026-10-01T18:30:00Z'))).toBe('2026-10-02');
    expect(bangkokYmd(new Date('2026-10-01T16:59:00Z'))).toBe('2026-10-01');
  });

  it('บวกวันข้ามเดือน/ข้ามปีได้', () => {
    expect(addDaysToYmd('2026-10-01', 30)).toBe('2026-10-31');
    expect(addDaysToYmd('2026-12-25', 10)).toBe('2027-01-04');
  });
});

describe('ฟอร์ม → รายการสาย', () => {
  it('บวกต่อกัน + เลขสาย 1..n + ส่งเบอร์เจ้าหน้าที่ต่อ + เวลาไทยถูกต้อง', () => {
    const calls = buildMoveCalls([r('3', '07:00', 'ai'), r('7', '09:00', 'manual')], '2026-10-05', '0812345678');
    expect(calls).toEqual([
      {
        day: '2026-10-08',
        time: '07:00',
        scheduledAt: '2026-10-08T00:00:00.000Z',
        callMode: 'ai',
        staffPhone: '0812345678',
        callRound: 1,
      },
      {
        day: '2026-10-15',
        time: '09:00',
        scheduledAt: '2026-10-15T02:00:00.000Z',
        callMode: 'manual',
        staffPhone: '0812345678',
        callRound: 2,
      },
    ]);
  });

  it('แผนละวัน (เหมือนตารางหลายวัน)', () => {
    const byDay = scheduleCallsByDay(buildMoveCalls([r('3'), r('7')], '2026-10-05', ''));
    expect(byDay.map((d) => [d.day, d.calls.length])).toEqual([
      ['2026-10-08', 1],
      ['2026-10-15', 1],
    ]);
  });
});

describe('"ไม่ย้าย" → ติดตามต่อ', () => {
  it('ปุ่มลัด 1 / 3 / 7 · ค่าเริ่ม 1 วัน 07:00 AI · จำนวนวัน 1–30', () => {
    expect([...CONTINUE_DAY_PRESETS]).toEqual([1, 3, 7]);
    expect(firstContinueDraft()).toEqual({ days: '1', time: '07:00', mode: 'ai' });
    expect(parseContinueDays('30')).toBe(30);
    expect(parseContinueDays('31')).toBeNull();
    expect(parseContinueDays('0')).toBeNull();
    expect(validateContinue({ days: '', time: '07:00', mode: 'ai' })).toBe('ใส่จำนวนวัน 1–30');
    expect(validateContinue({ days: '3', time: '7', mode: 'ai' })).toBe('เวลาไม่ถูกต้อง');
  });

  it('🔴 เริ่มวันถัดจากวันสุดท้าย — แต่ไม่ก่อนพรุ่งนี้ (ห้ามตั้งย้อนหลัง)', () => {
    const now = new Date('2026-10-05T03:00:00Z'); // 5 ต.ค.
    expect(continueStartYmd('2026-10-08', now)).toBe('2026-10-09');
    expect(continueStartYmd('2026-10-05', now)).toBe('2026-10-06');
    expect(continueStartYmd('2026-09-28', now)).toBe('2026-10-06');
  });

  it('อีก 3 วัน = วันละสาย 3 วันติด · เลขสายต่อจากชุดเดิม · คนโทรตามที่เลือก', () => {
    const calls = buildContinueCalls({ days: '3', time: '09:30', mode: 'manual' }, '2026-10-06', '0812345678', 7);
    expect(calls.map((c) => [c.day, c.scheduledAt, c.callRound, c.callMode, c.staffPhone])).toEqual([
      ['2026-10-06', '2026-10-06T02:30:00.000Z', 8, 'manual', '0812345678'],
      ['2026-10-07', '2026-10-07T02:30:00.000Z', 9, 'manual', '0812345678'],
      ['2026-10-08', '2026-10-08T02:30:00.000Z', 10, 'manual', '0812345678'],
    ]);
    expect(buildContinueCalls({ days: 'x', time: '09:30', mode: 'ai' }, '2026-10-06', '', 1)).toEqual([]);
  });
});

describe('อื่น ๆ', () => {
  it('รอบที่ต้องปิดตอนตัดสิน = ไม่ยกเลิก + ยังไม่ปิดงาน', () => {
    const rounds = [
      { id: 'a', cancelled: false, completed_at: null },
      { id: 'b', cancelled: true, completed_at: null },
      { id: 'c', cancelled: false, completed_at: '2026-10-01T00:00:00Z' },
    ];
    expect(openFollowRounds(rounds).map((x) => x.id)).toEqual(['a']);
  });

  it('ชุดถามความเป็นอยู่ ⇒ ปุ่มเปลี่ยนเป็น "ตามต่อ"', () => {
    expect(isAftercareTopic(AFTERCARE_TOPIC)).toBe(true);
    expect(isAftercareTopic(` ${AFTERCARE_TOPIC} `)).toBe(true);
    expect(isAftercareTopic('แจ้งเข้างาน')).toBe(false);
    expect(isAftercareTopic(null)).toBe(false);
  });
});
