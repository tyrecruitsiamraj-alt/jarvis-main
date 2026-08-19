import { apiFetch } from '@/lib/apiFetch';
import { readErrorMessage, readJsonSafe } from '@/lib/api';
import type { AutoMoveRunState, AutoMoveWorkerConfig } from '@/lib/applicationAutoMoveReport';

export type AutoMoveStatus = {
  config: AutoMoveWorkerConfig;
  lastRun: AutoMoveRunState | null;
};

const EMPTY: AutoMoveStatus = {
  config: { enabled: false, apply: false, intervalMs: 0, startupDelayMs: 0, limit: 0 },
  lastRun: null,
};

/** สถานะตัวตั้งเวลา + ผลรอบล่าสุด (อ่านอย่างเดียว ไม่ยิง ERP) */
export async function fetchAutoMoveStatus(): Promise<AutoMoveStatus> {
  const r = await apiFetch('/api/application-auto-move-status');
  if (!r.ok) throw new Error(await readErrorMessage(r, 'อ่านสถานะตัวย้ายใบสมัครไม่สำเร็จ'));
  const data = await readJsonSafe<AutoMoveStatus>(r);
  return data ?? EMPTY;
}

/**
 * สั่งเดินหนึ่งรอบเดี๋ยวนี้ — **ลองดูเสมอ ไม่ย้ายจริง**
 * (ย้ายจริงมีทางเดียวคือ `POST /api/application-auto-move` หรือ worker ที่เปิด APPLY)
 */
export async function runAutoMoveDryRun(): Promise<AutoMoveStatus> {
  const r = await apiFetch('/api/application-auto-move-status', { method: 'POST' });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'ลองเดินรอบไม่สำเร็จ'));
  const data = await readJsonSafe<AutoMoveStatus>(r);
  return data ?? EMPTY;
}
