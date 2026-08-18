import { describe, expect, it } from 'vitest';
import {
  firstIncompleteStep,
  followStepError,
  followStepSummary,
  nextFollowStep,
  prevFollowStep,
  type FollowWizardValues,
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
