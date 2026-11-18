import { apiFetch } from './apiFetch';
import type { StaffActivityItem, StaffActivityKind, StaffActivityRow } from './staffActivity';

async function readError(r: Response, fallback: string): Promise<never> {
  const b = (await r.json().catch(() => ({}))) as { message?: string };
  throw new Error(b.message || fallback);
}

/** งานรายคนต่อวันในช่วง (ภาพรวม · 18 พ.ย. 2569) */
export async function fetchStaffActivity(q: { from: string; to: string; bu: string | null }): Promise<StaffActivityRow[]> {
  const p = new URLSearchParams({ from: q.from, to: q.to });
  if (q.bu) p.set('bu', q.bu);
  const r = await apiFetch(`/api/staff-activity?${p.toString()}`);
  if (!r.ok) return readError(r, 'อ่านงานรายคนไม่ได้');
  return ((await r.json()) as { rows: StaffActivityRow[] }).rows;
}

/** รายการของช่องที่กด · day ว่าง = ทั้งช่วง */
export async function fetchStaffActivityItems(q: { from: string; to: string; bu: string | null; user: string; kind: StaffActivityKind; day: string | null }): Promise<StaffActivityItem[]> {
  const p = new URLSearchParams({ from: q.from, to: q.to, detail: '1', user: q.user, kind: q.kind });
  if (q.bu) p.set('bu', q.bu);
  if (q.day) p.set('day', q.day);
  const r = await apiFetch(`/api/staff-activity?${p.toString()}`);
  if (!r.ok) return readError(r, 'อ่านรายการไม่ได้');
  return ((await r.json()) as { items: StaffActivityItem[] }).items;
}
