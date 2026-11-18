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
    ];
    const eq = stuckEquation(rows);
    expect(eq.carried.length + eq.new.length - eq.filled.length - eq.cancelled.length).toBe(eq.remaining.length);
    const sum = (xs: readonly StuckRequest[], k: 'requested' | 'filled' | 'cancelled' | 'remaining') => xs.reduce((n, r) => n + r[k], 0);
    expect(sum(eq.carried, 'requested') + sum(eq.new, 'requested') - sum(rows, 'filled') - sum(rows, 'cancelled')).toBe(sum(eq.remaining, 'remaining'));
  });
  it('หัวการ์ดบอกสถานะ + เครื่องหมาย และอัตราหาได้/ยกเลิกนับจากใบทุกใบในชุด', () => {
    const src = readFileSync('src/components/dashboard-trends/v2/RecruitOverviewV2.tsx', 'utf8');
    for (const w of ['ยอดยกมา · เปิดอยู่ก่อน', '+ ใบขอใหม่ ·', '− ปิดครบใบขอ ·', '− ยกเลิกใบขอ ·', '= เหลือหา · ยังเปิดอยู่ ณ']) expect(src).toContain(w);
    expect(src).toContain("sumOf(reqRows, 'filled')");
    expect(src).toContain("sumOf(reqRows, 'cancelled')");
  });
});
