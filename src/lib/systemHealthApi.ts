import { apiFetch } from '@/lib/apiFetch';
import { readErrorMessage, readJsonSafe } from '@/lib/api';
import type { HealthCheck } from '@/lib/systemHealth';

export type SwitchRow = {
  key: string;
  label: string;
  state: 'on' | 'off' | 'partial';
  stateLabel: string;
  note: string;
};

export type StaleItem = {
  kind: 'confirmed_no_owner' | 'batch_pending';
  title: string;
  subtitle: string;
  ageMinutes: number;
  link: string;
};

export type SystemHealth = {
  checkedAt: string | null;
  checks: HealthCheck[];
  switches: SwitchRow[];
  stale: StaleItem[];
  confirmedOwnerLimitMinutes: number;
};

const EMPTY: SystemHealth = {
  checkedAt: null,
  checks: [],
  switches: [],
  stale: [],
  confirmedOwnerLimitMinutes: 120,
};

function normalize(data: SystemHealth | null): SystemHealth {
  if (!data) return EMPTY;
  return {
    checkedAt: data.checkedAt ?? null,
    checks: Array.isArray(data.checks) ? data.checks : [],
    switches: Array.isArray(data.switches) ? data.switches : [],
    stale: Array.isArray(data.stale) ? data.stale : [],
    confirmedOwnerLimitMinutes: Number(data.confirmedOwnerLimitMinutes) || 120,
  };
}

/** ผลรอบล่าสุดของยามเฝ้า (เบา — ไม่ยิง ERP) */
export async function fetchSystemHealth(): Promise<SystemHealth> {
  const r = await apiFetch('/api/system-health');
  if (!r.ok) throw new Error(await readErrorMessage(r, 'อ่านสถานะระบบไม่สำเร็จ'));
  return normalize(await readJsonSafe<SystemHealth>(r));
}

/** สั่งตรวจเดี๋ยวนี้ */
export async function runSystemHealthCheck(): Promise<SystemHealth> {
  const r = await apiFetch('/api/system-health', { method: 'POST' });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'ตรวจสถานะไม่สำเร็จ'));
  return normalize(await readJsonSafe<SystemHealth>(r));
}
