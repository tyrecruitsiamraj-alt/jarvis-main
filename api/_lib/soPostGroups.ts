/**
 * ═══ เรียกตารางโพสต์รายกลุ่มจาก So Scraping (เจ้าของ 11 พ.ย. 2569 · ข้อ 13 ของ JARVIS_OPTIONS_PROMPT.md) ═══
 * ใช้ key เดิม (`loadSoKey` แบบ `fetchSoStatusOf`) · key ไม่ออกไปหน้าจอ · เรียกไม่ได้ = โยนข้อความไทยที่บอกเหตุ
 */
import { loadSoKey } from './soScrapingOptions.js';
import { parseSoPostGroups, SO_POST_GROUPS_PAGE_SIZE, type SoPostGroupRow, type SoPostGroupStatus, type SoPostGroups } from '../../src/lib/soPostGroups.js';

export const SO_POST_GROUPS_PATH = '/api/integrations/jarvis/post-groups';
const TIMEOUT_MS = 15_000;

export class SoPostGroupsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export type SoPostGroupsQuery = { from: string; to: string; bu: string | null; page: number; pageSize?: number };

export async function callSoPostGroups(
  baseUrl: string,
  key: string,
  q: SoPostGroupsQuery,
  fetchImpl: typeof fetch = fetch,
): Promise<SoPostGroups> {
  const params = new URLSearchParams({ from: q.from, to: q.to, page: String(q.page), page_size: String(q.pageSize ?? SO_POST_GROUPS_PAGE_SIZE) });
  if (q.bu) params.set('bu', q.bu);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetchImpl(`${baseUrl}${SO_POST_GROUPS_PATH}?${params.toString()}`, {
      headers: { 'x-api-key': key, accept: 'application/json' },
      signal: ctrl.signal,
    });
  } catch {
    throw new SoPostGroupsError(`ติดต่อ So Scraping ไม่ได้ (${baseUrl})`, 502);
  } finally {
    clearTimeout(timer);
  }
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.status === 401 || res.status === 403) {
    throw new SoPostGroupsError('key ของ So Scraping ไม่ถูกต้อง — แก้ที่ ตั้งค่า › เชื่อมระบบภายนอก', 502);
  }
  if (!res.ok || !body) {
    const why = typeof body?.error === 'string' && body.error.trim() ? body.error.trim() : `So Scraping ตอบ ${res.status}`;
    throw new SoPostGroupsError(why, 502);
  }
  return parseSoPostGroups(body);
}

/** ใช้ key ที่บันทึกไว้ — ยังไม่ใส่ key = บอกตรง ๆ (การ์ดยังอยู่ ขึ้นเหตุ) */
export async function fetchSoPostGroups(q: SoPostGroupsQuery, fetchImpl: typeof fetch = fetch): Promise<SoPostGroups> {
  const k = await loadSoKey();
  if (!k) throw new SoPostGroupsError('ยังไม่ได้ใส่ key ของ So Scraping — ตั้งค่า › เชื่อมระบบภายนอก', 503);
  return callSoPostGroups(k.baseUrl, k.key, q, fetchImpl);
}

/**
 * ทุกแถวของช่วง (ไล่ทีละ 200 แถว · สูงสุด 50 หน้า) — ใช้ทำ "กดช่องสถานะแล้วดูเหตุ" กับ "ยอดต่อใบบนการ์ดโพสต์ประกาศ"
 * (เจ้าของ 12 พ.ย. 2569) · เก็บไว้ 3 นาทีต่อช่วง/BU (So Scraping คำนวณใหม่ทั้งช่วงทุกครั้งที่เรียก)
 */
const ALL_TTL_MS = 3 * 60_000;
const SO_MAX_PAGE_SIZE = 200;
const allCache = new Map<string, { at: number; p: Promise<{ statuses: SoPostGroupStatus[]; reasonGroups: SoPostGroupStatus[]; rows: SoPostGroupRow[] }> }>();

export async function fetchAllSoPostGroupRows(
  q: { from: string; to: string; bu: string | null },
  fetchImpl: typeof fetch = fetch,
): Promise<{ statuses: SoPostGroupStatus[]; reasonGroups: SoPostGroupStatus[]; rows: SoPostGroupRow[] }> {
  const key = `${q.from}|${q.to}|${q.bu ?? ''}`;
  const hit = allCache.get(key);
  if (hit && Date.now() - hit.at < ALL_TTL_MS) return hit.p;
  const p = (async () => {
    const k = await loadSoKey();
    if (!k) throw new SoPostGroupsError('ยังไม่ได้ใส่ key ของ So Scraping — ตั้งค่า › เชื่อมระบบภายนอก', 503);
    const first = await callSoPostGroups(k.baseUrl, k.key, { ...q, page: 1, pageSize: SO_MAX_PAGE_SIZE }, fetchImpl);
    // หน้าที่เหลือดึงพร้อมกัน (ทีละหน้ารอ ~15 วิ ตอนตรวจ 12 พ.ย. 2569)
    const rest = await Promise.all(
      Array.from({ length: Math.min(first.pages, 50) - 1 }, (_, i) => callSoPostGroups(k.baseUrl, k.key, { ...q, page: i + 2, pageSize: SO_MAX_PAGE_SIZE }, fetchImpl)),
    );
    return { statuses: first.statuses, reasonGroups: first.reasonGroups, rows: [...first.rows, ...rest.flatMap((r) => r.rows)] };
  })();
  allCache.set(key, { at: Date.now(), p });
  p.catch(() => allCache.delete(key));
  return p;
}
