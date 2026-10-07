/**
 * ═══ สวิตช์โฉมหน้าหลัก — ชั้นคู่ขนานตามกติกาโปรเจกต์ ═══
 *
 * - `?home=new` = **หน้าหลักใหม่ "ระบบไปกี่ %"** (เจ้าของเริ่มใหม่ 30 ก.ย. 2569: *"หน้าหลักเริ่มใหม่เลย โละทิ้ง…"*
 *   แล้วสั่งเรื่องแรก AI โทร vs คนโทร · `src/pages/HomeAiSharePage.tsx`) — **ค่าตั้งต้นตอนนี้**
 * - `?home=classic` = หน้าเดิม (deck · บอร์ด 4 ทีม · KPI) — โค้ดยังอยู่ครบเป็นทางถอย
 * - `?home=v3` = โฉม 3 ก้อน (29 ก.ย. 2569 · แผน `docs/plan-home-v3-2569-09-29.md`)
 * - `?home=online` = หน้าทีม Online ตามภาพต้นแบบของเจ้าของ (29 ก.ย. 2569 · แผน `docs/plan-team-online-2569-09-29.md`)
 * จำเลือกไว้ในเครื่อง (`jarvis.home.v3` — ค่า `1` เดิม = v3)
 *
 * 🔴 **ค่าตั้งต้น = หน้าหลักใหม่** (เปลี่ยนจากหน้าเดิม 30 ก.ย. 2569) — คนที่ไม่เคยกดสวิตช์เห็นหน้าใหม่
 *    หน้าเดิมยังเรียกได้ที่ `?home=classic` และโค้ดยังอยู่ครบ เป็นทางถอย (กติกา safe implementation)
 */
import * as React from 'react';
import { useLocation } from 'react-router-dom';

export const HOME_V3_KEY = 'jarvis.home.v3';

/** `ledger` = สมุดบัญชีติดตาม (7 ต.ค. 2569 · เปิดจากปุ่มบนหน้าหลัก) — ไม่จำในเครื่อง เปิดหน้าหลักใหม่ = หน้าหลักเดิม */
export type HomeVariant = 'new' | 'classic' | 'v3' | 'online' | 'ledger';

const isVariant = (v: unknown): v is HomeVariant =>
  v === 'new' || v === 'classic' || v === 'v3' || v === 'online' || v === 'ledger';

function paramMode(): HomeVariant | null {
  try {
    const v = new URLSearchParams(window.location.search).get('home');
    return isVariant(v) ? v : null;
  } catch {
    return null;
  }
}

export function homeVariant(): HomeVariant {
  if (typeof window === 'undefined') return 'new';
  const forced = paramMode();
  try {
    // 'new' = ค่าตั้งต้น ⇒ ล้างค่าจำ · โฉมอื่นเก็บชื่อไว้ (v3 เก็บ '1' เดิมเพื่อความเข้ากันได้)
    if (forced === 'new') window.localStorage.removeItem(HOME_V3_KEY);
    else if (forced && forced !== 'ledger') window.localStorage.setItem(HOME_V3_KEY, forced === 'v3' ? '1' : forced);
  } catch {
    /* ปิด storage ก็ปล่อยผ่าน — URL ยังสั่งได้ต่อรอบ */
  }
  if (forced) return forced;
  try {
    const v = window.localStorage.getItem(HOME_V3_KEY);
    return v === '1' || v === 'v3' ? 'v3' : v === 'online' ? 'online' : v === 'classic' ? 'classic' : 'new';
  } catch {
    // อ่าน storage ไม่ได้ = หน้าหลักใหม่ (ค่าตั้งต้น)
    return 'new';
  }
}

export function isHomeV3(): boolean {
  return homeVariant() === 'v3';
}

/** อ่านครั้งเดียวต่อ URL — กันหน้าสลับกลางทาง · กดปุ่มสมุดบัญชี/กลับหน้าหลัก (เปลี่ยน `?home=`) แล้วอ่านใหม่ */
export function useHomeVariant(): HomeVariant {
  const { search } = useLocation();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- อ่านจาก window.location ตาม URL ที่เปลี่ยน
  return React.useMemo(() => homeVariant(), [search]);
}
