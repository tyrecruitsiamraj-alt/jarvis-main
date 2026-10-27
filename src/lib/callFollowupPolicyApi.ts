import { apiFetch } from '@/lib/apiFetch';
import { normalizeCallFollowupPolicy, type CallFollowupPolicy } from '@/lib/callFollowupPolicy';

/** โทรซ้ำคนที่ไม่รับสาย (ตั้งค่า › โทรซ้ำคนไม่รับสาย · 26 ต.ค. 2569) */
async function readError(r: Response): Promise<string> {
  const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
  return data.message || data.error || `ไม่สำเร็จ (HTTP ${r.status})`;
}

export async function fetchCallFollowupPolicy(): Promise<CallFollowupPolicy> {
  const r = await apiFetch('/api/call-followup-policy');
  if (!r.ok) throw new Error(await readError(r));
  return normalizeCallFollowupPolicy(((await r.json()) as { policy?: unknown }).policy);
}

/** ช่องที่หน้า ตั้งค่า › โทรซ้ำคนไม่รับสาย แก้ได้ (27 ต.ค. 2569 โทรซ้ำเป็นรอบ) */
export type CallRetryRoundInput = Pick<
  CallFollowupPolicy,
  'roundCalls' | 'roundGapMinutes' | 'roundsPerDay' | 'roundsGapHours' | 'retryDays' | 'callFrom' | 'callTo' | 'dayMorning' | 'dayAfternoon'
>;

export async function saveCallFollowupPolicy(input: CallRetryRoundInput): Promise<CallFollowupPolicy> {
  const r = await apiFetch('/api/call-followup-policy', { method: 'PUT', body: JSON.stringify(input) });
  if (!r.ok) throw new Error(await readError(r));
  return normalizeCallFollowupPolicy(((await r.json()) as { policy?: unknown }).policy);
}
