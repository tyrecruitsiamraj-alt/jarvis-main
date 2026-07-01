/**
 * โหมดสาธิต: รวม mockData + demoStorage (+ API บางส่วน)
 *
 * - Build: VITE_DEMO_MODE=true (ตั้งใจเปิดโหมดสาธิต)
 * - Runtime: VITE_ENABLE_RUNTIME_DEMO_FALLBACK=true เท่านั้น (development) — เปิดเมื่อ API ล้ม
 * - Production build: ไม่มี runtime fallback แม้ตั้ง env ผิด
 */
const RUNTIME_DEMO_KEY = 'jarvis_runtime_demo';

function readRuntimeDemo(): boolean {
  if (typeof globalThis.sessionStorage === 'undefined') return false;
  try {
    return sessionStorage.getItem(RUNTIME_DEMO_KEY) === '1';
  } catch {
    return false;
  }
}

/** เปิด runtime demo fallback ได้เมื่อตั้ง env ชัดเจนและไม่ใช่ production build */
export function isRuntimeDemoFallbackEnabled(): boolean {
  if (import.meta.env.PROD) return false;
  return import.meta.env.VITE_ENABLE_RUNTIME_DEMO_FALLBACK === 'true';
}

/** เปิดโหมดสาธิตชั่วคราวในแท็บนี้ (หลังต่อ API ไม่ได้) — no-op ถ้าปิด fallback */
export function enableRuntimeDemo(): void {
  if (!isRuntimeDemoFallbackEnabled()) return;
  try {
    sessionStorage.setItem(RUNTIME_DEMO_KEY, '1');
  } catch {
    /* private / quota */
  }
}

export function clearRuntimeDemoFlag(): void {
  try {
    sessionStorage.removeItem(RUNTIME_DEMO_KEY);
  } catch {
    /* ignore */
  }
}

/** โหมดสาธิต: env หรือ runtime fallback (เมื่อเปิดใช้ได้เท่านั้น) */
export function isDemoMode(): boolean {
  if (import.meta.env.PROD) return false;
  if (import.meta.env.VITE_DEMO_MODE === 'true') return true;
  if (!isRuntimeDemoFallbackEnabled()) return false;
  return readRuntimeDemo();
}

/** โหมดสาธิตที่ "ตั้งใจเปิด" จาก env เท่านั้น (ไม่รวม fallback อัตโนมัติ) */
export function isConfiguredDemoMode(): boolean {
  if (import.meta.env.PROD) return false;
  return import.meta.env.VITE_DEMO_MODE === 'true';
}

/** สาธิตเพราะ API ล้ม — ไม่ใช่แค่ VITE_DEMO_MODE (ใช้โชว์แบนเนอร์) */
export function isRuntimeDemoFallback(): boolean {
  if (!isRuntimeDemoFallbackEnabled()) return false;
  return import.meta.env.VITE_DEMO_MODE !== 'true' && readRuntimeDemo();
}

/** ล้าง runtime flag ค้างจาก session เก่าเมื่อ production หรือปิด fallback */
function purgeStaleRuntimeDemo(): void {
  if (!isRuntimeDemoFallbackEnabled()) {
    clearRuntimeDemoFlag();
  }
}

purgeStaleRuntimeDemo();
