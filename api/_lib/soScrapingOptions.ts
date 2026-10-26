/**
 * ═══ So Scraping options API — บัญชี · กลุ่ม · เครื่อง · บัญชี JobThai/JobBKK (เจ้าของ 26 ต.ค. 2569 "ทำเลย ตามเอกสาร") ═══
 * GET {base_url}/api/integrations/jarvis/options · header `x-api-key` — เรียกจาก server เท่านั้น ไม่ส่ง key ไปหน้าจอ
 * - ดึงใหม่ทุกครั้งที่เปิดฟอร์ม/กดส่ง (เอกสาร: ข้อมูลเปลี่ยนตลอด ห้าม cache)
 * - key ใส่ที่ ตั้งค่า › เชื่อมระบบภายนอก (ตาราง `app_outbound_api_keys` · migration 163 · เข้ารหัสตัวเดียวกับ ai_connections)
 * - ยังไม่ได้ใส่ key = อ่านจากฐานของ So Scraping แบบเดิม (`source: 'db'`) — ทางถอยจนกว่าจะได้ key
 * - ใส่ key แล้วเรียกไม่ได้ (401 / ล่ม) = บอกตรง ๆ ไม่ถอยไปฐานเงียบ ๆ
 */
import { dbQuery, isPgUndefinedTable } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { decryptApiKey, encryptApiKey } from './aiSettingsStore.js';
import { listLinkedSoGroups, listSoAccounts, listSoWorkers } from './soScrapingGroups.js';
import { parseSoOptions, type SoOptions } from '../../src/lib/soScraping.js';

const KEYS = tableInAppSchema('app_outbound_api_keys');
export const SO_OPTIONS_KEY_NAME = 'so-scraping';
export const SO_DEFAULT_BASE_URL = 'https://so-scraping.vercel.app';
export const SO_OPTIONS_PATH = '/api/integrations/jarvis/options';
export const SO_START_PATH = '/api/integrations/jarvis/start';
const TIMEOUT_MS = 10_000;

type KeyRow = { base_url: string; key_enc: string | null; key_hint: string | null; updated_by: string | null; updated_at: Date | string | null };

export class SoOptionsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function loadKeyRow(): Promise<KeyRow | null> {
  try {
    const { rows } = await dbQuery<KeyRow>(`select base_url, key_enc, key_hint, updated_by, updated_at from ${KEYS} where name = $1`, [SO_OPTIONS_KEY_NAME]);
    return rows[0] ?? null;
  } catch (e) {
    if (isPgUndefinedTable(e)) return null; // ยังไม่รัน 163
    throw e;
  }
}

export type SoKeyView = { configured: boolean; hint: string | null; base_url: string; updated_by: string | null; updated_at: string | null };

export async function getSoKeyView(): Promise<SoKeyView> {
  const r = await loadKeyRow();
  return {
    // ถอดไม่ออก (AUTH_JWT_SECRET เปลี่ยน) = ถือว่ายังไม่มี ให้ใส่ใหม่
    configured: Boolean(r?.key_enc && decryptApiKey(r.key_enc)),
    hint: r?.key_hint ?? null,
    base_url: r?.base_url ?? SO_DEFAULT_BASE_URL,
    updated_by: r?.updated_by ?? null,
    updated_at: r?.updated_at ? new Date(r.updated_at).toISOString() : null,
  };
}

/** ตรวจ URL — https เท่านั้น ไม่มี path ต่อท้าย */
export function normalizeSoBaseUrl(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  try {
    const u = new URL(v.trim());
    if (u.protocol !== 'https:' || u.username || u.password) return null;
    return u.origin;
  } catch {
    return null;
  }
}

export const soKeyHint = (key: string) => (key.length <= 8 ? '••••' : `••••${key.slice(-4)}`);

/** บันทึก key/URL — ไม่ส่ง key = คง key เดิม · clear = ลบ key (กลับไปอ่านจากฐานแบบเดิม) */
export async function saveSoKey(input: { key: string | null; baseUrl: string; clear: boolean }, by: string | null): Promise<void> {
  const enc = input.key ? encryptApiKey(input.key) : null;
  const hint = input.key ? soKeyHint(input.key) : null;
  await dbQuery(
    `insert into ${KEYS} (name, base_url, key_enc, key_hint, updated_by, updated_at)
     values ($1, $2, $3, $4, $5, now())
     on conflict (name) do update set
       base_url = excluded.base_url,
       key_enc = case when $6 then null when $3::text is not null then $3 else ${KEYS}.key_enc end,
       key_hint = case when $6 then null when $3::text is not null then $4 else ${KEYS}.key_hint end,
       updated_by = excluded.updated_by, updated_at = now()`,
    [SO_OPTIONS_KEY_NAME, input.baseUrl, enc, hint, by, input.clear],
  );
}

/** เรียก options API ด้วย key/URL ที่ให้มา — ใช้ทั้งตอนใช้งานจริงและปุ่มทดสอบ */
export async function callSoOptions(baseUrl: string, key: string, fetchImpl: typeof fetch = fetch): Promise<SoOptions> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetchImpl(`${baseUrl}${SO_OPTIONS_PATH}`, { headers: { 'x-api-key': key, accept: 'application/json' }, signal: ctrl.signal });
  } catch {
    throw new SoOptionsError('ติดต่อระบบ So Scraping ไม่ได้ ลองใหม่อีกครั้ง', 502);
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401 || res.status === 403) throw new SoOptionsError('key ของ So Scraping ไม่ถูกต้อง — แก้ที่ ตั้งค่า › เชื่อมระบบภายนอก', 502);
  if (!res.ok) throw new SoOptionsError(`ระบบ So Scraping ตอบ ${res.status} ลองใหม่อีกครั้ง`, 502);
  const parsed = parseSoOptions(await res.json().catch(() => null));
  if (!parsed) throw new SoOptionsError('ข้อมูลจากระบบ So Scraping ผิดรูป', 502);
  return parsed;
}

/** ฐานของ So Scraping แบบเดิม (ยังไม่ได้ใส่ key) — สถานะคิดแค่ พัก / ครบโควต้า / พร้อม · ไม่มีบัญชี Scrap */
async function optionsFromDb(): Promise<SoOptions> {
  const [accounts, groups, workers] = await Promise.all([listSoAccounts(), listLinkedSoGroups(), listSoWorkers()]);
  const online = new Map(workers.map((w) => [w.name, w.online]));
  return {
    source: 'db',
    accounts: accounts.map((a) => {
      const paused = Boolean(a.pausedUntil && Date.parse(a.pausedUntil) > Date.now());
      const full = a.dailyCap !== null && a.postedToday >= a.dailyCap;
      return {
        id: a.id,
        name: a.name,
        worker: a.preferredWorker,
        workerOnline: a.preferredWorker ? online.get(a.preferredWorker) === true : false,
        postedToday: a.postedToday,
        dailyCap: a.dailyCap,
        remainingToday: a.dailyCap === null ? null : Math.max(0, a.dailyCap - a.postedToday),
        pausedUntil: a.pausedUntil,
        pauseReason: a.pauseReason,
        queue: { running: 0, queued: 0 },
        status: paused ? 'paused' : full ? 'full' : 'ready',
        warning: null,
        groupIds: a.groupIds,
        sessionWorkers: a.preferredWorker ? [a.preferredWorker] : [],
      };
    }),
    groups: groups.map((g) => ({ id: g.id, fbGroupId: null, name: g.name, url: null, accountIds: [], lastPostedAt: null, stats30d: null })),
    // ฐานเดิมอ่านแค่เครื่องโพสต์ (kind autopost)
    workers: workers.map((w) => ({
      name: w.name,
      online: w.online,
      lastSeen: w.lastSeen,
      load: 0,
      kinds: ['autopost'],
      postQueue: { running: 0, queued: 0 },
      scrapeQueue: { running: 0, queued: 0 },
      fbAccountIds: accounts.filter((a) => a.preferredWorker === w.name).map((a) => a.id),
    })),
    scrapeAccounts: [],
  };
}

/** key + URL ที่ใช้งานได้ — ยังไม่ใส่/ถอดไม่ออก = null */
export async function loadSoKey(): Promise<{ baseUrl: string; key: string } | null> {
  const row = await loadKeyRow();
  const key = decryptApiKey(row?.key_enc ?? null);
  return row && key ? { baseUrl: row.base_url || SO_DEFAULT_BASE_URL, key } : null;
}

export async function fetchSoOptions(): Promise<SoOptions> {
  const k = await loadSoKey();
  if (!k) return optionsFromDb();
  return callSoOptions(k.baseUrl, k.key);
}

/**
 * ผลเรียก start (เอกสารรอบ 3 · 26 ต.ค. 2569) — บันทึกคำขอแล้วเรียกให้ So Scraping เริ่มงานทันที
 * 200 เริ่มแล้ว · 409 เริ่มไปแล้ว (เรียกซ้ำได้) · 422 ข้อมูลไม่ครบ (คำสั่งค้าง แก้แล้วเรียกใหม่) · 404 ไม่พบเลขใบ · 401 key ผิด
 */
export type SoStartResult =
  | { state: 'started'; worker: string | null; preflightQueued: boolean; queued: boolean | null; message: string | null }
  | { state: 'already' }
  | { state: 'error'; message: string }
  | { state: 'skipped' };

export async function callSoStart(baseUrl: string, key: string, requestNo: string, fetchImpl: typeof fetch = fetch): Promise<SoStartResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetchImpl(`${baseUrl}${SO_START_PATH}`, {
      method: 'POST',
      headers: { 'x-api-key': key, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ request_no: requestNo }),
      signal: ctrl.signal,
    });
  } catch {
    return { state: 'error', message: 'ติดต่อระบบ So Scraping ไม่ได้ คำสั่งบันทึกแล้ว กดเริ่มงานอีกครั้งได้' };
  } finally {
    clearTimeout(timer);
  }
  const body = ((await res.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  if (res.status === 200) {
    return {
      state: 'started',
      worker: text(body.worker),
      preflightQueued: body.preflight_queued === true,
      queued: typeof body.queued === 'boolean' ? body.queued : null,
      message: text(body.message),
    };
  }
  if (res.status === 409) return { state: 'already' };
  if (res.status === 422) return { state: 'error', message: text(body.error) ?? 'ข้อมูลไม่ครบ So Scraping เริ่มงานไม่ได้' };
  if (res.status === 404) return { state: 'error', message: `So Scraping ไม่พบใบ ${requestNo}` };
  if (res.status === 401 || res.status === 403) return { state: 'error', message: 'key ของ So Scraping ไม่ถูกต้อง — แก้ที่ ตั้งค่า › เชื่อมระบบภายนอก' };
  return { state: 'error', message: `ระบบ So Scraping ตอบ ${res.status} กดเริ่มงานอีกครั้งได้` };
}

/** เรียก start ด้วย key ที่บันทึกไว้ — ยังไม่ใส่ key = ข้าม (So Scraping หยิบคำขอ pending เองแบบเดิม) */
export async function startSoRequest(requestNo: string | null): Promise<SoStartResult> {
  const k = await loadSoKey();
  if (!k || !requestNo) return { state: 'skipped' };
  return callSoStart(k.baseUrl, k.key, requestNo);
}
