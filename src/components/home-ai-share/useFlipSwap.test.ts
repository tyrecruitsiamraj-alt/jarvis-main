/**
 * จังหวะพลิกไพ่ของแท่งกราฟ (รอบ 12 · 30 ก.ย. 2569)
 * 🔴 ด่าน: สลับโหมดแล้วหุบของเดิมก่อน (ยังโชว์ของเดิม) → สลับของใหม่ → กาง → กลับปกติ ·
 *    ข้อมูลใหม่ในโหมดเดิมไม่พลิก · สลับกลับก่อนหุบเสร็จต้องไม่ค้างหุบ · ลดการเคลื่อนไหว = เปลี่ยนทันที
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useFlipSwap } from './useFlipSwap';

const HALF = 300;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const setup = (reduced = false) =>
  renderHook(({ value, k }: { value: string; k: string }) => useFlipSwap(value, k, HALF, reduced), {
    initialProps: { value: 'ai-view', k: 'segments' },
  });

describe('useFlipSwap', () => {
  it('เริ่มต้น = ของที่ส่งมา · ไม่พลิก', () => {
    const { result } = setup();
    expect(result.current).toEqual({ shown: 'ai-view', phase: 'idle' });
  });

  it('ข้อมูลใหม่ในโหมดเดิม = เปลี่ยนทันที ไม่พลิก', () => {
    const { result, rerender } = setup();
    rerender({ value: 'ai-view-2', k: 'segments' });
    expect(result.current).toEqual({ shown: 'ai-view-2', phase: 'idle' });
  });

  it('สลับโหมด = หุบของเดิม → สลับของใหม่ → กาง → ปกติ', () => {
    const { result, rerender } = setup();
    rerender({ value: 'bu-view', k: 'bu' });
    expect(result.current).toEqual({ shown: 'ai-view', phase: 'out' });
    act(() => vi.advanceTimersByTime(HALF));
    expect(result.current).toEqual({ shown: 'bu-view', phase: 'in' });
    act(() => vi.advanceTimersByTime(HALF));
    expect(result.current).toEqual({ shown: 'bu-view', phase: 'idle' });
  });

  it('🔴 สลับแล้วสลับกลับก่อนหุบเสร็จ = กางของเดิมกลับ ไม่ค้างหุบ', () => {
    const { result, rerender } = setup();
    rerender({ value: 'bu-view', k: 'bu' });
    act(() => vi.advanceTimersByTime(HALF / 2));
    rerender({ value: 'ai-view', k: 'segments' });
    expect(result.current).toEqual({ shown: 'ai-view', phase: 'in' });
    act(() => vi.advanceTimersByTime(HALF * 3));
    expect(result.current).toEqual({ shown: 'ai-view', phase: 'idle' });
  });

  it('เครื่องตั้งลดการเคลื่อนไหว = เปลี่ยนทันที ไม่พลิก', () => {
    const { result, rerender } = setup(true);
    rerender({ value: 'bu-view', k: 'bu' });
    expect(result.current).toEqual({ shown: 'bu-view', phase: 'idle' });
  });
});
