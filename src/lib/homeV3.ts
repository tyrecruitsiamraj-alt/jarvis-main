/**
 * ═══ สวิตช์หน้าหลักโฉม 3 ก้อน (29 ก.ย. 2569) — ชั้นคู่ขนานตามกติกาโปรเจกต์ ═══
 *
 * `?home=v3` เปิด · `?home=classic` ปิด · จำในเครื่อง (`jarvis.home.v3`)
 * 🔴 **ค่าตั้งต้น = หน้าเดิม** จนเจ้าของเคาะ — หน้าเดิมต้องใช้ได้เสมอ เป็นทางถอย (กติกา safe implementation)
 * แผน: `docs/plan-home-v3-2569-09-29.md`
 */
import * as React from 'react';

export const HOME_V3_KEY = 'jarvis.home.v3';

function paramMode(): 'v3' | 'classic' | null {
  try {
    const v = new URLSearchParams(window.location.search).get('home');
    return v === 'v3' || v === 'classic' ? v : null;
  } catch {
    return null;
  }
}

export function isHomeV3(): boolean {
  if (typeof window === 'undefined') return false;
  const forced = paramMode();
  try {
    if (forced === 'v3') window.localStorage.setItem(HOME_V3_KEY, '1');
    if (forced === 'classic') window.localStorage.removeItem(HOME_V3_KEY);
  } catch {
    /* ปิด storage ก็ปล่อยผ่าน — URL ยังสั่งได้ต่อรอบ */
  }
  if (forced) return forced === 'v3';
  try {
    return window.localStorage.getItem(HOME_V3_KEY) === '1';
  } catch {
    // อ่าน storage ไม่ได้ = หน้าเดิม (ค่าปลอดภัย)
    return false;
  }
}

/** อ่านครั้งเดียวต่อการเปิดหน้า — กันหน้าสลับกลางทาง */
export function useHomeV3(): boolean {
  return React.useMemo(() => isHomeV3(), []);
}
