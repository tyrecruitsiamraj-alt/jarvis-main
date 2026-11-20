/**
 * ภาพรวม v2 ส่วนใบขอ — บวกลบลงตัวทั้งใบและอัตรา (เจ้าของ 18 พ.ย. 2569
 * "ตรงนี้บวกลบกันต้องลง 327 ใบ 378 อัตรา และคำต้องบอกเลยว่าคือสถานะอะไร")
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { stuckEquation } from '@/lib/recruitStuck';
import type { StuckRequest } from '@/lib/recruitStuck';

const row = (p: Partial<StuckRequest>): StuckRequest => ({ requested: 1, filled: 0, cancelled: 0, remaining: 1, state: 'open', inRange: false, ...p }) as StuckRequest;

describe('สมการใบขอ', () => {
  it('ใบ: ยกมา + ขอใหม่ − ปิดครบ − ยกเลิก = เหลือหา · อัตรา: ขอไว้ยกมา + ขอมา − หาได้แล้ว − ยกเลิก = เหลือหา', () => {
    const rows = [
      row({ requested: 3, filled: 1, remaining: 2 }), // ยกมา ยังเปิด หาได้บางส่วน
      row({ requested: 2, filled: 1, cancelled: 1, remaining: 0, state: 'filled' }), // ยกมา ปิดครบ (ยกเลิกบางส่วน)
      row({ requested: 1, cancelled: 1, remaining: 0, state: 'cancelled', inRange: true }), // ใหม่ ยกเลิก
      row({ requested: 4, remaining: 4, inRange: true }), // ใหม่ ยังเปิด
      // ใบขอชั่วคราวที่จบ = ปิดแล้ว (ใบ) · อัตราที่ไม่ได้คน = ยกเลิก (เจ้าของ 11 พ.ย. 2569) — เดิมยกเลิก 0 ⇒ อัตราขาด
      row({ requested: 3, filled: 0, cancelled: 3, remaining: 0, state: 'filled', inRange: true }),
    ];
    const eq = stuckEquation(rows);
    expect(eq.carried.length + eq.new.length - eq.filled.length - eq.cancelled.length).toBe(eq.remaining.length);
    const sum = (xs: readonly StuckRequest[], k: 'requested' | 'filled' | 'cancelled' | 'remaining') => xs.reduce((n, r) => n + r[k], 0);
    expect(sum(eq.carried, 'requested') + sum(eq.new, 'requested') - sum(rows, 'filled') - sum(rows, 'cancelled')).toBe(sum(eq.remaining, 'remaining'));
  });
  it('เลขใหญ่ = อัตรา ใบเป็นบรรทัดรอง (เจ้าของ 19 พ.ย. 2569 "ถ้าจะนับอัตราก็เอาอัตราขึ้น")', () => {
    // 19 พ.ย. 2569 ค่ำ: สมการย้ายเข้าแผงใบขอ (เลือกเรื่องจากรายการ) — เลขใหญ่ = อัตรา · บรรทัดรอง = ใบ
    const src = readFileSync('src/components/dashboard-trends/v2/RequestBuPanel.tsx', 'utf8');
    for (const w of [
      "{ key: 'carried', label: 'ยอดยกมา', field: 'requested', rows: eq.carried",
      "{ key: 'new', label: 'ขอใหม่', field: 'requested', rows: eq.new",
      "{ key: 'filled', label: 'หาได้แล้ว', field: 'filled', rows: kept.filter((r) => r.filled > 0)",
      "{ key: 'cancelled', label: 'ยกเลิก', field: 'cancelled', rows: kept.filter((r) => r.cancelled > 0)",
      "{ key: 'remaining', label: 'เหลือหา', field: 'remaining', rows: eq.remaining",
      'อัตรา · {subOf(topic)}',
    ])
      expect(src).toContain(w);
    // 20 พ.ย. 2569: บรรทัดรองเป็น "N ใบ" ทุกเรื่อง ไม่มีปิดครบ/ยกเลิกทั้งใบปน ("เอาแค่ ปิดได้กี่อัตรา กี่ใบพอ")
    expect(src).not.toContain('ปิดครบ ${');
    expect(src).not.toContain('ยกเลิกทั้งใบ ${');
  });
  it('ใบขอชั่วคราวที่จบในช่วง: อัตราที่ไม่ได้คนเป็นยกเลิก ไม่หายจากสมการ', () => {
    const src = readFileSync('api/_handlers/recruit-stuck.ts', 'utf8');
    expect(src).toContain('v?.r.prequest && v.role.closed ? { ...r, jobId, remaining: 0, cancelled: Math.max(0, r.requested - r.filled) }');
  });
});
