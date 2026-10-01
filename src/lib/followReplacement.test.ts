/**
 * แท็บ "ติดตามส่งคนแทน" (เจ้าของสั่ง 1 ต.ค. 2569) — 🔴 ด่าน: หัวข้อเดียวทั้งระบบ · สองแท็บแยกรายการกันไม่ทับ ไม่หาย
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { REPLACEMENT_TOPIC, followScopeEntries, isReplacementFollow } from './followReplacement';

describe('รายการส่งคนแทน = หัวข้อ ติดตามส่งคนแทน', () => {
  it('หัวข้อตรงชื่อแท็บที่เจ้าของตั้ง · เว้นวรรคเกินไม่ทำให้หลุด · เรื่องอื่นไม่ใช่', () => {
    expect(REPLACEMENT_TOPIC).toBe('ติดตามส่งคนแทน');
    expect(isReplacementFollow({ topic: 'ติดตามส่งคนแทน' })).toBe(true);
    expect(isReplacementFollow({ topic: '  ติดตามส่งคนแทน ' })).toBe(true);
    expect(isReplacementFollow({ topic: 'ติดตามเริ่มงาน' })).toBe(false);
    expect(isReplacementFollow({ topic: null })).toBe(false);
  });

  it('🔴 สองแท็บแยกกันพอดี: ไม่มีรายการไหนอยู่สองที่ และรวมกันได้ครบทุกรายการ', () => {
    const items = [
      { id: 'a', topic: 'ติดตามเริ่มงาน' },
      { id: 'b', topic: 'ติดตามส่งคนแทน' },
      { id: 'c', topic: 'ติดตามเบิกเบี้ยเลี้ยง' },
      { id: 'd', topic: 'ติดตามส่งคนแทน' },
    ];
    const main = followScopeEntries(items, 'main').map((x) => x.id);
    const repl = followScopeEntries(items, 'replacement').map((x) => x.id);
    expect(main).toEqual(['a', 'c']);
    expect(repl).toEqual(['b', 'd']);
    expect([...main, ...repl].sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('หน้าการติดตามใช้ชุดตามแท็บ', () => {
  const page = fs.readFileSync(path.resolve(__dirname, '../pages/follow/FollowPage.tsx'), 'utf8');
  it('มีแท็บ ติดตามส่งคนแทน คั่นระหว่างรายชื่อติดตามกับ Dashboard', () => {
    const order = ['<TabsTrigger value="list">รายชื่อติดตาม</TabsTrigger>', '<TabsTrigger value="replace">ติดตามส่งคนแทน</TabsTrigger>', '<TabsTrigger value="dashboard">Dashboard</TabsTrigger>'].map((t) => page.indexOf(t));
    expect(order.every((i) => i > 0)).toBe(true);
    expect(order).toEqual([...order].sort((x, y) => x - y));
  });
  it('🔴 จอทั้งหมดอ่านจากชุดของแท็บ · ตัวกันนัดซ้ำยังเทียบทั้งก้อน · แท็บส่งคนแทนล็อกหัวข้อ', () => {
    expect(page).toContain("followScopeEntries(items, replaceView ? 'replacement' : 'main')");
    expect(page).toContain('filterFollowEntries(scopeItems,');
    expect(page).toContain('countFollowTabs(scopeItems)');
    expect(page).toContain('entries={scopeItems}');
    expect(page).toContain('findScheduleDuplicates(phone, dayIsos, items)');
    expect(page).toContain('const effectiveTopic = replaceView ? REPLACEMENT_TOPIC : topic;');
    expect(page.match(/topic: effectiveTopic,/g)?.length).toBe(3);
  });
});
