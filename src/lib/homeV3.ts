/**
 * ═══ สวิตช์โฉมหน้าหลัก — ชั้นคู่ขนานตามกติกาโปรเจกต์ ═══
 *
 * - `?home=exec` = **หน้าหลักผู้บริหาร หน้าเดียวเลื่อนลง** (เจ้าของ 24 ต.ค. 2569 · `src/pages/HomeExecPage.tsx`) — **ค่าตั้งต้นตอนนี้**
 * - `?home=new` = หน้าแท็บ "ระบบไปกี่ %" (30 ก.ย. 2569 · `src/pages/HomeAiSharePage.tsx`) — ทางถอย (ปุ่ม "แบบแท็บเดิม")
 * - `?home=classic` = หน้าเดิม (deck · บอร์ด 4 ทีม · KPI) — โค้ดยังอยู่ครบเป็นทางถอย
 * - `?home=v3` = โฉม 3 ก้อน (29 ก.ย. 2569 · แผน `docs/plan-home-v3-2569-09-29.md`)
 * - `?home=online` = หน้าทีม Online ตามภาพต้นแบบของเจ้าของ (29 ก.ย. 2569 · แผน `docs/plan-team-online-2569-09-29.md`)
 * จำเลือกไว้ในเครื่อง (`jarvis.home.v3` — ค่า `1` เดิม = v3)
 *
 * 🔴 **ค่าตั้งต้น = หน้าหลักใหม่** (เปลี่ยนจากหน้าเดิม 30 ก.ย. 2569) — คนที่ไม่เคยกดสวิตช์เห็นหน้าใหม่
 *    หน้าเดิมยังเรียกได้ที่ `?home=classic` และโค้ดยังอยู่ครบ เป็นทางถอย (กติกา safe implementation)
 */
import * as React from 'react';

export const HOME_V3_KEY = 'jarvis.home.v3';

export type HomeVariant = 'exec' | 'new' | 'classic' | 'v3' | 'online';

const isVariant = (v: unknown): v is HomeVariant =>
  v === 'exec' || v === 'new' || v === 'classic' || v === 'v3' || v === 'online';

function paramMode(): HomeVariant | null {
  try {
    const v = new URLSearchParams(window.location.search).get('home');
    return isVariant(v) ? v : null;
  } catch {
    return null;
  }
}

export function homeVariant(): HomeVariant {
  if (typeof window === 'undefined') return 'exec';
  const forced = paramMode();
  try {
    // 'exec' = ค่าตั้งต้น ⇒ ล้างค่าจำ · โฉมอื่นเก็บชื่อไว้ (v3 เก็บ '1' เดิมเพื่อความเข้ากันได้)
    if (forced === 'exec') window.localStorage.removeItem(HOME_V3_KEY);
    else if (forced) window.localStorage.setItem(HOME_V3_KEY, forced === 'v3' ? '1' : forced);
  } catch {
    /* ปิด storage ก็ปล่อยผ่าน — URL ยังสั่งได้ต่อรอบ */
  }
  if (forced) return forced;
  try {
    const v = window.localStorage.getItem(HOME_V3_KEY);
    return v === '1' || v === 'v3' ? 'v3' : v === 'online' ? 'online' : v === 'classic' ? 'classic' : v === 'new' ? 'new' : 'exec';
  } catch {
    // อ่าน storage ไม่ได้ = หน้าหลักผู้บริหาร (ค่าตั้งต้น)
    return 'exec';
  }
}

export function isHomeV3(): boolean {
  return homeVariant() === 'v3';
}

/** อ่านครั้งเดียวต่อการเปิดหน้า — กันหน้าสลับกลางทาง */
export function useHomeVariant(): HomeVariant {
  return React.useMemo(() => homeVariant(), []);
}
