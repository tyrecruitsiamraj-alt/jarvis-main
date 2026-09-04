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

/**
 * 🔴 **ด่านกันหลุด Framework** (เจ้าของสั่ง 4 ก.ย. 2569: *"เริ่มทั้งหมด ห้ามหลุด Framework"*)
 * ไล่ล้างของเดิมครบแล้ว — ด่านนี้กันไม่ให้ย้อนกลับไปเป็นแบบเดิมอีก
 * ⚠️ `src/components/ui/**` คือโค้ดของ shadcn เอง ไม่นับ
 */
describe('ห้ามหลุด Framework', () => {
  const files = screenFiles().filter((f) => !f.startsWith('src/components/ui'));
  /**
   * โค้ดจริงโดยตัด **คอมเมนต์ทุกแบบ** ออกก่อน — คอมเมนต์ในโปรเจกต์นี้อ้างชื่อคลาสเก่า
   * เพื่ออธิบายว่าเลิกใช้แล้ว ถ้าไม่ตัดออก ด่านจะจับคอมเมนต์ตัวเองว่าผิด
   */
  const codeOf = (f: string) =>
    read(f)
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !/^\s*\/\//.test(l))
      .join('\n');

  it('🔴 ไม่มีคลาสปุ่มที่ปั้นเองใน CSS แล้ว (jarvis-btn-* / jarvis-pill-btn)', () => {
    const bad = files.filter((f) => /className="[^"]*jarvis-(btn|pill-btn)/.test(codeOf(f)));
    expect(bad).toEqual([]);
  });

  it('🔴 ไม่มีกล่อง/ลิ้นชักที่ปั้นเอง — ต้องใช้ Dialog/AlertDialog/Sheet ของ shadcn', () => {
    const bad = files.filter((f) => /role="(dialog|alertdialog)"/.test(codeOf(f)));
    expect(bad).toEqual([]);
  });

  it('🔴 ไม่มีมุมโค้ง/ระยะที่ตั้งเอง — ต้องอยู่ในสเกลของ Tailwind', () => {
    const badRadius = files.filter((f) => /rounded-\[/.test(codeOf(f)));
    const badSpace = files.filter((f) =>
      /\b(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-[xy])-\[/.test(codeOf(f)),
    );
    expect({ badRadius, badSpace }).toEqual({ badRadius: [], badSpace: [] });
  });

  it('🔴 ไม่มีสี hex ดิบ — สีมาจาก token ของธีม (ยกเว้นสีแบรนด์โลโก้ Microsoft)', () => {
    const MS_BRAND = /#(f25022|7fba00|00a4ef|ffb900)/i;
    const bad = files.filter((f) => {
      const code = codeOf(f);
      return [...code.matchAll(/#[0-9a-fA-F]{6}\b/g)].some((m) => !MS_BRAND.test(m[0]));
    });
    expect(bad).toEqual([]);
  });

  /**
   * 🔴 **ขนาดไอคอนต้องมาจาก variant ของปุ่ม ไม่ใช่คลาสบนไอคอน** (4 ก.ย. 2569)
   * เจ้าของทักเรื่องปุ่มไอคอน — วัดจริงเจอว่าไอคอนในปุ่มออกมา 3 ขนาดบนหน้าเดียว
   * เพราะ selector ลูกของ Button (`[&_svg]:size-*`) ชนะคลาสบนตัวไอคอนเสมอ
   * ⇒ คลาส `h-3 w-3` บนไอคอนใน `<Button>` เป็นโค้ดตายที่โกหกคนอ่าน ห้ามมี
   */
  it('🔴 ไอคอนใน <Button> ห้ามกำหนดขนาดเอง (ปุ่มเป็นคนกำหนด)', () => {
    const bad: string[] = [];
    for (const f of files) {
      const code = codeOf(f);
      for (const m of code.matchAll(/<Button\b[\s\S]*?<\/Button>/g)) {
        /**
         * ดูเฉพาะ **ลูก** ของปุ่ม — `h-7 w-7` บนตัว `<Button>` เองคือการย่อขนาดปุ่ม
         * ซึ่งทำได้ (เช่นปุ่มไอคอนเล็กบนแถบหัว) · ที่ห้ามคือใส่ขนาดบนตัวไอคอน
         */
        for (const child of m[0].matchAll(/<([A-Z][A-Za-z0-9]*)\b[^>]*className="([^"]*)"/g)) {
          if (child[1] === 'Button') continue;
          if (/\bh-[\d.]+\b/.test(child[2]) && /\bw-[\d.]+\b/.test(child[2])) bad.push(f);
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('ทุก size ของ Button กำหนดขนาดไอคอนของตัวเอง', () => {
    const btn = read('src/components/ui/button.tsx');
    const sizes = btn.slice(btn.indexOf('size: {'), btn.indexOf('size: {') + 400);
    for (const key of ['default', 'sm', 'lg', 'icon']) {
      expect(sizes, key).toMatch(new RegExp(`${key}: "[^"]*\\[&_svg\\]:size-`));
    }
  });

  it('คลาสปุ่มเก่าถูกถอดออกจาก index.css แล้ว', () => {
    const css = read('src/index.css');
    const rules = css
      .split('\n')
      .filter((l) => !l.trim().startsWith('/*') && !l.trim().startsWith('*'))
      .join('\n');
    expect(rules).not.toMatch(/\.jarvis-btn|\.jarvis-pill-btn/);
  });

  it('ไม่มีคลาสปุ่มบนแถบ hero ที่ประกาศเอง (ย้ายเป็น variant ของ Button แล้ว)', () => {
    const strip = codeOf('src/components/shared/PageHeroStrip.tsx');
    expect(strip).not.toMatch(/export const heroButton/);
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
