// @vitest-environment node
/**
 * ═══ ปี พ.ศ. หลุดเข้าช่องวันที่ = สายที่ไม่มีวันถึง (10 ต.ค. 2569) ═══
 *
 * 9 ต.ค. 2569 มีคนพิมพ์ปี 2569 ลงช่องวันที่ของเบราว์เซอร์บนหน้าติดตาม (ช่องรับปี ค.ศ.)
 * ⇒ ได้สาย 28 สาย (2 คน × 7 วัน × 2 สาย) ที่ `scheduled_at` เป็นปี ค.ศ. 2569 — ไม่ขึ้นวันไหนเลย ไม่มีใครโทร
 *
 * 🔴 ด่าน:
 * 1. ตัวอ่าน body ทุกเส้น (สร้าง · แก้ · แก้ตารางทั้งชุด) ปฏิเสธวันที่ไกลเกิน 2 ปี
 * 2. วันใกล้ ๆ (พรุ่งนี้ · อีก 30 วัน · อีก 1 ปี) ยังผ่าน
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: vi.fn(), isPgUndefinedTable: () => false }));

const { parseFollowInput, parseFollowEditInput, parseFollowScheduleReplace, isFollowWhenTooFar, FOLLOW_WHEN_TOO_FAR_MSG } =
  await import('../../api/_handlers/follow.js');

const NOW = new Date('2026-10-10T03:00:00Z');
const base = { recipient_name: 'สมชาย ใจดี', recipient_phone: '0812345678', topic: 'ติดตามเริ่มงาน' };
/** ค่าที่ได้จริงจากฐาน 9 ต.ค. — เที่ยงคืนไทยของ 12/10 แต่ปีเป็น 2569 */
const BE_YEAR = '2569-10-12T00:00:00+07:00';

describe('isFollowWhenTooFar', () => {
  it('ปี พ.ศ. ในช่อง ค.ศ. = ไกลเกิน', () => {
    expect(isFollowWhenTooFar(new Date(BE_YEAR), NOW)).toBe(true);
  });
  it('พรุ่งนี้ · อีก 30 วัน · อีก 1 ปี = ผ่าน', () => {
    for (const days of [1, 30, 365]) {
      expect(isFollowWhenTooFar(new Date(NOW.getTime() + days * 86_400_000), NOW)).toBe(false);
    }
  });
});

describe('ตัวอ่าน body ปฏิเสธปีผิด', () => {
  it('สร้าง (POST)', () => {
    const p = parseFollowInput({ ...base, scheduled_at: BE_YEAR }, NOW);
    expect(p.error).toBe(FOLLOW_WHEN_TOO_FAR_MSG);
    expect(p.value).toBeNull();
  });

  it('สร้าง — ยังไม่ชัวร์เวลา ก็โดนเหมือนกัน (เส้นที่เจอจริง)', () => {
    const p = parseFollowInput({ ...base, scheduled_at: BE_YEAR, time_tbd: true }, NOW);
    expect(p.error).toBe(FOLLOW_WHEN_TOO_FAR_MSG);
  });

  it('แก้ (PATCH) ใช้ตัวตรวจเดียวกัน', () => {
    const p = parseFollowEditInput({ ...base, scheduled_at: BE_YEAR }, NOW);
    expect(p.error).toBe(FOLLOW_WHEN_TOO_FAR_MSG);
  });

  it('แก้ตารางทั้งชุด', () => {
    const p = parseFollowScheduleReplace({ replace_ids: [], rounds: [{ scheduled_at: BE_YEAR, call_mode: 'manual' }] }, NOW);
    expect(p.error).toBe(FOLLOW_WHEN_TOO_FAR_MSG);
  });

  it('วันที่ปกติยังผ่าน', () => {
    const p = parseFollowInput({ ...base, scheduled_at: '2026-10-12T09:00:00+07:00' }, NOW);
    expect(p.error).toBeNull();
    expect(p.value?.when.toISOString()).toBe('2026-10-12T02:00:00.000Z');
  });
});
