// @vitest-environment jsdom
/**
 * สีพื้นผิวของแบรนด์ vs โหมดมืด — เทสต์กันบั๊กเก่ากลับมา
 *
 * บั๊กเดิม (แก้ไปแล้ว แต่ไม่เคยมีอะไรกันไว้):
 * `applyBrandSurfaceVars()` เขียน `--background` / `--foreground` / `--card` ฯลฯ
 * เป็น **inline style บน `<html>`** ซึ่ง specificity ชนะกฎ `.dark` ใน index.css เสมอ
 * ตอนแรกเขียนทับทุกครั้งโดยไม่ดูธีม ผลคือโหมดมืดได้ "หมึกเข้มของธีมสว่าง" บนพื้นเข้ม
 * → ตัวหนังสือจมหายทั้งแอป (ช่องกรองทุกหน้าอ่านไม่ออก)
 *
 * ทำไมต้องมีเทสต์: เป็นบั๊กที่ **ดูโค้ดเฉย ๆ ไม่เห็น** เพราะสีถูกกำหนดถูกต้องแล้วใน CSS
 * ตัวการคือ inline style ที่มาทับทีหลัง หาเจอยาก แก้ยาก เสียเวลาไปเยอะ
 * ถ้ามีคนเผลอถอด `isDarkTheme()` ออก หรือลบตัวใดตัวหนึ่งจาก SURFACE_VARS
 * หรือถอด `resyncBrandingForTheme()` ออกจาก `applyThemeMode()` — บั๊กกลับมาเงียบ ๆ ทันที
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_BRANDING,
  applyBrandSurfaceVars,
  resyncBrandingForTheme,
} from '../../src/lib/brandingStorage';

/** ตัวแปรพื้นผิวที่ธีมมืดต้องเป็นคนกำหนดเอง — ห้ามมี inline ค้างในโหมดมืด */
const SURFACE_VARS = [
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--gradient-card',
  '--gradient-hero',
] as const;

const root = () => document.documentElement;
const setDark = (on: boolean) => root().classList.toggle('dark', on);
const inlineOf = (v: string) => root().style.getPropertyValue(v);

beforeEach(() => {
  root().className = '';
  root().removeAttribute('style');
  root().removeAttribute('data-page-bg');
});

describe('โหมดสว่าง — สีพื้นผิวของแบรนด์ต้องถูกเขียนลง inline', () => {
  it('เขียนครบทั้ง background / foreground / card', () => {
    setDark(false);
    applyBrandSurfaceVars(DEFAULT_BRANDING);
    expect(inlineOf('--background')).toBe(DEFAULT_BRANDING.backgroundHsl);
    expect(inlineOf('--foreground')).toBe(DEFAULT_BRANDING.foregroundHsl);
    expect(inlineOf('--card')).toBe(DEFAULT_BRANDING.cardHsl);
    expect(inlineOf('--card-foreground')).toBe(DEFAULT_BRANDING.foregroundHsl);
    expect(inlineOf('--popover-foreground')).toBe(DEFAULT_BRANDING.foregroundHsl);
  });

  it('โหมด gradient ติด data-page-bg · โหมด solid ต้องถอดออก', () => {
    setDark(false);
    applyBrandSurfaceVars({ ...DEFAULT_BRANDING, pageBackgroundMode: 'gradient' });
    expect(root().getAttribute('data-page-bg')).toBe('gradient');

    applyBrandSurfaceVars({ ...DEFAULT_BRANDING, pageBackgroundMode: 'solid' });
    expect(root().getAttribute('data-page-bg')).toBeNull();
  });
});

describe('โหมดมืด — ห้ามมี inline ค้าง ไม่งั้นทับกฎ .dark แล้วตัวหนังสือจมหาย', () => {
  it('เรียกตอนอยู่โหมดมืด = ไม่เขียน inline สักตัว', () => {
    setDark(true);
    applyBrandSurfaceVars(DEFAULT_BRANDING);
    for (const v of SURFACE_VARS) {
      expect(inlineOf(v), `${v} ต้องไม่มี inline ในโหมดมืด`).toBe('');
    }
    expect(root().getAttribute('data-page-bg')).toBeNull();
  });

  it('gradient ก็ต้องไม่ติดในโหมดมืด (พื้น gradient ของแบรนด์เป็นสีอ่อน)', () => {
    setDark(true);
    applyBrandSurfaceVars({ ...DEFAULT_BRANDING, pageBackgroundMode: 'gradient' });
    expect(root().getAttribute('data-page-bg')).toBeNull();
    expect(inlineOf('--gradient-hero')).toBe('');
  });
});

describe('สลับธีม — ต้องล้าง/คืนค่าให้ตรงกับธีมใหม่เสมอ (นี่คือตัวบั๊กเดิม)', () => {
  it('สว่าง → มืด: inline ที่เขียนไว้ตอนสว่างต้องถูกถอดออกให้หมด', () => {
    setDark(false);
    applyBrandSurfaceVars(DEFAULT_BRANDING);
    expect(inlineOf('--foreground')).not.toBe('');

    setDark(true);
    resyncBrandingForTheme();
    for (const v of SURFACE_VARS) {
      expect(inlineOf(v), `${v} ต้องถูกถอดออกหลังสลับไปมืด`).toBe('');
    }
  });

  it('มืด → สว่าง: ต้องเขียนสีแบรนด์กลับมา', () => {
    setDark(true);
    applyBrandSurfaceVars(DEFAULT_BRANDING);
    expect(inlineOf('--foreground')).toBe('');

    setDark(false);
    resyncBrandingForTheme();
    expect(inlineOf('--foreground')).toBe(DEFAULT_BRANDING.foregroundHsl);
    expect(inlineOf('--background')).toBe(DEFAULT_BRANDING.backgroundHsl);
  });

  it('สลับไปกลับหลายรอบก็ยังถูก (ไม่มีสถานะค้าง)', () => {
    setDark(false);
    applyBrandSurfaceVars(DEFAULT_BRANDING);
    for (let i = 0; i < 3; i++) {
      setDark(true);
      resyncBrandingForTheme();
      expect(inlineOf('--foreground')).toBe('');
      setDark(false);
      resyncBrandingForTheme();
      expect(inlineOf('--foreground')).toBe(DEFAULT_BRANDING.foregroundHsl);
    }
  });

  it('ยังไม่เคยโหลด branding = resync ต้องไม่พังและไม่เขียนอะไรมั่ว', () => {
    // ลำดับตอนบูตจริง: initTheme() ทำงานก่อน branding โหลดเสร็จ
    setDark(false);
    expect(() => resyncBrandingForTheme()).not.toThrow();
  });
});
