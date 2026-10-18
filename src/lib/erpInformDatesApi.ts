/** วันแจ้งเข้าล่าสุดจาก ERP ต่อเบอร์ (17 ต.ค. 2569) — เติมวันเริ่มงานที่ว่าง · อ่านอย่างเดียว */
import { apiFetch } from '@/lib/apiFetch';
import { phoneKey } from '@/lib/followDuplicateGuard';

/** เบอร์ 9 ตัวท้าย → YYYY-MM-DD · โหลดไม่ได้ = Map ว่าง (ช่องวันเริ่มงานยังเลือกเองได้ตามเดิม) */
export async function fetchErpInformDates(phones: readonly string[]): Promise<Map<string, string>> {
  const keys = [...new Set(phones.map((p) => phoneKey(p)).filter((x): x is string => Boolean(x)))];
  if (keys.length === 0) return new Map();
  try {
    const r = await apiFetch('/api/erp-inform-dates', { method: 'POST', body: JSON.stringify({ phones: keys }) });
    if (!r.ok) return new Map();
    const d = (await r.json()) as { dates?: Record<string, string> };
    return new Map(Object.entries(d.dates ?? {}));
  } catch {
    return new Map();
  }
}

export function erpInformDateOf(map: ReadonlyMap<string, string>, phone: string | null | undefined): string | null {
  const k = phoneKey(phone);
  return k ? (map.get(k) ?? null) : null;
}
