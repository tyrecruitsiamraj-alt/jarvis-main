/**
 * ฉากเปิดหน้าเข้าสู่ระบบ (`BrandIntro`) — เจ้าของสั่ง 6 ก.ย. 2569 ให้เล่น
 * **ทุกครั้ง** ที่เข้าหน้า Login (เดิม 4 ก.ย. 2569 เคยจำกัดโชว์ครั้งเดียวต่อ
 * การเปิดเบราว์เซอร์ผ่าน sessionStorage — ถอดออกแล้ว)
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. **เล่นทุกครั้งที่ component mount** — ไม่มี sessionStorage จำการดูอีกต่อไป
 * 2. **ข้ามได้ทันที** — กดคีย์/แตะ = ฉากเริ่มจางออกเลย ไม่ต้องรอครบเวลา
 * 3. **ห้ามกินคลิกของฟอร์ม** — ต้องมี `pointer-events-none` ตลอด
 * (ทำไมต้องเทสต์: ฉากยาว ~0.95 วิ แล้วหายไป จับด้วยการดูจอไม่ทัน)
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';

import BrandIntro from './BrandIntro';

beforeEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/login');
});

describe('BrandIntro', () => {
  it('รอบแรกโชว์ตัวอักษรครบทุกตัวของ "SO RECRUIT"', () => {
    render(<BrandIntro />);
    const overlay = document.querySelector('[data-brand-intro]');
    expect(overlay).not.toBeNull();
    // 2 + 7 ตัวอักษร (เว้นวรรคไม่นับเพราะแยกเป็นสองคำ)
    expect(overlay!.querySelectorAll('p span span')).toHaveLength(9);
    expect(screen.getByText('S')).toBeTruthy();
  });

  it('🔴 ผ้าคลุมห้ามกินคลิกของฟอร์มข้างหลัง', () => {
    render(<BrandIntro />);
    const overlay = document.querySelector('[data-brand-intro]')!;
    expect(overlay.className).toContain('pointer-events-none');
  });

  it('🔴 เล่นทุกครั้งที่ mount — รอบสองก็ต้องขึ้นอีก (เจ้าของสั่ง 6 ก.ย. 2569 เลิกจำ session)', () => {
    render(<BrandIntro />);
    expect(document.querySelector('[data-brand-intro]')).not.toBeNull();

    cleanup();
    render(<BrandIntro />);
    expect(document.querySelector('[data-brand-intro]')).not.toBeNull();
  });

  it('🔴 กดคีย์แล้วเริ่มจางออกทันที ไม่ต้องรอครบเวลา', () => {
    render(<BrandIntro />);
    const before = document.querySelector('[data-brand-intro]')!;
    expect(before.className).toContain('opacity-100');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    });
    expect(document.querySelector('[data-brand-intro]')!.className).toContain('opacity-0');
  });

  it('ถอดตัวเองออกจากหน้าเมื่อจางจบ (ไม่ค้างเป็นชั้นเปล่า)', () => {
    vi.useFakeTimers();
    try {
      render(<BrandIntro />);
      // ⚠️ ต้องเดินเวลา **สองจังหวะ** — จังหวะแรกทำให้เริ่มจาง (ตัวจับเวลาจางถูกตั้งใน
      // effect ที่รันหลัง state เปลี่ยน) จังหวะที่สองจึงถอดออกจากหน้า
      act(() => {
        vi.advanceTimersByTime(620 + 10);
      });
      act(() => {
        vi.advanceTimersByTime(320 + 10);
      });
      expect(document.querySelector('[data-brand-intro]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('เครื่องที่ตั้งลดการเคลื่อนไหว = ไม่โชว์เลย', () => {
    const spy = vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList);
    try {
      render(<BrandIntro />);
      expect(document.querySelector('[data-brand-intro]')).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it('`?intro=1` บังคับเล่นแม้ตั้งลดการเคลื่อนไหวไว้', () => {
    const spy = vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList);
    try {
      window.history.replaceState({}, '', '/login?intro=1');
      render(<BrandIntro />);
      expect(document.querySelector('[data-brand-intro]')).not.toBeNull();
    } finally {
      spy.mockRestore();
    }
  });
});
