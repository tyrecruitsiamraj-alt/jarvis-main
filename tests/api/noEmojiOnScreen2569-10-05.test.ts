/**
 * ═══ ห้ามอิโมจิบนจอ (เจ้าของสั่ง 5 ต.ค. 2569: *"อิโมจิที่ทำให้ดูเป็น Ai อะเอาออกด้วย"*) ═══
 * วงกลมสี/ไอคอนอิโมจิ (🔴🟢🟡🤖📞✅❌⚠️🔒📍 ฯลฯ) + เครื่องหมายถูก ✓ ✗ — ใช้ `ToneDot` (จุดสีจาก TONE) หรือไอคอน lucide แทน
 * สแกนโค้ดหลังตัดคอมเมนต์ (คอมเมนต์ใช้ 🔴 ⚠️ เป็นธงเตือนคนเขียนโค้ดได้ ไม่ขึ้นจอ) · ลูกศรกราฟ ↗ ↘ → ไม่นับ
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2705}\u{274C}\u{2714}\u{2716}\u{2757}\u{23F0}-\u{23FF}\u{2B50}✓✗]/u;

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return files(p);
    return /\.(tsx?|ts)$/.test(d.name) && !/\.test\./.test(d.name) ? [p] : [];
  });
}

const stripComments = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/^\s*--.*$/gm, ''); // คอมเมนต์ใน SQL ที่ฝังในสตริง

describe('ไม่มีอิโมจิบนจอ', () => {
  it('src/ ทั้งหมด + ข้อความแจ้งเตือนจาก api/_lib (ไปขึ้นกระดิ่ง)', () => {
    const targets = [...files(path.join(ROOT, 'src')), path.join(ROOT, 'api/_lib/callFollowup.ts'), path.join(ROOT, 'api/_lib/callBatchStore.ts')];
    const hits: string[] = [];
    for (const f of targets) {
      stripComments(fs.readFileSync(f, 'utf8'))
        .split('\n')
        .forEach((line) => {
          if (EMOJI.test(line)) hits.push(`${path.relative(ROOT, f)}: ${line.trim().slice(0, 80)}`);
        });
    }
    expect(hits).toEqual([]);
  });
});
