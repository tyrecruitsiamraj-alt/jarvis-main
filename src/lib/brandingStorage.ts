import type { CSSProperties } from 'react';

/** HSL components as in shadcn: "H S% L%" (no hsl() wrapper) */
export type BrandingConfig = {
  appName: string;
  logoDataUrl: string | null;
  /** Main brand color → primary, accent, ring, sidebar-primary */
  primaryHsl: string;
  backgroundHsl: string;
  foregroundHsl: string;
  cardHsl: string;
  pageBackgroundMode: 'solid' | 'gradient';
  /** Gradient endpoints (HSL components), used when pageBackgroundMode === 'gradient' */
  gradientFromHsl: string;
  gradientToHsl: string;
};

/** เปลี่ยนคีย์เมื่อ rebrand เพื่อไม่ให้ชื่อเก่าค้างใน localStorage ของผู้ใช้ */
const KEY = 'so_recruit_branding_v1';
const LEGACY_BRANDING_KEY = 'jarvis_branding_v1';
const DEFAULT_LOGO_PATH = '/so-work-logo.png';

export const DEFAULT_BRANDING: BrandingConfig = {
  appName: 'So Recruit',
  logoDataUrl: DEFAULT_LOGO_PATH,
  primaryHsl: '0 72% 50%',
  backgroundHsl: '0 0% 98%',
  foregroundHsl: '0 0% 12%',
  cardHsl: '0 0% 100%',
  pageBackgroundMode: 'solid',
  gradientFromHsl: '0 0% 98%',
  gradientToHsl: '0 0% 94%',
};

export function loadBranding(): BrandingConfig {
  if (typeof window === 'undefined') return DEFAULT_BRANDING;
  try {
    let raw = localStorage.getItem(KEY);
    if (!raw) raw = localStorage.getItem(LEGACY_BRANDING_KEY);
    if (!raw) return DEFAULT_BRANDING;
    const p = JSON.parse(raw) as Partial<BrandingConfig>;
    const merged = { ...DEFAULT_BRANDING, ...p };
    if (merged.appName === 'JARVIS' || merged.appName === 'Lovable App') {
      merged.appName = DEFAULT_BRANDING.appName;
    }
    if (!merged.logoDataUrl || !String(merged.logoDataUrl).trim()) {
      merged.logoDataUrl = DEFAULT_LOGO_PATH;
    }
    return merged;
  } catch {
    return DEFAULT_BRANDING;
  }
}

export function saveBranding(c: BrandingConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
    localStorage.removeItem(LEGACY_BRANDING_KEY);
  } catch {
    /* quota */
  }
}

/** #rrggbb → "H S% L%" */
export function hexToHslComponents(hex: string): string {
  const h = hex.replace(/^#/, '');
  if (h.length !== 6) return DEFAULT_BRANDING.primaryHsl;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let hue = 0;
  const l = (max + min) / 2;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        hue = ((b - r) / d + 2) / 6;
        break;
      default:
        hue = ((r - g) / d + 4) / 6;
    }
  }

  const H = Math.round(hue * 360);
  const S = Math.round(s * 100);
  const L = Math.round(l * 100);
  return `${H} ${S}% ${L}%`;
}

export function hslComponentsToHex(hsl: string): string {
  const parts = hsl.trim().split(/\s+/);
  if (parts.length < 3) return '#c41e3a';
  const h = Number(parts[0]) / 360;
  const s = Number(parts[1].replace('%', '')) / 100;
  const l = Number(parts[2].replace('%', '')) / 100;
  if (!Number.isFinite(h) || !Number.isFinite(s) || !Number.isFinite(l)) return '#c41e3a';

  let r: number;
  let g: number;
  let b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function applyBrandingToDocument(c: BrandingConfig): void {
  if (typeof document === 'undefined') return;
  const name = (c.appName || DEFAULT_BRANDING.appName).trim() || DEFAULT_BRANDING.appName;
  document.title = name;

  const root = document.documentElement;

  root.style.setProperty('--primary', c.primaryHsl);
  root.style.setProperty('--primary-foreground', '0 0% 100%');
  root.style.setProperty('--accent', c.primaryHsl);
  root.style.setProperty('--accent-foreground', '0 0% 100%');
  root.style.setProperty('--ring', c.primaryHsl);
  root.style.setProperty('--sidebar-primary', c.primaryHsl);
  root.style.setProperty('--sidebar-primary-foreground', '0 0% 100%');
  root.style.setProperty('--sidebar-ring', c.primaryHsl);

  const pp = c.primaryHsl.trim().split(/\s+/);
  const ph = pp[0] ?? '0';
  const ps = pp[1] ?? '72%';
  const plRaw = pp[2] ?? '50%';
  const lNum = parseInt(plRaw.replace('%', ''), 10);
  const darkerL = Math.max(0, lNum - 10);
  root.style.setProperty(
    '--gradient-primary',
    `linear-gradient(135deg, hsl(${c.primaryHsl}), hsl(${ph} ${ps} ${darkerL}%))`,
  );

  root.style.setProperty('--background', c.backgroundHsl);
  root.style.setProperty('--foreground', c.foregroundHsl);
  root.style.setProperty('--card', c.cardHsl);
  root.style.setProperty('--card-foreground', c.foregroundHsl);
  root.style.setProperty('--popover', c.cardHsl);
  root.style.setProperty('--popover-foreground', c.foregroundHsl);

  root.style.setProperty('--gradient-card', `linear-gradient(145deg, hsl(${c.cardHsl}), hsl(${c.backgroundHsl}))`);

  if (c.pageBackgroundMode === 'gradient') {
    root.setAttribute('data-page-bg', 'gradient');
    root.style.setProperty(
      '--gradient-hero',
      `linear-gradient(135deg, hsl(${c.gradientFromHsl}), hsl(${c.gradientToHsl}))`,
    );
  } else {
    root.removeAttribute('data-page-bg');
    root.style.setProperty(
      '--gradient-hero',
      `linear-gradient(135deg, hsl(${c.backgroundHsl}), hsl(${c.backgroundHsl}))`,
    );
  }
}

/** พื้นหลังแบบ gradient สำหรับ wrapper หลัก (AppLayout / Login) */
export function getAppShellBackgroundStyle(c: BrandingConfig): CSSProperties | undefined {
  if (c.pageBackgroundMode !== 'gradient') return undefined;
  return {
    background: `linear-gradient(135deg, hsl(${c.gradientFromHsl}), hsl(${c.gradientToHsl}))`,
    minHeight: '100vh',
  };
}
