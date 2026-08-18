import { describe, expect, it } from 'vitest';
import { findScheduleDuplicates, phoneKey } from '@/lib/followDuplicateGuard';
import type { FollowEntry } from '@/lib/followApi';

const entry = (p: Partial<FollowEntry>): FollowEntry =>
  ({
    id: 'e1',
    recipient_name: 'นายตี้ ตี้',
    recipient_phone: '+66812345678',
    topic: 'ติดตามเริ่มงาน',
    note: null,
    scheduled_at: '2026-08-20T02:00:00.000Z',
    created_by_name: null,
    created_at: null,
    cancelled: false,
    call_status: 'pending',
    call_outcome: null,
    call_summary: null,
    next_action: null,
    called_at: null,
    ...p,
  }) as FollowEntry;

describe('phoneKey', () => {
  it('🔴 0812345678 กับ +66812345678 ต้องเป็นคนเดียวกัน', () => {
    expect(phoneKey('0812345678')).toBe(phoneKey('+66812345678'));
    expect(phoneKey('081-234-5678')).toBe(phoneKey('+66 81 234 5678'));
  });

  it('เบอร์สั้นเกิน/ว่าง = null (ไม่จับคู่มั่ว)', () => {
    expect(phoneKey('1234')).toBeNull();
    expect(phoneKey('')).toBeNull();
    expect(phoneKey(null)).toBeNull();
  });
});

describe('findScheduleDuplicates', () => {
  const existing = [entry({ id: 'a', scheduled_at: '2026-08-20T02:00:00.000Z' })];

  it('🔴 เบอร์เดิม + เวลาเดิม = ซ้ำ พร้อมบอกชื่อรายการเดิม', () => {
    const r = findScheduleDuplicates('0812345678', ['2026-08-20T02:00:00.000Z'], existing);
    expect(r.duplicates).toHaveLength(1);
    expect(r.duplicates[0].existingName).toBe('นายตี้ ตี้');
    expect(r.freshIso).toEqual([]);
  });

  it('เวลาเดิมแต่วินาทีต่าง = ยังซ้ำ (เทียบระดับนาที)', () => {
    const r = findScheduleDuplicates('0812345678', ['2026-08-20T02:00:45.000Z'], existing);
    expect(r.duplicates).toHaveLength(1);
  });

  it('เบอร์เดิมแต่คนละเวลา = ไม่ซ้ำ', () => {
    const r = findScheduleDuplicates('0812345678', ['2026-08-20T05:00:00.000Z'], existing);
    expect(r.duplicates).toEqual([]);
    expect(r.freshIso).toEqual(['2026-08-20T05:00:00.000Z']);
  });

  it('เวลาเดิมแต่คนละเบอร์ = ไม่ซ้ำ', () => {
    const r = findScheduleDuplicates('0899999999', ['2026-08-20T02:00:00.000Z'], existing);
    expect(r.duplicates).toEqual([]);
  });

  it('🔴 รายการที่ยกเลิกแล้วไม่นับซ้ำ (ยกเลิกเพื่อตั้งใหม่ต้องตั้งได้)', () => {
    const r = findScheduleDuplicates(
      '0812345678',
      ['2026-08-20T02:00:00.000Z'],
      [entry({ cancelled: true })],
    );
    expect(r.duplicates).toEqual([]);
  });

  it('รายการที่ปิดงานแล้วยังนับซ้ำ (โทรไปแล้วจริง ตั้งซ้อนคือผิด)', () => {
    const r = findScheduleDuplicates(
      '0812345678',
      ['2026-08-20T02:00:00.000Z'],
      [entry({ completed_at: '2026-08-20T03:00:00.000Z', call_status: 'completed' })],
    );
    expect(r.duplicates).toHaveLength(1);
  });

  it('ผสมซ้ำ+ไม่ซ้ำ → แยกสองกอง (ปุ่ม "บันทึกเฉพาะที่ไม่ซ้ำ" ใช้กองหลัง)', () => {
    const r = findScheduleDuplicates(
      '0812345678',
      ['2026-08-20T02:00:00.000Z', '2026-08-20T05:00:00.000Z'],
      existing,
    );
    expect(r.duplicates).toHaveLength(1);
    expect(r.freshIso).toEqual(['2026-08-20T05:00:00.000Z']);
  });

  it('ชุดว่าง/เวลาพัง ไม่พัง ไม่จับคู่มั่ว', () => {
    expect(findScheduleDuplicates('0812345678', [], existing).duplicates).toEqual([]);
    expect(findScheduleDuplicates('0812345678', ['ไม่ใช่เวลา'], existing).duplicates).toEqual([]);
  });
});
