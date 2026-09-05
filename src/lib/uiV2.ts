/**
 * ═══ สวิตช์ "โฉมใหม่" — เปิดดูได้ทีละคน ไม่กระทบคนอื่นทั้งบริษัท ═══
 *
 * เจ้าของสั่ง 5 ก.ย. 2569: *"ฉัน Production แล้วนะ ... ถ้าข้อมูลไม่ครบก็ตายกันพอดี"*
 * ⇒ รื้อหน้าตาแบบ **ชั้นขนาน + สวิตช์** (หลักเดียวกับ feature flag ของ Control Tower)
 *
 * กติกา:
 * 1. **ค่าตั้งต้น = ปิด** — ทุกคนที่ไม่เคยกดสวิตช์ เห็นของเดิม 100% แม้โค้ดใหม่จะขึ้น production แล้ว
 * 2. เปิดด้วย `?ui=v2` · ปิดด้วย `?ui=v1` — จำไว้ในเครื่องคนที่กด (`localStorage`)
 *    ไม่ได้เก็บในฐานข้อมูล จึงไม่มีทางรั่วไปหาคนอื่น
 * 3. หน้าเดิม **ไม่ถูกลบ** — ปิดสวิตช์แล้วกลับทันที ไม่ต้อง deploy ใหม่ (ทางถอย)
 * 4. อ่านค่าครั้งเดียวตอนเปิดหน้า — ไม่ต้อง subscribe อะไรให้เปลืองเครื่อง
 */
import * as React from 'react';

export const UI_V2_KEY = 'jarvis.ui.v2';

/** อ่านพารามิเตอร์ `?ui=` — คืน null ถ้าไม่ได้สั่งมาใน URL */
function paramUiMode(): 'v2' | 'v1' | null {
  try {
    const v = new URLSearchParams(window.location.search).get('ui');
    if (v === 'v2') return 'v2';
    if (v === 'v1') return 'v1';
    return null;
  } catch {
    return null;
  }
}

function readStored(): boolean {
  try {
    return window.localStorage.getItem(UI_V2_KEY) === '1';
  } catch {
    // เบราว์เซอร์ปิด storage = ถือว่ายังไม่เปิด (ของเดิมคือค่าปลอดภัย)
    return false;
  }
}

function store(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(UI_V2_KEY, '1');
    else window.localStorage.removeItem(UI_V2_KEY);
  } catch {
    /* ปิด storage ก็ปล่อยผ่าน — URL ยังสั่งได้ต่อรอบ */
  }
}

/**
 * เปิดโฉมใหม่อยู่ไหม — `?ui=v2` / `?ui=v1` มีอำนาจเหนือค่าที่จำไว้ และเขียนทับค่าที่จำด้วย
 * (เจ้าของพิมพ์ `?ui=v2` ครั้งเดียว แล้วเปิดหน้าอื่นต่อได้เลยโดยไม่ต้องพิมพ์ซ้ำ)
 */
export function isUiV2(): boolean {
  if (typeof window === 'undefined') return false;
  const forced = paramUiMode();
  if (forced) {
    const on = forced === 'v2';
    store(on);
    return on;
  }
  return readStored();
}

/** ใช้ในไฟล์จอ — อ่านครั้งเดียวตอน mount (สลับโหมดต้องรีโหลดหน้า ซึ่งตั้งใจ) */
export function useUiV2(): boolean {
  return React.useMemo(() => isUiV2(), []);
}
