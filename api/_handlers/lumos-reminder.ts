/**
 * AI Reminder — endpoints สำหรับ Lumos
 *
 * GET  /api/lumos/reminder/contacts  →  ส่ง contact list ให้ Lumos ไปแจ้งเตือน
 * POST /api/lumos/reminder/results   →  รับผลลัพธ์การแจ้งเตือนจาก Lumos
 */
import { withLumosAuth } from '../_lib/lumos-auth.js';
import { readJsonBody } from '../_lib/body.js';
import { sendError, handleApiError, type ApiReq, type ApiRes } from '../_lib/http.js';
import { logInfo } from '../_lib/logger.js';

// ─── Types ────────────────────────────────────────────────────────────────────

type ReminderStep = {
  type: 'remind' | 'follow_up' | 'confirmation';
  message: string;
  scheduled_at: string;
};

type ContactForReminder = {
  client_contact_id: string;
  recipient_name: string;
  recipient_phone: string;
  steps: ReminderStep[];
  title?: string;
  language?: string;
  tone?: string;
};

type TranscriptItem = {
  role: 'agent' | 'candidate';
  text: string;
};

type ReminderResult = {
  plan_id: string;
  step_id: string;
  client_contact_id: string;
  title: string;
  recipient_name: string;
  recipient_phone: string;
  step_position: number;
  step_type: string;
  message: string;
  scheduled_at: string;
  language: string;
  tone: string;
  status: 'completed' | 'failed' | 'cancelled';
  outcome: string;
  summary: string | null;
  transcript: TranscriptItem[];
  recording_url: string | null;
  call_attempts: number;
  ended_reason: string | null;
  plan_status: 'active' | 'completed' | 'cancelled';
  stop_early: boolean;
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_CONTACTS: ContactForReminder[] = [
  {
    client_contact_id: 'cli-emp-551',
    recipient_name: 'คุณสมหญิง',
    recipient_phone: '+66898765432',
    title: 'นัดสัมภาษณ์พรุ่งนี้',
    language: 'th',
    tone: 'professional',
    steps: [
      {
        type: 'remind',
        message: 'แจ้งเตือนนัดสัมภาษณ์พรุ่งนี้ 10:00 น.',
        scheduled_at: '2026-07-10T14:00:00+07:00',
      },
      {
        type: 'follow_up',
        message: 'ติดตามยืนยันการเข้าสัมภาษณ์',
        scheduled_at: '2026-07-10T18:00:00+07:00',
      },
    ],
  },
  {
    client_contact_id: 'cli-emp-552',
    recipient_name: 'คุณประสิทธิ์',
    recipient_phone: '+66876543210',
    title: 'ยืนยันวันเริ่มงาน',
    language: 'th',
    tone: 'professional',
    steps: [
      {
        type: 'confirmation',
        message: 'ยืนยันวันเริ่มงาน 15 กรกฎาคม 2569',
        scheduled_at: '2026-07-11T10:00:00+07:00',
      },
    ],
  },
];

// ─── Validators ───────────────────────────────────────────────────────────────

const VALID_OUTCOMES = [
  'confirmed', 'acknowledged', 'declined', 'reschedule_requested',
  'wrong_person', 'no_answer', 'busy', 'unresponsive', 'failed', 'cancelled',
] as const;

const VALID_STATUSES = ['completed', 'failed', 'cancelled'] as const;

function isValidReminderResult(v: unknown): v is ReminderResult {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.plan_id === 'string' && o.plan_id.trim() !== '' &&
    typeof o.step_id === 'string' && o.step_id.trim() !== '' &&
    typeof o.client_contact_id === 'string' && o.client_contact_id.trim() !== '' &&
    typeof o.status === 'string' &&
    (VALID_STATUSES as readonly string[]).includes(o.status) &&
    typeof o.outcome === 'string' &&
    (VALID_OUTCOMES as readonly string[]).includes(o.outcome)
  );
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function getContacts(_req: ApiReq, res: ApiRes): Promise<void> {
  // TODO: replace mock with real DB query
  // const rows = await dbQuery(`SELECT ... FROM ${tableInAppSchema('employees')} WHERE ...`)
  return res.status(200).json({
    ok: true,
    data: MOCK_CONTACTS,
    total: MOCK_CONTACTS.length,
  });
}

async function postReminderResults(req: ApiReq, res: ApiRes): Promise<void> {
  try {
    const raw = await readJsonBody(req);
    const results: unknown[] = Array.isArray(raw) ? raw : raw != null ? [raw] : [];

    if (results.length === 0) {
      return sendError(res, 400, 'Bad Request', 'Body must be a non-empty array of reminder results');
    }

    for (const [i, item] of results.entries()) {
      if (!isValidReminderResult(item)) {
        return sendError(
          res, 400, 'Bad Request',
          `Item[${i}] is invalid — required: plan_id (string), step_id (string), client_contact_id (string), status (${VALID_STATUSES.join('|')}), outcome (${VALID_OUTCOMES.join('|')})`,
        );
      }
    }

    logInfo('lumos.reminder.results', {
      count: results.length,
      plan_ids: results.map((r) => (r as ReminderResult).plan_id),
      step_ids: results.map((r) => (r as ReminderResult).step_id),
    });

    // TODO: persist to DB
    // await dbQuery(`INSERT INTO ${tableInAppSchema('lumos_reminder_results')} (...) VALUES (...)`)

    return res.status(200).json({
      ok: true,
      received: results.length,
      message: 'Reminder results accepted',
    });
  } catch (e) {
    return handleApiError(res, e, 'lumos.reminder.results');
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const lumosReminderContactsHandler = withLumosAuth(getContacts);
export const lumosReminderResultsHandler = withLumosAuth(postReminderResults);
