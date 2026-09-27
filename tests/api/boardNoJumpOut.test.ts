/**
 * ═══ กล่องงานห้ามพาออกไปหน้าจับคู่งาน / หน้าใบขอ ═══
 *
 * เจ้าของสั่ง 27 ก.ย. 2569: *"หน้ากล่องงาน มีอะไรกดไปโผล่หน้าจับคู่งานหรือใบขอไหม ถ้ามีปิดออกห้ามไป"*
 * ที่เจอแล้วถอด: ปุ่ม "ดูรายชื่อ" (ไปแท็บผู้สมัครของหน้าใบขอ → สลับแท็บในหน้าเดิม) ·
 * Pre-Check ในเมนูตั้งค่าบอร์ด (ไปหมวดจับคู่งาน) · ปุ่มยกเลิกของป๊อปไล่งานแบบลิงก์ตรง (ไปหน้าใบขอ → กล่องงาน)
 *
 * เทสต์สแกนโค้ด (ตัดคอมเมนต์ก่อน — ไฟล์พวกนี้เล่าประวัติด้วย path เหล่านี้โดยตั้งใจ)
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const FILES = [
  'src/components/jobs/JobBoardView.tsx',
  'src/components/jobs/BoardReleaseHeader.tsx',
  'src/components/jobs/BoardFilterPanel.tsx',
  'src/components/jobs/JobBoardSilentLinks.tsx',
  'src/components/jobs/BoardCardProgress.tsx',
  'src/pages/jobs/BoardPostingPage.tsx',
];

const code = (rel: string) =>
  fs
    .readFileSync(path.join(ROOT, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('กล่องงานไม่มีทางกดออกไปหน้าจับคู่งาน/หน้าใบขอ', () => {
  it.each(FILES)('%s — ไม่เรียกตัวพาไปหน้าใบขอ', (f) => {
    const src = code(f);
    expect(src).not.toMatch(/navigateToUnitRequest\(/);
    expect(src).not.toMatch(/unitTabPath\(/);
    expect(src).not.toMatch(/unitRequestPath\(/);
    expect(src).not.toMatch(/['"`]\/jobs\/siamraj\//);
  });

  it.each(FILES)('%s — ไม่มีลิงก์ไปหมวดจับคู่งาน (/matching/…)', (f) => {
    expect(code(f)).not.toMatch(/['"`]\/matching\//);
  });

  it('"ดูรายชื่อ" สลับไปแท็บรายชื่อผู้สมัครในหน้าเดิมพร้อมติ๊กใบนั้น', () => {
    const src = code('src/components/jobs/JobBoardView.tsx');
    expect(src).toContain('openApplicantsOf(job)');
    expect(src).toContain("params.set('view', 'list')");
  });
});
