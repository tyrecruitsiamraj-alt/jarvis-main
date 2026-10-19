import type { ToneKey } from '@/lib/designTokens';
import { CALL_OUTCOME_LABEL } from '@/lib/callOutcomeTone';
import type { CallOutcome } from '@/lib/callFollowupPolicy';

/**
 * ═══ ป้าย "รอ AI โทร" แบบบอกครบ — แท็บผู้สมัคร (เจ้าของ Choice 14 ต.ค. 2569 "บอกครบ + แก้คนที่ตกหล่น") ═══
 *
 * > *"รอ Ai โทรบางคนผ่านมา 2 วันแล้วนะ"*
 * เดิมแถวคิวที่ยัง `pending` ขึ้น "รอ AI โทร" เหมือนกันหมด ทั้งที่จริงแบ่งได้ 4 แบบ:
 * - ส่งรอบแรก ยังไม่มีผล → "รอ AI โทร"
 * - AI โทรแล้ว ไม่ติด ตั้งโทรซ้ำไว้ → "AI โทรแล้ว 2 ครั้ง ไม่รับสาย" + "โทรซ้ำ 15 ต.ค. 14:00"
 *   (เลยเวลานัดโทรซ้ำเกิน 15 นาทียังไม่มีผล → เตือน "นัดโทรซ้ำ … ยังไม่มีผล")
 * - AI โทรครบแล้วยังไม่ได้คำตอบ (`needs_human`) → ให้เจ้าหน้าที่โทร
 * - ส่งแล้วเงียบเกิน 24 ชม. (`push_gave_up`) หรือ Lumos ไม่รับสาย (`lumos_import_status` failed/discarded)
 *
 * `attempt_count` = ครั้งที่กำลังจะโทร (ตัวตั้งโทรซ้ำ +1 ตอนตั้ง · `callFollowup.ts`) ⇒ ระหว่างรอ โทรไปแล้ว = attempt − 1
 * ส่วน `needs_human` ที่มาจากผลโทร (ไม่ใช่ส่งแล้วเงียบ) ไม่ +1 ⇒ โทรไปแล้ว = attempt
 */
export type AiQueueKind = 'waiting' | 'first_late' | 'retry' | 'retry_late' | 'needs_human' | 'silent' | 'not_imported';

export type AiQueueStatus = {
  kind: AiQueueKind;
  label: string;
  sub: string | null;
  tone: ToneKey;
  /** สายที่ AI จะไม่โทรแล้ว หรือเลยนัดแล้วยังไม่โทร — ชิป "AI ไม่ได้ผล" */
  atRisk: boolean;
};

export type AiQueueInput = {
  last_call_status?: string | null;
  last_call_attempts?: number | null;
  last_call_next_at?: string | null;
  last_call_followup?: string | null;
  last_call_prev_outcome?: string | null;
  last_call_push_state?: string | null;
  last_call_import_status?: string | null;
  last_call_sent_at?: string | null;
};

/** เลยเวลานัดโทรซ้ำกี่นาทีถึงเตือน — ตัวเดียวกับงานติดตาม (`OVERDUE_ALERT_MINUTES`) */
export const AI_RETRY_LATE_MINUTES = 15;
/**
 * รอบแรกส่งถึง Lumos แล้วเงียบกี่นาทีถึงขึ้นแดง (เจ้าของ 14 ต.ค. 2569 "แก้แบบที่บอกยัง" — ยังเห็น "รอ AI โทร" ค้าง)
 * ปกติรอบแรกโทรภายใน 6 นาที ช้าสุด 10% เกิน 12 นาที (วัด 30 ก.ย.) · เดิมรู้ตัวตอนเงียบครบ 24 ชม. เท่านั้น
 */
export const AI_FIRST_LATE_MINUTES = 30;

const DATE_TIME = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function whenText(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? DATE_TIME.format(new Date(t)) : null;
}

function outcomeText(code: string | null | undefined): string {
  const c = (code ?? '').trim();
  return c ? (CALL_OUTCOME_LABEL[c as CallOutcome] ?? c) : '';
}

function calledText(n: number, outcome: string | null | undefined): string {
  return [`AI โทรแล้ว ${n} ครั้ง`, outcomeText(outcome)].filter(Boolean).join(' ');
}

/** null = ไม่ใช่แถวที่ยังรอฝั่ง AI (ให้ป้ายเดิมทำงาน) */
export function aiQueueStatusOf(r: AiQueueInput, now: number = Date.now()): AiQueueStatus | null {
  if (r.last_call_status !== 'pending') return null;
  const attempts = Math.max(1, Math.trunc(Number(r.last_call_attempts) || 1));
  const followup = (r.last_call_followup ?? '').trim();
  const imp = (r.last_call_import_status ?? '').trim();

  if (imp === 'failed' || imp === 'discarded') {
    const done = attempts - 1;
    return {
      kind: 'not_imported',
      label: 'Lumos ไม่รับสาย',
      sub: done > 0 ? calledText(done, r.last_call_prev_outcome) : 'AI ยังไม่ได้โทร',
      tone: 'danger',
      atRisk: true,
    };
  }

  if (followup === 'needs_human') {
    if (r.last_call_push_state === 'push_gave_up') {
      const done = attempts - 1;
      return {
        kind: 'silent',
        label: done > 0 ? calledText(done, r.last_call_prev_outcome) : 'ส่ง AI แล้วไม่มีผล',
        // 19 ต.ค. 2569 — กติกา "ส่ง AI แล้วต้อง AI" ⇒ ไม่บอกให้คนโทร · กดส่ง AI ใหม่บนแถวได้ (รอบใหม่ที่ Lumos)
        sub: done > 0 ? `รอบที่ ${attempts} ไม่มีผลเกิน 24 ชม. กดส่ง AI ใหม่ได้` : 'เกิน 24 ชม. กดส่ง AI ใหม่ได้',
        tone: 'danger',
        atRisk: true,
      };
    }
    return {
      kind: 'needs_human',
      label: calledText(attempts, r.last_call_prev_outcome),
      sub: 'ให้เจ้าหน้าที่โทร',
      tone: 'warn',
      atRisk: true,
    };
  }

  // ตั้งโทรซ้ำไว้ (retry_scheduled) หรือส่งรอบโทรซ้ำไปแล้ว (followup ว่าง แต่มีผลรอบก่อน)
  if (attempts > 1 && (followup === 'retry_scheduled' || r.last_call_prev_outcome)) {
    const at = whenText(r.last_call_next_at);
    const late =
      r.last_call_next_at != null && Date.parse(r.last_call_next_at) < now - AI_RETRY_LATE_MINUTES * 60_000;
    const label = calledText(attempts - 1, r.last_call_prev_outcome);
    if (late) {
      return { kind: 'retry_late', label, sub: `นัดโทรซ้ำ ${at} ยังไม่มีผล`, tone: 'danger', atRisk: true };
    }
    return { kind: 'retry', label, sub: at ? `โทรซ้ำ ${at}` : null, tone: 'warn', atRisk: false };
  }

  const sent = Date.parse(r.last_call_sent_at ?? '');
  if (Number.isFinite(sent) && sent < now - AI_FIRST_LATE_MINUTES * 60_000) {
    return { kind: 'first_late', label: 'ส่ง AI แล้ว ยังไม่มีผล', sub: `ส่ง ${whenText(r.last_call_sent_at)}`, tone: 'danger', atRisk: true };
  }
  return { kind: 'waiting', label: 'รอ AI โทร', sub: null, tone: 'neutral', atRisk: false };
}
