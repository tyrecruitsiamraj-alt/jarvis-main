/**
 * โหมดธีมของระบบ — light / dark / system (ตามเครื่อง)
 * เก็บเป็นค่าเฉพาะเครื่องใน localStorage (ไม่ผูกบัญชี) และทำงานด้วยการสลับ class `dark`
 * บน <html> ตาม config ของ tailwind (darkMode: ["class"])
 */
import { resyncBrandingForTheme } from '@/lib/brandingStorage';

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_KEY = 'jarvis:theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

export function loadThemeMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
  } catch {
    return 'system';
  }
}

/** ธีมที่ใช้จริงตอนนี้ (คลี่ system เป็น light/dark ตามเครื่อง) */
export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') return media().matches ? 'dark' : 'light';
  return mode;
}

export function applyThemeMode(mode: ThemeMode): void {
  const dark = resolveTheme(mode) === 'dark';
  document.documentElement.classList.toggle('dark', dark);
  // บอกเบราว์เซอร์ให้ form control / scrollbar พื้นเมืองเข้าโหมดเดียวกัน
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  // สีพื้นผิวของแบรนด์เขียนเป็น inline บน <html> ซึ่งชนะกฎ .dark — ต้องคำนวณใหม่ทุกครั้งที่สลับธีม
  // ไม่งั้นโหมดมืดจะยังใช้พื้น/หมึกของธีมสว่างค้างอยู่ (ดู brandingStorage.applyBrandSurfaceVars)
  resyncBrandingForTheme();
}

export function setThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* ธีมยังสลับได้ แค่ไม่ถูกจำข้ามรีเฟรช */
  }
  applyThemeMode(mode);
}

/**
 * เรียกครั้งเดียวตอนบูตแอป (ก่อน render กัน flash สีผิด)
 * — ตั้งธีมตามที่จำไว้ และตามการเปลี่ยนธีมของเครื่องเมื่ออยู่โหมด system
 */
export function initTheme(): void {
  applyThemeMode(loadThemeMode());
  media().addEventListener('change', () => {
    if (loadThemeMode() === 'system') applyThemeMode('system');
  });
}
