/**
 * โหมดสาธิต: รวม mockData + demoStorage (+ API บางส่วน)
 *
 * - Build: VITE_DEMO_MODE=true
 * - Runtime: ตั้งเมื่อต่อ API ไม่ได้ (session) เพื่อให้เปิดแอปได้ทันทีโดยไม่ต้องมี DB
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

/** เปิดโหมดสาธิตชั่วคราวในแท็บนี้ (หลังต่อ API ไม่ได้) */
export function enableRuntimeDemo(): void {
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

export function isDemoMode(): boolean {
  if (import.meta.env.VITE_DEMO_MODE === 'true') return true;
  return readRuntimeDemo();
}

/** โหมดสาธิตที่ "ตั้งใจเปิด" จาก env เท่านั้น (ไม่รวม fallback อัตโนมัติ) */
export function isConfiguredDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === 'true';
}

/** สาธิตเพราะ API ล้ม — ไม่ใช่แค่ VITE_DEMO_MODE (ใช้โชว์แบนเนอร์) */
export function isRuntimeDemoFallback(): boolean {
  return import.meta.env.VITE_DEMO_MODE !== 'true' && readRuntimeDemo();
}

