// @vitest-environment node
/**
 * Phase 5.11 — "ผลติดต่อ `ok=false` นับเป็นไม่สนใจ" (เจ้าของสั่ง 23 ส.ค. 2569)
 *
 * ด่านที่ห้ามหลุด:
 * 1. ok=false → เข้าถัง "ไม่สนใจ" (เดิมหล่นอยู่ใน "ทั้งหมด" แล้วถูกไล่โทรซ้ำวนไป)
 * 2. **อันที่ใหม่กว่าชนะ** — ปฏิเสธเมื่อวานแล้ววันนี้โทรติดว่าเอางาน ต้องอ่านว่าสนใจ
 * 3. ผลที่แปลว่า "ยังติดต่อไม่ได้" (no_answer/busy) ไม่ใช่ทั้งสนใจและไม่สนใจ
 * 4. กล่องบน dashboard กับแท็บในหน้าต้องใช้กติกาเดียวกัน (isInRmListView เรียกตัวเดียวกัน)
 */
import { describe, expect, it } from 'vitest';
import {
  isInterestedApplicant,
  isNotInterestedApplicant,
  splitInterested,
} from '../../src/lib/applicantCallOutcome.js';
import { isInRmListView } from '../../src/lib/recruitRm.js';
import type { PublicApplication } from '../../src/lib/publicApplicationsApi.js';

const row = (over: Partial<PublicApplication>): PublicApplication =>
  ({ id: 'x', full_name: 'ทดสอบ', phone: '0999999999', status: 'new', created_at: '2026-08-01T00:00:00Z', ...over }) as PublicApplication;

describe('ok=false นับเป็นไม่สนใจ', () => {
  it('บันทึกผลติดต่อไม่สำเร็จ = ไม่สนใจ', () => {
    const a = { last_contact_ok: false, last_contact_at: '2026-08-20T03:00:00Z' };
    expect(isNotInterestedApplicant(a)).toBe(true);
    expect(isInterestedApplicant(a)).toBe(false);
  });

  it('บันทึกผลติดต่อสำเร็จเฉย ๆ ยังไม่ใช่ "สนใจ" (สนใจต้องมาจากผลโทร)', () => {
    const a = { last_contact_ok: true, last_contact_at: '2026-08-20T03:00:00Z' };
    expect(isNotInterestedApplicant(a)).toBe(false);
    expect(isInterestedApplicant(a)).toBe(false);
  });

  it('ไม่มีสัญญาณอะไรเลย = ไม่เข้าถังไหน', () => {
    expect(isInterestedApplicant({})).toBe(false);
    expect(isNotInterestedApplicant({})).toBe(false);
  });
});

describe('อันที่ใหม่กว่าชนะ', () => {
  it('ปฏิเสธเมื่อวาน + วันนี้โทรติดว่าเอางาน → สนใจ', () => {
    const a = {
      last_contact_ok: false,
      last_contact_at: '2026-08-20T03:00:00Z',
      last_call_outcome: 'confirmed',
      last_call_at: '2026-08-22T03:00:00Z',
    };
    expect(isInterestedApplicant(a)).toBe(true);
    expect(isNotInterestedApplicant(a)).toBe(false);
  });

  it('โทรติดว่าเอางานเมื่อวาน + วันนี้เจ้าหน้าที่บันทึกว่าไม่สำเร็จ → ไม่สนใจ', () => {
    const a = {
      last_call_outcome: 'confirmed',
      last_call_at: '2026-08-20T03:00:00Z',
      last_contact_ok: false,
      last_contact_at: '2026-08-22T03:00:00Z',
    };
    expect(isNotInterestedApplicant(a)).toBe(true);
    expect(isInterestedApplicant(a)).toBe(false);
  });

  it('ไม่มีเวลาให้เทียบ → contact log ชนะ (บันทึกเจาะจงใบนี้ตรง ๆ)', () => {
    const a = { last_call_outcome: 'confirmed', last_contact_ok: false };
    expect(isNotInterestedApplicant(a)).toBe(true);
  });
});

describe('ผลที่ยังไม่สรุป', () => {
  it('no_answer / unresponsive ไม่ใช่ทั้งสนใจและไม่สนใจ', () => {
    for (const o of ['no_answer', 'busy', 'unresponsive']) {
      const a = { last_call_outcome: o, last_call_at: '2026-08-22T03:00:00Z' };
      expect(isInterestedApplicant(a)).toBe(false);
      expect(isNotInterestedApplicant(a)).toBe(false);
    }
  });

  it('ค่าปนเปื้อน (completed) ไม่ถูกนับเป็นอะไร', () => {
    const a = { last_call_outcome: 'completed', last_call_at: '2026-08-22T03:00:00Z' };
    expect(isInterestedApplicant(a)).toBe(false);
    expect(isNotInterestedApplicant(a)).toBe(false);
  });
});

describe('มุมมองรายชื่อใช้กติกาเดียวกัน (ห้ามเทียบ === ในไฟล์หน้า)', () => {
  it('แท็บ "ไม่สนใจ" รับใบที่ ok=false ด้วย', () => {
    expect(isInRmListView(row({ last_contact_ok: false, last_contact_at: '2026-08-20T03:00:00Z' }), 'declined')).toBe(true);
  });

  it('แท็บ "สนใจ" ยังเป็นคนที่ตอบสนใจตอนโทร', () => {
    expect(isInRmListView(row({ last_call_outcome: 'confirmed', last_call_at: '2026-08-20T03:00:00Z' }), 'interested')).toBe(true);
    expect(isInRmListView(row({ last_contact_ok: false }), 'interested')).toBe(false);
  });

  it('คิว "รอเก็บใบสมัคร" = สนใจ + ยังไม่ขึ้นบอร์ด', () => {
    const base = { last_call_outcome: 'confirmed', last_call_at: '2026-08-20T03:00:00Z' } as const;
    expect(isInRmListView(row({ ...base }), 'collect')).toBe(true);
    expect(isInRmListView(row({ ...base, on_board: true }), 'collect')).toBe(false);
  });

  it('splitInterested: สนใจ + ไม่สนใจ ≠ ทั้งหมด (คนที่ยังไม่ถูกโทรอยู่แค่ "ทั้งหมด")', () => {
    const items = [
      { last_call_outcome: 'confirmed', last_call_at: '2026-08-22T00:00:00Z' },
      { last_contact_ok: false, last_contact_at: '2026-08-22T00:00:00Z' },
      {},
    ];
    const { all, interested, notInterested } = splitInterested(items);
    expect(all).toHaveLength(3);
    expect(interested).toHaveLength(1);
    expect(notInterested).toHaveLength(1);
  });
});
