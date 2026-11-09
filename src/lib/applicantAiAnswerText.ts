import type { PublicApplication } from '@/lib/publicApplicationsApi';
import { bkkWhen } from '@/lib/bkkWhen';
import { aiQueueStatusOf, type AiQueueStatus } from '@/lib/applicantAiQueueStatus';
import { callResultLabel } from '@/lib/homeCallResults';
import { FOLLOW_STATUS_LABEL, isFollowCallStatus } from '@/lib/followApi';
import { IRECRUIT_PULL_STATE_LABEL, irecruitPullState } from '@/lib/irecruitPullStatus';
import { IRECRUIT_PULL_CREATED_BY, rmShownViewOf } from '@/lib/recruitRm';
import { isOverAge, OVER_AGE_REASON } from '@/lib/applicantAge';

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
  // เหตุจริงที่ตัวส่งอัตโนมัติจดไว้ (28 ต.ค. 2569 เคสคุณหนึ่ง: เลือก AI แล้วแต่ใบขอยังไม่ตั้งรายได้ — เดิมขึ้น "ยังไม่กดส่ง AI")
  const blocked = r.ai_block_reason?.split(' — ')[0]?.trim();
  if (blocked) return blocked;
  // อายุเกิน = AI ไม่โทร (3 พ.ย. 2569 เดิมขึ้น "สมัครผ่านลิงก์ ระบบไม่ได้ส่ง" 14 คน)
  if (isOverAge(r.age)) return OVER_AGE_REASON;
  if (!r.job_id) return 'ไม่ผูกใบขอ';
  if (r.call_choice === 'ai' || r.call_choice === 'auto_ai') return 'เลือกให้ AI โทรแล้ว รอระบบส่ง';
  if (r.created_by_name?.trim()) return 'เพิ่มเอง/นำเข้า ยังไม่กดส่ง AI';
  // กรอกผ่านลิงก์ ระบบควรส่งเองแต่ส่งไม่ออก (ก่อนมีตัวส่งซ้ำ 15 ต.ค. หรือตัวส่งซ้ำเลิกลองหลัง 7 วัน) — กดส่งจากแถวได้
  return 'ส่ง AI ไม่สำเร็จตอนกรอก · กดส่ง AI ได้';
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

/**
 * ═══ สถานะบนแถวแท็บผู้สมัคร = ชิปที่แถวนั้นอยู่ (เจ้าของ 3 พ.ย. 2569) ═══
 * > *"อ่านแล้วต้องเคลียร์ว่าโทรแล้วเป็นไง ไม่โทรเพราะไร ไม่ใช่มาใช้คำพูดกำกวม แก้ให้ตรง Slot มัน"*
 * บรรทัดบน = ชื่อชิปเป๊ะ (ตัวตัดสินเดียว `rmShownViewOf`) · บรรทัดล่าง = ข้อเท็จจริงสั้น ๆ (โทรกี่ครั้ง ผลล่าสุด เวลา / เหตุที่ไม่ได้โทร)
 */
export type RmRowStatus = { view: ReturnType<typeof rmShownViewOf>; title: string; detail: string | null; tone: 'success' | 'warn' | 'danger' | 'neutral' | 'info' };

const rowWhen = bkkWhen;
const OUTCOME_SHORT: Record<string, string> = { no_answer: 'ไม่รับสาย', busy: 'สายไม่ว่าง', unresponsive: 'รับแต่ไม่ตอบ', failed: 'โทรไม่ติด' };
const TALKED_DETAIL: Record<string, string> = { picked_silent: 'รับสายแต่ไม่พูด', talked_unclear: 'คุยแล้วตอบไม่ชัด', not_yet: 'ยังไม่ตัดสินใจ' };

export function rmRowStatusOf(r: PublicApplication, now: number = Date.now()): RmRowStatus {
  const view = rmShownViewOf(r);
  const n = Math.trunc(Number(r.last_call_attempts) || 0);
  const times = n > 0 ? `AI โทร ${n} ครั้ง` : null;
  const join = (...xs: Array<string | null | undefined>) => xs.filter(Boolean).join(' · ') || null;
  switch (view) {
    case 'ai_waiting': {
      const q = aiQueueStatusOf(r, now);
      if (q?.kind === 'retry' || q?.kind === 'retry_late') {
        const prev = OUTCOME_SHORT[(r.last_call_prev_outcome ?? '').trim()] ?? 'ไม่ได้คำตอบ';
        const at = rowWhen(r.last_call_next_at);
        const done = `โทรแล้ว ${Math.max(1, n - 1)} ครั้ง ${prev}`;
        // ส่งรอบโทรซ้ำถึง Lumos แล้ว = รอคิว Lumos ไม่ใช่ "เลยเวลา" (3 พ.ย. 2569 สายโทรซ้ำ 322 สายส่งตรงเวลาแต่รอคิว)
        if (r.last_call_push_state === 'pushed' && typeof r.last_call_queue_ahead === 'number') {
          const sent = rowWhen(r.last_call_sent_at);
          return { view, title: 'รอ AI โทรซ้ำ', detail: join(done, sent ? `ส่งโทรซ้ำ ${sent}` : null, `คิวก่อนหน้า ${r.last_call_queue_ahead.toLocaleString('th-TH')} คน`), tone: 'warn' };
        }
        return { view, title: 'รอ AI โทรซ้ำ', detail: join(done, at ? `โทรซ้ำ ${at}` : null, q.kind === 'retry_late' ? 'เลยเวลาแล้ว ยังไม่ได้ส่ง' : null), tone: q.kind === 'retry_late' ? 'danger' : 'warn' };
      }
      if (q?.kind === 'silent') return { view, title: 'รอ AI โทร', detail: 'ส่งเกิน 24 ชม. Lumos ยังไม่โทร · กดส่ง AI ใหม่ได้', tone: 'danger' };
      if (q?.kind === 'first_late') return { view, title: 'รอ AI โทร', detail: join(rowWhen(r.last_call_sent_at) ? `ส่ง ${rowWhen(r.last_call_sent_at)}` : null, 'เกิน 24 ชม. ยังไม่มีผล'), tone: 'danger' };
      if (q?.kind === 'not_imported') return { view, title: 'รอ AI โทร', detail: 'Lumos ไม่รับรายชื่อนี้ · AI ยังไม่ได้โทร', tone: 'danger' };
      return { view, title: 'รอ AI โทร', detail: q?.sub ?? null, tone: 'neutral' };
    }
    case 'no_pickup': {
      const last = OUTCOME_SHORT[(r.last_call_outcome ?? r.last_call_prev_outcome ?? '').trim()] ?? 'ไม่รับสาย';
      return { view, title: 'ไม่รับสาย', detail: join(times, `ล่าสุด ${last}`, rowWhen(r.last_call_at)), tone: 'warn' };
    }
    case 'interested':
      return { view, title: 'สนใจ', detail: join(times, rowWhen(r.ai_answer?.at ?? r.last_call_at)), tone: 'success' };
    case 'declined':
      return { view, title: 'ไม่สนใจ', detail: join(times, rowWhen(r.ai_answer?.at ?? r.last_call_at)), tone: 'danger' };
    case 'ai_talked':
      return { view, title: 'คุยแล้วไม่ได้คำตอบ', detail: join(TALKED_DETAIL[r.ai_answer?.micro ?? ''] ?? null, times, rowWhen(r.ai_answer?.at)), tone: 'info' };
    case 'irecruit_pull': {
      const st = irecruitPullState(r.irecruit_status);
      return { view, title: 'iRecruit', detail: join('ดึงจาก iRecruit ยังไม่ส่ง AI', st ? IRECRUIT_PULL_STATE_LABEL[st] : null), tone: 'warn' };
    }
    case 'no_job':
      return { view, title: 'ไม่ผูกใบขอ', detail: 'AI ไม่โทร · เลือกใบขอแล้วกดส่ง AI ได้', tone: 'warn' };
    default: {
      // ไม่ได้ส่ง AI — เหตุจริงตามลำดับ: ยกเลิก · เบอร์ผิด · ซ้ำ iRecruit · เหตุจากตัวส่ง (อายุเกิน · ไม่มีรายได้ · เก็บไปโทรเอง …)
      const why =
        r.last_call_status === 'cancelled'
          ? 'สาย AI ถูกยกเลิก'
          : r.phone_callable === false
            ? 'เบอร์ใช้โทรไม่ได้ (ไม่ใช่มือถือ 10 หลัก)'
            : r.irecruit_dup_at
              ? `ซ้ำ iRecruit (สมัคร ${rowWhen(r.irecruit_dup_at)}) · AI ไม่โทรเอง`
              : notSentReasonOf(r);
      return { view: 'not_sent', title: 'ไม่ได้ส่ง AI', detail: why, tone: 'warn' };
    }
  }
}
