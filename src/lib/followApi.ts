import { apiFetch } from '@/lib/apiFetch';

export type FollowCallStatus = 'pending' | 'delivered' | 'completed' | 'failed' | 'cancelled';

export type FollowEntry = {
  id: string;
  recipient_name: string;
  recipient_phone: string;
  topic: string;
  note: string | null;
  scheduled_at: string | null;
  created_by_name: string | null;
  created_at: string | null;
  cancelled: boolean;
  call_status: FollowCallStatus;
  call_outcome: string | null;
  call_summary: string | null;
  called_at: string | null;
};

export type NewFollowEntry = {
  recipient_name: string;
  recipient_phone: string;
  topic: string;
  note?: string;
  scheduled_at?: string;
};

async function readError(r: Response): Promise<string> {
  const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
  return data.message || data.error || `ไม่สำเร็จ (HTTP ${r.status})`;
}

export async function listFollowEntries(): Promise<FollowEntry[]> {
  const r = await apiFetch('/api/follow');
  if (!r.ok) throw new Error(await readError(r));
  const data = (await r.json()) as { items: FollowEntry[] };
  return data.items ?? [];
}

export async function createFollowEntry(input: NewFollowEntry): Promise<FollowEntry> {
  const r = await apiFetch('/api/follow', { method: 'POST', body: JSON.stringify(input) });
  if (!r.ok) throw new Error(await readError(r));
  return (await r.json()) as FollowEntry;
}

export async function cancelFollowEntry(id: string): Promise<void> {
  const r = await apiFetch(`/api/follow?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(await readError(r));
}

export const FOLLOW_STATUS_LABEL: Record<FollowCallStatus, string> = {
  pending: 'รอ AI โทร',
  delivered: 'AI รับไปโทรแล้ว',
  completed: 'โทรสำเร็จ',
  failed: 'โทรไม่สำเร็จ',
  cancelled: 'ยกเลิกแล้ว',
};

export const FOLLOW_STATUS_CLASS: Record<FollowCallStatus, string> = {
  pending: 'bg-slate-500/15 text-slate-700',
  delivered: 'bg-blue-500/15 text-blue-700',
  completed: 'bg-emerald-500/15 text-emerald-700',
  failed: 'bg-red-500/10 text-red-700',
  cancelled: 'bg-muted text-muted-foreground',
};
