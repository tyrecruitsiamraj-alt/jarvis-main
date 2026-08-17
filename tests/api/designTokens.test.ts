import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  DASH,
  DASH_DARK_EXEMPT_KEYS,
  TONE,
  TONE_DARK_REQUIRED_VARIANTS,
  type ToneKey,
} from '@/lib/designTokens';

/**
 * contract ของ token กลาง (src/lib/designTokens.ts)
 *
 * รอบก่อนหน้า (3e0bfd2) ต้องนั่งวัดสีในเบราว์เซอร์ทีละขั้นเพื่อยืนยันว่ามีคู่ dark ครบ
 * เทสต์นี้ทำแทน: โทนใหม่ที่เพิ่มเข้ามาแล้วลืมคู่มืด หรือ chip ที่ไม่มี class จริงใน index.css
 * จะพังที่นี่ ไม่ต้องรอไปเจอตอนสลับธีม
 */

const TONE_KEYS: ToneKey[] = [
  'neutral',
  'info',
  'primary',
  'success',
  'warn',
  'danger',
  'violet',
  'orange',
  'teal',
];

const indexCss = readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');

describe('designTokens — TONE', () => {
  it('ประกาศครบทุกโทนที่ระบบใช้', () => {
    expect(Object.keys(TONE).sort()).toEqual([...TONE_KEYS].sort());
  });

  it('ทุกโทนมี variant ครบและไม่มีค่าว่าง', () => {
    const variants = [
      'bar',
      'tile',
      'num',
      'value',
      'soft',
      'softHover',
      'outline',
      'solid',
      'dot',
      'onDark',
      'chip',
      'hex',
    ] as const;
    for (const key of TONE_KEYS) {
      for (const variant of variants) {
        expect(TONE[key][variant], `${key}.${variant}`).toBeTruthy();
      }
    }
  });

  it('variant ที่กำหนดสีธีมสว่าง ต้องมีคู่ dark: ครบ', () => {
    for (const key of TONE_KEYS) {
      for (const variant of TONE_DARK_REQUIRED_VARIANTS) {
        expect(TONE[key][variant], `${key}.${variant} ขาดคู่ dark:`).toContain('dark:');
      }
    }
  });

  it('bar ต้องเป็น !important ทั้งสองธีม — ไม่งั้น .jarvis-stat-tile ทับสีขอบบนเงียบ ๆ', () => {
    for (const key of TONE_KEYS) {
      const [light, dark] = TONE[key].bar.split(' ');
      expect(light, `${key}.bar (light)`).toMatch(/^!border-t-/);
      expect(dark, `${key}.bar (dark)`).toMatch(/^dark:!border-t-/);
    }
  });

  it('outline พื้นขาวต้องมีคู่พื้นมืด — กันปุ่มขาวโพลนบนพื้นเข้ม', () => {
    for (const key of TONE_KEYS) {
      const outline = TONE[key].outline;
      expect(outline, `${key}.outline ต้องเป็นพื้นขาวในธีมสว่าง`).toContain('bg-white');
      // นี่คือบั๊กที่ทำให้ต้องมี variant นี้: เขียนมือแล้วลืม dark:bg-*
      expect(outline, `${key}.outline: bg-white ขาดคู่ dark:bg-*`).toMatch(/dark:bg-[a-z]+-\d/);
      expect(outline, `${key}.outline ต้องมีสีตัวหนังสือคู่มืด`).toMatch(/dark:text-[a-z]+-\d/);
    }
  });

  it('solid เป็นบล็อกสีอิ่มตัวหนังสือขาว — ใช้สีเดียวกันทั้งสองธีมโดยตั้งใจ', () => {
    for (const key of TONE_KEYS) {
      expect(TONE[key].solid, `${key}.solid`).toContain('text-white');
      expect(TONE[key].solid, `${key}.solid ไม่ควรมี dark: — ตั้งใจให้สีเดียวทั้งสองธีม`).not.toContain(
        'dark:',
      );
    }
  });

  it('hex ของทุกโทนใช้กับ recharts ได้ (6 หลัก)', () => {
    for (const key of TONE_KEYS) {
      expect(TONE[key].hex, `${key}.hex`).toMatch(/^#[0-9a-f]{6}$/);
    }
    const hexes = TONE_KEYS.map((k) => TONE[k].hex);
    expect(new Set(hexes).size, 'สีกราฟต้องไม่ซ้ำกันระหว่างโทน').toBe(hexes.length);
  });

  it('chip ชี้ไปที่ class จริงใน index.css และมีคู่มืดครบ (ไม่ประกาศสีซ้ำใน TS)', () => {
    for (const key of TONE_KEYS) {
      const classes = TONE[key].chip.split(' ');
      expect(classes[0], `${key}.chip ต้องเริ่มด้วย jarvis-chip`).toBe('jarvis-chip');
      const toneClass = classes[1];
      expect(indexCss, `${key}.chip: ไม่พบ .${toneClass} ใน index.css`).toContain(`.${toneClass} {`);
      expect(indexCss, `${key}.chip: ไม่พบคู่มืด .dark .${toneClass} ใน index.css`).toContain(
        `.dark .${toneClass} {`,
      );
    }
  });
});

describe('designTokens — DASH (พื้นผิวหน้า /dashboard)', () => {
  it('ทุก token ที่กำหนดสีพื้น/ตัวหนังสือ ต้องมีคู่ dark:', () => {
    const exempt = new Set<string>(DASH_DARK_EXEMPT_KEYS);
    for (const [key, value] of Object.entries(DASH)) {
      if (exempt.has(key)) continue;
      expect(value, `DASH.${key} ขาดคู่ dark:`).toContain('dark:');
    }
  });

  it('การ์ดดำ/hero อ้าง class กลางใน index.css ไม่ประกาศ gradient ซ้ำ', () => {
    expect(DASH.darkCard).toBe('jarvis-dark-card');
    expect(indexCss).toContain('.jarvis-dark-card {');
    expect(indexCss).toContain('.dark .jarvis-dark-card {');
    expect(DASH.hero).toBe('jarvis-hero-card');
    expect(indexCss).toContain('.jarvis-hero-card {');
    expect(indexCss).toContain('.dark .jarvis-hero-card {');
  });
});
