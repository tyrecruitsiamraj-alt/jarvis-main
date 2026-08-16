/**
 * เมนูที่แอดมินจัดเอง (093) — ลำดับ / ชื่อ / ซ่อน
 *
 * พังเงียบที่คุมไว้:
 * - เมนูใหม่ที่เพิ่มในโค้ดหายไปเพราะค่าเก่าไม่รู้จัก (เหตุผลที่เก็บเป็น override รายเมนู)
 * - เรียงไม่ stable → เมนูสลับที่เองทุกครั้งที่โหลด
 * - ย้ายแล้วเขียน order แค่สองตัว → ตัวที่เหลือชนกันจนลำดับมั่ว
 */
import { describe, expect, it } from 'vitest';
import { Home } from 'lucide-react';
import type { DockNavItem } from '@/components/layout/bottom-nav/dockNavConfig';
import {
  applyNavPreferences,
  moveNavItem,
  normalizeNavPreferences,
  renameNavItem,
  toggleNavItemHidden,
} from '@/lib/navPreferences';

const items: DockNavItem[] = [
  { path: '/', label: 'หน้าหลัก', icon: Home },
  { path: '/jobs/list', label: 'หน่วยงาน', icon: Home },
  { path: '/follow', label: 'Follow', icon: Home },
  { path: '/dashboard', label: 'Dashboard', icon: Home },
];
const paths = (list: DockNavItem[]) => list.map((i) => i.path);

describe('applyNavPreferences', () => {
  it('ไม่มีค่าที่ตั้งไว้ = ลำดับและชื่อตั้งต้นเป๊ะ', () => {
    expect(applyNavPreferences(items, {})).toEqual(items);
    expect(applyNavPreferences(items, null)).toEqual(items);
  });

  it('เปลี่ยนชื่อได้ โดยไม่แตะตัวอื่น', () => {
    const out = applyNavPreferences(items, { '/follow': { label: 'ตามงาน' } });
    expect(out.find((i) => i.path === '/follow')?.label).toBe('ตามงาน');
    expect(out.find((i) => i.path === '/')?.label).toBe('หน้าหลัก');
  });

  it('ซ่อนแล้วหายจากเมนู (แต่ยังอยู่ในลิสต์ตั้งต้น — route ไม่ถูกลบ)', () => {
    const out = applyNavPreferences(items, { '/dashboard': { hidden: true } });
    expect(paths(out)).toEqual(['/', '/jobs/list', '/follow']);
    expect(items).toHaveLength(4);
  });

  it('ย้ายลำดับด้วย order — ตัวที่ไม่ได้ตั้งยังอยู่ที่เดิมเทียบกับเพื่อน', () => {
    const out = applyNavPreferences(items, { '/dashboard': { order: -1 } });
    expect(paths(out)).toEqual(['/dashboard', '/', '/jobs/list', '/follow']);
  });

  // หมายเหตุความจริง: `Array.sort` ของ JS stable อยู่แล้ว ตัว tiebreaker ใน
  // applyNavPreferences จึงเป็นการเขียนเจตนาให้ชัด ไม่ใช่ตัวกันบั๊ก — เทสต์นี้
  // ยืนยัน "ผลลัพธ์ที่ต้องการ" ไม่ได้พิสูจน์ว่า tiebreaker จำเป็น (ลองถอดแล้วยังผ่าน)
  it('order เท่ากันให้ยึดลำดับตั้งต้น', () => {
    const out = applyNavPreferences(items, {
      '/jobs/list': { order: 1 },
      '/follow': { order: 1 },
    });
    expect(paths(out)).toEqual(['/', '/jobs/list', '/follow', '/dashboard']);
  });

  it('🔴 เมนูใหม่ที่เพิ่งเพิ่มในโค้ด ต้องโผล่เอง ไม่ต้องแก้ค่าที่ตั้งไว้', () => {
    const withNew: DockNavItem[] = [...items, { path: '/new', label: 'ของใหม่', icon: Home }];
    const out = applyNavPreferences(withNew, { '/follow': { order: 0 } });
    expect(paths(out)).toContain('/new');
  });
});

describe('moveNavItem', () => {
  it('ย้ายขึ้นแล้วสลับกับตัวบน', () => {
    const next = moveNavItem(items, {}, '/follow', -1);
    expect(paths(applyNavPreferences(items, next))).toEqual([
      '/',
      '/follow',
      '/jobs/list',
      '/dashboard',
    ]);
  });

  it('ย้ายลงแล้วสลับกับตัวล่าง', () => {
    const next = moveNavItem(items, {}, '/', 1);
    expect(paths(applyNavPreferences(items, next))[0]).toBe('/jobs/list');
  });

  it('ย้ายเกินขอบ = ไม่เปลี่ยนอะไร', () => {
    expect(moveNavItem(items, {}, '/', -1)).toEqual({});
    expect(moveNavItem(items, {}, '/dashboard', 1)).toEqual({});
  });

  // เขียน `order` ให้ทุกตัวเป็นทางที่ปลอดภัยกว่าเขียนเฉพาะคู่ที่สลับ (ค่าไม่ชนกับ
  // index ของตัวที่ไม่ถูกแตะ) — เทสต์นี้คุม "ผลลัพธ์" ของการย้ายซ้ำหลายรอบ
  it('ย้ายซ้ำหลายรอบแล้วลำดับต้องไม่มั่ว', () => {
    let prefs = moveNavItem(items, {}, '/dashboard', -1);
    prefs = moveNavItem(items, prefs, '/dashboard', -1);
    prefs = moveNavItem(items, prefs, '/dashboard', -1);
    expect(paths(applyNavPreferences(items, prefs))).toEqual([
      '/dashboard',
      '/',
      '/jobs/list',
      '/follow',
    ]);
    expect(Object.keys(prefs).sort()).toEqual(paths(items).sort());
  });

  it('path ที่ไม่มีอยู่ = ไม่เปลี่ยนอะไร', () => {
    expect(moveNavItem(items, {}, '/ไม่มีจริง', 1)).toEqual({});
  });
});

describe('renameNavItem / toggleNavItemHidden', () => {
  it('ตั้งชื่อว่าง = กลับไปใช้ชื่อตั้งต้น (ลบ override ทิ้ง ไม่เก็บค่าว่าง)', () => {
    const named = renameNavItem({}, '/follow', 'ตามงาน');
    expect(named['/follow'].label).toBe('ตามงาน');
    expect(renameNavItem(named, '/follow', '   ')).toEqual({});
  });

  it('ซ่อนแล้วเอากลับได้ และไม่เหลือ override ค้าง', () => {
    const hidden = toggleNavItemHidden({}, '/wl');
    expect(hidden['/wl'].hidden).toBe(true);
    expect(toggleNavItemHidden(hidden, '/wl')).toEqual({});
  });

  it('ซ่อนไม่ลบชื่อที่ตั้งไว้', () => {
    const named = renameNavItem({}, '/wl', 'ปฏิทิน');
    const hidden = toggleNavItemHidden(named, '/wl');
    expect(hidden['/wl']).toEqual({ label: 'ปฏิทิน', hidden: true });
  });
});

describe('normalizeNavPreferences — กันค่าเพี้ยนจาก DB', () => {
  it('ทิ้งคีย์ที่ไม่ใช่ path และค่าที่ผิดชนิด', () => {
    expect(
      normalizeNavPreferences({
        'ไม่ใช่path': { label: 'x' },
        '/ok': { label: 'ดี', order: 2, hidden: true },
        '/bad': { label: 123, order: 'x', hidden: 'yes' },
      }),
    ).toEqual({ '/ok': { label: 'ดี', order: 2, hidden: true } });
  });

  it('ค่าที่ไม่ใช่ object = ว่าง', () => {
    expect(normalizeNavPreferences(null)).toEqual({});
    expect(normalizeNavPreferences([1, 2])).toEqual({});
    expect(normalizeNavPreferences('x')).toEqual({});
  });

  it('ชื่อยาวเกินถูกตัด ไม่ให้ล้นเมนู', () => {
    const long = 'ก'.repeat(80);
    expect(normalizeNavPreferences({ '/a': { label: long } })['/a'].label).toHaveLength(40);
  });
});
