/**
 * นโยบายการโทรตาม — client adapter ของ GET/PUT /api/lumos/call-policy
 * ความหมายของค่า + normalize อยู่ที่ callFollowupPolicy.ts ที่เดียว
 */
import { apiFetch } from '@/lib/apiFetch';
import {
  normalizeCallFollowupPolicy,
  type CallFollowupPolicy,
} from '@/lib/callFollowupPolicy';

export async function fetchCallFollowupPolicy(): Promise<CallFollowupPolicy> {
  const r = await apiFetch('/api/lumos/call-policy', { cache: 'no-store' });
  if (!r.ok) throw new Error('โหลดนโยบายการโทรไม่สำเร็จ');
  const body = (await r.json()) as { policy?: unknown };
  return normalizeCallFollowupPolicy(body.policy ?? null);
}

export async function saveCallFollowupPolicy(
  policy: CallFollowupPolicy,
): Promise<CallFollowupPolicy> {
  const r = await apiFetch('/api/lumos/call-policy', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ policy }),
  });
  if (!r.ok) {
    const body = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message || 'บันทึกนโยบายการโทรไม่สำเร็จ');
  }
  const body = (await r.json()) as { policy?: unknown };
  return normalizeCallFollowupPolicy(body.policy ?? null);
}
