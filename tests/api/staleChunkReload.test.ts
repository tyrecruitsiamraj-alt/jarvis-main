/**
 * เปลี่ยนหน้าแล้วค้าง ต้องกด refresh (เจ้าของ 19 ต.ค. 2569) — ขึ้นเว็บใหม่แล้วไฟล์ย่อยของหน้าเก่าหาย (404)
 * แก้: โหลดหน้าใหม่ให้เองหนึ่งครั้ง กันวน 30 วินาที
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isStaleChunkError, reloadForStaleChunk } from '../../src/lib/staleChunkReload';

describe('staleChunkReload', () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });
  it('จับ error โหลดไฟล์ย่อยไม่ได้ของทุกเบราว์เซอร์ · error อื่นไม่ใช่', () => {
    expect(isStaleChunkError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/A-1.js'))).toBe(true);
    expect(isStaleChunkError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isStaleChunkError(new Error('error loading dynamically imported module'))).toBe(true);
    expect(isStaleChunkError(new Error('Cannot read properties of undefined'))).toBe(false);
  });
  it('โหลดใหม่หนึ่งครั้ง · ซ้ำภายใน 30 วินาทีไม่โหลดอีก (กันวน)', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    expect(reloadForStaleChunk(1_000_000)).toBe(true);
    expect(reloadForStaleChunk(1_010_000)).toBe(false);
    expect(reloadForStaleChunk(1_040_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });
  it('ทุกหน้าที่โหลดแยกไฟล์ใช้ lazyPage · ติดตั้งตัวดัก vite:preloadError ที่ main', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).not.toMatch(/[^a-zA-Z]lazy\(\(\) =>/);
    expect(app).toContain('lazyPage(() =>');
    expect(readFileSync('src/main.tsx', 'utf8')).toContain('installStaleChunkReload();');
  });
});
