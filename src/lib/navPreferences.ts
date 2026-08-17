import type { DockNavItem } from '@/components/layout/bottom-nav/dockNavConfig';

/**
 * แอดมินจัดเมนูเองได้ — ย้ายลำดับ / เปลี่ยนชื่อ / ซ่อน
 * (เจ้าของสั่ง 16 ส.ค. 2569 เย็น: *"เพิ่มให้ฉันปรับแก้ ย้ายเอง เปลี่ยนชื่อเองได้ด้วย"*)
 *
 * เก็บเป็น **override รายเมนู** ไม่ใช่เก็บลิสต์เมนูทั้งก้อน — เหตุผลสำคัญ:
 * วันหลังเพิ่มเมนูใหม่ในโค้ด มันจะโผล่ให้เองโดยไม่ต้องไปแก้ค่าที่แอดมินตั้งไว้
 * (ถ้าเก็บทั้งก้อน เมนูใหม่จะหายเงียบจนกว่าจะมีคนกดบันทึกใหม่)
 *
 * ⚠️ `path` เป็นคีย์ — เปลี่ยน path ของเมนูไหนในโค้ด = ค่าที่ตั้งไว้ของเมนูนั้นหลุด
 * กลับไปเป็นค่าตั้งต้น (ยอมรับได้ ดีกว่าเมนูหายทั้งอัน)
 */
export type NavOverride = {
  /** ชื่อที่แอดมินตั้งเอง — ว่าง/ไม่มี = ใช้ชื่อตั้งต้นในโค้ด */
  label?: string;
  /** ลำดับ — เลขน้อยขึ้นก่อน · ไม่มี = ใช้ลำดับตั้งต้น */
  order?: number;
  /** ซ่อนจากเมนู (route ยังเข้าได้ด้วยลิงก์ตรง) */
  hidden?: boolean;
};

export type NavPreferences = Record<string, NavOverride>;

export const EMPTY_NAV_PREFERENCES: NavPreferences = {};

/** ค่าที่ยอมรับได้จริง — กันค่าเพี้ยนจาก DB/มือคน */
export function normalizeNavPreferences(raw: unknown): NavPreferences {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const out: NavPreferences = {};
  for (const [path, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!path.startsWith('/')) continue;
    if (typeof value !== 'object' || value === null) continue;
    const v = value as Record<string, unknown>;
    const entry: NavOverride = {};
    if (typeof v.label === 'string' && v.label.trim()) entry.label = v.label.trim().slice(0, 40);
    if (typeof v.order === 'number' && Number.isFinite(v.order)) entry.order = Math.trunc(v.order);
    if (v.hidden === true) entry.hidden = true;
    if (Object.keys(entry).length > 0) out[path] = entry;
  }
  return out;
}

/**
 * ใช้ค่าที่แอดมินตั้ง ทับลิสต์เมนูตั้งต้น — **pure** (มี unit test)
 *
 * ⚠️ เมนูที่ไม่มี override ต้องอยู่ **ที่เดิมเทียบกับเพื่อนที่ไม่ถูกย้าย** —
 * ใช้ index เดิมเป็นลำดับตั้งต้น แล้วให้ `order` ที่ตั้งไว้ทับเฉพาะตัวที่ตั้ง
 * ⚠️ เรียงต้อง **stable**: ลำดับเท่ากันให้ยึด index เดิม ไม่งั้นเมนูสลับที่เองทุกครั้งที่โหลด
 */
export function applyNavPreferences(
  items: DockNavItem[],
  prefs: NavPreferences | null | undefined,
): DockNavItem[] {
  const p = prefs ?? {};
  return items
    .map((item, index) => {
      const o = p[item.path];
      return {
        item: o?.label ? { ...item, label: o.label } : item,
        hidden: o?.hidden === true,
        order: typeof o?.order === 'number' ? o.order : index,
        index,
      };
    })
    .filter((x) => !x.hidden)
    .sort((a, b) => (a.order === b.order ? a.index - b.index : a.order - b.order))
    .map((x) => x.item);
}

/**
 * ย้ายเมนูขึ้น/ลง 1 ขั้น แล้วคืน preferences ชุดใหม่ — **เขียน `order` ให้ทุกตัว**
 * เพราะถ้าเขียนเฉพาะสองตัวที่สลับ ตัวที่เหลือยังใช้ index เดิมซึ่งอาจชนกันจนสลับมั่ว
 */
export function moveNavItem(
  items: DockNavItem[],
  prefs: NavPreferences,
  path: string,
  direction: -1 | 1,
): NavPreferences {
  const current = applyNavPreferences(items, prefs);
  const from = current.findIndex((i) => i.path === path);
  if (from < 0) return prefs;
  const to = from + direction;
  if (to < 0 || to >= current.length) return prefs;
  const reordered = [...current];
  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved);

  const next: NavPreferences = { ...prefs };
  reordered.forEach((item, i) => {
    next[item.path] = { ...next[item.path], order: i };
  });
  return next;
}

/** ตั้งชื่อเอง · ว่าง = กลับไปใช้ชื่อตั้งต้น */
export function renameNavItem(
  prefs: NavPreferences,
  path: string,
  label: string,
): NavPreferences {
  const next: NavPreferences = { ...prefs };
  const trimmed = label.trim().slice(0, 40);
  const entry = { ...next[path] };
  if (trimmed) entry.label = trimmed;
  else delete entry.label;
  if (Object.keys(entry).length === 0) delete next[path];
  else next[path] = entry;
  return next;
}

/** ซ่อน/แสดง — ซ่อนแล้ว route ยังเข้าได้ด้วยลิงก์ตรง (ไม่ใช่การตัดสิทธิ์) */
export function toggleNavItemHidden(prefs: NavPreferences, path: string): NavPreferences {
  const next: NavPreferences = { ...prefs };
  const entry = { ...next[path] };
  if (entry.hidden) delete entry.hidden;
  else entry.hidden = true;
  if (Object.keys(entry).length === 0) delete next[path];
  else next[path] = entry;
  return next;
}
