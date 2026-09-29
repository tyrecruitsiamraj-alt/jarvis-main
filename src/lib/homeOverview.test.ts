/**
 * หน้าหลักโฉม 3 ก้อน — ตัวคิด pure (29 ก.ย. 2569)
 * 🔴 ด่าน: ลำดับก้อนตามคนเปิด · ก้อน 1 กระทบยอดถึงหัวกล่องงานเป๊ะ · ก้อน 3 นับคนไม่ซ้ำ + นิยามกลางของ "ติด/สนใจ"
 */
import { describe, expect, it } from 'vitest';
import {
  HOME_TODAY_STEPS,
  aiCallSteps,
  buildMonthResult,
  countTodaySteps,
  homeBlockOrder,
  staffContactSteps,
} from './homeOverview';

describe('homeBlockOrder — แยกตามคนเปิด (เจ้าของเคาะ 29 ก.ย. 2569)', () => {
  it('เจ้าหน้าที่ = งานของฉัน (ของค้าง) ก่อน · หัวหน้า/ผู้บริหาร/ผู้ชม = ผลงานก่อน · ก้อนที่เหลือเหมือนกัน', () => {
    expect(homeBlockOrder('staff')).toEqual(['stuck', 'result', 'today', 'teams']);
    for (const r of ['admin', 'supervisor', 'opl'] as const) {
      expect(homeBlockOrder(r)).toEqual(['result', 'stuck', 'today', 'teams']);
    }
    expect(homeBlockOrder(null)).toEqual(['result', 'stuck', 'today', 'teams']);
  });
});

describe('buildMonthResult — ก้อน 1 ผลงานเดือนนี้ (อัตรา)', () => {
  it('🔴 เลขจริง 29 ก.ย. 2569: 381 + 213 − 140 − 58 = 396 · −4 ไม่มีวันแจ้งเข้า = 392 = ERP ของหัวกล่องงาน · +26 = 418', () => {
    const r = buildMonthResult(
      { points: [{ key: '2026-09', label: 'ก.ย.', added: 213, informed: 140, cancelled: 58, backlog: 396 }], ledgerEnd: 396, undatedFilled: 4, openNow: 392 },
      { open: 418, pre: 26 },
      { monthFrom: '2026-09-01', today: '2026-09-29', source: 'snapshot', ageSeconds: 60 },
    );
    expect(r.carried).toBe(381);
    expect(r.carried + r.added - r.informed - r.cancelled).toBe(r.equationEnd);
    expect(r.equationEnd - r.undatedFilled).toBe(r.boardOpen - r.boardPre);
    expect(r.unexplained).toBe(0);
    expect(r.boardOpen).toBe(418);
  });

  it('ส่วนต่างที่อธิบายไม่ได้ต้องโผล่เป็นตัวเลข (ห้ามกลบ)', () => {
    const r = buildMonthResult(
      { points: [{ key: 'm', label: 'm', added: 10, informed: 2, cancelled: 1, backlog: 57 }], ledgerEnd: 57, undatedFilled: 0, openNow: 50 },
      { open: 55, pre: 0 },
      { monthFrom: '2026-09-01', today: '2026-09-29', source: 'fresh', ageSeconds: 0 },
    );
    expect(r.carried).toBe(50);
    expect(r.unexplained).toBe(2);
  });
});

describe('ก้อน 3 — ขั้นของสาย AI / บันทึกติดต่อ', () => {
  const ai = (outcome: string | null, summary: string | null = null) => aiCallSteps({ outcome, summary, reply: null, personRef: 'app-1' });

  it('ไม่รับสาย = โทรอย่างเดียว · ยกเลิก/ไม่มีผล = ไม่นับเลย', () => {
    expect(ai('no_answer')).toEqual(['called']);
    expect(ai('busy')).toEqual(['called']);
    expect(ai('cancelled')).toEqual([]);
    expect(ai(null)).toEqual([]);
  });

  it('ยืนยัน (confirmed) = โทร + ติด + สนใจ · ปฏิเสธ = โทร + ติด ไม่สนใจ', () => {
    expect(ai('confirmed')).toEqual(['called', 'connected', 'interested']);
    expect(ai('declined')).toEqual(['called', 'connected']);
  });

  it('ไม่ใช่เจ้าตัว = ไม่นับว่าติด (ถังโทรติดกลางไม่มี wrong_person)', () => {
    expect(ai('wrong_person')).toEqual(['called']);
  });

  it('เจ้าหน้าที่: ติดต่อไม่ได้ = โทร · ติดต่อได้ = ติด · ติดต่อได้ + นัด = สนใจ + นัด', () => {
    expect(staffContactSteps({ ok: false, hasAppointment: false })).toEqual(['called']);
    expect(staffContactSteps({ ok: false, hasAppointment: true })).toEqual(['called']);
    expect(staffContactSteps({ ok: true, hasAppointment: false })).toEqual(['called', 'connected']);
    expect(staffContactSteps({ ok: true, hasAppointment: true })).toEqual(['called', 'connected', 'interested', 'appointed']);
  });
});

describe('countTodaySteps — นับเป็นคน (เบอร์ไม่ซ้ำ)', () => {
  it('คนเดียวหลายสายในขั้นเดียว = 1 · แยกวันนี้/เมื่อวาน · วันอื่นไม่นับ · ครบทุกขั้นตามลำดับ', () => {
    const steps = countTodaySteps(
      [
        { step: 'called', day: '2026-09-29', who: '+66811111111' },
        { step: 'called', day: '2026-09-29', who: '+66811111111' },
        { step: 'called', day: '2026-09-29', who: '+66822222222' },
        { step: 'called', day: '2026-09-28', who: '+66811111111' },
        { step: 'called', day: '2026-09-20', who: '+66833333333' },
        { step: 'arrived', day: '2026-09-29', who: 'follow:9' },
      ],
      '2026-09-29',
      '2026-09-28',
    );
    expect(steps.map((s) => s.key)).toEqual([...HOME_TODAY_STEPS]);
    expect(steps.find((s) => s.key === 'called')).toEqual({ key: 'called', today: 2, yesterday: 1 });
    expect(steps.find((s) => s.key === 'arrived')).toEqual({ key: 'arrived', today: 1, yesterday: 0 });
    expect(steps.find((s) => s.key === 'applied')).toEqual({ key: 'applied', today: 0, yesterday: 0 });
  });
});
