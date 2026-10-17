/**
 * ที่เก็บการตั้งค่า AI (migration 150) — การเชื่อมต่อ + งานไหนใช้ตัวไหน
 *
 * - อ่านจากฐานแล้วจำไว้ 30 วิ (ทุกสายแมทเรียก `resolveAiTarget` · ไม่ยิงฐานทุกครั้ง) · บันทึกแล้วล้างทันที
 * - ไม่มีตาราง (ยังไม่รัน 150) / ไม่มีแถว / การเชื่อมต่อถูกลบ = ถอยไป Ollama จากไฟล์ตั้งค่าเซิร์ฟเวอร์แบบเดิม
 * - API key เข้ารหัส AES-256-GCM ด้วยกุญแจที่ได้จาก `AUTH_JWT_SECRET` (ไม่ต้องตั้ง env ใหม่บนเซิร์ฟเวอร์)
 *   ⚠️ เปลี่ยน AUTH_JWT_SECRET = ถอด key เดิมไม่ออก ⇒ หน้าจอขึ้นให้ใส่ key ใหม่ (ไม่ล้มทั้งระบบ)
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { dbQuery, isPgUndefinedTable } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { getOllamaConfig } from './ollamaClient.js';
import { logError } from './logger.js';
import {
  aiKeyHint,
  isAiProviderKind,
  isAiTask,
  type AiConnectionInput,
  type AiConnectionView,
  type AiProviderKind,
  type AiSettingsView,
  type AiTask,
  type AiTaskRouteView,
} from '../../src/lib/aiSettings.js';

const connTable = tableInAppSchema('ai_connections');
const routeTable = tableInAppSchema('ai_task_routes');

type ConnRow = {
  id: string;
  name: string;
  kind: string;
  base_url: string;
  model: string;
  api_key_enc: string | null;
  api_key_hint: string | null;
  updated_by: string | null;
  updated_at: string | Date | null;
};
type RouteRow = { task: string; connection_id: string | null; model: string | null; updated_by: string | null; updated_at: string | Date | null };

/** เป้าหมายที่ตัวเรียก AI ใช้จริง — มี key ที่ถอดแล้ว (อยู่ฝั่งเซิร์ฟเวอร์เท่านั้น) */
export type AiTarget = {
  kind: AiProviderKind;
  baseUrl: string;
  model: string;
  apiKey: string | null;
  /** ชื่อที่ใช้ใน log/จอ — "Ollama ของระบบ" หรือชื่อการเชื่อมต่อ */
  source: string;
};

// ─── เข้ารหัส key ─────────────────────────────────────────────────────────────
function cipherKey(): Buffer {
  const secret = (process.env.AUTH_JWT_SECRET || '').trim();
  if (!secret) throw new Error('AUTH_JWT_SECRET is not configured');
  return createHash('sha256').update(`${secret}:ai-settings:v1`).digest();
}

export function encryptApiKey(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', cipherKey(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
}

/** ถอดไม่ออก (กุญแจเปลี่ยน/ข้อมูลเสีย) = null — ผู้เรียกถือว่า "ยังไม่มี key" */
export function decryptApiKey(stored: string | null): string | null {
  if (!stored) return null;
  try {
    const [v, iv, tag, enc] = stored.split(':');
    if (v !== 'v1' || !iv || !tag || !enc) return null;
    const d = createDecipheriv('aes-256-gcm', cipherKey(), Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(enc, 'base64')), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// ─── อ่าน + จำไว้ ────────────────────────────────────────────────────────────
type Loaded = { conns: ConnRow[]; routes: RouteRow[]; at: number };
let cache: Loaded | null = null;
const TTL_MS = 30_000;

const iso = (v: string | Date | null) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));

async function loadRaw(): Promise<Loaded> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  try {
    const [c, r] = await Promise.all([
      dbQuery<ConnRow>(`select * from ${connTable} order by created_at`),
      dbQuery<RouteRow>(`select * from ${routeTable}`),
    ]);
    cache = { conns: c.rows, routes: r.rows, at: Date.now() };
  } catch (e) {
    // ยังไม่รัน 150 = ทำงานแบบเดิม (Ollama จากไฟล์ตั้งค่า) · ล้มแบบอื่นก็ถอยแบบเดียวกัน ไม่ให้งานแมทล้มตาม
    if (!isPgUndefinedTable(e)) logError('ai-settings.load.fail', { message: e instanceof Error ? e.message : String(e) });
    cache = { conns: [], routes: [], at: Date.now() };
  }
  return cache;
}

export function invalidateAiSettings(): void {
  cache = null;
}

function envTarget(): AiTarget | null {
  const cfg = getOllamaConfig();
  return cfg ? { kind: 'ollama', baseUrl: cfg.baseUrl, model: cfg.model, apiKey: null, source: 'Ollama ของระบบ' } : null;
}

function toTarget(c: ConnRow, model: string | null): AiTarget | null {
  if (!isAiProviderKind(c.kind)) return null;
  return {
    kind: c.kind,
    baseUrl: c.base_url.replace(/\/+$/, ''),
    model: (model || c.model || '').trim(),
    apiKey: decryptApiKey(c.api_key_enc),
    source: c.name,
  };
}

/** AI ที่งานนี้ต้องใช้ — ไม่ได้ตั้ง/ตั้งไว้แต่การเชื่อมต่อหาย = Ollama จากไฟล์ตั้งค่า · ไม่มีอะไรเลย = null */
export async function resolveAiTarget(task: AiTask): Promise<AiTarget | null> {
  const { conns, routes } = await loadRaw();
  const route = routes.find((r) => r.task === task);
  if (route?.connection_id) {
    const c = conns.find((x) => x.id === route.connection_id);
    const t = c ? toTarget(c, route.model) : null;
    if (t && t.model) return t;
  }
  return envTarget();
}

/** ใช้กับการเชื่อมต่อที่ยังไม่บันทึก (ปุ่มทดสอบ) หรือที่บันทึกแล้ว */
export async function targetForConnection(id: string, model?: string | null): Promise<AiTarget | null> {
  const { conns } = await loadRaw();
  const c = conns.find((x) => x.id === id);
  return c ? toTarget(c, model ?? null) : null;
}

export async function getAiSettingsView(): Promise<AiSettingsView> {
  invalidateAiSettings();
  const { conns, routes } = await loadRaw();
  const env = getOllamaConfig();
  const connections: AiConnectionView[] = conns
    .filter((c) => isAiProviderKind(c.kind))
    .map((c) => ({
      id: c.id,
      name: c.name,
      kind: c.kind as AiProviderKind,
      base_url: c.base_url,
      model: c.model,
      // ถอดไม่ออก = ถือว่ายังไม่มี key ให้คนใส่ใหม่
      has_key: Boolean(c.api_key_enc && decryptApiKey(c.api_key_enc)),
      key_hint: c.api_key_hint,
      updated_by: c.updated_by,
      updated_at: iso(c.updated_at),
    }));
  const routeViews: AiTaskRouteView[] = routes
    .filter((r) => isAiTask(r.task))
    .map((r) => ({ task: r.task as AiTask, connection_id: r.connection_id, model: r.model, updated_by: r.updated_by, updated_at: iso(r.updated_at) }));
  return { connections, routes: routeViews, env_default: env ? { base_url: env.baseUrl, model: env.model } : null };
}

// ─── เขียน ───────────────────────────────────────────────────────────────────
export async function saveAiConnection(input: AiConnectionInput, by: string | null): Promise<string> {
  const enc = input.api_key ? encryptApiKey(input.api_key) : null;
  const hint = input.api_key ? aiKeyHint(input.api_key) : null;
  let id = input.id;
  if (id) {
    const { rows } = await dbQuery<{ id: string }>(
      `update ${connTable} set name = $2, kind = $3, base_url = $4, model = $5,
         api_key_enc = case when $8 then null when $6::text is not null then $6 else api_key_enc end,
         api_key_hint = case when $8 then null when $6::text is not null then $7 else api_key_hint end,
         updated_by = $9, updated_at = now()
       where id = $1 returning id`,
      [id, input.name, input.kind, input.base_url, input.model, enc, hint, input.clear_key === true, by],
    );
    if (!rows[0]) throw Object.assign(new Error('ไม่พบการเชื่อมต่อนี้'), { status: 404 });
  } else {
    const { rows } = await dbQuery<{ id: string }>(
      `insert into ${connTable} (name, kind, base_url, model, api_key_enc, api_key_hint, updated_by)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [input.name, input.kind, input.base_url, input.model, enc, hint, by],
    );
    id = rows[0].id;
  }
  invalidateAiSettings();
  return id!;
}

export async function deleteAiConnection(id: string): Promise<boolean> {
  const { rows } = await dbQuery<{ id: string }>(`delete from ${connTable} where id = $1 returning id`, [id]);
  invalidateAiSettings();
  return rows.length > 0;
}

export async function saveAiRoutes(
  routes: Array<{ task: AiTask; connection_id: string | null; model: string | null }>,
  by: string | null,
): Promise<void> {
  for (const r of routes) {
    await dbQuery(
      `insert into ${routeTable} (task, connection_id, model, updated_by, updated_at)
       values ($1, $2, $3, $4, now())
       on conflict (task) do update set connection_id = excluded.connection_id, model = excluded.model,
         updated_by = excluded.updated_by, updated_at = now()`,
      [r.task, r.connection_id, r.model, by],
    );
  }
  invalidateAiSettings();
}
