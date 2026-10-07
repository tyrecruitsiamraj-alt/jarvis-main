import { describe, expect, it } from 'vitest';
import {
  firstIncompleteStep,
  FOLLOW_SUBMIT_GUARD_MS,
  isSubmitTooSoonAfterStep3,
  followStepError,
  followStepSummary,
  nextFollowStep,
  prevFollowStep,
  scheduleDayCallRound,
  scheduleDayStaffPhone,
  buildScheduleCalls,
  scheduleCallsByDay,
  validScheduleTimes,
  type FollowWizardValues,
  type ScheduleDayMode,
} from '@/lib/followWizard';

const values = (over: Partial<FollowWizardValues> = {}): FollowWizardValues => ({
  firstName: 'สมชาย',
  phone: '0812345678',
  topic: 'ยืนยันวันเริ่มงาน',
  scheduleMode: false,
  scheduledAts: ['2026-08-20T09:00'],
  scheduleDays: [],
  roundTimes: ['07:00'],
  ...over,
});

describe('ขั้นที่ 1 — คนที่จะติดตาม', () => {
  it('ครบแล้วผ่าน', () => {
    expect(followStepError(1, values())).toBeNull();
  });

  it('ชื่อว่าง/เว้นวรรคล้วน = ไม่ผ่าน', () => {
    expect(followStepError(1, values({ firstName: '' }))).toMatch(/ชื่อ/);
    expect(followStepError(1, values({ firstName: '   ' }))).toMatch(/ชื่อ/);
  });

  it('เรื่องที่จะให้โทรว่าง = ไม่ผ่าน', () => {
    expect(followStepError(1, values({ topic: '  ' }))).toMatch(/เรื่อง/);
  });

  it('🔴 เบอร์ต้องเป็นมือถือ 10 หลักขึ้นต้น 0', () => {
    expect(followStepError(1, values({ phone: '' }))).toMatch(/เบอร์/);
    expect(followStepError(1, values({ phone: '812345678' }))).toMatch(/10 หลัก/);
    expect(followStepError(1, values({ phone: '08123456789' }))).toMatch(/10 หลัก/);
    expect(followStepError(1, values({ phone: '021234567' }))).toMatch(/10 หลัก/);
    expect(followStepError(1, values({ phone: 'ไม่รู้' }))).toMatch(/10 หลัก/);
  });

  it('เบอร์ที่มีขีด/เว้นวรรคยังผ่าน (คนก๊อปมาจากที่อื่น)', () => {
    expect(followStepError(1, values({ phone: '081-234-5678' }))).toBeNull();
    expect(followStepError(1, values({ phone: '081 234 5678' }))).toBeNull();
  });
});

describe('ขั้นที่ 2 — หน่วยงาน', () => {
  it('🔴 ข้ามได้เสมอ — งาน Follow บางเรื่องไม่ผูกหน่วยงาน', () => {
    expect(followStepError(2, values())).toBeNull();
    expect(followStepError(2, values({ firstName: '', phone: '', topic: '' }))).toBeNull();
  });
});

describe('ขั้นที่ 3 — ตั้งเวลา', () => {
  it('โหมดระบุเวลาเอง: ต้องมีอย่างน้อย 1 รอบ', () => {
    expect(followStepError(3, values())).toBeNull();
    expect(followStepError(3, values({ scheduledAts: [] }))).toMatch(/อย่างน้อย 1 รอบ/);
    expect(followStepError(3, values({ scheduledAts: ['', '  '] }))).toMatch(/อย่างน้อย 1 รอบ/);
  });

  it('โหมดตาราง: ต้องมีทั้งวันที่ติ๊กไว้และรอบเวลา', () => {
    const sched = (o: Partial<FollowWizardValues>) => values({ scheduleMode: true, ...o });
    expect(followStepError(3, sched({ scheduleDays: ['2026-08-20'], roundTimes: ['07:00'] }))).toBeNull();
    expect(followStepError(3, sched({ scheduleDays: [], roundTimes: ['07:00'] }))).toMatch(/อย่างน้อย 1 วัน/);
    expect(followStepError(3, sched({ scheduleDays: ['2026-08-20'], roundTimes: [] }))).toMatch(/รอบเวลา/);
    expect(followStepError(3, sched({ scheduleDays: ['2026-08-20'], roundTimes: ['เช้า'] }))).toMatch(/รอบเวลา/);
  });

  it('🔴 สลับโหมดแล้วต้องตรวจคนละชุด — ของอีกโหมดว่างอยู่ก็ต้องผ่าน', () => {
    // โหมดตารางครบ แต่ scheduledAts ว่าง → ต้องผ่าน (ไม่เอาเงื่อนไขโหมดเวลาเองมาใช้)
    expect(
      followStepError(3, values({ scheduleMode: true, scheduledAts: [], scheduleDays: ['2026-08-20'] })),
    ).toBeNull();
    // โหมดเวลาเองครบ แต่ scheduleDays ว่าง → ต้องผ่าน
    expect(followStepError(3, values({ scheduleMode: false, scheduleDays: [] }))).toBeNull();
  });
});

describe('firstIncompleteStep — ด่านตอนกดบันทึก', () => {
  it('ครบทุกขั้น = null', () => {
    expect(firstIncompleteStep(values())).toBeNull();
  });

  it('คืน**ขั้นแรกสุด**ที่ยังไม่ผ่าน (ไม่ใช่ขั้นสุดท้าย)', () => {
    expect(firstIncompleteStep(values({ firstName: '', scheduledAts: [] }))).toBe(1);
    expect(firstIncompleteStep(values({ scheduledAts: [] }))).toBe(3);
  });
});

describe('เดินขั้น', () => {
  it('ไม่หลุดกรอบ 1–3', () => {
    expect(nextFollowStep(1)).toBe(2);
    expect(nextFollowStep(2)).toBe(3);
    expect(nextFollowStep(3)).toBe(3);
    expect(prevFollowStep(3)).toBe(2);
    expect(prevFollowStep(1)).toBe(1);
  });
});

describe('followStepSummary', () => {
  const full = { ...values(), recipientName: 'นายสมชาย ใจดี', unitName: 'ฮอนด้า', siteCode: '69LBD0001' };

  it('ขั้น 1 สรุป ชื่อ · เบอร์ · เรื่อง', () => {
    expect(followStepSummary(1, full)).toBe('นายสมชาย ใจดี · 0812345678 · ยืนยันวันเริ่มงาน');
  });

  it('ขั้น 2 สรุปหน่วยงาน + รหัสไซต์ · ไม่เลือกก็บอกว่าไม่ระบุ', () => {
    expect(followStepSummary(2, full)).toBe('ฮอนด้า (69LBD0001)');
    expect(followStepSummary(2, { ...full, siteCode: '' })).toBe('ฮอนด้า');
    expect(followStepSummary(2, { ...full, unitName: '' })).toBe('ไม่ระบุหน่วยงาน');
  });

  it('ยังไม่มีชื่อ = ไม่ต้องสรุป', () => {
    expect(followStepSummary(1, { ...full, recipientName: '  ' })).toBeNull();
    expect(followStepSummary(3, full)).toBeNull();
  });
});

describe('isSubmitTooSoonAfterStep3 — กันคลิกเร็วซ้อนตอนปุ่มบันทึกมาแทนที่ปุ่มถัดไป', () => {
  it('ภายในช่วงกัน = ห้ามบันทึก · พ้นช่วงแล้ว = บันทึกได้', () => {
    const t0 = 1_000_000;
    expect(isSubmitTooSoonAfterStep3(t0, t0)).toBe(true);
    expect(isSubmitTooSoonAfterStep3(t0, t0 + FOLLOW_SUBMIT_GUARD_MS - 1)).toBe(true);
    expect(isSubmitTooSoonAfterStep3(t0, t0 + FOLLOW_SUBMIT_GUARD_MS)).toBe(false);
    expect(isSubmitTooSoonAfterStep3(t0, t0 + 10_000)).toBe(false);
  });

  it('ช่วงกันต้องยาวพอสำหรับดับเบิลคลิกจริง (>= 500ms)', () => {
    expect(FOLLOW_SUBMIT_GUARD_MS).toBeGreaterThanOrEqual(500);
  });
});

describe('โหมดตารางหลายวัน — สายที่เท่าไหร่ (call_round)', () => {
  it('วันแรกรอบแรก = สายที่ 1', () => {
    expect(scheduleDayCallRound(0, 2)).toBe(1);
  });

  it('นับต่อข้ามวัน — วันละ 2 รอบ วันที่สองต้องเริ่มที่สายที่ 3 (ไม่ใช่ 1 ซ้ำ)', () => {
    expect(scheduleDayCallRound(1, 2)).toBe(3);
    expect(scheduleDayCallRound(2, 2)).toBe(5);
  });

  it('วันละรอบเดียวก็ยังต้องเพิ่มทุกวัน — ไม่งั้นทุกวันใช้บทสายแรก', () => {
    expect([0, 1, 2, 3].map((i) => scheduleDayCallRound(i, 1))).toEqual([1, 2, 3, 4]);
  });

  it('ค่าเพี้ยนต้องไม่ทำให้ได้ 0 หรือติดลบ — ฝั่ง API รับเฉพาะ >= 1', () => {
    expect(scheduleDayCallRound(-1, 0)).toBe(1);
    expect(scheduleDayCallRound(0, -3)).toBe(1);
  });
});

describe('โหมดตารางหลายวัน — เบอร์เจ้าหน้าที่ของแต่ละวัน', () => {
  const byDay = { '2569-09-24': '021111111', '2569-09-25': '' };

  it('ปิดสวิตช์รายวัน = ทุกวันใช้เบอร์ชุดเดียว (แม้มีค่ารายวันค้างอยู่)', () => {
    const opts = { perDay: false, byDay, shared: ' 029999999 ' };
    expect(scheduleDayStaffPhone('2569-09-24', opts)).toBe('029999999');
    expect(scheduleDayStaffPhone('2569-09-25', opts)).toBe('029999999');
  });

  it('เปิดสวิตช์รายวัน = เบอร์ของวันนั้นชนะ', () => {
    expect(
      scheduleDayStaffPhone('2569-09-24', { perDay: true, byDay, shared: '029999999' }),
    ).toBe('021111111');
  });

  it('เปิดรายวันแต่วันนั้นเว้นว่าง = ตกกลับไปใช้เบอร์ชุดเดียว ไม่ใช่ไม่มีเบอร์', () => {
    expect(
      scheduleDayStaffPhone('2569-09-25', { perDay: true, byDay, shared: '029999999' }),
    ).toBe('029999999');
  });

  it('ไม่ได้กรอกเบอร์เลย = ว่าง (ฝั่งเรียกแปลงเป็น undefined เอง)', () => {
    expect(scheduleDayStaffPhone('2569-09-26', { perDay: true, byDay, shared: '  ' })).toBe('');
  });
});

/**
 * ═══ ตารางหลายวัน: หนึ่งสาย = หนึ่งแถว · เวลารายวัน · ข้ามวัน (เจ้าของ Choice 1 ต.ค. 2569) ═══
 */
describe('validScheduleTimes', () => {
  it('รับแค่ HH:MM ที่เป็นเวลาจริง · ตัดซ้ำ · เรียงเช้าไปเย็น · เติมศูนย์', () => {
    expect(validScheduleTimes(['08:25', '7:00', '07:00', 'เช้า', '25:00', '', '09:60'])).toEqual(['07:00', '08:25']);
  });
});

describe('buildScheduleCalls', () => {
  const days = ['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'];
  const modes: Record<string, ScheduleDayMode> = {
    '2026-10-02': 'ai',
    '2026-10-03': 'off',
    '2026-10-04': 'manual',
    '2026-10-05': 'ai',
  };
  const times: Record<string, string[]> = {
    '2026-10-02': ['08:25', '07:25'],
    '2026-10-03': ['07:00'],
    '2026-10-04': ['09:00'],
    '2026-10-05': ['13:00', '17:00', '13:00'],
  };
  const calls = buildScheduleCalls({
    days,
    modeOfDay: (d) => modes[d],
    timesOfDay: (d) => times[d],
    staffPhoneOfDay: (d) => (d === '2026-10-04' ? '0899999999' : ' 0811111111 '),
  });

  it('🔴 หนึ่งสาย = หนึ่งแถว · วันที่ "ไม่โทร" ไม่มีสาย · เวลาต่างกันรายวันได้', () => {
    expect(calls.map((c) => `${c.day} ${c.time} ${c.callMode}`)).toEqual([
      '2026-10-02 07:25 ai',
      '2026-10-02 08:25 ai',
      '2026-10-04 09:00 manual',
      '2026-10-05 13:00 ai',
      '2026-10-05 17:00 ai',
    ]);
  });

  it('🔴 เลขรอบนับต่อทั้งชุด (จำนวนรอบต่อวันไม่เท่ากันก็นับถูก) — สายแรกเท่านั้นที่ได้บทสายแรก', () => {
    expect(calls.map((c) => c.callRound)).toEqual([1, 2, 3, 4, 5]);
  });

  it('เวลาเป็นเขตเวลาไทย · เบอร์เจ้าหน้าที่ของวันนั้นตัดช่องว่างแล้ว', () => {
    expect(calls[0].scheduledAt).toBe('2026-10-02T00:25:00.000Z');
    expect(calls[0].staffPhone).toBe('0811111111');
    expect(calls[2].staffPhone).toBe('0899999999');
  });

  it('เริ่มนับรอบต่อจากรอบที่โทรไปแล้วได้ (ใช้ตอนแก้ตาราง)', () => {
    const more = buildScheduleCalls({
      days: ['2026-10-02'],
      modeOfDay: () => 'ai',
      timesOfDay: () => ['07:00'],
      staffPhoneOfDay: () => '',
      startRound: 4,
    });
    expect(more[0].callRound).toBe(4);
  });

  it('แยกตามวันสำหรับส่ง AI แผนละวัน', () => {
    expect(scheduleCallsByDay(calls).map((g) => `${g.day}:${g.calls.length}`)).toEqual([
      '2026-10-02:2',
      '2026-10-04:1',
      '2026-10-05:2',
    ]);
  });
});

describe('ขั้นที่ 3 — เวลารายวัน', () => {
  const sched = (o: Partial<FollowWizardValues>) => values({ scheduleMode: true, scheduleDays: ['2026-10-02', '2026-10-03'], ...o });
  it('เปิดเวลารายวัน: ทุกวันที่จะโทรต้องมีเวลาอย่างน้อย 1 รอบ · บอกว่าวันไหนขาด', () => {
    expect(followStepError(3, sched({ timesByDay: { '2026-10-02': ['07:00'], '2026-10-03': ['09:00'] } }))).toBeNull();
    expect(followStepError(3, sched({ timesByDay: { '2026-10-02': ['07:00'], '2026-10-03': [] } }))).toMatch(/3 ต\.ค\./);
  });
  it('ปิดเวลารายวัน: ใช้ชุดเดียวทุกวันเหมือนเดิม', () => {
    expect(followStepError(3, sched({ timesByDay: null, roundTimes: ['07:00'] }))).toBeNull();
    expect(followStepError(3, sched({ timesByDay: null, roundTimes: [] }))).toMatch(/รอบเวลา/);
  });
});

describe('🔴 ใครโทรรายสายในโหมดตาราง (เจ้าของ 7 ต.ค. 2569 "ทำทั้ง 2 เรื่องเลย")', () => {
  it('วัน AI: สาย 1 AI · สาย 2 คนโทร ได้ · วันคนโทรทับทุกสาย · ยังไม่ชัวร์เวลา = คนโทรเสมอ', () => {
    const calls = buildScheduleCalls({
      days: ['2026-10-08', '2026-10-09'],
      modeOfDay: (d) => (d === '2026-10-09' ? 'manual' : 'ai'),
      timesOfDay: () => ['07:00', '08:00'],
      staffPhoneOfDay: () => '',
      modeOfSlot: (_d, t) => (t === '08:00' ? 'manual' : 'ai'),
    });
    expect(calls.map((c) => `${c.day} ${c.time} ${c.callMode}`)).toEqual([
      '2026-10-08 07:00 ai',
      '2026-10-08 08:00 manual',
      '2026-10-09 07:00 manual',
      '2026-10-09 08:00 manual',
    ]);
    expect(calls.map((c) => c.callRound)).toEqual([1, 2, 3, 4]);
  });
  it('ไม่ส่งรายสาย = ตามวันเหมือนเดิม', () => {
    const calls = buildScheduleCalls({
      days: ['2026-10-08'],
      modeOfDay: () => 'ai',
      timesOfDay: () => ['07:00', '08:00'],
      staffPhoneOfDay: () => '',
    });
    expect(calls.every((c) => c.callMode === 'ai')).toBe(true);
  });
});
