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
