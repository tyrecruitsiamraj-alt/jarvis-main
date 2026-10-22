import type { PublicApplication } from '@/lib/publicApplicationsApi';
import { aiQueueStatusOf, type AiQueueStatus } from '@/lib/applicantAiQueueStatus';
import { callResultLabel } from '@/lib/homeCallResults';
import { FOLLOW_STATUS_LABEL, isFollowCallStatus } from '@/lib/followApi';
import { IRECRUIT_PULL_STATE_LABEL, irecruitPullState } from '@/lib/irecruitPullStatus';
import { IRECRUIT_PULL_CREATED_BY } from '@/lib/recruitRm';

/**
 * ═══ คำบรรทัดบนของคอลัมน์ "คำตอบกับ AI" — ตัวเดียวทั้งตารางและตัวกรอง (เจ้าของ 22 ต.ค. 2569) ═══
 * > *"Fill สถานะ การตอบของ Ai ได้ด้วย เช่น AI โทรแล้ว 1 ครั้ง ไม่ตอบ / AI โทรแล้ว 2 ครั้ง สายไม่ว่าง /ส่ง AI แล้ว ยังไม่มีผล"*
 * ลำดับเดียวกับ `AiAnswerCell` ใน RmTable — คิว AI ที่มีเรื่องให้บอก → คำตอบ → เบอร์ใช้ไม่ได้ → สถานะสาย →
 * ซ้ำ iRecruit → รายชื่อดึงจาก iRecruit → ยังไม่ได้ส่ง · 🔴 แก้ลำดับ/คำที่นี่ที่เดียว ตารางกับตัวกรองพูดตรงกันเสมอ
 */
export type AiAnswerKind = 'queue' | 'answer' | 'bad_phone' | 'call_status' | 'irecruit_dup' | 'irecruit_pull' | 'not_sent';

export type AiAnswerText = { kind: AiAnswerKind; text: string; queue?: AiQueueStatus };

export const AI_NOT_SENT_TEXT = 'ยังไม่ได้ส่งให้ AI';

export function aiAnswerTextOf(r: PublicApplication, now: number = Date.now()): AiAnswerText {
  const queue = aiQueueStatusOf(r, now);
  if (queue && queue.kind !== 'waiting') return { kind: 'queue', text: queue.label, queue };
  if (r.ai_answer) return { kind: 'answer', text: callResultLabel('interest', r.ai_answer.micro) };
  if (r.phone_callable === false) return { kind: 'bad_phone', text: 'เบอร์ใช้โทรไม่ได้' };
  if (isFollowCallStatus(r.last_call_status)) return { kind: 'call_status', text: FOLLOW_STATUS_LABEL[r.last_call_status] };
  if (r.irecruit_dup_at) return { kind: 'irecruit_dup', text: 'ซ้ำ iRecruit' };
  const irState = irecruitPullState(r.irecruit_status);
  if (r.created_by_name === IRECRUIT_PULL_CREATED_BY && irState) {
    return { kind: 'irecruit_pull', text: IRECRUIT_PULL_STATE_LABEL[irState] };
  }
  return { kind: 'not_sent', text: AI_NOT_SENT_TEXT };
}
