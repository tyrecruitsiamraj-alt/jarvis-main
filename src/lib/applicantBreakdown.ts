import type { PublicApplication } from '@/lib/publicApplicationsApi';
import { isInterestedApplicant, isNotInterestedApplicant } from '@/lib/applicantCallOutcome';
import { isOverAge } from '@/lib/applicantAge';
import { aiQueueStatusOf } from '@/lib/applicantAiQueueStatus';

/**
 * ═══ แตกยอดผู้สมัครทั้งหมด — ทุกกลุ่มบวกกันได้ทั้งหมด (เจ้าของสั่ง 14 ต.ค. 2569) ═══
 *
 * > *"หน้าผู้สมัคร จาก 396 ย่อยมาให้ดูหน่อยว่าแบ่งไปอันไหนอะไรยังไง"*
 * > *"มันต้องบอกว่าทั้งหมดเท่าไหร่ / Ai โทรไปแล้วเท่าไหร่ ย่อยมาเป็น สนใจเท่าไหร่ ไม่สนใจ ไม่รับสายรอโทรซ้ำ
 * >  ติดต่อไม่ได้หลายครั้ง / รอโทร ไรงี้"*
 *
 * ชิปเดิม (สนใจ · ไม่สนใจ · อายุเกิน · ซ้ำ · AI ไม่ได้ผล) ซ้อนกัน บวกกันไม่ได้ทั้งหมด ⇒ ตัวนี้จัดทุกคนลง **กลุ่มเดียว**
 * ลำดับตัดสิน: สนใจ/ไม่สนใจ (ตัวเดียวกับชิป) → AI โทรแล้ว (ตามสถานะคิว) → รอ AI โทร → ยังไม่ได้ส่งให้ AI
 * สนใจ/ไม่สนใจที่มาจากเจ้าหน้าที่ติดต่อเอง (AI ไม่เคยโทร) แยกเป็น "เจ้าหน้าที่ติดต่อแล้ว" — ไม่นับว่า AI โทร
 */
export type ApplicantBucket =
  | 'ai_yes'
  | 'ai_no'
  | 'ai_retry'
  | 'ai_gave_up'
  | 'ai_unclear'
  | 'staff_yes'
  | 'staff_no'
  | 'wait'
  | 'wait_late'
  | 'over_age'
  | 'irecruit_dup'
  | 'bad_phone'
  | 'no_job'
  | 'not_sent_other';

export type ApplicantBucketGroup = 'ai_called' | 'staff' | 'waiting' | 'not_sent';

export const APPLICANT_BREAKDOWN: ReadonlyArray<{
  group: ApplicantBucketGroup;
  label: string;
  buckets: ReadonlyArray<{ key: ApplicantBucket; label: string }>;
}> = [
  {
    group: 'ai_called',
    label: 'AI โทรแล้ว',
    buckets: [
      { key: 'ai_yes', label: 'สนใจ' },
      { key: 'ai_no', label: 'ไม่สนใจ' },
      { key: 'ai_retry', label: 'ไม่รับสาย รอโทรซ้ำ' },
      { key: 'ai_gave_up', label: 'ติดต่อไม่ได้หลายครั้ง' },
      { key: 'ai_unclear', label: 'คุยแล้วยังไม่ได้คำตอบ' },
    ],
  },
  {
    group: 'waiting',
    label: 'รอ AI โทร',
    buckets: [
      { key: 'wait', label: 'ยังไม่ถึงคิว' },
      { key: 'wait_late', label: 'ส่งแล้วยังไม่มีผล' },
    ],
  },
  {
    group: 'not_sent',
    label: 'ยังไม่ได้ส่งให้ AI',
    buckets: [
      { key: 'over_age', label: 'อายุเกิน' },
      { key: 'irecruit_dup', label: 'ซ้ำ iRecruit' },
      { key: 'bad_phone', label: 'เบอร์ใช้โทรไม่ได้' },
      { key: 'no_job', label: 'ไม่ได้เลือกงาน' },
      { key: 'not_sent_other', label: 'ยังไม่ส่ง' },
    ],
  },
  {
    group: 'staff',
    label: 'เจ้าหน้าที่ติดต่อเอง',
    buckets: [
      { key: 'staff_yes', label: 'สนใจ' },
      { key: 'staff_no', label: 'ไม่สนใจ' },
    ],
  },
];

export const APPLICANT_BUCKETS: readonly ApplicantBucket[] = APPLICANT_BREAKDOWN.flatMap((g) => g.buckets.map((b) => b.key));
export const APPLICANT_BUCKET_GROUPS: readonly ApplicantBucketGroup[] = APPLICANT_BREAKDOWN.map((g) => g.group);
const GROUP_OF = new Map<ApplicantBucket, ApplicantBucketGroup>(
  APPLICANT_BREAKDOWN.flatMap((g) => g.buckets.map((b) => [b.key, g.group] as const)),
);

export function applicantBucketGroupOf(b: ApplicantBucket): ApplicantBucketGroup {
  return GROUP_OF.get(b) ?? 'not_sent';
}

export function isApplicantBreakdownKey(v: string | null | undefined): v is ApplicantBucket | ApplicantBucketGroup {
  return !!v && ((APPLICANT_BUCKETS as readonly string[]).includes(v) || (APPLICANT_BUCKET_GROUPS as readonly string[]).includes(v));
}

type Row = Pick<
  PublicApplication,
  | 'ai_answer'
  | 'age'
  | 'irecruit_dup_at'
  | 'phone_callable'
  | 'job_id'
  | 'last_call_status'
  | 'last_call_attempts'
  | 'last_call_next_at'
  | 'last_call_followup'
  | 'last_call_prev_outcome'
  | 'last_call_push_state'
  | 'last_call_import_status'
  | 'last_call_sent_at'
  | 'last_call_outcome'
  | 'last_call_at'
  | 'last_contact_ok'
  | 'last_contact_at'
>;

/** ผลที่แปลว่าติดต่อตัวไม่ได้ (ตัวเดียวกับถัง "ไม่ติด" ของทั้งระบบ `UNREACHED_CALL_OUTCOMES`) */
const UNREACHED = new Set(['no_answer', 'busy', 'unresponsive', 'failed']);

/** AI เคยโทรถึงตัวใบนี้แล้วไหม (มีผลจาก AI อย่างน้อยหนึ่งสาย) */
function aiCalled(r: Row, kind: string | null, attempts: number): boolean {
  if (r.ai_answer) return true;
  if (r.last_call_status === 'completed' || r.last_call_status === 'failed') return true;
  if (kind === 'retry' || kind === 'retry_late' || kind === 'needs_human') return true;
  return (kind === 'silent' || kind === 'not_imported') && attempts > 1;
}

export function applicantBucketOf(r: Row, now: number = Date.now()): ApplicantBucket {
  const q = aiQueueStatusOf(r, now);
  const kind = q?.kind ?? null;
  const attempts = Math.max(1, Math.trunc(Number(r.last_call_attempts) || 1));
  const called = aiCalled(r, kind, attempts);
  if (isInterestedApplicant(r)) return called ? 'ai_yes' : 'staff_yes';
  if (isNotInterestedApplicant(r)) return called ? 'ai_no' : 'staff_no';
  if (kind === 'retry' || kind === 'retry_late') return 'ai_retry';
  if (called && (kind === 'needs_human' || kind === 'silent' || kind === 'not_imported')) return 'ai_gave_up';
  // AI โทรครบรอบแล้ว คิวปิด (failed + needs_human) · ผลสายล่าสุดยังติดต่อไม่ได้ = ติดต่อไม่ได้หลายครั้ง (ใช้ผลสายล่าสุด · เจ้าของ 14 ต.ค.)
  if (called && r.last_call_followup === 'needs_human' && UNREACHED.has((r.last_call_outcome ?? '').trim())) return 'ai_gave_up';
  if (called) return 'ai_unclear';
  if (kind === 'waiting') return 'wait';
  if (kind === 'first_late' || kind === 'silent' || kind === 'not_imported') return 'wait_late';
  if (isOverAge(r.age)) return 'over_age';
  if (r.irecruit_dup_at) return 'irecruit_dup';
  if (r.phone_callable === false) return 'bad_phone';
  if (!r.job_id) return 'no_job';
  return 'not_sent_other';
}

export function isInApplicantBreakdown(r: Row, key: ApplicantBucket | ApplicantBucketGroup, now: number = Date.now()): boolean {
  const b = applicantBucketOf(r, now);
  return b === key || applicantBucketGroupOf(b) === key;
}

export type ApplicantBreakdownCounts = Record<ApplicantBucket | ApplicantBucketGroup, number> & { total: number };

export function countApplicantBreakdown(rows: readonly Row[], now: number = Date.now()): ApplicantBreakdownCounts {
  const out = { total: rows.length } as ApplicantBreakdownCounts;
  for (const k of [...APPLICANT_BUCKETS, ...APPLICANT_BUCKET_GROUPS]) out[k] = 0;
  for (const r of rows) {
    const b = applicantBucketOf(r, now);
    out[b] += 1;
    out[applicantBucketGroupOf(b)] += 1;
  }
  return out;
}
