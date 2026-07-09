import { formatDepartmentCodeDisplay } from '@/lib/siamrajUnitFilters';

export const WL_BU_CODES = ['LBD', 'LBA'] as const;
export type WlBuCode = (typeof WL_BU_CODES)[number];

const WL_BU_KEY = 'jarvis:wl-selected-bu';

export function isWlBuCode(value: string): value is WlBuCode {
  return (WL_BU_CODES as readonly string[]).includes(value);
}

export function normalizeWlBuCode(code?: string | null): WlBuCode | null {
  const upper = (code || '').trim().toUpperCase();
  return isWlBuCode(upper) ? upper : null;
}

export function loadWlBu(): WlBuCode | null {
  const raw = sessionStorage.getItem(WL_BU_KEY);
  if (!raw) return null;
  return isWlBuCode(raw) ? raw : null;
}

export function saveWlBu(bu: WlBuCode): void {
  sessionStorage.setItem(WL_BU_KEY, bu);
}

export function wlBuLabel(bu: WlBuCode): string {
  return formatDepartmentCodeDisplay(bu);
}
