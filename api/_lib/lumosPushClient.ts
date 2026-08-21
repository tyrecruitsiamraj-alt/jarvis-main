/**
 * Lumos Push Client — Jarvis → Lumos (outbound)
 *
 * ใช้เมื่อ ingest_mode = "webhook": แทนที่จะรอ Lumos มา poll เรา
 * เราดัน record ตรงไปหา Lumos ผ่าน public webhook API
 *
 * ต้องตั้งค่า env vars:
 *   LUMOS_BASE_URL      — https://app.lumos.ai (ไม่ต้องมี trailing slash)
 *   LUMOS_CONNECTION_ID — connection id จาก Lumos dashboard
 *   LUMOS_PUSH_API_KEY  — inbound API key (คนละตัวกับ LUMOS_API_KEY ที่ Lumos ใช้เรียก Jarvis)
 *
 * Endpoints ที่ wrap ไว้:
 *   POST   /api/public/v1/webhooks/{connection_id}/interviews          → pushInterviews()
 *   POST   /api/public/v1/webhooks/{connection_id}/reminders           → pushReminders()
 *   DELETE /api/public/v1/webhooks/{connection_id}/interviews/{id}     → cancelInterview()
 *   DELETE /api/public/v1/webhooks/{connection_id}/reminders/{id}      → cancelReminder()
 *   GET    /api/public/v1/events/{event_id}                            → getEventStatus()
 *   GET    /api/public/v1/events?status=&since=&limit=                 → listEvents()
 */

import { logError, logInfo } from './logger.js';

// ─── Config ───────────────────────────────────────────────────────────────────

export type LumosPushConfig = {
  baseUrl: string;
  connectionId: string;
  apiKey: string;
};

export function getLumosPushConfig(): LumosPushConfig | null {
  const baseUrl = (process.env.LUMOS_BASE_URL || '').trim().replace(/\/$/, '');
  const connectionId = (process.env.LUMOS_CONNECTION_ID || '').trim();
  const apiKey = (process.env.LUMOS_PUSH_API_KEY || '').trim();
  if (!baseUrl || !connectionId || !apiKey) return null;
  return { baseUrl, connectionId, apiKey };
}

// ─── Shared Types ─────────────────────────────────────────────────────────────

/** ผลของ 1 record ใน 202 response */
export type LumosPushResultItem = {
  event_id: string;
  status: 'pending';
  /** มีเฉพาะ interview push */
  client_interview_id?: string;
  client_candidate_id?: string;
  candidate_name?: string;
  /** มีเฉพาะ reminder push */
  client_contact_id?: string;
  recipient_name?: string;
};

export type LumosPushResponse = {
  status: 'success' | 'failed';
  code: 202;
  accepted: number;
  results: LumosPushResultItem[];
};

export type LumosEventStatus = 'pending' | 'processing' | 'imported' | 'failed' | 'discarded';

export type LumosEventRecord = {
  event_id: string;
  receipt_id: string;
  event_type: string;
  status: LumosEventStatus;
  received_at: string;
  processed_at: string | null;
  attempt_count: number;
  /** Lumos-side interview / reminder-plan id — ใช้ correlate ผลกลับ */
  resolved_id: string | null;
  error: string | null;
};

// ─── Interview Push Types ─────────────────────────────────────────────────────

type ExperienceItem = {
  company?: string;
  position?: string;
  period?: string;
  responsibilities?: string;
  salary?: string;
  level?: string;
  business_type?: string;
};

type EducationItem = {
  institution?: string;
  degree?: string;
  faculty?: string;
  major?: string;
  details?: string;
  gpa?: string;
  year_ce?: number;
};

/** payload เดียวกับที่ GET /api/lumos/interview/candidates คืน + admin_phone */
export type LumosPushInterviewRecord = {
  client_candidate_id: string;
  client_interview_id: string;
  candidate_name: string;
  phone: string;
  /** เบอร์เจ้าหน้าที่ — AI โทรหาเมื่อโทรหาผู้สมัครไม่สำเร็จ (E.164) */
  admin_phone?: string;
  position: string;
  scheduled_at: string;
  priority?: 'high' | 'medium' | 'low';
  questions: string[];
  type?: 'phone' | 'online';
  language?: string;
  tone?: string;
  skills?: string[];
  experience?: ExperienceItem[];
  education?: EducationItem[];
};

// ─── Reminder Push Types ──────────────────────────────────────────────────────

type ReminderStep = {
  type: 'remind' | 'follow_up' | 'confirmation';
  message: string;
  scheduled_at: string;
};

/** payload เดียวกับที่ GET /api/lumos/reminder/contacts คืน + admin_phone */
export type LumosPushReminderRecord = {
  client_contact_id: string;
  recipient_name: string;
  recipient_phone: string;
  /** เบอร์เจ้าหน้าที่ — AI โทรหาเมื่อโทรหาผู้รับไม่สำเร็จ (E.164) */
  admin_phone?: string;
  title?: string;
  priority?: 'high' | 'medium' | 'low';
  language?: string;
  tone?: string;
  steps: ReminderStep[];
};

// ─── HTTP helper ─────────────────────────────────────────────────────────────

async function lumosFetch(
  config: LumosPushConfig,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = `${config.baseUrl}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  return res;
}

async function readLumosError(res: Response): Promise<string> {
  const data = await res.json().catch(() => ({})) as { message?: string; detail?: string; error?: string };
  return data.message || data.detail || data.error || `HTTP ${res.status}`;
}

// ─── Push ─────────────────────────────────────────────────────────────────────

/**
 * ส่ง interview record ไปหา Lumos โดยตรง (push mode)
 * รับ record เดี่ยว หรือ array ก็ได้ — max 200 records ต่อ request
 */
export async function pushInterviews(
  records: LumosPushInterviewRecord | LumosPushInterviewRecord[],
  idempotencyKey?: string,
): Promise<LumosPushResponse> {
  const config = getLumosPushConfig();
  if (!config) throw new Error('LUMOS_BASE_URL / LUMOS_CONNECTION_ID / LUMOS_PUSH_API_KEY ยังไม่ได้ตั้งค่า');

  const body = Array.isArray(records) ? records : [records];
  const headers: Record<string, string> = {};
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const res = await lumosFetch(
    config,
    `/api/public/v1/webhooks/${encodeURIComponent(config.connectionId)}/interviews`,
    { method: 'POST', body: JSON.stringify(body), headers },
  );

  if (!res.ok) {
    const msg = await readLumosError(res);
    logError('lumos.push.interviews', { status: res.status, message: msg, count: body.length });
    throw new Error(`Lumos push interviews ล้มเหลว: ${msg}`);
  }

  const data = (await res.json()) as LumosPushResponse;
  logInfo('lumos.push.interviews', { accepted: data.accepted, count: body.length });
  return data;
}

/**
 * ส่ง reminder plan record ไปหา Lumos โดยตรง (push mode)
 * รับ record เดี่ยว หรือ array ก็ได้ — max 200 records ต่อ request
 */
export async function pushReminders(
  records: LumosPushReminderRecord | LumosPushReminderRecord[],
  idempotencyKey?: string,
): Promise<LumosPushResponse> {
  const config = getLumosPushConfig();
  if (!config) throw new Error('LUMOS_BASE_URL / LUMOS_CONNECTION_ID / LUMOS_PUSH_API_KEY ยังไม่ได้ตั้งค่า');

  const body = Array.isArray(records) ? records : [records];
  const headers: Record<string, string> = {};
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const res = await lumosFetch(
    config,
    `/api/public/v1/webhooks/${encodeURIComponent(config.connectionId)}/reminders`,
    { method: 'POST', body: JSON.stringify(body), headers },
  );

  if (!res.ok) {
    const msg = await readLumosError(res);
    logError('lumos.push.reminders', { status: res.status, message: msg, count: body.length });
    throw new Error(`Lumos push reminders ล้มเหลว: ${msg}`);
  }

  const data = (await res.json()) as LumosPushResponse;
  logInfo('lumos.push.reminders', { accepted: data.accepted, count: body.length });
  return data;
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

/**
 * ยกเลิก interview ที่ยังไม่เริ่มโทร
 * ใช้ client_interview_id ที่ push ไป (async — Lumos คืน 202 แล้วดำเนินการเอง)
 */
export async function cancelPushedInterview(clientInterviewId: string): Promise<LumosPushResponse> {
  const config = getLumosPushConfig();
  if (!config) throw new Error('LUMOS_BASE_URL / LUMOS_CONNECTION_ID / LUMOS_PUSH_API_KEY ยังไม่ได้ตั้งค่า');

  const res = await lumosFetch(
    config,
    `/api/public/v1/webhooks/${encodeURIComponent(config.connectionId)}/interviews/${encodeURIComponent(clientInterviewId)}`,
    { method: 'DELETE' },
  );

  if (!res.ok) {
    const msg = await readLumosError(res);
    logError('lumos.push.cancel.interview', { status: res.status, message: msg, clientInterviewId });
    throw new Error(`ยกเลิก Lumos interview ล้มเหลว: ${msg}`);
  }

  return (await res.json()) as LumosPushResponse;
}

/**
 * ยกเลิก reminder plan ทุก step ที่ยังรอโทร
 * ใช้ client_contact_id ที่ push ไป (async — Lumos คืน 202 แล้วดำเนินการเอง)
 */
export async function cancelPushedReminder(clientContactId: string): Promise<LumosPushResponse> {
  const config = getLumosPushConfig();
  if (!config) throw new Error('LUMOS_BASE_URL / LUMOS_CONNECTION_ID / LUMOS_PUSH_API_KEY ยังไม่ได้ตั้งค่า');

  const res = await lumosFetch(
    config,
    `/api/public/v1/webhooks/${encodeURIComponent(config.connectionId)}/reminders/${encodeURIComponent(clientContactId)}`,
    { method: 'DELETE' },
  );

  if (!res.ok) {
    const msg = await readLumosError(res);
    logError('lumos.push.cancel.reminder', { status: res.status, message: msg, clientContactId });
    throw new Error(`ยกเลิก Lumos reminder ล้มเหลว: ${msg}`);
  }

  return (await res.json()) as LumosPushResponse;
}

// ─── Event Status ─────────────────────────────────────────────────────────────

/**
 * ดูผลของ 1 event — ใช้ event_id ที่ได้จาก push 202 response
 * URL-encode เอง: event_id รูปแบบ derived มี `:` อยู่
 */
export async function getEventStatus(eventId: string): Promise<LumosEventRecord> {
  const config = getLumosPushConfig();
  if (!config) throw new Error('LUMOS_BASE_URL / LUMOS_CONNECTION_ID / LUMOS_PUSH_API_KEY ยังไม่ได้ตั้งค่า');

  const res = await lumosFetch(
    config,
    `/api/public/v1/events/${encodeURIComponent(eventId)}`,
  );

  if (!res.ok) {
    const msg = await readLumosError(res);
    throw new Error(`ดูสถานะ event ล้มเหลว: ${msg}`);
  }

  return (await res.json()) as LumosEventRecord;
}

/**
 * ดูผลหลาย event พร้อมกัน — ใช้กรอง status=failed เพื่อหา record ที่ import ไม่สำเร็จ
 */
export async function listEvents(opts: {
  status?: LumosEventStatus;
  /** ISO 8601 — เฉพาะ event ที่ received_at >= since */
  since?: string;
  /** 1–500, default 100 */
  limit?: number;
} = {}): Promise<LumosEventRecord[]> {
  const config = getLumosPushConfig();
  if (!config) throw new Error('LUMOS_BASE_URL / LUMOS_CONNECTION_ID / LUMOS_PUSH_API_KEY ยังไม่ได้ตั้งค่า');

  const params = new URLSearchParams();
  if (opts.status) params.set('status', opts.status);
  if (opts.since) params.set('since', opts.since);
  if (opts.limit) params.set('limit', String(opts.limit));

  const qs = params.toString();
  const res = await lumosFetch(config, `/api/public/v1/events${qs ? `?${qs}` : ''}`);

  if (!res.ok) {
    const msg = await readLumosError(res);
    throw new Error(`list events ล้มเหลว: ${msg}`);
  }

  return (await res.json()) as LumosEventRecord[];
}
