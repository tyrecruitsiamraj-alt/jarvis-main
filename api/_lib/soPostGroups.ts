/**
 * ═══ เรียกตารางโพสต์รายกลุ่มจาก So Scraping (เจ้าของ 11 พ.ย. 2569 · ข้อ 13 ของ JARVIS_OPTIONS_PROMPT.md) ═══
 * ใช้ key เดิม (`loadSoKey` แบบ `fetchSoStatusOf`) · key ไม่ออกไปหน้าจอ · เรียกไม่ได้ = โยนข้อความไทยที่บอกเหตุ
 */
import { loadSoKey } from './soScrapingOptions.js';
import { parseSoPostGroups, SO_POST_GROUPS_PAGE_SIZE, type SoPostGroups } from '../../src/lib/soPostGroups.js';

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

export type SoPostGroupsQuery = { from: string; to: string; bu: string | null; page: number };

export async function callSoPostGroups(
  baseUrl: string,
  key: string,
  q: SoPostGroupsQuery,
  fetchImpl: typeof fetch = fetch,
): Promise<SoPostGroups> {
  const params = new URLSearchParams({ from: q.from, to: q.to, page: String(q.page), page_size: String(SO_POST_GROUPS_PAGE_SIZE) });
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
