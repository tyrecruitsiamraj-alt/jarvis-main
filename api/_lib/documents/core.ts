/**
 * ส่งเอกสารผ่าน LINE — ของกลางฝั่งเซิร์ฟเวอร์ (เจ้าของ 22 พ.ย. 2569)
 * รหัสลิงก์/รหัส session · เข้ารหัสข้อมูลในชุดและภาพ · ค่าที่ตั้งจากหน้าจอ · จดเหตุการณ์
 *
 * 🔴 ห้ามพิมพ์ลง log: รหัสลิงก์ของผู้สมัคร · รหัส session · ID token ของ LINE · ภาพเอกสาร · ข้อมูลในชุด
 * 🔴 กุญแจเข้ารหัสมาจาก AUTH_JWT_SECRET (แบบเดียวกับเลขบัตรของแบบทดสอบ `piiCipher.ts`) — เปลี่ยนค่านี้แล้วเอกสารเดิมเปิดไม่ได้
 *    จนกว่าจะใส่ค่าเดิมไว้ที่ DOCUMENT_KEY_FALLBACK_SECRETS (คั่นด้วย ,) · ทุกแถวจด key_id ไว้ให้รู้ว่าเข้ารหัสด้วยกุญแจไหน
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';
import { dbQuery, isPgUndefinedTable } from '../postgres.js';
import { tableInAppSchema } from '../schema.js';
import { isProductionRuntime } from '../runtime.js';
import { DOC_IDS, type DocId } from '../../../src/lib/documents/documentTypes.js';

export const T = {
  settings: tableInAppSchema('document_settings'),
  templates: tableInAppSchema('document_templates'),
  templatePages: tableInAppSchema('document_template_pages'),
  invitations: tableInAppSchema('document_invitations'),
  events: tableInAppSchema('document_events'),
  sessions: tableInAppSchema('document_sessions'),
  files: tableInAppSchema('document_files'),
  blobs: tableInAppSchema('document_file_blobs'),
  packets: tableInAppSchema('document_packets'),
  outbox: tableInAppSchema('document_notification_outbox'),
  imports: tableInAppSchema('document_import_attempts'),
  applications: tableInAppSchema('public_job_applications'),
  users: tableInAppSchema('users'),
  notifications: tableInAppSchema('app_notifications'),
};

/** ข้อผิดพลาดที่ตอบผู้ใช้ได้ตรง ๆ (ข้อความไทย + รหัส HTTP) */
export class DocError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

// ─── รหัสสุ่ม + แฮช ──────────────────────────────────────────────────────────
export const sha256Hex = (v: string | Uint8Array): string => createHash('sha256').update(v).digest('hex');
/** รหัสลิงก์ / รหัส session — สุ่ม 32 ไบต์ (เก็บลงฐานเฉพาะแฮช) */
export const newToken = (): string => randomBytes(32).toString('hex');
export const TOKEN_RE = /^[a-f0-9]{64}$/;
/** คีย์สั้นที่หน้าผู้สมัครแนบมากับทุกคำขอ — บอกว่าเป็นลิงก์ไหนโดยไม่ต้องส่งรหัสลิงก์ซ้ำ (ไม่ติดไปกับ URL ของภาพ) */
export const inviteKeyOf = (tokenHash: string): string => tokenHash.slice(0, 16);

// ─── เข้ารหัส ────────────────────────────────────────────────────────────────
export class DocumentKeyError extends Error {}

const keyOf = (secret: string): Buffer => createHash('sha256').update(`${secret}:documents:v1`).digest();
const idOf = (key: Buffer): string => createHash('sha256').update(key).digest('hex').slice(0, 12);

function keys(): { id: string; key: Buffer }[] {
  const current = (process.env.AUTH_JWT_SECRET || '').trim();
  if (!current) throw new DocumentKeyError('AUTH_JWT_SECRET is not configured');
  const old = (process.env.DOCUMENT_KEY_FALLBACK_SECRETS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [current, ...old].map((s) => {
    const key = keyOf(s);
    return { id: idOf(key), key };
  });
}

export const currentKeyId = (): string => keys()[0].id;

/** AES-256-GCM · ผลลัพธ์ = [รุ่น 1 ไบต์][iv 12][tag 16][ข้อมูล] */
export function encryptBytes(plain: Uint8Array): { keyId: string; bytes: Buffer } {
  const { id, key } = keys()[0];
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(plain), c.final()]);
  return { keyId: id, bytes: Buffer.concat([Buffer.from([1]), iv, c.getAuthTag(), enc]) };
}

export function decryptBytes(stored: Uint8Array, keyId: string): Buffer {
  const buf = Buffer.from(stored);
  const found = keys().find((k) => k.id === keyId);
  if (!found) throw new DocumentKeyError('กุญแจเข้ารหัสเอกสารไม่ตรงกับตอนบันทึก');
  if (buf.length < 30 || buf[0] !== 1) throw new DocumentKeyError('ข้อมูลเอกสารเสีย');
  try {
    const d = createDecipheriv('aes-256-gcm', found.key, buf.subarray(1, 13));
    d.setAuthTag(buf.subarray(13, 29));
    return Buffer.concat([d.update(buf.subarray(29)), d.final()]);
  } catch {
    throw new DocumentKeyError('ถอดข้อมูลเอกสารไม่ได้');
  }
}

export const encryptText = (plain: string): { keyId: string; text: string } => {
  const r = encryptBytes(Buffer.from(plain, 'utf8'));
  return { keyId: r.keyId, text: r.bytes.toString('base64') };
};
export const decryptText = (stored: string, keyId: string): string =>
  decryptBytes(Buffer.from(stored, 'base64'), keyId).toString('utf8');

// ─── เวลา ────────────────────────────────────────────────────────────────────
const BKK_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' });
/** วันนี้ตามเวลาไทย yyyy-mm-dd */
export const bangkokToday = (at: Date = new Date()): string => BKK_DAY.format(at);
export const iso = (v: unknown): string | null => (v ? new Date(v as string | Date).toISOString() : null);

// ─── ค่าที่ตั้งจากหน้าจอ ──────────────────────────────────────────────────────
export type DocumentSettings = { enabled: boolean; lineChannelId: string; liffId: string };
const DEFAULT_SETTINGS: DocumentSettings = { enabled: false, lineChannelId: '', liffId: '' };
export const LINE_CHANNEL_RE = /^\d{6,20}$/;
export const LIFF_ID_RE = /^\d{6,20}-[A-Za-z0-9_-]{4,40}$/;
export const LINK_TTL_HOURS = 24;
export const SESSION_TTL_HOURS = 4;

let settingsCache: { at: number; value: DocumentSettings } | null = null;
const SETTINGS_CACHE_MS = 10_000;
export const clearDocumentSettingsCache = (): void => {
  settingsCache = null;
};

/** ยังไม่มีตาราง (ยังไม่รัน 195) / ยังไม่มีแถว = ปิดอยู่ */
export async function getDocumentSettings(): Promise<DocumentSettings> {
  if (settingsCache && Date.now() - settingsCache.at < SETTINGS_CACHE_MS) return settingsCache.value;
  let value = DEFAULT_SETTINGS;
  try {
    const { rows } = await dbQuery<{ value: Partial<DocumentSettings> }>(`select value from ${T.settings} where key = 'main'`);
    const v = rows[0]?.value;
    if (v) {
      value = {
        enabled: v.enabled === true,
        lineChannelId: typeof v.lineChannelId === 'string' ? v.lineChannelId : '',
        liffId: typeof v.liffId === 'string' ? v.liffId : '',
      };
    }
  } catch (e) {
    if (!isPgUndefinedTable(e)) throw e;
  }
  settingsCache = { at: Date.now(), value };
  return value;
}

export async function saveDocumentSettings(
  patch: Partial<DocumentSettings>,
  by: { id: string; name: string },
): Promise<DocumentSettings> {
  const next = { ...(await getDocumentSettings()), ...patch };
  await dbQuery(
    `insert into ${T.settings} (key, value, updated_by, updated_by_name, updated_at)
     values ('main', $1::jsonb, $2, $3, now())
     on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by,
       updated_by_name = excluded.updated_by_name, updated_at = now()`,
    [JSON.stringify(next), by.id, by.name],
  );
  clearDocumentSettingsCache();
  return next;
}

/**
 * บัญชี LINE จำลองสำหรับทดสอบบนเครื่อง — ใช้ได้เฉพาะตอนไม่ใช่ production และตั้ง DOCUMENTS_LINE_MOCK=1
 * 🔴 production ปิดเสมอ แม้ตั้งค่านี้ไว้ (มีเทสต์คุม)
 */
export const isLineMockAllowed = (): boolean => !isProductionRuntime() && process.env.DOCUMENTS_LINE_MOCK === '1';

/** ต้นฉบับรุ่นที่ใช้อยู่ ต่อเอกสาร */
export type ActiveTemplate = { id: string; docType: DocId; version: number; pageCount: number; sha256: string; createdAt: string; createdByName: string | null };

export async function listActiveTemplates(): Promise<ActiveTemplate[]> {
  const { rows } = await dbQuery<{ id: string; doc_type: string; version: number; page_count: number; sha256: string; created_at: Date; created_by_name: string | null }>(
    `select id, doc_type, version, page_count, sha256, created_at, created_by_name from ${T.templates} where is_active order by doc_type`,
  );
  return rows
    .filter((r) => (DOC_IDS as readonly string[]).includes(r.doc_type))
    .map((r) => ({
      id: r.id,
      docType: r.doc_type as DocId,
      version: r.version,
      pageCount: r.page_count,
      sha256: r.sha256,
      createdAt: new Date(r.created_at).toISOString(),
      createdByName: r.created_by_name,
    }));
}

export type DocumentReadiness = { enabled: boolean; ready: boolean; problems: string[]; mock: boolean };

/**
 * พร้อมสร้างลิงก์ไหม — ต้องครบ: เปิดใช้ · ตั้ง LINE แล้ว · ต้นฉบับครบ 5 ประเภท · กุญแจเข้ารหัสใช้ได้ · ตารางคิวแจ้งเตือนมีแล้ว
 * ไม่ครบ = ไม่ให้สร้างลิงก์ (ไม่มีลิงก์ที่ผู้สมัครเปิดแล้วส่งไม่ได้ หรือส่งได้แต่ไม่มีแจ้งเตือน)
 */
export async function documentReadiness(): Promise<DocumentReadiness> {
  const mock = isLineMockAllowed();
  let s: DocumentSettings;
  try {
    s = await getDocumentSettings();
  } catch {
    return { enabled: false, ready: false, problems: ['อ่านค่าที่ตั้งไว้ไม่ได้'], mock };
  }
  const problems: string[] = [];
  if (!mock && !LINE_CHANNEL_RE.test(s.lineChannelId)) problems.push('ยังไม่ได้ใส่ LINE Login Channel ID');
  if (!mock && !LIFF_ID_RE.test(s.liffId)) problems.push('ยังไม่ได้ใส่ LIFF ID');
  try {
    const have = new Set((await listActiveTemplates()).map((t) => t.docType));
    const missing = DOC_IDS.filter((d) => !have.has(d));
    if (missing.length) problems.push(`ยังไม่ได้อัปโหลดต้นฉบับเอกสาร ${missing.length} ประเภท`);
    await dbQuery(`select 1 from ${T.outbox} limit 0`);
  } catch (e) {
    problems.push(isPgUndefinedTable(e) ? 'ฐานข้อมูลยังไม่ได้อัปเดต (migration 195)' : 'อ่านต้นฉบับเอกสารไม่ได้');
  }
  try {
    currentKeyId();
  } catch {
    problems.push('ยังไม่ได้ตั้งกุญแจของเซิร์ฟเวอร์ (AUTH_JWT_SECRET)');
  }
  return { enabled: s.enabled, ready: s.enabled && problems.length === 0, problems, mock };
}

// ─── เหตุการณ์ ───────────────────────────────────────────────────────────────
export type DocEventInput = {
  invitationId?: string | null;
  applicationId: string;
  packetId?: string | null;
  type: string;
  actorType: 'staff' | 'applicant' | 'system';
  actorId?: string | null;
  actorName?: string | null;
  detail?: Record<string, unknown> | null;
};

/** จดเหตุการณ์ — ส่ง client มา = อยู่ในธุรกรรมเดียวกับงานหลัก */
export async function recordEvent(client: PoolClient | null, e: DocEventInput): Promise<void> {
  const sql = `insert into ${T.events} (invitation_id, application_id, packet_id, event_type, actor_type, actor_id, actor_name, detail)
               values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`;
  const params = [e.invitationId ?? null, e.applicationId, e.packetId ?? null, e.type, e.actorType, e.actorId ?? null, e.actorName ?? null, e.detail ? JSON.stringify(e.detail) : null];
  if (client) await client.query(sql, params);
  else await dbQuery(sql, params);
}

/** ชื่อที่ใช้เรียกเจ้าหน้าที่ (ชื่อเล่น → ชื่อเต็ม → ส่วนหน้าอีเมล) */
export async function staffDisplayName(userId: string, email: string): Promise<string> {
  try {
    const { rows } = await dbQuery<{ n: string | null }>(
      `select coalesce(nullif(btrim(nickname), ''), nullif(btrim(full_name), '')) as n from ${T.users} where id = $1`,
      [userId],
    );
    return rows[0]?.n || email.split('@')[0];
  } catch {
    return email.split('@')[0];
  }
}
