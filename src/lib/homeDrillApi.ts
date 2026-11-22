import { apiFetch } from './apiFetch';
import type { DrillPayload } from './homeDrill';

/**
 * แผงไล่เดือนของกล่องหน้าหลัก (22 พ.ย. 2569) — ชุดเดียวใช้ทุกกล่อง จำไว้ 2 นาทีต่อ BU (กดกล่องอื่นต่อไม่ต้องโหลดใหม่)
 * พังแล้วไม่จำ — กดใหม่ได้ลองอีกครั้ง
 */
const KEEP_MS = 2 * 60_000;
const kept = new Map<string, { at: number; p: Promise<DrillPayload> }>();

export function fetchHomeDrill(bu: string | null): Promise<DrillPayload> {
  const key = bu ?? '';
  const hit = kept.get(key);
  if (hit && Date.now() - hit.at < KEEP_MS) return hit.p;
  const p = apiFetch(`/api/home-drill${bu ? `?bu=${encodeURIComponent(bu)}` : ''}`).then(async (r) => {
    const data = (await r.json().catch(() => null)) as (DrillPayload & { message?: string }) | null;
    if (!r.ok || !data) throw new Error(data?.message || `โหลดข้อมูล 12 เดือนไม่ขึ้น (HTTP ${r.status})`);
    return data;
  });
  kept.set(key, { at: Date.now(), p });
  p.catch(() => kept.delete(key));
  return p;
}
