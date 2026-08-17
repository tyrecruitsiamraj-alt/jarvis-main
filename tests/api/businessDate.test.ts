import { describe, it, expect } from 'vitest';
import {
  bangkokBusinessDateYmd,
  bangkokNoonDate,
  isValidYmd,
  toBangkokYmd,
} from '../../api/_lib/businessDate';
import { toYmdBangkok } from '../../src/lib/dateTh';

describe('businessDate — ปฏิทินกรุงเทพ', () => {
  it('แปลงตามเขตเวลากรุงเทพ ไม่ใช่ UTC', () => {
    // 2026-07-15 18:00Z = 2026-07-16 01:00 ที่กรุงเทพ (+07:00) → ต้องได้วันที่ 16
    expect(bangkokBusinessDateYmd(new Date('2026-07-15T18:00:00Z'))).toBe('2026-07-16');
    // 2026-07-15 16:59Z = 2026-07-15 23:59 กรุงเทพ → ยังเป็นวันที่ 15
    expect(bangkokBusinessDateYmd(new Date('2026-07-15T16:59:00Z'))).toBe('2026-07-15');
    // ข้ามปี
    expect(bangkokBusinessDateYmd(new Date('2025-12-31T17:00:00Z'))).toBe('2026-01-01');
  });

  it('ฝั่ง client (dateTh.toYmdBangkok) ต้องให้ผลตรงกับฝั่ง API', () => {
    for (const iso of [
      '2026-07-15T18:00:00Z',
      '2026-07-15T16:59:00Z',
      '2025-12-31T17:00:00Z',
      '2026-02-28T20:30:00Z',
    ]) {
      expect(toYmdBangkok(new Date(iso))).toBe(bangkokBusinessDateYmd(new Date(iso)));
    }
  });

  it('toBangkokYmd: ค่า YMD อยู่แล้วส่งคืนตรง ๆ · ค่าเสียคืนสตริงว่าง', () => {
    expect(toBangkokYmd('2026-07-15')).toBe('2026-07-15');
    expect(toBangkokYmd('  2026-07-15  ')).toBe('2026-07-15');
    expect(toBangkokYmd(null)).toBe('');
    expect(toBangkokYmd(undefined)).toBe('');
    expect(toBangkokYmd('ไม่ใช่วันที่')).toBe('');
    expect(toBangkokYmd(new Date('invalid'))).toBe('');
  });

  it('bangkokNoonDate / isValidYmd', () => {
    expect(bangkokNoonDate('2026-07-15').toISOString()).toBe('2026-07-15T05:00:00.000Z');
    expect(isValidYmd('2026-02-29')).toBe(false);
    expect(isValidYmd('2024-02-29')).toBe(true);
    expect(isValidYmd('2026-7-15')).toBe(false);
  });

  /**
   * กันถอยหลังของบัคจริง: เดิม bangkokBusinessDateYmd สร้าง Intl.DateTimeFormat ใหม่ทุกครั้ง
   * เส้นใบขอที่ปิดแล้วเรียก 6 ครั้ง/แถว × 5,000 แถว → 30,000 ครั้ง ใช้เวลา ~4.7 วินาที
   * (ทำให้ API ใช้เวลา 4-5 วินาที) พอ hoist ตัวจัดรูปออกมาเหลือ ~0.06 วินาที
   * เกณฑ์ 1,500ms ตั้งไว้หลวมมากเทียบกับ 60ms ที่ควรได้ — ถ้าพังคือมีคนเอา new Intl กลับเข้าไปในฟังก์ชัน
   */
  it('เรียก 30,000 ครั้งต้องไม่ช้า (ตัวจัดรูปวันที่ต้องสร้างครั้งเดียว)', () => {
    const d = new Date('2026-07-15T03:00:00Z');
    const started = Date.now();
    for (let i = 0; i < 30_000; i += 1) bangkokBusinessDateYmd(d);
    expect(Date.now() - started).toBeLessThan(1_500);
  });
});
