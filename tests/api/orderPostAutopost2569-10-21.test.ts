/**
 * ═══ ป๊อปประกาศ: "โพสต์ ยังไม่ได้สั่ง" ต้องมีทางสั่ง (เจ้าของ 21 ต.ค. 2569 · Choice "เพิ่มปุ่ม Autopost ในป๊อปนี้") ═══
 * ปุ่ม Autopost ข้างบรรทัดโพสต์ → ฟอร์มเดียวกับป๊อป Autopost ฝังแทนที่ (embedded) — ห้ามซ้อน Dialog
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('ฟอร์มสั่ง So Scraping ในป๊อปประกาศ (3 พ.ย. 2569: dropdown Autopost / Scrap · ข้อ 1-2-3)', () => {
  const order = read('src/components/jobs/OrderPostButton.tsx');
  const dialog = read('src/components/jobs/AutopostDialog.tsx');

  it('เลือกว่าสั่งอะไรจาก dropdown · Autopost ฝังเป็นฟอร์มเดิม · กดส่งไม่ได้ระหว่างมีคำสั่งค้าง (เช็กใน AutopostBody)', () => {
    expect(order).toContain('testId="so-order-kind"');
    expect(order).toContain('data-testid="so-order-autopost"');
    expect(dialog).toContain('disabled={busy !== null || problems.length > 0 || openOrder !== null}');
  });

  it('🔴 ฝังฟอร์มเดิม ไม่เปิด Dialog ซ้อน · ป๊อปจากการ์ดก็ใช้ฟอร์มเดียวกัน', () => {
    expect(order).toContain('<AutopostBody');
    expect(order).toContain('embedded');
    expect(order).not.toMatch(/<AutopostDialog\b/);
    expect(dialog).toContain('export function AutopostBody');
    expect(dialog).toContain('<OrderPostButton key={job.id} job={job} defaultKind="autopost" onSent={onSent} />');
  });
});
