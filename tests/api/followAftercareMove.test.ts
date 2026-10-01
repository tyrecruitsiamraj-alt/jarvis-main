// @vitest-environment node
/**
 * การ์ด "ติดตามครบ" → ย้ายไปดูแลหลังเริ่มงาน (เจ้าของสั่ง 1 ต.ค. 2569)
 *
 * Choice ของเจ้าของ: ปุ่ม 3 / 7 / 30 + พิมพ์เอง · **เพิ่มรอบเองได้** · แต่ละรอบตั้งได้ว่า AI หรือคนโทร
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. "อีก N วัน" นับจาก **วันตามปฏิทินไทย** — ก่อน 07:00 ห้ามได้วันของเมื่อวาน (toISOString ตรง ๆ พลาดตรงนี้)
 * 2. สายเรียงตามเวลา + เลขสายนับใหม่ 1..n (ชุดถามความเป็นอยู่เป็นชุดใหม่)
 * 3. รอบซ้ำ (วันเดียวกัน เวลาเดียวกัน) ต้องถูกจับก่อนส่ง
 */
import { describe, expect, it } from 'vitest';
import { AFTERCARE_PRESET_DAYS, AFTERCARE_TOPIC } from '../../src/lib/aftercareRounds.js';
import {
  MOVE_DAY_PRESETS,
  MOVE_DEFAULT_TIME,
  MOVE_MAX_ROUNDS,
  addDaysToYmd,
  bangkokYmd,
  buildMoveCalls,
  firstMoveRound,
  isAftercareTopic,
  moveRoundDay,
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
  it('ปุ่มลัดเป็นชุดเดียวกับหน้าดูแลหลังเริ่มงาน (3 / 7 / 30) — ห้ามตั้งชุดใหม่', () => {
    expect([...MOVE_DAY_PRESETS]).toEqual([...AFTERCARE_PRESET_DAYS]);
    expect([...MOVE_DAY_PRESETS]).toEqual([3, 7, 30]);
  });

  it('รอบแรก = อีก 3 วัน · เวลาเดียวกับฟอร์มเพิ่มคน · AI โทร', () => {
    expect(firstMoveRound()).toEqual({ days: '3', time: MOVE_DEFAULT_TIME, mode: 'ai' });
    expect(MOVE_DEFAULT_TIME).toBe('07:00');
  });

  it('กดเพิ่มรอบ ไล่ปุ่มลัดถัดไป (3 → 7 → 30) แล้วบวกทีละ 30 วัน · เวลา/คนโทรตามรอบท้าย', () => {
    expect(nextMoveRound([])).toEqual(firstMoveRound());
    expect(nextMoveRound([r('3', '09:30', 'manual')])).toEqual(r('7', '09:30', 'manual'));
    expect(nextMoveRound([r('3'), r('7')]).days).toBe('30');
    expect(nextMoveRound([r('30')]).days).toBe('60');
    expect(nextMoveRound([r('10')]).days).toBe('30');
    expect(nextMoveRound([r('350')]).days).toBe('365');
  });

  it('รอบท้ายพิมพ์ค้างอ่านไม่ออก ⇒ เริ่มที่ 3 วันแต่คงเวลา/คนโทร', () => {
    expect(nextMoveRound([r('', '10:00', 'manual')])).toEqual(r('3', '10:00', 'manual'));
  });
});

describe('ตรวจฟอร์มก่อนส่ง', () => {
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
    expect(validateMoveRounds([])).toBe('ตั้งอย่างน้อย 1 รอบ');
    expect(validateMoveRounds([r('3'), r('0')])).toBe('รอบที่ 2: ใส่จำนวนวัน 1–365');
    expect(validateMoveRounds([r('3', '25:00')])).toBe('รอบที่ 1: เวลาไม่ถูกต้อง');
    expect(validateMoveRounds([r('3'), r('03')])).toBe('รอบที่ 2: ซ้ำกับรอบก่อนหน้า');
    expect(validateMoveRounds([r('3'), r('3', '18:00')])).toBeNull();
    expect(validateMoveRounds(Array.from({ length: MOVE_MAX_ROUNDS + 1 }, (_, i) => r(String(i + 1))))).toBe(
      `ตั้งได้ไม่เกิน ${MOVE_MAX_ROUNDS} รอบ`,
    );
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

  it('วันของรอบ = วันนี้ (ไทย) + N · อ่านไม่ออก = null', () => {
    const today = new Date('2026-10-01T18:30:00Z'); // 2 ต.ค. 01:30 เวลาไทย
    expect(moveRoundDay(r('3'), today)).toBe('2026-10-05');
    expect(moveRoundDay(r('x'), today)).toBeNull();
  });
});

describe('ฟอร์ม → รายการสาย', () => {
  const today = new Date('2026-10-01T03:00:00Z'); // 1 ต.ค. 10:00 เวลาไทย

  it('เรียงตามเวลา + เลขสาย 1..n + ส่งเบอร์เจ้าหน้าที่ต่อ + เวลาไทยถูกต้อง', () => {
    const calls = buildMoveCalls([r('30', '09:00', 'manual'), r('3', '07:00', 'ai')], today, '0812345678');
    expect(calls).toEqual([
      {
        day: '2026-10-04',
        time: '07:00',
        scheduledAt: '2026-10-04T00:00:00.000Z',
        callMode: 'ai',
        staffPhone: '0812345678',
        callRound: 1,
      },
      {
        day: '2026-10-31',
        time: '09:00',
        scheduledAt: '2026-10-31T02:00:00.000Z',
        callMode: 'manual',
        staffPhone: '0812345678',
        callRound: 2,
      },
    ]);
  });

  it('สองรอบวันเดียวกัน ⇒ รวมเป็นแผนเดียวของวันนั้น (แผนละวัน เหมือนตารางหลายวัน)', () => {
    const calls = buildMoveCalls([r('3', '07:00'), r('3', '18:00'), r('7')], today, '');
    const byDay = scheduleCallsByDay(calls);
    expect(byDay.map((d) => [d.day, d.calls.length])).toEqual([
      ['2026-10-04', 2],
      ['2026-10-08', 1],
    ]);
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
