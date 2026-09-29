/** ตัวดึง `/api/home-overview` — ก้อน 1 (ผลงานเดือนนี้) + ก้อน 3 (วันนี้) ของหน้าหลักโฉม 3 ก้อน */
import { apiFetch } from '@/lib/apiFetch';
import type { HomeOverview } from '@/lib/homeOverview';

export async function fetchHomeOverview(bu?: string | null): Promise<HomeOverview> {
  const r = await apiFetch(bu ? `/api/home-overview?bu=${encodeURIComponent(bu)}` : '/api/home-overview');
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(data.message || data.error || `โหลดภาพรวมหน้าหลักไม่สำเร็จ (HTTP ${r.status})`);
  }
  return (await r.json()) as HomeOverview;
}
