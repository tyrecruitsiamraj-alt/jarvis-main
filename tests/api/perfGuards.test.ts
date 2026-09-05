// @vitest-environment node
/**
 * ═══ ด่านความเร็ว — กันของที่เคยทำให้ "เว็บช้า/กระตุก" กลับมาอีก ═══
 *
 * เจ้าของแจ้ง 5 ก.ย. 2569: *"ตอนนี้ Web กระตุกมาก ช้ามาก"* และ
 * *"หน้าการติดตาม ข้อมูลมันมาช้า เวลาได้รับผลโทรมา มันดีเลย์มาก"*
 *
 * ที่วัดได้จริงบนเครื่อง (ก่อนแก้):
 *   /api/matching/list         5.5 วิ **ทุกครั้ง**
 *   /api/matching/flow-summary 5.1 วิ **ทุกครั้ง**
 *   /api/office-team (ครั้งแรก) 4.6 วิ
 * หลังแก้: 1.0 / 0.6 / 0.05 วิ
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('สำเนาใบขอต้องอยู่ในตัวฟังก์ชันกลาง ไม่ใช่แค่ handler เดียว', () => {
  const lib = read('api/_lib/siamrajUnitRequests.ts');

  it('🔴 listSiamrajUnitRequests อ่านผ่าน readThroughCache', () => {
    expect(lib).toContain("from './unitRequestCache.js'");
    expect(lib).toMatch(/export async function listSiamrajUnitRequests[\s\S]{0,900}readThroughCache\(/);
  });

  it('ยังข้ามสำเนาไปถามสดได้ด้วย fresh (ปุ่มรีเฟรชบนจอ)', () => {
    expect(lib).toMatch(/fresh\?: boolean/);
    expect(lib).toMatch(/\{ fresh: options\.fresh \}/);
    // handler ต้องส่ง fresh ต่อลงไป ไม่งั้นข้ามได้แค่สำเนาชั้นนอก
    expect(read('api/_handlers/siamraj-unit-requests.ts')).toMatch(
      /listSiamrajUnitRequests\(\{[^}]*fresh[^}]*\}\)/,
    );
  });
});

describe('ห้ามเอา backdrop-filter กลับมาใส่ของที่มีเยอะ ๆ ต่อหน้า', () => {
  const css = read('src/index.css');

  /** ตัดคอมเมนต์ออกก่อน — ไฟล์นี้อธิบายว่า "เลิกใช้แล้ว" ไว้ในคอมเมนต์ */
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');

  it('🔴 การ์ด/กล่องตัวเลข/แผงกระจก ไม่มี backdrop-filter แล้ว', () => {
    for (const cls of ['.glass-card', '.jarvis-frost', '.jarvis-stat-tile']) {
      const start = rules.indexOf(`${cls} {`);
      expect(start, cls).toBeGreaterThan(-1);
      const block = rules.slice(start, rules.indexOf('}', start));
      expect(block, cls).not.toContain('backdrop-filter');
    }
  });

  it('🔴 แถบหัวที่ปักหมุดไม่ใช้ backdrop-blur (ถูกวาดใหม่ทุกเฟรมตอนเลื่อนจอ)', () => {
    const layout = read('src/components/layout/AppLayout.tsx');
    expect(layout).not.toContain('backdrop-blur');
  });
});

describe('หน้าติดตามต้องรีเฟรชผลโทรเอง', () => {
  const page = read('src/pages/follow/FollowPage.tsx');

  it('🔴 มีรอบรีเฟรชอัตโนมัติ + รีเฟรชตอนกลับมาที่แท็บ', () => {
    expect(page).toMatch(/setInterval\(tick/);
    expect(page).toContain("addEventListener('visibilitychange'");
  });

  it('รีเฟรชเบื้องหลังต้องเงียบ (ไม่ขึ้นโครงกระดูก/ไม่เด้ง error)', () => {
    expect(page).toMatch(/reload\(true\)/);
    expect(page).toMatch(/if \(!silent\) setLoading\(true\)/);
  });

  it('อยู่แท็บอื่น หรือกำลังพิมพ์อยู่ = ข้ามรอบนั้น', () => {
    expect(page).toMatch(/document\.visibilityState !== 'visible'/);
    expect(page).toMatch(/INPUT\|TEXTAREA\|SELECT/);
  });
});

describe('นาฬิกาบนหน้าแรกต้องไม่ลากทั้งแผงเรนเดอร์ใหม่ทุกวินาที', () => {
  it('useNowTick ถูกเรียกใน DeckClock เท่านั้น', () => {
    const deck = read('src/components/home/CommandDeck.tsx');
    expect(deck).toMatch(/const DeckClock[\s\S]{0,200}useNowTick\(true\)/);
    expect(deck.match(/useNowTick\(/g) ?? []).toHaveLength(1);
  });
});
