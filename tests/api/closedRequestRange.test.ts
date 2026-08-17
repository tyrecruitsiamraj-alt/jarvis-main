// @vitest-environment node
/**
 * ช่วงวันที่ของแท็บ "ปิดแล้ว" (17 ส.ค. 2569)
 *
 * ทำไมต้องมีเทสต์: ถ้าคิดเป็น UTC แทนเวลาไทย ตอนดึกของไทย (00:00–07:00) จะได้
 * "วันนี้" เป็นเมื่อวาน → ใบที่เพิ่งปิดวันนี้หายจากหน้าจอทั้งวันโดยไม่มีสัญญาณอะไร
 */
import { describe, expect, it } from 'vitest';
import { closedRangeForDays } from '../../src/lib/closedRequestRange.js';

describe('closedRangeForDays', () => {
  it('คืนช่วง 30 วันย้อนหลังถึงวันนี้', () => {
    const now = new Date('2026-08-17T10:00:00+07:00');
    expect(closedRangeForDays(30, now)).toEqual({ from: '2026-07-18', to: '2026-08-17' });
  });

  it('🔴 คิดเป็นเวลาไทย — ตี 2 ของไทยยังต้องเป็นวันไทย ไม่ใช่เมื่อวานแบบ UTC', () => {
    // 02:00 ของวันที่ 17 ที่ไทย = 19:00 ของวันที่ 16 ที่ UTC
    const now = new Date('2026-08-17T02:00:00+07:00');
    expect(closedRangeForDays(30, now).to).toBe('2026-08-17');
  });

  it('ช่วงยาวขึ้นได้ตามปุ่มที่มีให้เลือก', () => {
    const now = new Date('2026-08-17T10:00:00+07:00');
    expect(closedRangeForDays(90, now).from).toBe('2026-05-19');
    expect(closedRangeForDays(365, now).from).toBe('2025-08-17');
  });

  it('from ต้องมาก่อน to เสมอ', () => {
    const now = new Date('2026-08-17T10:00:00+07:00');
    for (const days of [30, 90, 180, 365]) {
      const r = closedRangeForDays(days, now);
      expect(r.from < r.to).toBe(true);
    }
  });
});
