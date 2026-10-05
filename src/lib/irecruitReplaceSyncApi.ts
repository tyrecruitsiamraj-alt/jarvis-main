import { apiFetch } from '@/lib/apiFetch';
import type { ReplaceCallRule, ReplaceSyncSummary } from '@/lib/irecruitReplaceSync';

/** สภาพการดึงส่งคนแทนจาก iRecruit — `GET /api/irecruit-replace-sync` */
export type ReplaceSyncStatus = {
  enabled: boolean;
  horizonDays: number;
  /** ใช้ iRecruit ไม่ได้เพราะอะไร — `null` = ปกติ */
  unavailableReason: string | null;
  tableReady: boolean;
  running: boolean;
  rule: ReplaceCallRule;
  ruleText: string;
  lastRun: ReplaceSyncSummary | null;
  updatedAt: string | null;
  updatedByName: string | null;
};

async function readError(r: Response): Promise<string> {
  const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
  return data.message || data.error || `ไม่สำเร็จ (HTTP ${r.status})`;
}

export async function fetchReplaceSyncStatus(): Promise<ReplaceSyncStatus> {
  const r = await apiFetch('/api/irecruit-replace-sync', { cache: 'no-store' });
  if (!r.ok) throw new Error(await readError(r));
  return (await r.json()) as ReplaceSyncStatus;
}

/** ดึงตอนนี้หนึ่งรอบ — ตัวเดียวกับที่ระบบดึงทุก 5 นาที */
export async function runReplaceSyncNow(): Promise<ReplaceSyncStatus & { summary: ReplaceSyncSummary }> {
  const r = await apiFetch('/api/irecruit-replace-sync', { method: 'POST' });
  if (!r.ok) throw new Error(await readError(r));
  return (await r.json()) as ReplaceSyncStatus & { summary: ReplaceSyncSummary };
}
