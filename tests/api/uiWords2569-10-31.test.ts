/**
 * คำบนจอชุดเดียวทั้งระบบ (เจ้าของ 31 ต.ค. 2569) — กติกาอยู่ `src/lib/uiWords.ts` ที่เดียว
 * ไล่ทุกไฟล์ใน src/ (ไม่นับคอมเมนต์) · คำที่เลิกใช้ห้ามกลับมา
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { UI_WORD_RULES } from '@/lib/uiWords';

const ROOT = path.resolve(__dirname, '../..');

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(d.name) && !/\.test\./.test(d.name) ? [p] : [];
  });
}

/** ตัดคอมเมนต์ทิ้ง — /* … *\/ ข้ามบรรทัด และ // ที่ขึ้นต้นบรรทัดหรือหลังช่องว่าง (ไม่แตะ https://) */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

const SOURCES = files(path.join(ROOT, 'src'))
  .map((p) => path.relative(ROOT, p).split(path.sep).join('/'))
  .filter((p) => p !== 'src/lib/uiWords.ts')
  .map((p) => ({ p, code: codeOnly(fs.readFileSync(path.join(ROOT, p), 'utf8')) }));

describe('คำบนจอชุดเดียวทั้งระบบ', () => {
  for (const rule of UI_WORD_RULES) {
    if (!rule.banned.length) continue;
    it(`${rule.topic} → ใช้ ${rule.use.join(' / ')}`, () => {
      const hits: string[] = [];
      for (const { p, code } of SOURCES) {
        if (rule.allowIn?.includes(p)) continue;
        for (const w of rule.banned) {
          const found = typeof w === 'string' ? code.includes(w) : w.test(code);
          if (found) hits.push(`${p} · ${String(w)}`);
        }
      }
      expect(hits).toEqual([]);
    });
  }

  it('ไฟล์ที่ยกเว้นยังมีอยู่จริง (ลบไฟล์แล้วต้องเอาออกจากรายการด้วย)', () => {
    for (const rule of UI_WORD_RULES) for (const p of rule.allowIn ?? []) expect(fs.existsSync(path.join(ROOT, p)), p).toBe(true);
  });
});
