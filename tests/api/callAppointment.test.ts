import { describe, expect, it } from 'vitest';
import {
  CONFIRMED_SCOPE_HINT,
  CONFIRMED_SCOPE_LABEL,
  CONFIRMED_SCOPES,
  isConfirmedScope,
  isDeclinedScope,
  MAX_APPOINTMENT_YEARS_AHEAD,
  resolveAppointment,
} from '../../src/lib/callAppointment';

const NOW = '2026-08-14T03:00:00.000Z'; // 14 ส.ค. 2569 10:00 น. เวลาไทย

describe('resolveAppointment — "สนใจ" แยกนัดได้ / ยังนัดไม่ได้', () => {
  it('สนใจ + นัดได้ + มีวันนัด → เก็บทั้ง scope และวันนัด', () => {
    const r = resolveAppointment({
      outcome: 'confirmed',
      scope: 'scheduled',
      appointmentAt: '2026-08-20',
      now: NOW,
    });
    expect(r).toEqual({
      ok: true,
      scope: 'scheduled',
      appointmentAt: expect.stringContaining('2026-08-20'),
      reason: null,
    });
  });

  it('⚠️ สนใจ + นัดได้ แต่ไม่ใส่วันนัด → ต้องไม่ผ่าน (ห้ามเดาวันให้)', () => {
    for (const bad of ['', '   ', undefined, null, 42, 'พรุ่งนี้']) {
      const r = resolveAppointment({
        outcome: 'confirmed',
        scope: 'scheduled',
        appointmentAt: bad,
        now: NOW,
      });
      expect(r.ok, `ค่า ${JSON.stringify(bad)} ต้องไม่ผ่าน`).toBe(false);
    }
  });

  it('สนใจ + ยังนัดไม่ได้ → ล้างวันนัดทิ้งเสมอ แม้ฟอร์มจะกรอกค้างไว้', () => {
    const r = resolveAppointment({
      outcome: 'confirmed',
      scope: 'unscheduled',
      appointmentAt: '2026-08-20',
      now: NOW,
    });
    expect(r).toEqual({ ok: true, scope: 'unscheduled', appointmentAt: null, reason: null });
  });

  it('⚠️ สนใจ แต่ไม่ส่ง scope (ผลจาก AI) → scope = null ห้ามเดาเป็น unscheduled', () => {
    // เดาให้ = ไปโผล่ในรายงานว่า "โทรแล้วนัดไม่ได้" ทั้งที่ไม่มีใครถามคำถามนั้น
    for (const missing of [undefined, null, '', 'อะไรก็ไม่รู้', 'job']) {
      const r = resolveAppointment({ outcome: 'confirmed', scope: missing, now: NOW });
      expect(r).toEqual({ ok: true, scope: null, appointmentAt: null, reason: null });
    }
  });

  it('⚠️ ปี พ.ศ. หลุดเข้ามาต้องถูกจับ ไม่ใช่ลงฐานเงียบ ๆ', () => {
    // 2569-08-20 เป็นวันที่ถูกต้องตามรูปแบบทุกประการ แต่ห่างออกไป 543 ปี
    const r = resolveAppointment({
      outcome: 'confirmed',
      scope: 'scheduled',
      appointmentAt: '2569-08-20',
      now: NOW,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('ค.ศ.');
  });

  it('ขอบเพดาน: พอดี 2 ปีผ่าน · เกินไปวันเดียวไม่ผ่าน', () => {
    expect(MAX_APPOINTMENT_YEARS_AHEAD).toBe(2);
    const ok = resolveAppointment({
      outcome: 'confirmed',
      scope: 'scheduled',
      appointmentAt: '2028-08-13',
      now: NOW,
    });
    expect(ok.ok).toBe(true);
    const tooFar = resolveAppointment({
      outcome: 'confirmed',
      scope: 'scheduled',
      appointmentAt: '2028-08-16',
      now: NOW,
    });
    expect(tooFar.ok).toBe(false);
  });

  it('วันนัดย้อนหลังบันทึกได้ (โทรเมื่อวาน มานั่งคีย์วันนี้)', () => {
    const r = resolveAppointment({
      outcome: 'confirmed',
      scope: 'scheduled',
      appointmentAt: '2026-08-12',
      now: NOW,
    });
    expect(r.ok).toBe(true);
  });

  it('⚠️ YYYY-MM-DD ต้องยึดเที่ยงวันไทย — วันที่ที่คนเห็นห้ามเลื่อนไปวันข้าง ๆ', () => {
    const r = resolveAppointment({
      outcome: 'confirmed',
      scope: 'scheduled',
      appointmentAt: '2026-08-20',
      now: NOW,
    });
    expect(r.ok).toBe(true);
    if (!r.appointmentAt) throw new Error('ต้องผ่าน');
    const th = new Date(r.appointmentAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    const utc = new Date(r.appointmentAt).toLocaleDateString('en-CA', { timeZone: 'UTC' });
    expect(th).toBe('2026-08-20');
    expect(utc).toBe('2026-08-20'); // เที่ยงวันไทย = 05:00Z ยังเป็นวันเดียวกันฝั่ง UTC
  });
});

describe('resolveAppointment — ผลแบบอื่นต้องไม่ถูกกระทบ', () => {
  it('ไม่สนใจ: ไม่ส่ง scope = job (ปลอดภัยกว่า ไม่ตัดคนออกจากระบบเอง)', () => {
    expect(resolveAppointment({ outcome: 'declined', now: NOW })).toEqual({
      ok: true,
      scope: 'job',
      appointmentAt: null,
      reason: null,
    });
    expect(resolveAppointment({ outcome: 'declined', scope: 'all', now: NOW })).toEqual({
      ok: true,
      scope: 'all',
      appointmentAt: null,
      reason: null,
    });
  });

  it('ไม่สนใจ + ส่งวันนัดมาด้วย → วันนัดต้องถูกทิ้ง', () => {
    const r = resolveAppointment({
      outcome: 'declined',
      scope: 'all',
      appointmentAt: '2026-08-20',
      now: NOW,
    });
    expect(r).toEqual({ ok: true, scope: 'all', appointmentAt: null, reason: null });
  });

  it('ไม่รับสาย/เบอร์ผิด/ขอเลื่อน ไม่มีทั้ง scope และวันนัด', () => {
    for (const outcome of ['no_answer', 'wrong_person', 'reschedule_requested']) {
      expect(
        resolveAppointment({ outcome, scope: 'scheduled', appointmentAt: '2026-08-20', now: NOW }),
      ).toEqual({ ok: true, scope: null, appointmentAt: null, reason: null });
    }
  });
});

describe('invariant ของคำตอบ', () => {
  it('⚠️ ok === (reason === null) เสมอ — ปิดทางไม่ผ่านต้องมีเหตุผลให้คนอ่าน', () => {
    const cases = [
      { outcome: 'confirmed', scope: 'scheduled', appointmentAt: '2026-08-20', now: NOW },
      { outcome: 'confirmed', scope: 'scheduled', now: NOW },
      { outcome: 'confirmed', scope: 'scheduled', appointmentAt: '2569-08-20', now: NOW },
      { outcome: 'confirmed', scope: 'unscheduled', now: NOW },
      { outcome: 'declined', scope: 'all', now: NOW },
      { outcome: 'no_answer', now: NOW },
    ];
    for (const c of cases) {
      const r = resolveAppointment(c);
      expect(r.ok, JSON.stringify(c)).toBe(r.reason === null);
      // ตกแล้วต้องไม่มีค่าอะไรหลุดออกไปให้เผลอเอาไปเขียนฐาน
      if (!r.ok) expect([r.scope, r.appointmentAt]).toEqual([null, null]);
    }
  });
});

describe('ค่าคงที่ + ตัวตรวจชนิด', () => {
  it('scope ของ "สนใจ" กับของ "ไม่สนใจ" ต้องไม่ทับกัน', () => {
    for (const s of CONFIRMED_SCOPES) expect(isDeclinedScope(s)).toBe(false);
    for (const s of ['job', 'all']) expect(isConfirmedScope(s)).toBe(false);
  });

  it('ทุก scope มีทั้งป้ายและคำอธิบาย และไม่มีอันไหนว่าง', () => {
    for (const s of CONFIRMED_SCOPES) {
      expect(CONFIRMED_SCOPE_LABEL[s].trim().length).toBeGreaterThan(0);
      expect(CONFIRMED_SCOPE_HINT[s].trim().length).toBeGreaterThan(0);
    }
    expect(CONFIRMED_SCOPE_LABEL.scheduled).not.toBe(CONFIRMED_SCOPE_LABEL.unscheduled);
  });
});
