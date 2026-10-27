import { describe, expect, it } from 'vitest';
import { isInRmListView, RM_LIST_VIEWS_SHOWN, rmRestViewOf } from '@/lib/recruitRm';
import type { PublicApplication } from '@/lib/publicApplicationsApi';

/**
 * 14 ต.ค. 2569 เจ้าของ: "397 แบ่งเป็น สนใจ … หายไปไหน 146" → เพิ่ม ไม่รับสาย · รอติดต่อซ้ำ · ยังไม่ได้ · ข้อมูลผิด · ยกเลิก
 * 🔴 ทุกชิป (ยกเว้น "ทั้งหมด") ไม่ทับกัน รวมกัน = ทั้งหมด
 */
const row = (x: Partial<PublicApplication>) => ({ id: 'a', status: 'new', job_id: 'siamraj-sql:X', ...x }) as PublicApplication;
const FUTURE = new Date(Date.now() + 86_400_000).toISOString();
const CASES: Array<[Partial<PublicApplication>, string]> = [
  [{ last_call_outcome: 'confirmed', last_call_at: '2026-10-13T01:00:00Z' }, 'interested'],
  [{ last_call_outcome: 'declined', last_call_at: '2026-10-13T01:00:00Z' }, 'declined'],
  [{ age: 60 }, 'over_age'],
  [{ irecruit_dup_at: '2026-10-10T00:00:00Z' }, 'irecruit_dup'],
  [{ last_call_status: 'pending', last_call_followup: 'needs_human', last_call_attempts: 3, last_call_prev_outcome: 'no_answer' }, 'ai_at_risk'],
  [{ last_call_status: 'failed', last_call_followup: 'needs_human', last_call_outcome: 'no_answer', ai_answer: { micro: 'no_pickup', at: null } }, 'no_pickup'],
  [{ last_call_status: 'pending', last_call_followup: 'retry_scheduled', last_call_attempts: 2, last_call_prev_outcome: 'busy', last_call_next_at: FUTURE }, 'retry_wait'],
  [{}, 'not_sent'],
  [{ job_id: undefined }, 'not_sent'],
  [{ phone_callable: false }, 'bad_data'],
  // 20 ต.ค. 2569: ดึงจาก iRecruit ยังไม่มีใครส่ง AI = กล่อง iRecruit แยกจาก "ยังไม่ส่ง AI"
  [{ created_by_name: 'iRecruit', job_id: undefined }, 'irecruit_pull'],
  [{ created_by_name: 'สมชาย', job_id: undefined }, 'not_sent'],
  // ซ้ำ iRecruit แล้วกดส่ง AI จนตอบสนใจ = อยู่ "สนใจ" กล่องเดียว (เดิมอยู่สองกล่อง)
  [{ irecruit_dup_at: '2026-10-10T00:00:00Z', last_call_outcome: 'confirmed', last_call_at: '2026-10-13T01:00:00Z' }, 'interested'],
  [{ age: 60, irecruit_dup_at: '2026-10-10T00:00:00Z' }, 'over_age'],
  [{ last_call_status: 'cancelled' }, 'ai_cancelled'],
  // 27 ต.ค. 2569 เจ้าของ (คำสั่งล่าสุด): ไม่รับสายอยู่รอติดต่อซ้ำ · ครบ 3 ครั้ง = ไม่รับสาย (ไม่ใช่ไม่สนใจ)
  [{ last_call_status: 'failed', last_call_followup: 'needs_human', last_call_outcome: 'unresponsive', last_call_attempts: 3, last_call_at: '2026-10-27T05:00:00Z' }, 'no_pickup'],
  // เลยนัดโทรซ้ำแล้วยังไม่มีผล = ยังอยู่รอติดต่อซ้ำ (เดิมไป AI ไม่ได้ผล)
  [{ last_call_status: 'pending', last_call_followup: 'retry_scheduled', last_call_attempts: 2, last_call_prev_outcome: 'no_answer', last_call_next_at: '2026-10-01T05:00:00Z' }, 'retry_wait'],
  // ส่ง AI แล้วรอสายแรก = รอโทร (เดิมปนในยังไม่ส่ง AI)
  [{ last_call_status: 'pending', last_call_attempts: 1, last_call_sent_at: new Date().toISOString() }, 'ai_waiting'],
  // กด "ส่ง AI ใหม่" (สายเดิมเงียบ) = รอโทรทันที ไม่ค้างใน AI ไม่ได้ผล (27 ต.ค. 2569 "พอกดส่งแล้วมันไม่หาย")
  [{ last_call_status: 'pending', last_call_attempts: 1, last_call_followup: 'retry_scheduled', last_call_push_state: 'push_gave_up', last_call_sent_at: '2026-10-25T03:00:00Z', last_call_next_at: new Date().toISOString() }, 'ai_waiting'],
  // คุยแล้วแต่ไม่ได้คำตอบ ≠ ไม่รับสาย (27 ต.ค. 2569 Choice แยกกลุ่ม)
  [{ last_call_status: 'completed', last_call_outcome: 'completed', ai_answer: { micro: 'talked_unclear', at: null } }, 'ai_talked'],
];

describe('ชิปแท็บผู้สมัคร แบ่งครบไม่ทับกัน', () => {
  it.each(CASES)('%o → %s', (x, expected) => {
    const r = row(x);
    const hits = RM_LIST_VIEWS_SHOWN.filter((v) => v !== 'all' && isInRmListView(r, v));
    expect(hits).toEqual([expected]);
  });

  it('ชิปท้ายแถวคืน null เมื่ออยู่ชิปก่อนหน้าแล้ว', () => {
    expect(rmRestViewOf(row({ age: 60, phone_callable: false }))).toBeNull();
  });
});

describe('ทำไมยังไม่ส่ง AI (27 ต.ค. 2569)', () => {
  it('บอกเหตุผลจากช่องบนแถว', async () => {
    const { aiAnswerTextOf, notSentReasonOf } = await import('@/lib/applicantAiAnswerText');
    expect(notSentReasonOf(row({ claimed_by_name: 'แป๋ม' }))).toBe('เก็บไปโทรเอง · แป๋ม');
    expect(notSentReasonOf(row({ job_id: undefined }))).toBe('ไม่ผูกใบขอ');
    expect(notSentReasonOf(row({ created_by_name: 'narissara.p@siamraj.com' }))).toBe('เพิ่มเอง/นำเข้า ยังไม่กดส่ง AI');
    expect(notSentReasonOf(row({}))).toBe('สมัครผ่านลิงก์ ระบบไม่ได้ส่ง');
    expect(aiAnswerTextOf(row({ job_id: undefined }))).toMatchObject({ kind: 'not_sent', reason: 'ไม่ผูกใบขอ' });
  });
  it('ลำดับบนจอตามที่เจ้าของสั่ง', () => {
    expect(RM_LIST_VIEWS_SHOWN).toEqual([
      'all', 'ai_waiting', 'interested', 'declined', 'over_age', 'irecruit_dup', 'retry_wait', 'no_pickup', 'ai_talked',
      'irecruit_pull', 'not_sent', 'ai_cancelled', 'ai_at_risk', 'bad_data',
    ]);
  });
});

describe('โทรครบแล้ว (27 ต.ค. 2569 "บอกหน่อยว่าโทรครบ 3 ครั้งแล้ว")', () => {
  it('คิวปิดเพราะไม่มีคนรับ = บอกจำนวนครั้ง · อย่างอื่นไม่บอก', async () => {
    const { aiCallsDoneText } = await import('@/lib/applicantAiAnswerText');
    expect(aiCallsDoneText(row({ last_call_status: 'failed', last_call_followup: 'needs_human', last_call_outcome: 'busy', last_call_attempts: 3 }))).toBe('โทรครบ 3 ครั้งแล้ว');
    expect(aiCallsDoneText(row({ last_call_status: 'failed', last_call_followup: 'needs_human', last_call_outcome: 'wrong_person', last_call_attempts: 1 }))).toBeNull();
    expect(aiCallsDoneText(row({ last_call_status: 'pending', last_call_followup: 'retry_scheduled', last_call_attempts: 2 }))).toBeNull();
  });
});
