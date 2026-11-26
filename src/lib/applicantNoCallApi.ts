import { apiFetch } from './apiFetch';
import type { NoCallBox, NoCallReason } from './applicantNoCall';

/** เส้น `/api/applicant-no-call` (26 พ.ย. 2569) — พังโยนข้อความไทยจาก server */
async function readError(r: Response): Promise<never> {
  const data = (await r.json().catch(() => ({}))) as { message?: string };
  throw new Error(data.message || `ระบบตอบ ${r.status}`);
}

export async function fetchNoCallReasons(): Promise<NoCallReason[]> {
  const r = await apiFetch('/api/applicant-no-call');
  if (!r.ok) return readError(r);
  return ((await r.json()) as { reasons: NoCallReason[] }).reasons ?? [];
}

/** ตั้ง "ไม่โทร" · reasonId = null ล้าง (กลับกล่องเดิม) */
export async function setApplicationNoCall(
  ids: string[],
  reasonId: number | null,
): Promise<{ done: number; cancelledCalls: number; skipped: number }> {
  const r = await apiFetch('/api/applicant-no-call', { method: 'POST', body: JSON.stringify({ ids, reasonId }) });
  if (!r.ok) return readError(r);
  return (await r.json()) as { done: number; cancelledCalls: number; skipped: number };
}

export async function createNoCallReason(label: string, box: NoCallBox): Promise<NoCallReason> {
  const r = await apiFetch('/api/applicant-no-call', { method: 'POST', body: JSON.stringify({ label, box }) });
  if (!r.ok) return readError(r);
  return ((await r.json()) as { item: NoCallReason }).item;
}

export async function updateNoCallReason(id: number, patch: { label?: string; active?: boolean }): Promise<NoCallReason> {
  const r = await apiFetch('/api/applicant-no-call', { method: 'PATCH', body: JSON.stringify({ id, ...patch }) });
  if (!r.ok) return readError(r);
  return ((await r.json()) as { item: NoCallReason }).item;
}
