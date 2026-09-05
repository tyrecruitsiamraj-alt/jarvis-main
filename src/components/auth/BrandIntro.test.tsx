/**
 * ฉากเปิดหน้าเข้าสู่ระบบ (`BrandIntro`) — เจ้าของขอลองเล่น 4 ก.ย. 2569
 * และย้ำว่า *"อย่าพึ่งเอาขึ้น ขอรันดูเองก่อนว่ามันจะน่ารำคาญไหม"*
 *
 * 🔴 ด่านที่ห้ามหลุด (สามข้อนี้คือเหตุผลที่ฉากนี้ "ไม่กวน"):
 * 1. **โชว์ครั้งเดียวต่อการเปิดเบราว์เซอร์** — เข้าใหม่ในแท็บเดิมต้องไม่เห็นซ้ำ
 * 2. **ข้ามได้ทันที** — กดคีย์/แตะ = ฉากเริ่มจางออกเลย ไม่ต้องรอครบเวลา
 * 3. **ห้ามกินคลิกของฟอร์ม** — ต้องมี `pointer-events-none` ตลอด
 * (ทำไมต้องเทสต์: ฉากยาว ~0.95 วิ แล้วหายไป จับด้วยการดูจอไม่ทัน)
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';

import BrandIntro from './BrandIntro';

const SEEN_KEY = 'jarvis.brandIntroSeen';

beforeEach(() => {
  cleanup();
  window.sessionStorage.clear();
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

  it('🔴 โชว์ครั้งเดียวต่อการเปิดเบราว์เซอร์ — รอบสองไม่ขึ้น', () => {
    render(<BrandIntro />);
    expect(document.querySelector('[data-brand-intro]')).not.toBeNull();
    expect(window.sessionStorage.getItem(SEEN_KEY)).toBe('1');

    cleanup();
    render(<BrandIntro />);
    expect(document.querySelector('[data-brand-intro]')).toBeNull();
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

  it('`?intro=1` บังคับเล่นซ้ำได้ แม้เคยดูแล้ว (ไว้ให้เจ้าของลองเอง)', () => {
    window.sessionStorage.setItem(SEEN_KEY, '1');
    window.history.replaceState({}, '', '/login?intro=1');
    render(<BrandIntro />);
    expect(document.querySelector('[data-brand-intro]')).not.toBeNull();
  });
});
