/**
 * หน้า ตั้งค่า › จัดเมนู คุมแถบเมนูซ้ายจริง (เจ้าของ 23 พ.ย. 2569 "หน้าตั้งค่าที่จัดเมนูไม่เห็นจัดได้จริง")
 * เดิมหน้าจัดเมนูแก้รายการเก่า 6 อัน แต่แถบซ้ายไม่อ่านลำดับ/ชื่อ อ่านแค่ซ่อนบางอัน · เมนูใหม่ (งานสรรหา เอกสาร แบบทดสอบ) จัดไม่ได้เลย
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { applyNavPreferences, moveNavItem, renameNavItem, toggleNavItemHidden } from '@/lib/navPreferences';
import { navMenuGroups } from '@/lib/soRecruitNav';

const vault = () => navMenuGroups().find((g) => g.key === 'vault')!.items;

describe('ชุดเมนูที่จัดได้ = เมนูจริงในแถบซ้าย', () => {
  it('สองกลุ่ม · มีงานสรรหา เอกสาร แบบทดสอบ · ไม่มีจับคู่งาน', () => {
    const g = navMenuGroups();
    expect(g.map((x) => x.label)).toEqual(['สายพานงาน', 'คลังข้อมูล']);
    const paths = g.flatMap((x) => x.items.map((i) => i.path));
    for (const p of ['/jobs/list', '/follow', '/aftercare', '/jobs/board', '/documents', '/skill-test', '/dashboard']) expect(paths).toContain(p);
    expect(paths.some((p) => p.includes('view=match'))).toBe(false);
  });

  it('ย้าย · เปลี่ยนชื่อ · ซ่อน มีผลกับรายการที่แถบใช้ (คีย์ = path เดิม)', () => {
    let prefs = moveNavItem(vault(), {}, '/dashboard', -1);
    prefs = renameNavItem(prefs, '/documents', 'เอกสารผู้สมัคร');
    prefs = toggleNavItemHidden(prefs, '/skill-test');
    const out = applyNavPreferences(vault(), prefs);
    const labels = out.map((i) => i.label);
    expect(labels).toContain('เอกสารผู้สมัคร');
    expect(out.find((i) => i.path === '/skill-test')).toBeUndefined();
    const idx = (p: string) => out.findIndex((i) => i.path === p);
    expect(idx('/dashboard')).toBeLessThan(vault().findIndex((i) => i.path === '/dashboard'));
  });

  it('แถบซ้ายอ่านค่าจากหน้าจัดเมนูทั้งสองกลุ่ม · หน้าจัดเมนูใช้ชุดเดียวกัน', () => {
    const drawer = readFileSync('src/components/layout/AppNavDrawer.tsx', 'utf8');
    expect(drawer).toContain('const visibleVault = applyNavPreferences(CONVEYOR_VAULT, prefs);');
    expect(drawer).toMatch(/const visibleSteps = applyNavPreferences\(\n/);
    expect(drawer).not.toContain('OWNER_DOCK_PATH');
    expect(readFileSync('src/components/layout/AppLayout.tsx', 'utf8')).toContain('prefs={navPrefs}');
    const tab = readFileSync('src/pages/settings/NavMenuTab.tsx', 'utf8');
    expect(tab).toContain('const groups = useMemo(() => navMenuGroups(), []);');
    expect(tab).not.toContain('DOCK_NAV_ITEMS');
  });
});
