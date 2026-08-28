import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  DASH,
  DASH_DARK_EXEMPT_KEYS,
  HUD,
  HUD_CSS_CLASS_KEYS,
  HUD_HEX,
  FRONT_SCENE,
  HUD_SCENE,
  HUD_DARK_EXEMPT_KEYS,
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

describe('designTokens — HUD (แผงควบคุมล้ำ · Jarvis HUD)', () => {
  it('class กลางทุกตัวมีตัวจริงใน index.css', () => {
    for (const key of HUD_CSS_CLASS_KEYS) {
      const cls = HUD[key];
      expect(cls, `HUD.${key} ต้องเป็นชื่อ class เดียว ไม่ใช่ชุด utility`).not.toContain(' ');
      expect(indexCss, `HUD.${key}: ไม่พบ .${cls} ใน index.css`).toContain(`.${cls} {`);
    }
  });

  it('เป็นแผง ink เข้มเท่ากันสองธีมโดยตั้งใจ — ห้ามมี dark: ปนเข้ามาทีละตัว', () => {
    // ถ้าวันหนึ่งอยากได้คู่สว่าง ให้ประกาศชุดใหม่ (HUD_LIGHT) ไม่ใช่เติม dark: ที่นี่
    // ไม่งั้นแผงเดียวจะมีสองภาษาปนกัน (เหตุผลเต็มอยู่ในคอมเมนต์ของ HUD)
    const exempt = new Set<string>(HUD_DARK_EXEMPT_KEYS);
    for (const [key, value] of Object.entries(HUD)) {
      expect(exempt.has(key), `HUD.${key} ต้องอยู่ใน HUD_DARK_EXEMPT_KEYS`).toBe(true);
      expect(value, `HUD.${key} ไม่ควรมี dark:`).not.toContain('dark:');
    }
  });

  it('ไม่มีสีใหม่นอกจานเดิม — เส้น/ตัวหนังสือใช้ teal/sky/slate/white ที่ระบบใช้บนพื้นเข้มอยู่แล้ว', () => {
    const allowed = new Set(['teal', 'sky', 'slate', 'white', 'black']);
    // จับเฉพาะ utility ที่เป็น "สี" จริง (มีเลขเฉด หรือเป็น white/black) — ไม่จับขนาดอย่าง text-2xl
    const colorUtility = /^(?:text|bg|border)-([a-z]+)(?:-\d{2,3})?(?:\/\d{1,3})?$/;
    for (const [key, value] of Object.entries(HUD)) {
      for (const cls of value.split(' ')) {
        if (cls.includes('[')) continue; // ค่าดิบ (ขนาด/ระยะ) ไม่ใช่สี
        const m = colorUtility.exec(cls);
        if (!m) continue;
        const family = m[1];
        const hasShade = /-\d{2,3}(?:\/\d{1,3})?$/.test(cls);
        if (!hasShade && family !== 'white' && family !== 'black') continue; // เช่น text-xs
        expect(allowed.has(family), `HUD.${key}: สี "${cls}" อยู่นอกจานที่อนุญาต`).toBe(true);
      }
    }
  });

  it('ตัวเลขบนแผงต้องเป็น mono + tabular — กันความกว้างเด้งตอนค่าเปลี่ยน', () => {
    for (const key of ['figure', 'figureSm'] as const) {
      expect(HUD[key], `HUD.${key} ต้องเป็น font-mono`).toContain('font-mono');
      expect(HUD[key], `HUD.${key} ต้องเป็น tabular-nums`).toContain('tabular-nums');
    }
  });

  it('เส้นสแกนต้องถูกปิดเมื่อผู้ใช้ตั้งว่าไม่เอาแอนิเมชัน', () => {
    expect(indexCss).toContain('prefers-reduced-motion: reduce');
    const reduced = indexCss.slice(indexCss.indexOf('prefers-reduced-motion: reduce'));
    expect(reduced, 'ต้องมีกฎปิด .jarvis-hud-scan ใน prefers-reduced-motion').toContain(
      '.jarvis-hud-scan',
    );
  });

  it('HUD_SCENE ใช้แต่ rgba (ขาว/ดำ/teal) — ห้ามมีสีความหมายใหม่หลุดเข้ามา', () => {
    for (const [key, value] of Object.entries(HUD_SCENE)) {
      expect(value, `HUD_SCENE.${key} ต้องเป็น rgba() ไม่ใช่ hex/ชื่อสี`).toMatch(/^rgba?\(/);
      const [r, g, b] = value
        .replace(/^rgba?\(|\)$/g, '')
        .split(',')
        .map((n) => Number(n.trim()));
      const isNeutral = r === g && g === b; // ขาว/ดำ/เทา
      const isTeal = r === 94 && g === 234 && b === 212; // teal-300 ชุดเดียวกับ HUD
      const isSlate = r === 148 && g === 163 && b === 184; // slate-400 (เส้นเชื่อมที่ยังไม่มีงานไหล)
      expect(isNeutral || isTeal || isSlate, `HUD_SCENE.${key} = ${value} อยู่นอกจานที่อนุญาต`).toBe(
        true,
      );
    }
  });

  it('HUD_HEX ครบทุกโทน · เป็นเฉดสว่างที่ต่างจาก TONE.hex (ไม่งั้นจมพื้นเข้ม)', () => {
    expect(Object.keys(HUD_HEX).sort()).toEqual([...TONE_KEYS].sort());
    for (const key of TONE_KEYS) {
      expect(HUD_HEX[key], `HUD_HEX.${key}`).toMatch(/^#[0-9a-f]{6}$/);
      expect(HUD_HEX[key], `HUD_HEX.${key} ต้องไม่เท่า TONE.${key}.hex (ต้องสว่างกว่า)`).not.toBe(
        TONE[key].hex,
      );
    }
    const hexes = TONE_KEYS.map((k) => HUD_HEX[k]);
    expect(new Set(hexes).size, 'สีเกจต้องไม่ซ้ำกันระหว่างโทน').toBe(hexes.length);
  });
});

/**
 * ฉากของหน้าด่านหน้า — ยกมาจาก mockup `tundralogin_v3.html` ที่เจ้าของส่งมา
 * 27 ส.ค. 2569 (*"อยากได้ค่าภาพกับอะไรต่าง ๆ ของเขา แต่การทำงานเป็นแบบเรา"*)
 *
 * 🔴 เทสต์นี้คุมว่า **จานสีของ mockup ยังอยู่ครบ** และห้ามใครแอบเปลี่ยนภาพ/สีทีหลัง
 * โดยไม่รู้ตัว — ถ้าจะเปลี่ยนต้องมาแก้ที่นี่ด้วย = มีคนอ่านคำสั่งเจ้าของอีกรอบ
 */
describe('designTokens — FRONT_SCENE (หน้า login)', () => {
  it('มีค่าครบทุกตัวที่หน้า login ใช้ และไม่มีค่าว่าง', () => {
    for (const key of [
      'photo',
      'base',
      'paper',
      'glass',
      'glassStrong',
      'line',
      'ink',
      'muted',
      'forest',
      'forest2',
      'sage',
      'sageStrong',
      'photoFilter',
    ] as const) {
      expect(String(FRONT_SCENE[key]).trim().length, `FRONT_SCENE.${key}`).toBeGreaterThan(0);
    }
  });

  it('ภาพพื้นหลังเป็นภาพเดียวกับใน mockup', () => {
    expect(FRONT_SCENE.photo).toContain('photo-1441974231531-c6227db76b6e');
  });

  it('จานสีเป็นกระดาษ + เขียวป่า ตาม mockup (ไม่ใช่ฟ้าของระบบ)', () => {
    expect(FRONT_SCENE.paper).toBe('#f5f2e9');
    expect(FRONT_SCENE.ink).toBe('#15251c');
    expect(FRONT_SCENE.forest).toBe('#1e3a2b');
  });
});
