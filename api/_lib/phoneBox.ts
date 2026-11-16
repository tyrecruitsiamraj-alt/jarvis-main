/**
 * ═══ phone-box — มือถือโพสต์กลุ่ม Facebook (เจ้าของ 16 พ.ย. 2569 "ฉันจะใส่กุญแจให้ ถ้าใส่แล้วนายเช็คได้ไหม") ═══
 * https://phone-box.sosiamraj.com · header `Authorization: Bearer <key>` · เรียกจาก server เท่านั้น ไม่ส่ง key ไปหน้าจอ
 * - key + URL ใส่ที่ ตั้งค่า › เชื่อมระบบภายนอก (ตาราง `app_outbound_api_keys` เข้ารหัสตัวเดียวกับ So Scraping)
 * - เฟสนี้ "อ่านอย่างเดียว": health · devices · accounts · กลุ่มของแต่ละบัญชี — ยังไม่สั่งโพสต์ (POST /v1/posts)
 *   ย้าย Autopost 5 บัญชีมาที่นี่เป็นงานถัดไป (เจ้าของ: "5 เครื่อง ย้ายแค่ 5 Account ไปก่อน ที่เหลือทำแบบเดิม")
 */
import { dbQuery, isPgUndefinedTable } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { decryptApiKey, encryptApiKey } from './aiSettingsStore.js';

const KEYS = tableInAppSchema('app_outbound_api_keys');
export const PHONE_BOX_KEY_NAME = 'phone-box';
export const PHONE_BOX_DEFAULT_BASE_URL = 'https://phone-box.sosiamraj.com';
const TIMEOUT_MS = 10_000;

type KeyRow = { base_url: string; key_enc: string | null; key_hint: string | null; updated_by: string | null; updated_at: Date | string | null };

export class PhoneBoxError extends Error {
  constructor(message: string) {
    super(message);
  }
}

async function loadRow(): Promise<KeyRow | null> {
  try {
    const { rows } = await dbQuery<KeyRow>(`select base_url, key_enc, key_hint, updated_by, updated_at from ${KEYS} where name = $1`, [PHONE_BOX_KEY_NAME]);
    return rows[0] ?? null;
  } catch (e) {
    if (isPgUndefinedTable(e)) return null;
    throw e;
  }
}

export type PhoneBoxKeyView = { configured: boolean; hint: string | null; base_url: string; updated_by: string | null; updated_at: string | null };

export async function getPhoneBoxKeyView(): Promise<PhoneBoxKeyView> {
  const r = await loadRow();
  return {
    configured: Boolean(r?.key_enc && decryptApiKey(r.key_enc)),
    hint: r?.key_hint ?? null,
    base_url: r?.base_url ?? PHONE_BOX_DEFAULT_BASE_URL,
    updated_by: r?.updated_by ?? null,
    updated_at: r?.updated_at ? new Date(r.updated_at).toISOString() : null,
  };
}

/** key ที่บันทึกไว้ (ถอดแล้ว) · ไม่มี = null */
export async function savedPhoneBoxKey(): Promise<string | null> {
  return decryptApiKey((await loadRow())?.key_enc ?? null);
}

/** บันทึก key/URL — ไม่ส่ง key = คงตัวเดิม · clear = ลบ */
export async function savePhoneBoxKey(input: { key: string | null; baseUrl: string; clear: boolean }, by: string | null): Promise<void> {
  const enc = input.key ? encryptApiKey(input.key) : null;
  const hint = input.key ? (input.key.length <= 8 ? '••••' : `••••${input.key.slice(-4)}`) : null;
  await dbQuery(
    `insert into ${KEYS} (name, base_url, key_enc, key_hint, updated_by, updated_at)
     values ($1, $2, $3, $4, $5, now())
     on conflict (name) do update set
       base_url = excluded.base_url,
       key_enc = case when $6 then null when $3::text is not null then $3 else ${KEYS}.key_enc end,
       key_hint = case when $6 then null when $3::text is not null then $4 else ${KEYS}.key_hint end,
       updated_by = excluded.updated_by, updated_at = now()`,
    [PHONE_BOX_KEY_NAME, input.baseUrl, enc, hint, by, input.clear],
  );
}

export type PhoneBoxDevice = {
  serial: string;
  accountId: string | null;
  accountName: string | null;
  online: boolean;
  adbState: string;
  facebookOpen: boolean | null;
  groups: number | null;
  groupsMapped: number | null;
};
export type PhoneBoxStatus = { ok: true; status: string; onlineDevices: number; devices: PhoneBoxDevice[] } | { ok: false; message: string };

type RawDevice = {
  serial?: unknown;
  account_id?: unknown;
  account_name?: unknown;
  adb_state?: unknown;
  device_online?: unknown;
  facebook_foreground?: unknown;
};

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** อุปกรณ์จาก /v1/devices → แถวบนจอ (ยังไม่มีกลุ่ม) */
export function devicesOf(body: unknown): PhoneBoxDevice[] {
  const list = (body as { devices?: unknown } | null)?.devices;
  if (!Array.isArray(list)) return [];
  return (list as RawDevice[]).map((d) => ({
    serial: str(d.serial) ?? '—',
    accountId: str(d.account_id),
    accountName: str(d.account_name),
    online: d.device_online === true,
    adbState: str(d.adb_state) ?? '—',
    facebookOpen: typeof d.facebook_foreground === 'boolean' ? d.facebook_foreground : null,
    groups: null,
    groupsMapped: null,
  }));
}

async function getJson(baseUrl: string, path: string, key: string, fetchImpl: typeof fetch): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetchImpl(`${baseUrl}${path}`, { headers: { authorization: `Bearer ${key}`, accept: 'application/json' }, signal: ctrl.signal });
  } catch {
    throw new PhoneBoxError('ติดต่อ phone-box ไม่ได้ ลองใหม่อีกครั้ง');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401 || res.status === 403) throw new PhoneBoxError('กุญแจ phone-box ไม่ถูกต้อง');
  if (res.status === 503) throw new PhoneBoxError('phone-box ตอบว่าเครื่องหลักยังไม่พร้อม (503)');
  if (!res.ok) throw new PhoneBoxError(`phone-box ตอบ ${res.status} ลองใหม่อีกครั้ง`);
  return res.json().catch(() => null);
}

/** อ่านสถานะทั้งหมด (GET อย่างเดียว) — เครื่อง · บัญชีที่ผูก · จำนวนกลุ่มของแต่ละบัญชี */
export async function readPhoneBoxStatus(baseUrl: string, key: string, fetchImpl: typeof fetch = fetch): Promise<PhoneBoxStatus> {
  try {
    const health = (await getJson(baseUrl, '/v1/health', key, fetchImpl)) as { status?: unknown; online_devices?: unknown } | null;
    const devices = devicesOf(await getJson(baseUrl, '/v1/devices', key, fetchImpl));
    for (const d of devices) {
      if (!d.accountId) continue;
      const g = (await getJson(baseUrl, `/v1/accounts/${encodeURIComponent(d.accountId)}/groups`, key, fetchImpl)) as { groups?: unknown } | null;
      const groups = Array.isArray(g?.groups) ? (g.groups as Array<{ destination_mapped?: unknown }>) : [];
      d.groups = groups.length;
      d.groupsMapped = groups.filter((x) => x?.destination_mapped === true).length;
    }
    return {
      ok: true,
      status: str(health?.status) ?? '—',
      onlineDevices: typeof health?.online_devices === 'number' ? health.online_devices : devices.filter((d) => d.online).length,
      devices,
    };
  } catch (e) {
    if (e instanceof PhoneBoxError) return { ok: false, message: e.message };
    throw e;
  }
}
