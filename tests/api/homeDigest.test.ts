// @vitest-environment node
/**
 * สามแผงล่างของหน้าหลัก (Phase 10.2)
 *
 * ด่านที่ห้ามหลุด:
 * 1. "อัปเดตล่าสุด" เอาเฉพาะโต๊ะที่ **มีเวลาเหตุการณ์** — โต๊ะที่วันนี้ไม่ขยับไม่ใช่ "อัปเดต"
 * 2. "ผลงานเด่น" ตัดโต๊ะที่ยังไม่มีผลงานออก · ยอดเท่ากันต้องเรียงคงที่ (ไม่สลับที่ทุกโหลด)
 * 3. แท่งของชุดว่างต้องเป็น 0 ไม่ใช่ NaN
 * 4. ไม่รู้เวลา = ไม่มีข้อความเวลา (ห้ามเดาว่า "เมื่อสักครู่")
 * 5. ชื่อโต๊ะต้องครบทั้ง 6 ตัวและตรงกับชื่อในฉากห้องทำงาน
 */
import { describe, expect, it } from 'vitest';
import {
  DESK_NAME,
  agoText,
  barPct,
  dailyLeaders,
  digestRows,
  latestUpdates,
} from '../../src/lib/homeDigest.js';

const T = (h: number) => new Date(Date.UTC(2026, 7, 24, h, 0, 0)).toISOString();
const NOW = new Date(Date.UTC(2026, 7, 24, 10, 0, 0));

const map = {
  intake: { count: 3, unit: 'ใบ', lastAt: T(9) },
  aiCalls: { count: 12, unit: 'สาย', lastAt: T(8) },
  selection: { count: 0, unit: 'คน', lastAt: null },
  follow: { count: 12, unit: 'ราย', lastAt: T(6) },
  content: { count: 1, unit: 'ใบ', lastAt: T(2) },
  aftercare: { count: 0, unit: 'คน', lastAt: null },
};

describe('แปลงเป็นแถว', () => {
  it('ครบ 6 โต๊ะ พร้อมหน่วยทุกแถว', () => {
    const rows = digestRows(map);
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.unit.length > 0)).toBe(true);
    expect(rows.map((r) => r.id)).toEqual([
      'intake',
      'aiCalls',
      'selection',
      'follow',
      'content',
      'aftercare',
    ]);
  });

  it('ชื่อโต๊ะครบทั้ง 6 ตัว ไม่มีตัวว่าง', () => {
    expect(Object.keys(DESK_NAME)).toHaveLength(6);
    expect(Object.values(DESK_NAME).every((v) => v.trim().length > 0)).toBe(true);
  });

  it('API ไม่ส่งอะไรมา = ไม่มีแถว (ไม่ระเบิด)', () => {
    expect(digestRows(null)).toEqual([]);
    expect(digestRows(undefined)).toEqual([]);
    expect(digestRows({})).toEqual([]);
  });

  it('โต๊ะที่ API ส่งมาไม่ครบ ก็ข้ามตัวที่ไม่มี', () => {
    const rows = digestRows({ follow: { count: 2, unit: 'ราย', lastAt: null } });
    expect(rows.map((r) => r.id)).toEqual(['follow']);
  });

  it('เลขติดลบ/เศษ ถูกปัดให้ปลอดภัย', () => {
    const rows = digestRows({ intake: { count: -5, unit: 'ใบ', lastAt: null } });
    expect(rows[0].count).toBe(0);
  });
});

describe('อัปเดตล่าสุด', () => {
  it('🔴 เอาเฉพาะโต๊ะที่มีเวลา และเรียงใหม่สุดก่อน', () => {
    const got = latestUpdates(digestRows(map));
    expect(got.map((r) => r.id)).toEqual(['intake', 'aiCalls', 'follow', 'content']);
  });

  it('ไม่มีโต๊ะไหนขยับ = แผงว่าง', () => {
    const rows = digestRows({
      intake: { count: 0, unit: 'ใบ', lastAt: null },
      follow: { count: 0, unit: 'ราย', lastAt: null },
    });
    expect(latestUpdates(rows)).toEqual([]);
  });
});

describe('ผลงานเด่นประจำวัน', () => {
  it('เรียงมากไปน้อย · ตัดโต๊ะที่ยังไม่มีผลงาน', () => {
    const got = dailyLeaders(digestRows(map));
    expect(got.map((r) => r.id)).toEqual(['aiCalls', 'follow', 'intake', 'content']);
    expect(got.some((r) => r.count === 0)).toBe(false);
  });

  it('🔴 ยอดเท่ากันเรียงตามลำดับงานจริง (ไม่สลับที่ทุกโหลด)', () => {
    const a = dailyLeaders(digestRows(map));
    const b = dailyLeaders(digestRows(map));
    expect(a.map((r) => r.id)).toEqual(b.map((r) => r.id));
    // aiCalls มาก่อน follow เพราะ 12 เท่ากันแต่ aiCalls อยู่ต้นสายงาน
    expect(a[0].id).toBe('aiCalls');
    expect(a[1].id).toBe('follow');
  });

  it('แท่งเทียบตัวมากสุด · ชุดว่างได้ 0 ไม่ใช่ NaN', () => {
    const rows = dailyLeaders(digestRows(map));
    expect(barPct(12, rows)).toBe(100);
    expect(barPct(1, rows)).toBeGreaterThanOrEqual(4);
    expect(barPct(5, [])).toBe(0);
    expect(Number.isNaN(barPct(0, []))).toBe(false);
  });
});

describe('เวลาสัมพัทธ์', () => {
  it('บอกเป็นนาที/ชั่วโมง/วัน', () => {
    expect(agoText(new Date(NOW.getTime() - 30_000).toISOString(), NOW)).toBe('เมื่อครู่นี้');
    expect(agoText(new Date(NOW.getTime() - 12 * 60_000).toISOString(), NOW)).toBe('12 นาทีที่แล้ว');
    expect(agoText(new Date(NOW.getTime() - 3 * 3_600_000).toISOString(), NOW)).toBe('3 ชม.ที่แล้ว');
    expect(agoText(new Date(NOW.getTime() - 50 * 3_600_000).toISOString(), NOW)).toBe('2 วันที่แล้ว');
  });

  it('🔴 ไม่รู้เวลา = null ห้ามเดาคำว่า "เมื่อสักครู่"', () => {
    expect(agoText(null, NOW)).toBeNull();
    expect(agoText(undefined, NOW)).toBeNull();
    expect(agoText('ไม่ใช่วันที่', NOW)).toBeNull();
  });

  it('เวลาอนาคต (นาฬิกาเครื่องเพี้ยน) ไม่ได้ค่าติดลบ', () => {
    expect(agoText(new Date(NOW.getTime() + 60_000).toISOString(), NOW)).toBe('อีกไม่นาน');
  });
});
