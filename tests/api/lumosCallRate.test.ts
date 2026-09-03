import { describe, expect, it } from 'vitest';
import {
  compareCallRate,
  summarizeCallRateWindow,
  ymdAddDays,
  type CallRateDay,
} from '@/lib/lumosCallRate';

/**
 * contract ของแผง "Rate ผลการโทร Lumos" — กันสามเรื่องที่จอห้ามโกหก:
 * 1. สายยกเลิกห้ามเป็นทั้งยอดส่งและฐานของ % (กติกาแม่ของโปรเจกต์)
 * 2. ช่วงก่อนหน้าไม่มีข้อมูล = "เทียบไม่ได้" (null) ไม่ใช่ 0% หรือเดาทิศ
 * 3. ขอบหน้าต่างเวลาต้องแม่น — วันแรก/วันสุดท้ายอยู่ในช่วง วันถัดไปไม่อยู่
 */

const day = (d: string, over: Partial<CallRateDay> = {}): CallRateDay => ({
  day: d,
  queued: 0,
  cancelled: 0,
  withResult: 0,
  connected: 0,
  confirmed: 0,
  declined: 0,
  unreached: 0,
  ...over,
});

describe('lumosCallRate — สรุปช่วง', () => {
  it('ยอดส่ง = queued − cancelled และฐาน % = สายที่มีผลจริง (เคสจริง 17 ส.ค.: ยกเลิกยกวัน)', () => {
    const series = [
      // 16 ส.ค. ส่ง 15 ยกเลิกทั้ง 15 — วันแบบนี้ต้องไม่โผล่เป็นยอดส่งเลย
      day('2026-08-16', { queued: 15, cancelled: 15 }),
      day('2026-08-17', {
        queued: 44,
        cancelled: 4,
        withResult: 40,
        connected: 3,
        confirmed: 2,
        declined: 1,
        unreached: 37,
      }),
    ];
    const w = summarizeCallRateWindow(series, '2026-08-16', '2026-08-17');
    expect(w.sent).toBe(40); // 0 + 40 — ไม่ใช่ 59
    expect(w.cancelled).toBe(19);
    expect(w.withResult).toBe(40);
    expect(w.pending).toBe(0);
    expect(w.connectedPct).toBe(8); // 3/40
    expect(w.confirmedPct).toBe(5); // 2/40
    expect(w.unreachedPct).toBe(93); // 37/40
  });

  it('ไม่มีสายที่มีผลจริง = % เป็น null ทุกตัว (ห้ามโชว์ 0% ทั้งที่ยังไม่มีผล)', () => {
    const w = summarizeCallRateWindow([day('2026-09-01', { queued: 5 })], '2026-09-01', '2026-09-01');
    expect(w.sent).toBe(5);
    expect(w.pending).toBe(5);
    expect(w.connectedPct).toBeNull();
    expect(w.confirmedPct).toBeNull();
  });

  it('ขอบหน้าต่าง: นับเฉพาะวันใน [from..to]', () => {
    const series = [
      day('2026-08-27', { queued: 1 }),
      day('2026-08-28', { queued: 2 }),
      day('2026-09-03', { queued: 4 }),
      day('2026-09-04', { queued: 8 }),
    ];
    const w = summarizeCallRateWindow(series, '2026-08-28', '2026-09-03');
    expect(w.sent).toBe(6); // 2 + 4 — ไม่รวม 27 ส.ค. และ 4 ก.ย.
  });
});

describe('lumosCallRate — เทียบสองช่วง', () => {
  it('days=7 วันนี้ 3 ก.ย. ⇒ ช่วงนี้ 28 ส.ค.–3 ก.ย. · ช่วงก่อน 21–27 ส.ค.', () => {
    const t = compareCallRate([], 7, '2026-09-03');
    expect(t.current.fromYmd).toBe('2026-08-28');
    expect(t.current.toYmd).toBe('2026-09-03');
    expect(t.previous.fromYmd).toBe('2026-08-21');
    expect(t.previous.toYmd).toBe('2026-08-27');
  });

  it('ปริมาณโต + ผลสำเร็จดีขึ้น — ทิศถูกและมีตัวเลขทั้งคู่', () => {
    const series = [
      // ช่วงก่อน: ส่ง 10 มีผล 10 สำเร็จ 1 (10%)
      day('2026-08-25', { queued: 10, withResult: 10, connected: 5, confirmed: 1, unreached: 5 }),
      // ช่วงนี้: ส่ง 20 มีผล 10 สำเร็จ 3 (30%)
      day('2026-09-01', { queued: 20, withResult: 10, connected: 8, confirmed: 3, unreached: 2 }),
    ];
    const t = compareCallRate(series, 7, '2026-09-03');
    expect(t.volumeDir).toBe('up');
    expect(t.volumePct).toBe(100); // 10 → 20
    expect(t.successDir).toBe('up');
    expect(t.successDeltaPts).toBe(20); // 10% → 30%
  });

  it('ช่วงก่อนไม่มีสายเลย = volumePct null (หารศูนย์ไม่ได้) แต่ทิศยังบอกว่าโต', () => {
    const t = compareCallRate([day('2026-09-01', { queued: 3 })], 7, '2026-09-03');
    expect(t.volumeDir).toBe('up');
    expect(t.volumePct).toBeNull();
    // คุณภาพเทียบไม่ได้ — ช่วงก่อนไม่มีฐาน
    expect(t.successDir).toBeNull();
    expect(t.successDeltaPts).toBeNull();
  });

  it('สองช่วงว่างทั้งคู่ = ทุกแนวโน้มเป็น null (ไม่ใช่ flat หลอก ๆ)', () => {
    const t = compareCallRate([], 7, '2026-09-03');
    expect(t.volumeDir).toBeNull();
    expect(t.successDir).toBeNull();
  });

  it('สายยกเลิกไม่ดันปริมาณ: ช่วงนี้มีแต่ยกเลิก = ทิศลง ไม่ใช่โต', () => {
    const series = [
      day('2026-08-25', { queued: 5, withResult: 5, confirmed: 1, connected: 1, unreached: 4 }),
      day('2026-09-01', { queued: 9, cancelled: 9 }),
    ];
    const t = compareCallRate(series, 7, '2026-09-03');
    expect(t.current.sent).toBe(0);
    expect(t.volumeDir).toBe('down');
  });
});

describe('lumosCallRate — ปฏิทิน', () => {
  it('ymdAddDays ข้ามเดือน/ปีถูก', () => {
    expect(ymdAddDays('2026-09-03', -6)).toBe('2026-08-28');
    expect(ymdAddDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(ymdAddDays('2026-08-31', 1)).toBe('2026-09-01');
  });
});
