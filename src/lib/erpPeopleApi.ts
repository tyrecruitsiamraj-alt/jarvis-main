import { apiFetch } from '@/lib/apiFetch';

/**
 * ค้นชื่อคนจาก ERP (ทะเบียนผู้สมัคร/พนักงาน `hr_recruitment`) — ฟอร์มเพิ่มคนหน้าติดตาม (เจ้าของ 9 ต.ค. 2569)
 * แทน "เลือกชื่อจากบอร์ด" ที่ชื่อเก่า ๆ ไม่ขึ้น · ค้นฝั่ง server (ของมี 100k คน โหลดทั้งหมดมาไม่ได้)
 */
export type ErpPerson = {
  key: string;
  prefix: string | null;
  first_name: string;
  last_name: string | null;
  nick_name: string | null;
  sex_code: string | null;
  mobile: string;
  inform_date: string | null;
  application_date: string | null;
  site_name: string | null;
};

/** พิมพ์อย่างน้อยเท่านี้ถึงค้น */
export const ERP_PEOPLE_MIN_QUERY = 2;

export async function searchErpPeople(q: string, signal?: AbortSignal): Promise<ErpPerson[]> {
  const r = await apiFetch(`/api/matching/board-candidates?picker=erp&q=${encodeURIComponent(q.trim())}`, { signal });
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(data.message || data.error || `ค้นรายชื่อไม่สำเร็จ (HTTP ${r.status})`);
  }
  const data = (await r.json()) as { people?: ErpPerson[] };
  return data.people ?? [];
}

const PREFIXES = ['นางสาว', 'นาย', 'นาง'] as const;

/** คำนำหน้า + ชื่อ + นามสกุล ที่เติมลงฟอร์ม — คำนำหน้าในฟอร์มมีแค่ นาย/นาง/นางสาว · อื่น ๆ เดาจากเพศ */
export function splitErpName(p: ErpPerson): { prefix: string; first: string; last: string } {
  const pre = (p.prefix ?? '').trim();
  let prefix: string = PREFIXES.find((x) => x === pre) ?? '';
  if (!prefix) {
    const sex = (p.sex_code ?? '').trim().toUpperCase();
    prefix = sex === 'M' ? 'นาย' : sex === 'F' ? 'นางสาว' : '';
  }
  return { prefix, first: p.first_name.trim(), last: (p.last_name ?? '').trim() };
}

export function erpPersonDisplayName(p: ErpPerson): string {
  const { prefix, first, last } = splitErpName(p);
  return [prefix + first, last].filter(Boolean).join(' ').trim();
}
