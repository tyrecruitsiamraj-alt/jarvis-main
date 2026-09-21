// @vitest-environment node
/**
 * ═══ หน้ากล่องงานต้องใช้สีของธีม ไม่ตั้งเฉดเอง (21 ก.ย. 2569) ═══
 *
 * เจ้าของสั่ง: *"หน้ากล่องงานทำให้มันเข้ากับธีม โทนหน่อย … ช่องไฟการเว้นบรรทัด
 * และระยะห่างมันต้องพอดีกัน เท่ากัน"*
 *
 * ของเดิมหยิบเฉดจากจานสีของ Tailwind มาใช้ตรง ๆ (blue-600 · blue-700 · emerald-700 ·
 * slate-200 · amber-50 …) ⇒ เปลี่ยนธีมทั้งระบบทีเดียวไม่ได้ เพราะสีพวกนี้ไม่ได้ผูกกับ
 * ตัวแปรธีมหรือ `designTokens` เลย · ตอนนี้ทั้งสี่ไฟล์ของหน้ากล่องงานใช้
 * `TONE` / `DASH` / ตัวแปรธีม (`primary` · `muted` · `foreground`) เท่านั้น
 *
 * 🔴 ด่านนี้คุมเฉพาะ **สี่ไฟล์ของหน้ากล่องงาน** — ที่อื่นยังมีของเดิมค้างอยู่
 * (วัดวันเดียวกัน: 84 ไฟล์ · 930 จุดทั้งระบบ) ค่อยไล่เก็บเมื่อเจ้าของสั่ง
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const FILES = [
  'src/components/jobs/JobBoardView.tsx',
  'src/components/jobs/BoardCardProgress.tsx',
  'src/components/jobs/BoardReleaseHeader.tsx',
  'src/components/jobs/JobBoardTopFilters.tsx',
];

/** เฉดดิบจากจานสีของ Tailwind — ห้ามโผล่ในสี่ไฟล์นี้ */
const RAW_SHADE =
  /(?:text|bg|border|ring|from|via|to|decoration|outline)-(?:slate|gray|zinc|neutral|stone|blue|emerald|red|amber|green|sky|violet|orange|yellow|rose|indigo|teal|cyan|purple|pink)-\d{2,3}/;

const read = (p: string) =>
  readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')
    // คอมเมนต์อธิบายเหตุผลมีชื่อสีอยู่ด้วย — ตัดทิ้งก่อนตรวจ (บทเรียนเดียวกับ typographyRules)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('หน้ากล่องงานใช้สีของธีมเท่านั้น', () => {
  for (const f of FILES) {
    it(f.split('/').pop() ?? f, () => {
      const hits = read(f)
        .split('\n')
        .map((line, i) => ({ line: line.trim(), no: i + 1 }))
        .filter((x) => RAW_SHADE.test(x.line));
      expect(hits).toEqual([]);
    });
  }
});
