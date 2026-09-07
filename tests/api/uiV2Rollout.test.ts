// @vitest-environment node
/**
 * ═══ ด่านของ "โฉมใหม่" ทั้งชุด — กันพลาดบน production ═══
 *
 * เจ้าของสั่งรื้อหน้าตาทั้งระบบ (5 ก.ย. 2569) โดยระบบอยู่บน production แล้ว
 * ⇒ ทุกอย่างต้องอยู่หลังสวิตช์ `?ui=v2` และ **ของเดิมต้องยังอยู่ครบเป็นทางถอย**
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

/** ไฟล์ที่รับหน้าที่ "สลับสกิน" ในรอบรื้อนี้ */
const SKINNED = [
  'src/components/shared/PageHeroStrip.tsx',
  'src/components/shared/StatCard.tsx',
  'src/components/ui/button.tsx',
  'src/components/home/TeamBoardPanel.tsx',
  'src/components/matching/AiCallFlowPanel.tsx',
  'src/components/follow/CallFunnelPanel.tsx',
  'src/components/dashboard/analytics/DashboardHeroStrip.tsx',
  'src/components/jobs/RecruitBoardTools.tsx',
];

describe('ทุกหน้าที่รื้อ ต้องรื้อ "หลังสวิตช์" เท่านั้น', () => {
  for (const f of SKINNED) {
    it(`${f} อ่านสวิตช์ก่อนเปลี่ยนหน้าตา`, () => {
      const code = read(f);
      const usesFlag = /useUiV2|useSurfaceKit|skin/.test(code);
      expect(usesFlag, `${f} เปลี่ยนหน้าตาโดยไม่ดูสวิตช์`).toBe(true);
    });
  }

  it('🔴 ของเดิมยังอยู่ครบ — ไม่มีไฟล์ไหนถูกลบทิ้ง', () => {
    for (const f of [...SKINNED, 'src/components/home/CommandDeck.tsx']) {
      expect(fs.existsSync(path.join(root, f)), f).toBe(true);
    }
  });
});

describe('สวิตช์ต้องปิดเป็นค่าตั้งต้นเสมอ', () => {
  const flag = read('src/lib/uiV2.ts');

  it('อ่านค่าจาก localStorage และคืน false เมื่อไม่มีค่า', () => {
    expect(flag).toMatch(/getItem\(UI_V2_KEY\) === '1'/);
  });

  it('ไม่มีที่ไหนบังคับเปิดให้ทุกคน', () => {
    // กันเคสเผลอ hard-code เป็น true ตอนทดสอบแล้วลืมเอาออก
    expect(flag).not.toMatch(/export function isUiV2\(\): boolean \{\s*return true/);
  });
});

/**
 * ═══ ของ 3 ชิ้นที่ audit 7 ก.ย. 2569 จับได้ว่า "หายจริง" — ห้ามหายอีก ═══
 * ที่มา: `docs/audit-v1-v2-functions-2569-09-07.md` §1.3 (หาย-1 · หาย-2 · หาย-4)
 */
describe('ของที่รอบรื้อทำหายต้องกลับมาครบ', () => {
  it('🔴 หาย-1 · StatCard โฉมใหม่ต้องมีชุดสีความหมายสำหรับพื้นขาว', () => {
    const card = read('src/components/shared/StatCard.tsx');
    // สีต้องมาจาก TONE (designTokens) ไม่ใช่สีใหม่ที่พิมพ์เอง
    expect(card).toContain("from '@/lib/designTokens'");
    expect(card).toMatch(/VARIANT_TONE/);
    // prop `variant` ต้องถูกใช้จริงในกิ่ง v2 ไม่ใช่ถูกทิ้งเหมือนเดิม
    expect(card).toMatch(/v2 && tone \? TONE\[tone\]\.value/);
    // `default` = ไม่มีความหมาย จึงต้องไม่มีสี (กันเผลอทาสีทุกใบจนสีเฟ้อ)
    expect(card).toMatch(/default: null/);
  });

  it('🔴 หาย-2 · ป้ายตัวตน "SO RECRUIT" อยู่บนแถบหัวหน้าแรกทั้งสองโฉม', () => {
    expect(read('src/components/home/CommandDeck.tsx')).toContain('SO RECRUIT');
    expect(read('src/components/home/HomeDeckV2.tsx')).toContain('SO RECRUIT');
  });

  it('🔴 หาย-4 · หุ่นยนต์ในโฉมใหม่ต้องเคารพ "ลดการเคลื่อนไหว"', () => {
    const deck = read('src/components/home/HomeDeckV2.tsx');
    expect(deck).toContain('useReducedMotion');
    // ตั้งค่าลดการเคลื่อนไหว = ได้ภาพนิ่ง (webp เป็นภาพเคลื่อนไหว)
    expect(deck).toMatch(/reduceMotion \? '\/robot-mascot\.png' : '\/robot-mascot\.webp'/);
  });

  it('🔴 งง-2 · วงตัวเลข "ต้องลงมือ" ต้องมาก่อนหัวเรื่องงาน (จุดยึดสายตาแรก)', () => {
    const deck = read('src/components/home/HomeDeckV2.tsx');
    const ring = deck.indexOf('ต้องลงมือ');
    const headline = deck.indexOf('{head.title}');
    expect(ring).toBeGreaterThan(-1);
    expect(headline).toBeGreaterThan(-1);
    expect(ring, 'วงตัวเลขต้องถูกเรนเดอร์ก่อนหัวเรื่อง').toBeLessThan(headline);
  });
});

describe('CSS ที่ตายแล้วต้องไม่ค้างในไฟล์สไตล์', () => {
  const css = read('src/index.css');

  it('🔴 ฉากห้องทำงาน 3D ถูกลบออกแล้ว (ไม่มีไฟล์จอไหนใช้)', () => {
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(rules).not.toContain('.jarvis-office');
  });

  it('ไม่มีไฟล์จอไหนอ้างคลาสฉากห้องทำงานอีก', () => {
    const walk = (dir: string, acc: string[] = []): string[] => {
      for (const name of fs.readdirSync(path.join(root, dir))) {
        const rel = `${dir}/${name}`;
        if (fs.statSync(path.join(root, rel)).isDirectory()) walk(rel, acc);
        else if (name.endsWith('.tsx') || name.endsWith('.ts')) acc.push(rel);
      }
      return acc;
    };
    const offenders = walk('src').filter((f) => read(f).includes('jarvis-office'));
    expect(offenders).toEqual([]);
  });
});
