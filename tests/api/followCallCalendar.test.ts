// @vitest-environment node
/**
 * ปฏิทินการโทรหน้า Follow (เจ้าของสั่ง 18 ส.ค. 2569)
 *
 * ทำไมต้องคุม: ยอด "วันนี้โทรกี่คน" เป็นตัวเลขที่คนใช้วางแผนงานจริง
 * เพี้ยนไปวันเดียวเพราะเขตเวลา = ไปยืนรอสายที่ไม่มา
 */
import { describe, expect, it } from 'vitest';
import {
  buildCallCalendar,
  callDayKey,
  monthGridDays,
  monthKeyOf,
  shiftMonth,
} from '../../src/lib/followCallCalendar';

describe('วันของสายโทร', () => {
  it('🔴 ตัดวันตามปฏิทินกรุงเทพ ไม่ใช่ UTC', () => {
    // 18 ส.ค. 01:00 น. ไทย = 17 ส.ค. 18:00Z — ถ้าตัดฝั่ง UTC จะกลายเป็นวันที่ 17
    expect(callDayKey('2026-08-17T18:00:00.000Z')).toBe('2026-08-18');
  });

  it('ค่าว่าง/เสีย = null (ไม่ใช่วันนี้)', () => {
    expect(callDayKey(null)).toBeNull();
    expect(callDayKey('')).toBeNull();
    expect(callDayKey('ไม่ใช่วันที่')).toBeNull();
  });
});

describe('ยอดต่อวัน', () => {
  const e = (id: string, sched: string | null, called: string | null, cancelled = false) => ({
    id,
    scheduled_at: sched,
    called_at: called,
    cancelled,
  });

  it('นับ "ตั้งไว้จะโทร" กับ "โทรแล้ว" แยกถัง', () => {
    const cal = buildCallCalendar([
      e('1', '2026-08-18T02:00:00.000Z', null),
      e('2', '2026-08-18T03:00:00.000Z', '2026-08-18T04:00:00.000Z'),
    ]);
    const day = cal.get('2026-08-18')!;
    expect(day.planned).toBe(2);
    expect(day.called).toBe(1);
  });

  it('🔴 สายที่ยกเลิกไม่นับเป็น "จะโทร" — ไม่งั้นยอดวันนั้นโป่งด้วยสายที่ตายแล้ว', () => {
    const cal = buildCallCalendar([e('1', '2026-08-18T02:00:00.000Z', null, true)]);
    const day = cal.get('2026-08-18')!;
    expect(day.planned).toBe(0);
    expect(day.cancelled).toBe(1);
  });

  it('🔴 ผลกลับคนละวันกับที่ตั้งไว้ ต้องนับคนละวัน', () => {
    const cal = buildCallCalendar([e('1', '2026-08-18T02:00:00.000Z', '2026-08-19T02:00:00.000Z')]);
    expect(cal.get('2026-08-18')!.planned).toBe(1);
    expect(cal.get('2026-08-18')!.called).toBe(0);
    expect(cal.get('2026-08-19')!.called).toBe(1);
  });

  it('ไม่มีข้อมูลวันไหน = ไม่มีคีย์วันนั้น (ไม่สร้างวันเปล่า)', () => {
    const cal = buildCallCalendar([e('1', null, null)]);
    expect(cal.size).toBe(0);
  });
});

describe('กริดเดือน', () => {
  it('ส.ค. 2026 เริ่มวันเสาร์ → มีช่องว่างนำ 6 ช่อง และครบสัปดาห์พอดี', () => {
    const cells = monthGridDays('2026-08');
    expect(cells.length % 7).toBe(0);
    expect(cells.slice(0, 6).every((c) => c === null)).toBe(true);
    expect(cells[6]).toBe('2026-08-01');
    expect(cells.filter(Boolean).length).toBe(31);
  });

  it('ก.พ. ปีอธิกสุรทินได้ 29 วัน', () => {
    expect(monthGridDays('2024-02').filter(Boolean).length).toBe(29);
  });

  it('เดือนผิดรูป = กริดว่าง ไม่ใช่พัง', () => {
    expect(monthGridDays('')).toEqual([]);
    expect(monthGridDays('2026-13')).toEqual([]);
    expect(monthGridDays('abcd')).toEqual([]);
  });
});

describe('เลื่อนเดือน', () => {
  it('ข้ามปีถูกต้องทั้งสองทาง', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('เดือนของวัน', () => {
    expect(monthKeyOf('2026-08-18')).toBe('2026-08');
  });
});
