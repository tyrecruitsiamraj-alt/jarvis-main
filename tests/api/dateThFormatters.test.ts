import { describe, it, expect } from 'vitest';
import { formatDateTimeTh, shortTime } from '../../src/lib/dateTh';

/**
 * ตัวจัดรูปวันเวลาแบบไทย — ต้องสร้าง Intl formatter **ครั้งเดียวระดับโมดูล**
 * (กติกาเดียวกับ `api/_lib/businessDate.ts` และ `toYmdBangkok`)
 *
 * เดิมสองฟังก์ชันนี้เรียก `toLocaleString()` / `toLocaleTimeString()` ตรง ๆ
 * ซึ่งสร้าง formatter ใหม่ทุกครั้ง และถูกเรียก **ต่อแถว**
 * (ป้ายผลโทรทุกใบในหน้า Matching · ทุกแถวในแผงล็อกโทร)
 */
describe('formatDateTimeTh / shortTime — ผลลัพธ์ต้องเท่ากับวิธีเดิมเป๊ะ', () => {
  const samples = [
    '2026-08-03T11:08:00.000Z',
    '2026-08-06T06:37:47.686Z',
    '2025-12-31T17:00:00.000Z',
    '2026-01-01T00:00:00.000Z',
    '2026-02-28T23:59:59.999Z',
  ];

  it('formatDateTimeTh ให้ผลเดียวกับ toLocaleString เดิมทุกค่า', () => {
    for (const iso of samples) {
      const legacy = new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
      expect(formatDateTimeTh(iso)).toBe(legacy);
    }
  });

  it('shortTime ให้ผลเดียวกับ toLocaleTimeString เดิมทุกค่า', () => {
    for (const iso of samples) {
      const legacy = new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      expect(shortTime(iso)).toBe(legacy);
    }
  });

  it('ค่าที่อ่านไม่ออกต้องคืนแบบเดิม — คนละแบบกันโดยตั้งใจ', () => {
    // formatDateTimeTh คืนสตริงเดิม (อยากเห็นของจริงเวลาไล่ต้นเหตุ)
    expect(formatDateTimeTh('ไม่ใช่วันที่')).toBe('ไม่ใช่วันที่');
    expect(formatDateTimeTh(null)).toBe('—');
    expect(formatDateTimeTh('')).toBe('—');
    // shortTime คืน "—"
    expect(shortTime('ไม่ใช่วันที่')).toBe('—');
  });

  it('เรียกซ้ำได้ผลเท่าเดิม (formatter ที่ใช้ร่วมกันต้องไม่มีสถานะค้าง)', () => {
    const first = formatDateTimeTh(samples[0]);
    for (let i = 0; i < 100; i++) {
      formatDateTimeTh(samples[i % samples.length]);
      shortTime(samples[i % samples.length]);
    }
    expect(formatDateTimeTh(samples[0])).toBe(first);
  });
});

describe('ความเร็ว — พังแปลว่ามีคนเอา new Intl.* กลับเข้าไปในฟังก์ชัน', () => {
  it('เรียก 30,000 ครั้งต้องไม่เกิน 1.5 วินาที', () => {
    const iso = '2026-08-06T06:37:47.686Z';
    const started = Date.now();
    for (let i = 0; i < 15_000; i++) {
      formatDateTimeTh(iso);
      shortTime(iso);
    }
    const elapsed = Date.now() - started;
    expect(elapsed).toBeLessThan(1500);
  });
});
