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

import { logError, logInfo, logWarn, errorSummaryText } from './logger.js';
import {
  newRequestId,
  pickResponseHeaders,
  readLumosHttpLogConfig,
  redactSecrets,
  safeHeadersForLog,
  truncateForLog,
} from './lumosHttpLog.js';

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

/**
 * retry เฉพาะตอน `fetch()` เอง throw (DNS หาไม่เจอ/ต่อปลายทางไม่ติด/connection reset
 * กลางทาง — ขึ้น "fetch failed" เฉย ๆ ไม่มีรายละเอียด) **ไม่ retry ตอนได้ HTTP response
 * กลับมาแล้ว** (4xx/5xx ปล่อยให้ผู้เรียกจัดการเอง ไม่ใช่ปัญหาที่ retry แก้ได้)
 *
 * เจอจริง 8 ก.ย. 2569: ส่งคิว follow 16 รายการ ผ่านแค่ 4 ที่เหลือ "fetch failed"
 * ทั้งที่ payload/credential ถูกทุกตัว — เข้าข่ายเครือข่ายหลุดเป็นระยะ ไม่ใช่ยิงพร้อมกัน
 * (ทุก request คือ POST /api/follow แยกกันทีละครั้ง ไม่ใช่ยิง 16 ทีเดียว)
 *
 * ปลอดภัยที่จะส่งซ้ำเพราะทุก endpoint ต้องมีคีย์กันซ้ำฝั่ง Lumos เอง — POST มี
 * client_interview_id/client_contact_id ต่อ record (Lumos ใช้จับคู่ผลกลับอยู่แล้ว)
 * และ pushInterviews/pushReminders รับ Idempotency-Key ต่อ batch ด้วย · ส่งซ้ำจึงไม่ทำให้
 * เกิดสายที่สองไปหาคนจริง
 */
const FETCH_MAX_ATTEMPTS = 3;
const FETCH_RETRY_DELAYS_MS = [300, 900];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * ═══ ทุกคำขอที่ยิงออกไปหา Lumos ผ่านตรงนี้จุดเดียว ═══
 *
 * 🔴 เจ้าของสั่ง 11 ก.ย. 2569: *"ให้ทำ log ในระหว่างที่ http client ยิงไปที่ Server Lumos
 * อย่างละเอียดทุก End point โดยให้บอก Http Status, Request และ Response"*
 *
 * ออกมาเป็น **สองบรรทัดต่อหนึ่งครั้งที่ยิง** ผูกกันด้วย `reqId`:
 *   `lumos.http.request`  — method · path · attempt · หัว · body ที่ส่ง
 *   `lumos.http.response` — status · เวลาที่ใช้ · หัวที่สนใจ · body ที่ตอบ
 * ต่อไม่ถึงเลย (ไม่มี response) จะได้ `lumos.http.error` แทนบรรทัดที่สอง
 *
 * ⚠️ **อ่าน body ของฝั่งตอบด้วย `clone()` เสมอ** — ถ้าอ่านจากตัวจริง ผู้เรียกที่ทำ
 * `res.json()` ต่อจะเจอ stream ที่ถูกอ่านไปแล้วแล้วพังทั้งเส้น
 *
 * ⚠️ **ห้าม log แล้วทำให้คำขอล้ม** — ทุกจุดที่ log ห่อ try/catch ไว้ (งานหลักคือยิง ไม่ใช่จด)
 */
async function lumosFetch(
  config: LumosPushConfig,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = `${config.baseUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
    ...(init.headers as Record<string, string> | undefined),
  };
  const logCfg = readLumosHttpLogConfig(process.env);
  const method = (init.method ?? 'GET').toUpperCase();
  /** ปิดบังคีย์ + connection id ทุกบรรทัดก่อนลง log */
  const clean = (text: string): string =>
    truncateForLog(redactSecrets(text, [config.apiKey]), logCfg.maxChars);

  let lastErr: unknown;
  for (let attempt = 1; attempt <= FETCH_MAX_ATTEMPTS; attempt++) {
    const reqId = newRequestId();
    const startedAt = Date.now();

    if (logCfg.level !== 'off') {
      try {
        const bodyText = typeof init.body === 'string' ? init.body : undefined;
        logInfo('lumos.http.request', {
          reqId,
          method,
          path,
          attempt,
          maxAttempts: FETCH_MAX_ATTEMPTS,
          headers: safeHeadersForLog(headers),
          bodyChars: bodyText?.length ?? 0,
          ...(logCfg.level === 'full' && bodyText ? { body: clean(bodyText) } : {}),
        });
      } catch {
        /* จดไม่ได้ก็ต้องยิงต่อ */
      }
    }

    try {
      const res = await fetch(url, { ...init, headers });
      if (logCfg.level !== 'off') {
        try {
          // clone ก่อนอ่าน — ตัวจริงต้องเหลือให้ผู้เรียก .json() ต่อได้
          const raw = logCfg.level === 'full' ? await res.clone().text() : '';
          logInfo('lumos.http.response', {
            reqId,
            method,
            path,
            attempt,
            status: res.status,
            statusText: res.statusText,
            ok: res.ok,
            ms: Date.now() - startedAt,
            headers: pickResponseHeaders((n) => res.headers.get(n)),
            ...(logCfg.level === 'full' ? { bodyChars: raw.length, body: clean(raw) } : {}),
          });
        } catch (logErr) {
          // อ่าน body ไม่ได้ (เช่น stream พัง) — อย่างน้อยต้องรู้ว่า status อะไร
          logWarn('lumos.http.response.logFailed', {
            reqId,
            path,
            status: res.status,
            reason: errorSummaryText(logErr, 200),
          });
        }
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (logCfg.level !== 'off') {
        try {
          logWarn('lumos.http.error', {
            reqId,
            method,
            path,
            attempt,
            maxAttempts: FETCH_MAX_ATTEMPTS,
            ms: Date.now() - startedAt,
            willRetry: attempt < FETCH_MAX_ATTEMPTS,
            // คลี่ .cause ออกมา — "fetch failed" เปล่า ๆ ไล่ต้นเหตุไม่ได้
            reason: errorSummaryText(e, logCfg.maxChars),
          });
        } catch {
          /* ไม่เป็นไร */
        }
      }
      if (attempt < FETCH_MAX_ATTEMPTS) {
        await sleep(FETCH_RETRY_DELAYS_MS[attempt - 1]);
      }
    }
  }
  throw lastErr;
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
