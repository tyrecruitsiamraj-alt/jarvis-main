import { formatDepartmentCodeDisplay } from '@/lib/siamrajUnitFilters';

export const WL_BU_CODES = ['LBD', 'LBA'] as const;
export type WlBuCode = (typeof WL_BU_CODES)[number];

/** ถังพิเศษ "ยังไม่ระบุ BU" — ไม่ใช่ BU จริง แต่ต้องมีที่ให้คนที่ยังไม่มีรหัสโผล่ให้เห็นและตั้งค่าได้ */
export const WL_BU_UNASSIGNED = 'unassigned' as const;
export type WlBuView = WlBuCode | typeof WL_BU_UNASSIGNED;

const WL_BU_KEY = 'jarvis:wl-selected-bu';

export function isWlBuCode(value: string): value is WlBuCode {
  return (WL_BU_CODES as readonly string[]).includes(value);
}

export function isWlBuView(value: string): value is WlBuView {
  return value === WL_BU_UNASSIGNED || isWlBuCode(value);
}

export function normalizeWlBuCode(code?: string | null): WlBuCode | null {
  const upper = (code || '').trim().toUpperCase();
  return isWlBuCode(upper) ? upper : null;
}

export function loadWlBu(): WlBuView | null {
  const raw = sessionStorage.getItem(WL_BU_KEY);
  if (!raw) return null;
  return isWlBuView(raw) ? raw : null;
}

export function saveWlBu(bu: WlBuView): void {
  sessionStorage.setItem(WL_BU_KEY, bu);
}

export function wlBuLabel(bu: WlBuCode): string {
  return formatDepartmentCodeDisplay(bu);
}

export function wlBuViewLabel(view: WlBuView): string {
  return view === WL_BU_UNASSIGNED ? 'ยังไม่ระบุ BU' : wlBuLabel(view);
}
