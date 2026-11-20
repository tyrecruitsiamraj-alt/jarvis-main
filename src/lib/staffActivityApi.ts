import { apiFetch } from './apiFetch';
import type { StaffActivityFeedItem, StaffActivityItem, StaffActivityKind, StaffActivityRow, StaffPersonDay } from './staffActivity';

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

/** งานของคนเดียววันเดียว เทียบวันก่อน + 7 วัน (from–to) · null = คนนอก BU ที่เห็น (แท็บงานรายคน 20 พ.ย. 2569) */
export async function fetchStaffPersonDay(q: { from: string; to: string; day: string; user: string; bu: string | null }): Promise<StaffPersonDay | null> {
  const p = new URLSearchParams({ from: q.from, to: q.to, person: '1', user: q.user, day: q.day });
  if (q.bu) p.set('bu', q.bu);
  const r = await apiFetch(`/api/staff-activity?${p.toString()}`);
  if (!r.ok) return readError(r, 'อ่านงานรายคนไม่ได้');
  return ((await r.json()) as { person: StaffPersonDay | null }).person;
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

/** ความเคลื่อนไหวล่าสุด 30 รายการในช่วง */
export async function fetchStaffActivityFeed(q: { from: string; to: string; bu: string | null }): Promise<StaffActivityFeedItem[]> {
  const p = new URLSearchParams({ from: q.from, to: q.to, feed: '1' });
  if (q.bu) p.set('bu', q.bu);
  const r = await apiFetch(`/api/staff-activity?${p.toString()}`);
  if (!r.ok) return readError(r, 'อ่านความเคลื่อนไหวไม่ได้');
  return ((await r.json()) as { items: StaffActivityFeedItem[] }).items;
}
