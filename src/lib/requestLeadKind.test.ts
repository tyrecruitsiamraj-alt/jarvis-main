import { describe, expect, it } from 'vitest';
import {
  leadDaysBetweenYmd,
  requestLeadKindFromDays,
  requestLeadKindFromYmd,
  URGENCY_LEAD_DAYS,
} from '@/lib/requestLeadKind';

describe('requestLeadKindFromDays', () => {
  it('ติดลบ = ย้อนหลัง · 0 ถึง 6 = ฉุกเฉิน · 7 ขึ้นไป = ล่วงหน้า', () => {
    expect(requestLeadKindFromDays(-1)).toBe('retroactive');
    expect(requestLeadKindFromDays(-30)).toBe('retroactive');
    expect(requestLeadKindFromDays(0)).toBe('urgent');
    expect(requestLeadKindFromDays(6)).toBe('urgent');
    expect(requestLeadKindFromDays(7)).toBe('advance');
    expect(requestLeadKindFromDays(365)).toBe('advance');
  });

  it('🔴 เส้นแบ่งอยู่ที่ URGENCY_LEAD_DAYS พอดี ไม่ใช่ 6 หรือ 8', () => {
    expect(requestLeadKindFromDays(URGENCY_LEAD_DAYS - 1)).toBe('urgent');
    expect(requestLeadKindFromDays(URGENCY_LEAD_DAYS)).toBe('advance');
  });

  it('🔴 ไม่รู้วัน = ล่วงหน้า ห้ามเดาเป็นฉุกเฉิน (ใบข้อมูลไม่ครบจะโป่งทั้งกอง)', () => {
    expect(requestLeadKindFromDays(null)).toBe('advance');
    expect(requestLeadKindFromDays(undefined)).toBe('advance');
    expect(requestLeadKindFromDays(Number.NaN)).toBe('advance');
    expect(requestLeadKindFromDays(Number.POSITIVE_INFINITY)).toBe('advance');
  });
});

describe('leadDaysBetweenYmd', () => {
  it('นับเป็นวันตามปฏิทิน', () => {
    expect(leadDaysBetweenYmd('2026-08-01', '2026-08-08')).toBe(7);
    expect(leadDaysBetweenYmd('2026-08-08', '2026-08-01')).toBe(-7);
    expect(leadDaysBetweenYmd('2026-08-01', '2026-08-01')).toBe(0);
  });

  it('ข้ามเดือน/ปี และปีอธิกสุรทินยังถูก', () => {
    expect(leadDaysBetweenYmd('2026-12-28', '2027-01-04')).toBe(7);
    expect(leadDaysBetweenYmd('2028-02-28', '2028-03-01')).toBe(2); // 2028 อธิกสุรทิน
  });

  it('รับ ISO ที่มีเวลาต่อท้าย (ตัดเอาเฉพาะวัน)', () => {
    expect(leadDaysBetweenYmd('2026-08-01T23:59:00Z', '2026-08-08T00:01:00Z')).toBe(7);
  });

  it('รูปแบบผิด = null ไม่ใช่ 0 (0 จะกลายเป็นฉุกเฉินเงียบ ๆ)', () => {
    expect(leadDaysBetweenYmd('', '2026-08-08')).toBeNull();
    expect(leadDaysBetweenYmd('2026-08-01', null)).toBeNull();
    expect(leadDaysBetweenYmd('01/08/2026', '2026-08-08')).toBeNull();
    expect(leadDaysBetweenYmd(undefined, undefined)).toBeNull();
  });
});

describe('requestLeadKindFromYmd', () => {
  it('รวมสองขั้นให้ฝั่ง API เรียกทีเดียว', () => {
    expect(requestLeadKindFromYmd('2026-08-01', '2026-07-25')).toBe('retroactive');
    expect(requestLeadKindFromYmd('2026-08-01', '2026-08-03')).toBe('urgent');
    expect(requestLeadKindFromYmd('2026-08-01', '2026-08-20')).toBe('advance');
  });

  it('🔴 ขาดวันใดวันหนึ่ง = ล่วงหน้า (เหมือน computeJobUrgency เดิม)', () => {
    expect(requestLeadKindFromYmd('2026-08-01', null)).toBe('advance');
    expect(requestLeadKindFromYmd(null, '2026-08-01')).toBe('advance');
  });
});
