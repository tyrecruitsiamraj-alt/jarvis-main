/**
 * ═══ ป๊อปประกาศ: "โพสต์ ยังไม่ได้สั่ง" ต้องมีทางสั่ง (เจ้าของ 21 ต.ค. 2569 · Choice "เพิ่มปุ่ม Autopost ในป๊อปนี้") ═══
 * ปุ่ม Autopost ข้างบรรทัดโพสต์ → ฟอร์มเดียวกับป๊อป Autopost ฝังแทนที่ (embedded) — ห้ามซ้อน Dialog
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('ปุ่ม Autopost ในป๊อปประกาศ', () => {
  const order = read('src/components/jobs/OrderPostButton.tsx');
  const dialog = read('src/components/jobs/AutopostDialog.tsx');

  it('มีปุ่มข้างบรรทัดโพสต์ · กดไม่ได้ระหว่างมีคำสั่งค้าง', () => {
    expect(order).toContain('data-testid="so-order-autopost"');
    expect(order).toContain('disabled={latest === null || Boolean(contentView?.open)}');
  });

  it('🔴 ฝังฟอร์มเดิม ไม่เปิด Dialog ซ้อน', () => {
    expect(order).toContain('<AutopostBody');
    expect(order).toContain('embedded');
    expect(order).not.toMatch(/<AutopostDialog\b/);
    expect(dialog).toContain('export function AutopostBody');
    expect(dialog).toMatch(/embedded \? \(\s*<h3/);
  });
});
