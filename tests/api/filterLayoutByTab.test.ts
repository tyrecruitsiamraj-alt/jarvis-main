/**
 * ═══ หน้าตาตัวกรองแยกตามแท็บ (เจ้าของสั่ง 28 ก.ย. 2569) ═══
 *
 * > *"ฉันต้องการให้หน้ากล่องงาน ใน menu กล่องงาน เป็นช่องๆแบบเดิม ส่วนหน้าอื่นๆพวก รายชื่อผู้สมัคร
 * > การโทรของฉัน ฯลฯ ทำแบบ Irecruit เลย"* → Choice "แถบกรองซ้ายตามแบบร่างที่เคาะไว้"
 *
 * - แท็บกล่องงาน = การ์ดใบขอ + ปุ่ม "ตัวกรอง" ปุ่มเดียว (`BoardFilterBar` → `FilterButton` · แบบ A)
 * - แท็บรายชื่อผู้สมัคร / การโทรของฉัน / ติดตามนัดหมาย (`RmWorkspace`) = แถบกรองด้านซ้าย
 *   (`FilterSidebar`) + ปุ่มเปิดแผงบนจอเล็ก (`FilterSheetButton`)
 *
 * วันเดียว (27 ก.ย.) หน้าตานี้ถูกสลับไปมา 3 รอบ — เทสต์นี้กันไม่ให้สลับอีกโดยไม่ได้สั่ง
 * (สแกนโค้ดหลังตัดคอมเมนต์ — ไฟล์พวกนี้เล่าประวัติด้วยชื่อ component โดยตั้งใจ)
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');

const code = (rel: string) =>
  fs
    .readFileSync(path.join(ROOT, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('ตัวกรองแท็บผู้สมัคร = แถบซ้ายแบบ iRecruit', () => {
  const ws = code('src/components/recruit-rm/RmWorkspace.tsx');

  it('วาดแถบซ้าย (จอใหญ่) และปุ่มเปิดแผง (จอเล็ก) ครบทั้งคู่', () => {
    expect(ws).toMatch(/<FilterSidebar\b/);
    expect(ws).toMatch(/<FilterSheetButton\b/);
  });

  it('ไม่กลับไปใช้ปุ่ม "ตัวกรอง" ปุ่มเดียวของกล่องงาน', () => {
    expect(ws).not.toMatch(/<FilterButton\b/);
  });

  it('วันที่สมัครอยู่ในแถบเดียวกัน — ส่งหัวข้อเพิ่มชุดเดียวให้ทั้งแถบซ้ายและแผงมือถือ', () => {
    expect(ws.match(/sections=\{applicantPanelSections\}/g)?.length).toBe(2);
  });
});

describe('ตัวกรองแท็บกล่องงาน = ปุ่มเดียว (แบบ A) — การ์ดใบขอคงเดิม', () => {
  const board = code('src/components/jobs/JobBoardView.tsx');
  const panel = code('src/components/jobs/BoardFilterPanel.tsx');

  it('กล่องงานใช้ BoardFilterBar และไม่มีแถบซ้าย', () => {
    expect(board).toMatch(/<BoardFilterBar\b/);
    expect(board).not.toMatch(/FilterSidebar|FilterSheetButton/);
  });

  it('BoardFilterBar ยังเป็นปุ่มตัวกรองปุ่มเดียว', () => {
    const bar = panel.slice(panel.indexOf('export function BoardFilterBar'));
    expect(bar).toMatch(/<FilterButton\b/);
    expect(bar).not.toMatch(/<FilterSidebar\b/);
  });

  it('ทั้งสามแบบวาดหัวข้อด้วยตัวเดียว (FilterAccordion) — หัวข้อ/เลขต่อท้ายจึงตรงกันเสมอ', () => {
    expect(panel.match(/<FilterAccordion\b/g)?.length).toBe(3);
  });
});
