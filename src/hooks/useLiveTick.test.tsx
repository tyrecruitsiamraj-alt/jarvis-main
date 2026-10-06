/**
 * อัปเดตสดหน้าหลัก (เจ้าของ 6 ต.ค. 2569 → Choice "ตัวเลขอัปเดตเองสด ๆ")
 * - รอบเดินทุก interval ขณะเปิดดู · แท็บซ่อน = หยุด · กลับมาดู = เดินทันทีถ้าเลยเวลา · ปิด = ไม่เดิน
 * - เลขวิ่งเฉพาะตอนหัวข้อ/ช่วงเดิม · สลับหัวข้อ = เปลี่ยนทันที
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLiveTick } from '@/hooks/useLiveTick';
import { useCountUp } from '@/hooks/useCountUp';

let visibility: DocumentVisibilityState = 'visible';
beforeEach(() => {
  vi.useFakeTimers();
  visibility = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useLiveTick', () => {
  it('เดินทุก 30 วิขณะเปิดดู', () => {
    const { result } = renderHook(() => useLiveTick(true, 30_000));
    expect(result.current).toBe(0);
    act(() => void vi.advanceTimersByTime(30_000));
    expect(result.current).toBe(1);
    act(() => void vi.advanceTimersByTime(30_000));
    expect(result.current).toBe(2);
  });

  it('แท็บซ่อน = ไม่เดิน · กลับมาดูหลังเลยเวลา = เดินทันที', () => {
    const { result } = renderHook(() => useLiveTick(true, 30_000));
    visibility = 'hidden';
    act(() => void vi.advanceTimersByTime(90_000));
    expect(result.current).toBe(0);
    visibility = 'visible';
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(result.current).toBe(1);
  });

  it('ปิด (ช่วงที่จบไปแล้ว) = ไม่เดินเลย', () => {
    const { result } = renderHook(() => useLiveTick(false, 30_000));
    act(() => void vi.advanceTimersByTime(120_000));
    expect(result.current).toBe(0);
  });
});

describe('useCountUp', () => {
  it('ครั้งแรก = ค่าจริงทันที (ไม่วิ่งจาก 0)', () => {
    const { result } = renderHook(() => useCountUp(205, 'follow|a|b'));
    expect(result.current).toBe(205);
  });

  it('สลับหัวข้อ/ช่วง = ค่าใหม่ทันทีใน render เดียวกัน', () => {
    const { result, rerender } = renderHook(({ v, k }) => useCountUp(v, k), { initialProps: { v: 205, k: 'follow|a|b' } });
    rerender({ v: 43, k: 'aftercare|a|b' });
    expect(result.current).toBe(43);
  });

  it('หัวข้อเดิมเลขเปลี่ยน = วิ่งจนถึงค่าใหม่', () => {
    const { result, rerender } = renderHook(({ v, k }) => useCountUp(v, k), { initialProps: { v: 100, k: 'follow|a|b' } });
    rerender({ v: 110, k: 'follow|a|b' });
    act(() => void vi.advanceTimersByTime(1_000));
    expect(result.current).toBe(110);
  });
});
