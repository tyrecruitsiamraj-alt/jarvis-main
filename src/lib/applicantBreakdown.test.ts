import { describe, expect, it } from 'vitest';
import {
  APPLICANT_BUCKETS,
  APPLICANT_BUCKET_GROUPS,
  applicantBucketOf,
  countApplicantBreakdown,
  isInApplicantBreakdown,
} from '@/lib/applicantBreakdown';
import type { PublicApplication } from '@/lib/publicApplicationsApi';

/** แตกยอดผู้สมัคร (เจ้าของสั่ง 14 ต.ค. 2569) — ทุกคนอยู่กลุ่มเดียว ทุกชั้นบวกได้ทั้งหมด */
const NOW = Date.parse('2026-10-14T05:00:00Z');
const row = (x: Partial<PublicApplication>) => ({ job_id: 'siamraj-sql:X1', ...x }) as PublicApplication;

const CASES: Array<[string, Partial<PublicApplication>, string]> = [
  ['AI โทร ตอบสนใจ', { last_call_outcome: 'confirmed', last_call_at: '2026-10-13T01:00:00Z', ai_answer: { micro: 'said_yes', at: null }, last_call_status: 'completed' }, 'ai_yes'],
  ['AI โทร ตอบไม่สนใจ', { last_call_outcome: 'declined', last_call_at: '2026-10-13T01:00:00Z', ai_answer: { micro: 'said_no', at: null }, last_call_status: 'completed' }, 'ai_no'],
  ['ไม่รับสาย รอโทรซ้ำ', { last_call_status: 'pending', last_call_attempts: 2, last_call_followup: 'retry_scheduled', last_call_prev_outcome: 'no_answer', last_call_next_at: '2026-10-15T07:00:00Z' }, 'ai_retry'],
  ['AI โทรครบ คิวปิด ผลล่าสุดไม่รับ', { last_call_status: 'failed', last_call_followup: 'needs_human', last_call_outcome: 'no_answer', ai_answer: { micro: 'no_pickup', at: null } }, 'ai_gave_up'],
  ['คุยแล้วสรุปไม่ได้', { last_call_status: 'completed', last_call_outcome: 'acknowledged', ai_answer: { micro: 'talked_unclear', at: null } }, 'ai_unclear'],
  ['เจ้าหน้าที่ติดต่อแล้วไม่เอา (AI ไม่เคยโทร)', { last_contact_ok: false, last_contact_at: '2026-10-13T01:00:00Z' }, 'staff_no'],
  ['รอ AI รอบแรก', { last_call_status: 'pending', last_call_attempts: 1, last_call_sent_at: new Date(NOW - 5 * 60_000).toISOString() }, 'wait'],
  ['ส่งรอบแรกแล้วเงียบ', { last_call_status: 'pending', last_call_attempts: 1, last_call_sent_at: '2026-10-14T03:00:00Z' }, 'wait_late'],
  ['อายุเกิน', { age: 60 }, 'over_age'],
  ['ซ้ำ iRecruit', { irecruit_dup_at: '2026-10-10T00:00:00Z' }, 'irecruit_dup'],
  ['เบอร์ใช้ไม่ได้', { phone_callable: false }, 'bad_phone'],
  ['ไม่ได้เลือกงาน', { job_id: undefined }, 'no_job'],
  ['มีใบขอ ยังไม่ส่ง', {}, 'not_sent_other'],
];

describe('applicantBucketOf', () => {
  it.each(CASES)('%s', (_, x, expected) => {
    expect(applicantBucketOf(row(x), NOW)).toBe(expected);
  });

  it('🔴 ทุกชั้นบวกได้ทั้งหมด · กลุ่ม = ผลรวมกลุ่มย่อย · กลุ่มกับกลุ่มย่อยไม่ใช้คีย์ซ้ำกัน', () => {
    const rows = CASES.map(([, x]) => row(x));
    const c = countApplicantBreakdown(rows, NOW);
    expect(APPLICANT_BUCKETS.reduce((s, k) => s + c[k], 0)).toBe(rows.length);
    expect(APPLICANT_BUCKET_GROUPS.reduce((s, k) => s + c[k], 0)).toBe(rows.length);
    expect(c.ai_called).toBe(c.ai_yes + c.ai_no + c.ai_retry + c.ai_gave_up + c.ai_unclear);
    expect(c.not_sent).toBe(c.over_age + c.irecruit_dup + c.bad_phone + c.no_job + c.not_sent_other);
    expect(new Set([...APPLICANT_BUCKETS, ...APPLICANT_BUCKET_GROUPS]).size).toBe(APPLICANT_BUCKETS.length + APPLICANT_BUCKET_GROUPS.length);
  });

  it('กรองด้วยกลุ่มหรือกลุ่มย่อยได้', () => {
    const r = row(CASES[2][1]);
    expect(isInApplicantBreakdown(r, 'ai_retry', NOW)).toBe(true);
    expect(isInApplicantBreakdown(r, 'ai_called', NOW)).toBe(true);
    expect(isInApplicantBreakdown(r, 'waiting', NOW)).toBe(false);
  });
});
