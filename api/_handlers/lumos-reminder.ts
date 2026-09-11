/**
 * AI Reminder — endpoints สำหรับ Lumos
 *
 * GET  /api/lumos/reminder/contacts  →  ส่ง contact list ให้ Lumos ไปแจ้งเตือน
 * POST /api/lumos/reminder/results   →  รับผลลัพธ์การแจ้งเตือนจาก Lumos
 */
import { withLumosAuth } from '../_lib/lumos-auth.js';
import { readJsonBody } from '../_lib/body.js';
import { sendError, handleApiError, type ApiReq, type ApiRes } from '../_lib/http.js';
import { logInfo, logWarn } from '../_lib/logger.js';
import { recordLumosResultInbox, readInboxFields } from '../_lib/lumosResultInbox.js';
import { takePendingLumosItems, applyLumosResult } from '../_lib/lumosDispatch.js';

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

async function getContacts(req: ApiReq, res: ApiRes): Promise<void> {
  try {
    const rawLimit = typeof req.query?.limit === 'string' ? Number(req.query.limit) : NaN;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 200;

    // คิวจากผล AI match "คนของเรา" — เสิร์ฟครั้งเดียวต่อรายการ (pending → delivered)
    const data = (await takePendingLumosItems('reminder', limit)) as ContactForReminder[];
    return res.status(200).json({ ok: true, data, total: data.length });
  } catch (e) {
    return handleApiError(res, e, 'lumos.reminder.contacts');
  }
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

    /**
     * 🔴 **จด log ขาเข้าให้ละเอียดเท่าขาออก** (11 ก.ย. 2569)
     * ของเดิมจดแค่ count/plan_id/step_id ⇒ เวลา "ผลรอบแรกไม่ขึ้น" ไล่ไม่ได้ว่า
     * ใบนั้นเข้ามาถึงเราหรือเปล่า และเข้ามาหน้าตาแบบไหน
     */
    logInfo('lumos.reminder.results', {
      count: results.length,
      items: (results as ReminderResult[]).map((r) => ({
        client_contact_id: r.client_contact_id,
        plan_id: r.plan_id,
        step_id: r.step_id,
        step_position: (r as unknown as { step_position?: unknown }).step_position ?? null,
        status: r.status,
        outcome: r.outcome,
        plan_status: (r as unknown as { plan_status?: unknown }).plan_status ?? null,
      })),
    });

    // ผูกผลกลับเข้าคิว dispatch (match ด้วย client_contact_id + step_position)
    let matched = 0;
    for (const item of results as ReminderResult[]) {
      const ok = await applyLumosResult('reminder', item.client_contact_id, item.status, item);
      if (ok) matched += 1;
      /**
       * 🔴 **เก็บทุกใบลงกล่องรับ ไม่ว่าจับคู่ได้หรือไม่** — ของเดิมจับคู่ไม่ได้แล้วทิ้งเงียบ
       * ⇒ เวลาผลไม่ขึ้นบนจอ แยกไม่ออกว่า "เขาไม่ส่ง" หรือ "ส่งแล้วเราจับคู่ไม่ได้"
       * ซึ่งเป็นคนละเรื่องและแก้คนละทางโดยสิ้นเชิง
       */
      await recordLumosResultInbox({
        channel: 'reminder',
        ...readInboxFields(item),
        matched: ok,
        unmatchedReason: ok
          ? null
          : 'ไม่พบแถวคิวที่ตรงกับ client_contact_id (+step_position) ที่ส่งมา',
        payload: item,
      });
    }
    if (matched < results.length) {
      // ผลที่จับคู่ไม่ได้ = ไม่ได้ขึ้นจอที่ไหนเลย ต้องเห็นชัดใน log ไม่ใช่ซ่อนในตัวเลข
      logWarn('lumos.reminder.results.unmatched', {
        received: results.length,
        matched,
        unmatched: results.length - matched,
      });
    }

    return res.status(200).json({
      ok: true,
      received: results.length,
      matched,
      message: 'Reminder results accepted',
    });
  } catch (e) {
    return handleApiError(res, e, 'lumos.reminder.results');
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const lumosReminderContactsHandler = withLumosAuth(getContacts);
export const lumosReminderResultsHandler = withLumosAuth(postReminderResults);
