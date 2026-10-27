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

export type AiAnswerText = { kind: AiAnswerKind; text: string; queue?: AiQueueStatus; reason?: string };

/**
 * ทำไมยังไม่ส่ง AI (เจ้าของ 27 ต.ค. 2569 "ยังไม่ส่ง Ai อันนี้อยากรู้ว่าทำไมไม่ส่ง") — บรรทัดล่างของแถวในชิป "ยังไม่ส่ง AI"
 * อ่านจากช่องที่มีบนแถว · ที่เหลือ = สมัครผ่านลิงก์แต่ระบบไม่ได้ส่ง (เช่นเบอร์เดียวกันเคยโทรจากใบก่อน)
 */
export function notSentReasonOf(r: PublicApplication): string {
  if (r.claimed_by_name?.trim()) return `เก็บไปโทรเอง · ${r.claimed_by_name.trim()}`;
  if (r.call_choice === 'manual') return 'เลือกโทรเอง';
  if (!r.job_id) return 'ไม่ผูกใบขอ';
  if (r.created_by_name?.trim()) return 'เพิ่มเอง/นำเข้า ยังไม่กดส่ง AI';
  return 'สมัครผ่านลิงก์ ระบบไม่ได้ส่ง';
}

export const AI_NOT_SENT_TEXT = 'ยังไม่ได้ส่งให้ AI';

/**
 * AI โทรครบแล้วไม่มีใครรับ (คิวปิด ส่งให้คน) → "โทรครบ N ครั้งแล้ว" (เจ้าของ 27 ต.ค. 2569 "บอกหน่อยว่าโทรครบ 3 ครั้งแล้ว")
 * ระบบไม่โทรเองอีก · กดส่ง AI โทรเองได้ · null = ไม่ใช่แถวแบบนี้
 */
const NO_PICKUP_OUTCOMES = new Set(['no_answer', 'busy', 'unresponsive', 'failed']);
export function aiCallsDoneText(r: PublicApplication): string | null {
  const n = Math.trunc(Number(r.last_call_attempts) || 0);
  if (r.last_call_status !== 'failed' || (r.last_call_followup ?? '').trim() !== 'needs_human' || n < 1) return null;
  if (!NO_PICKUP_OUTCOMES.has((r.last_call_outcome ?? '').trim())) return null;
  return `โทรครบ ${n} ครั้งแล้ว`;
}

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
  return { kind: 'not_sent', text: AI_NOT_SENT_TEXT, reason: notSentReasonOf(r) };
}
