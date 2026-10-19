/**
 * ═══ เปลี่ยนหน้าแล้วค้าง ต้องกด refresh (เจ้าของ 19 ต.ค. 2569: *"มันชอบค้าง สมมติเปลี่ยนหน้าใช่ไหม ต้องกด refresh
 * อีก 1 ทีถึงจะมา เป็นๆหายๆ"*) ═══
 *
 * ต้นเหตุ: แต่ละหน้าโหลดเป็นไฟล์ย่อย (`lazy(() => import(...))`) ชื่อไฟล์มีรหัสต่อท้าย · ขึ้นเว็บใหม่ = ไฟล์ชื่อเก่าหาย (404)
 * ⇒ แท็บที่เปิดค้างไว้ก่อนขึ้นเว็บ กดไปหน้าที่ยังไม่เคยเปิด → โหลดไฟล์ไม่ได้ → หน้าไม่ขึ้นจนกว่าจะ refresh
 * (เป็น ๆ หาย ๆ เพราะเกิดเฉพาะหลังขึ้นเว็บ และเฉพาะหน้าที่ยังไม่เคยเปิดในแท็บนั้น)
 *
 * แก้: โหลดไฟล์ย่อยไม่ได้ = โหลดหน้าใหม่ให้เองหนึ่งครั้ง (ได้ไฟล์ชุดใหม่) · กันวนด้วยเวลาใน sessionStorage
 * ถ้าโหลดใหม่แล้ว 30 วินาทียังพังซ้ำ = ไม่ใช่เรื่องไฟล์เก่า ปล่อยให้ error ขึ้นตามปกติ (PageErrorBoundary)
 */
import { lazy, type ComponentType } from 'react';

const KEY = 'jarvis:stale-chunk-reload-at';
const LOOP_GUARD_MS = 30_000;

export function isStaleChunkError(e: unknown): boolean {
  const msg = e instanceof Error ? `${e.name} ${e.message}` : String(e ?? '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Unable to preload CSS/i.test(
    msg,
  );
}

/** โหลดหน้าใหม่หนึ่งครั้ง — คืน false ถ้าเพิ่งโหลดใหม่ไปเพราะเรื่องเดียวกัน (กันวน) */
export function reloadForStaleChunk(now: number = Date.now()): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (last && now - last < LOOP_GUARD_MS) return false;
    sessionStorage.setItem(KEY, String(now));
  } catch {
    /* sessionStorage ใช้ไม่ได้ = ยังโหลดใหม่ได้ (ไม่มีตัวกันวน แต่ดีกว่าค้าง) */
  }
  window.location.reload();
  return true;
}

/** `lazy` ที่โหลดหน้าใหม่ให้เองเมื่อไฟล์ย่อยหาย (หลังขึ้นเว็บใหม่) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- รับ props แบบไหนก็ได้เหมือน React.lazy
export function lazyPage<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(() =>
    factory().catch((e: unknown) => {
      if (isStaleChunkError(e) && reloadForStaleChunk()) {
        // ระหว่างรอโหลดใหม่ ค้างไว้ไม่ต้องโชว์ error
        return new Promise<{ default: T }>(() => {});
      }
      throw e;
    }),
  );
}

/** Vite ยิง `vite:preloadError` ตอนโหลดไฟล์ย่อย/CSS ล่วงหน้าไม่ได้ — จัดการทางเดียวกัน */
export function installStaleChunkReload(): void {
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadForStaleChunk()) event.preventDefault();
  });
}
