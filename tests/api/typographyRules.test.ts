// @vitest-environment node
/**
 * **กติกาตัวอักษรของทั้งระบบ** — เจ้าของสั่ง 4 ก.ย. 2569:
 * *"ทั้งระบบต้องเป็น font Kanit ดูเรื่องความเป็นระเบียบ ขนาด ช่องไฟ ชิดซ้าย ชิดขวา
 * ตรงกลาง อย่าหลุด Framework จำไว้เลยนะ"*
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. **ฟอนต์เดียวคือ Kanit** — ห้ามโหลด/ประกาศฟอนต์อื่นอีก (เดิมมี JetBrains Mono
 *    กับ Instrument Sans ปนอยู่ ทำให้จอมีสามหน้าตา)
 * 2. `font-mono` ที่โค้ดเดิมใช้อยู่ 73 จุด ต้องได้ Kanit เหมือนกัน — ความเป็นระเบียบ
 *    ของตัวเลขมาจาก `tabular-nums` ไม่ใช่จากการสลับฟอนต์
 * 3. **ห้ามกำหนด font-family เองในไฟล์จอ** — ต้องมาจาก tailwind/ธีมที่เดียว
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

/** ไล่ไฟล์จอทั้งหมด — ไม่รวม `components/ui` ที่เป็นของ shadcn */
function screenFiles(dir = 'src', acc: string[] = []): string[] {
  for (const name of fs.readdirSync(path.join(root, dir))) {
    const rel = `${dir}/${name}`;
    if (fs.statSync(path.join(root, rel)).isDirectory()) {
      if (rel === 'src/components/ui') continue;
      screenFiles(rel, acc);
    } else if (name.endsWith('.tsx')) {
      acc.push(rel);
    }
  }
  return acc;
}

describe('ฟอนต์เดียวทั้งระบบ = Kanit', () => {
  const css = read('src/index.css');
  const tw = read('tailwind.config.ts');

  it('🔴 โหลดฟอนต์ตัวเดียว — ไม่มี JetBrains Mono / Instrument Sans แล้ว', () => {
    const importLine = css.split('\n').find((l) => l.includes('fonts.googleapis.com')) ?? '';
    expect(importLine).toContain('family=Kanit');
    expect(importLine).not.toContain('JetBrains');
    expect(importLine).not.toContain('Instrument');
  });

  it('font-sans และ font-mono ชี้ Kanit ทั้งคู่', () => {
    const fam = tw.slice(tw.indexOf('fontFamily'), tw.indexOf('fontFamily') + 400);
    expect(fam).toMatch(/sans: \['Kanit'/);
    expect(fam).toMatch(/mono: \['Kanit'/);
  });

  it('ตัวแปรธีมทั้ง display และ mono เป็น Kanit', () => {
    expect(css).toMatch(/--font-display:\s*'Kanit'/);
    expect(css).toMatch(/--font-mono:\s*'Kanit'/);
  });

  it('🔴 ไฟล์จอห้ามกำหนด font-family เอง (ต้องมาจากธีมที่เดียว)', () => {
    const offenders = screenFiles().filter((f) => {
      const code = read(f)
        .split('\n')
        .filter((l) => !/^\s*(\*|\/\/|\{\/\*)/.test(l))
        .join('\n');
      return /fontFamily:\s*["'`](?!Kanit)/.test(code);
    });
    expect(offenders).toEqual([]);
  });
});

describe('Success Rate — ต้องเขียนฐานกำกับเสมอ', () => {
  it('บนจอบอกว่า % นับจากคนที่รับสาย (ไม่งั้นอ่านสลับกับช่อง "สำเร็จ")', () => {
    const panel = read('src/components/dashboard/LumosCallRatePanel.tsx');
    expect(panel).toContain('Success Rate');
    expect(panel).toMatch(/% จากคนที่รับสาย/);
    // ช่อง "สำเร็จ" เดิมก็ต้องบอกฐานของตัวเองด้วย
    expect(panel).toMatch(/% จากสายที่มีผลทั้งหมด/);
  });
});
