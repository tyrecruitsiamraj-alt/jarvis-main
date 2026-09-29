/**
 * ═══ สวิตช์โฉมหน้าหลัก — ชั้นคู่ขนานตามกติกาโปรเจกต์ ═══
 *
 * - `?home=v3` = โฉม 3 ก้อน (29 ก.ย. 2569 · แผน `docs/plan-home-v3-2569-09-29.md`)
 * - `?home=online` = หน้าทีม Online ตามภาพต้นแบบของเจ้าของ (29 ก.ย. 2569 · แผน `docs/plan-team-online-2569-09-29.md`)
 * - `?home=classic` = กลับหน้าเดิม · จำในเครื่อง (`jarvis.home.v3` — ค่า `1` เดิม = v3)
 *
 * 🔴 **ค่าตั้งต้น = หน้าเดิม** จนเจ้าของเคาะ — หน้าเดิมต้องใช้ได้เสมอ เป็นทางถอย (กติกา safe implementation)
 */
import * as React from 'react';

export const HOME_V3_KEY = 'jarvis.home.v3';

export type HomeVariant = 'classic' | 'v3' | 'online';

const isVariant = (v: unknown): v is HomeVariant => v === 'classic' || v === 'v3' || v === 'online';

function paramMode(): HomeVariant | null {
  try {
    const v = new URLSearchParams(window.location.search).get('home');
    return isVariant(v) ? v : null;
  } catch {
    return null;
  }
}

export function homeVariant(): HomeVariant {
  if (typeof window === 'undefined') return 'classic';
  const forced = paramMode();
  try {
    if (forced === 'classic') window.localStorage.removeItem(HOME_V3_KEY);
    else if (forced) window.localStorage.setItem(HOME_V3_KEY, forced === 'v3' ? '1' : forced);
  } catch {
    /* ปิด storage ก็ปล่อยผ่าน — URL ยังสั่งได้ต่อรอบ */
  }
  if (forced) return forced;
  try {
    const v = window.localStorage.getItem(HOME_V3_KEY);
    return v === '1' ? 'v3' : v === 'online' ? 'online' : 'classic';
  } catch {
    // อ่าน storage ไม่ได้ = หน้าเดิม (ค่าปลอดภัย)
    return 'classic';
  }
}

export function isHomeV3(): boolean {
  return homeVariant() === 'v3';
}

/** อ่านครั้งเดียวต่อการเปิดหน้า — กันหน้าสลับกลางทาง */
export function useHomeVariant(): HomeVariant {
  return React.useMemo(() => homeVariant(), []);
}
