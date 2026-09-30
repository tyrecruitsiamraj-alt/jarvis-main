/** ตัวดึง `/api/home-presence` — ใครอยู่ในระบบ ท้ายหน้าหลัก (30 ก.ย. 2569) */
import { apiFetch } from '@/lib/apiFetch';
import type { HomePresenceResponse } from '@/lib/homePresence';

export async function fetchHomePresence(): Promise<HomePresenceResponse> {
  const r = await apiFetch('/api/home-presence');
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(data.message || data.error || 'โหลดรายชื่อไม่ขึ้น ลองรีเฟรชอีกครั้ง');
  }
  return (await r.json()) as HomePresenceResponse;
}
