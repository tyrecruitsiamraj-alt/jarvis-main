/**
 * ═══ LINE Bot So Work — รู้ว่าผู้สมัครคนไหนส่งใบสมัครสำเร็จ (ทีมบอท 28 ต.ค. 2569 · เจ้าของ Choice "ทำข้อ 1–2") ═══
 *
 * ① บอทส่งลิงก์ `/apply?job=…&lid=<LINE userId>&lsig=<HMAC-SHA256(lid) hex>` · หน้าสมัครส่ง lid/lsig มากับใบ
 *    ฝั่ง API ตรวจลายเซ็นด้วย secret ร่วม — ตรง = เก็บ `line_user_id` + `referral_source = 'line_oa'` · ไม่ตรง = ไม่เก็บ (ใบยังบันทึกปกติ)
 * ② ส่งใบสำเร็จ → POST {base_url}/jarvis/application · header `x-jarvis-signature` = HMAC-SHA256(body ทั้งก้อน) hex
 *    body `{ event: 'application.created', application_id, line_user_id, request_no, created_at (+07:00) }`
 *    ส่งเฉพาะใบที่มี line_user_id · ไม่ส่งชื่อ/เบอร์/ที่อยู่ · ส่งไม่สำเร็จ = จด log ไม่ทำใบสมัครล้ม
 * secret + URL ใส่ที่ ตั้งค่า › เชื่อมระบบภายนอก (ตาราง `app_outbound_api_keys` เข้ารหัสตัวเดียวกับ So Scraping)
 * ยังไม่ใส่ secret = ไม่ตรวจ ไม่เก็บ ไม่ส่งอะไรออกไป
 * ③ (เฟสถัดไป · ยังไม่ทำ) application.status_changed
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { dbQuery, isPgUndefinedTable } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { decryptApiKey, encryptApiKey } from './aiSettingsStore.js';
import { logError, logInfo, logWarn } from './logger.js';

const KEYS = tableInAppSchema('app_outbound_api_keys');
export const LINE_BOT_KEY_NAME = 'line-bot-sowork';
export const LINE_BOT_DEFAULT_BASE_URL = 'https://bot-lbd.tyrecruitsiamraj.workers.dev';
export const LINE_BOT_APPLICATION_PATH = '/jarvis/application';
const TIMEOUT_MS = 8_000;
const CACHE_MS = 60_000;

/** LINE userId = U + 32 ตัวอักษร hex */
export const LINE_USER_ID = /^U[0-9a-f]{32}$/;

type KeyRow = { base_url: string; key_enc: string | null; key_hint: string | null; updated_by: string | null; updated_at: Date | string | null };

async function loadRow(): Promise<KeyRow | null> {
  try {
    const { rows } = await dbQuery<KeyRow>(`select base_url, key_enc, key_hint, updated_by, updated_at from ${KEYS} where name = $1`, [LINE_BOT_KEY_NAME]);
    return rows[0] ?? null;
  } catch (e) {
    if (isPgUndefinedTable(e)) return null;
    throw e;
  }
}

let cache: { at: number; value: { secret: string; baseUrl: string } | null } | null = null;

/** secret + URL ที่ใช้งาน · ยังไม่ตั้ง/ถอดไม่ออก = null */
export async function getLineBotConfig(): Promise<{ secret: string; baseUrl: string } | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const r = await loadRow();
  const secret = decryptApiKey(r?.key_enc ?? null);
  const value = secret ? { secret, baseUrl: r?.base_url || LINE_BOT_DEFAULT_BASE_URL } : null;
  cache = { at: Date.now(), value };
  return value;
}

export type LineBotKeyView = { configured: boolean; hint: string | null; base_url: string; updated_by: string | null; updated_at: string | null };

export async function getLineBotKeyView(): Promise<LineBotKeyView> {
  const r = await loadRow();
  return {
    configured: Boolean(r?.key_enc && decryptApiKey(r.key_enc)),
    hint: r?.key_hint ?? null,
    base_url: r?.base_url ?? LINE_BOT_DEFAULT_BASE_URL,
    updated_by: r?.updated_by ?? null,
    updated_at: r?.updated_at ? new Date(r.updated_at).toISOString() : null,
  };
}

/** บันทึก secret/URL — ไม่ส่ง secret = คงตัวเดิม · clear = ลบ (หยุดตรวจ/หยุดส่ง) */
export async function saveLineBotKey(input: { secret: string | null; baseUrl: string; clear: boolean }, by: string | null): Promise<void> {
  const enc = input.secret ? encryptApiKey(input.secret) : null;
  const hint = input.secret ? (input.secret.length <= 8 ? '••••' : `••••${input.secret.slice(-4)}`) : null;
  await dbQuery(
    `insert into ${KEYS} (name, base_url, key_enc, key_hint, updated_by, updated_at)
     values ($1, $2, $3, $4, $5, now())
     on conflict (name) do update set
       base_url = excluded.base_url,
       key_enc = case when $6 then null when $3::text is not null then $3 else ${KEYS}.key_enc end,
       key_hint = case when $6 then null when $3::text is not null then $4 else ${KEYS}.key_hint end,
       updated_by = excluded.updated_by, updated_at = now()`,
    [LINE_BOT_KEY_NAME, input.baseUrl, enc, hint, by, input.clear],
  );
  cache = null;
}

export const hmacHex = (secret: string, data: string) => createHmac('sha256', secret).update(data, 'utf8').digest('hex');

/** ตรวจ lsig ของ lid — ตรงเท่านั้นถึงคืน lid · รูปผิด/ไม่ตรง = null */
export function verifyLineUser(lid: unknown, lsig: unknown, secret: string): string | null {
  if (typeof lid !== 'string' || typeof lsig !== 'string') return null;
  const id = lid.trim();
  const sig = lsig.trim().toLowerCase();
  if (!LINE_USER_ID.test(id) || !/^[0-9a-f]{64}$/.test(sig)) return null;
  const want = Buffer.from(hmacHex(secret, id), 'hex');
  const got = Buffer.from(sig, 'hex');
  return want.length === got.length && timingSafeEqual(want, got) ? id : null;
}

/** เวลาไทยแบบมี offset — "2026-10-28T10:15:00+07:00" */
export function bangkokIso(d: Date): string {
  const t = new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 19);
  return `${t}+07:00`;
}

/** เลขใบขอจาก job_id ของเรา (`siamraj-sql:OPL6909077` → OPL6909077) */
export const requestNoOfJobId = (jobId: string | null | undefined): string | null => {
  const t = (jobId ?? '').trim();
  if (!t) return null;
  return t.replace(/^siamraj-(sql|pre):/, '') || null;
};

export function applicationCreatedBody(input: { applicationId: string; lineUserId: string; jobId: string | null; createdAt: Date }): string {
  return JSON.stringify({
    event: 'application.created',
    application_id: input.applicationId,
    line_user_id: input.lineUserId,
    request_no: requestNoOfJobId(input.jobId),
    created_at: bangkokIso(input.createdAt),
  });
}

/** แจ้งบอทว่าส่งใบสำเร็จ — ไม่โยน error (ใบสมัครบันทึกไปแล้ว) */
export async function notifyLineBotApplicationCreated(
  input: { applicationId: string; lineUserId: string; jobId: string | null; createdAt: Date },
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  try {
    const cfg = await getLineBotConfig();
    if (!cfg) return;
    const body = applicationCreatedBody(input);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetchImpl(`${cfg.baseUrl}${LINE_BOT_APPLICATION_PATH}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-jarvis-signature': hmacHex(cfg.secret, body) },
        body,
        signal: ctrl.signal,
      });
      if (res.ok) logInfo('lineBot.application.sent', { applicationId: input.applicationId, status: res.status });
      else logWarn('lineBot.application.rejected', { applicationId: input.applicationId, status: res.status });
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    logError('lineBot.application.failed', e, { applicationId: input.applicationId });
  }
}
