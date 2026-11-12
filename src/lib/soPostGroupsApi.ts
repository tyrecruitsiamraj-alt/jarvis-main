import { apiFetch } from './apiFetch';
import type { SoPostGroups, SoPostGroupsFiltered, SoPostSummary } from './soPostGroups';

async function readError(r: Response): Promise<never> {
  const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
  throw new Error(data.message || `So Scraping ตอบ ${r.status}`);
}

/**
 * การ์ด "5. โพสต์ลงกลุ่ม Facebook" — ช่วง/BU ตามภาพรวม · bu null = ทุก BU · `status` = กดช่องสถานะ (ได้เหตุจัดกลุ่มมาด้วย)
 * พังโยนข้อความไทยจาก server (บอกเหตุ) · server แปลงแล้ว (`parseSoPostGroups`) — ห้ามแปลงซ้ำ
 */
export async function fetchSoPostGroups(q: { from: string; to: string; bu: string | null; page: number; status?: string | null }): Promise<SoPostGroups & Partial<Pick<SoPostGroupsFiltered, 'status' | 'filteredTotal' | 'reasons'>>> {
  const p = new URLSearchParams({ from: q.from, to: q.to, page: String(q.page) });
  if (q.bu) p.set('bu', q.bu);
  if (q.status) p.set('status', q.status);
  const r = await apiFetch(`/api/so-post-groups?${p.toString()}`);
  if (!r.ok) return readError(r);
  return (await r.json()) as SoPostGroups;
}

/** ยอดต่อเลขใบขอ (การ์ดหน้าโพสต์ประกาศ) */
export async function fetchSoPostSummary(): Promise<SoPostSummary> {
  const r = await apiFetch('/api/so-post-summary');
  if (!r.ok) return readError(r);
  return (await r.json()) as SoPostSummary;
}
