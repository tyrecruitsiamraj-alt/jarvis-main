import { apiFetch } from './apiFetch';
import type { SoPostGroups } from './soPostGroups';

/** การ์ด "5. โพสต์ลงกลุ่ม Facebook" — ช่วง/BU ตามภาพรวม · bu null = ทุก BU · พังโยนข้อความไทยจาก server (บอกเหตุ) */
export async function fetchSoPostGroups(q: { from: string; to: string; bu: string | null; page: number }): Promise<SoPostGroups> {
  const p = new URLSearchParams({ from: q.from, to: q.to, page: String(q.page) });
  if (q.bu) p.set('bu', q.bu);
  const r = await apiFetch(`/api/so-post-groups?${p.toString()}`);
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(data.message || `So Scraping ตอบ ${r.status}`);
  }
  // server แปลงแล้ว (`parseSoPostGroups`) — ห้ามแปลงซ้ำ (ชื่อช่องเปลี่ยนเป็นแบบ camelCase แล้ว)
  return (await r.json()) as SoPostGroups;
}
