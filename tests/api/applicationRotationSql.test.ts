// @vitest-environment node
/**
 * กติกากันโทรซ้ำของ "หาคนเพิ่มส่ง AI" (R1) — โครง SQL ต้องครบ 3 แหล่ง + เวลาถูกตัว
 * (พังเงียบ: ถ้าตกแหล่งใดแหล่งหนึ่ง คนที่เพิ่งถูกโทรจะโดนโทรซ้ำ)
 */
import { describe, expect, it } from 'vitest';
import { buildContactedAboutJobSql, ROTATION_COOLDOWN_DAYS } from '../../api/_lib/applicationRotationSql.js';

describe('buildContactedAboutJobSql', () => {
  const sql = buildContactedAboutJobSql();

  it('มีครบ 3 แหล่ง (คิว + hold + contact log) เชื่อมด้วย union', () => {
    expect(sql).toContain('lumos_dispatch_queue');
    expect(sql).toContain('candidate_call_holds');
    expect(sql).toContain('application_contact_logs');
    expect((sql.match(/\bunion\b/g) || []).length).toBe(2); // 3 แหล่ง = 2 union
  });

  it('job-scoped ทุกแหล่ง (job_ref / job_id) — ไม่ใช่ per-person', () => {
    expect(sql).toContain('q.job_ref = $1');
    expect(sql).toContain('h.job_id = $1');
    expect(sql).toContain('c.job_id = $1');
  });

  it('เบอร์ในคิว coalesce สองคีย์ (reminder/interview)', () => {
    expect(sql).toContain(`coalesce(q.payload->>'recipient_phone', q.payload->>'phone')`);
  });

  it('outcome คิว coalesce last_outcome + ตัด cancelled', () => {
    expect(sql).toContain(`coalesce(q.last_outcome, q.result->>'outcome')`);
    expect(sql).toContain(`<> 'cancelled'`);
  });

  it('เวลาใช้ first_result_at/result_at (088) ไม่ใช่ created_at เดี่ยวฝั่งคิว/hold', () => {
    expect(sql).toContain('q.first_result_at');
    expect(sql).toContain('h.result_at');
    // contact log ใช้ created_at ได้ (เป็น append-only เขียนครั้งเดียวอยู่แล้ว)
    expect(sql).toContain('c.created_at >= $3');
  });

  it('cooldown default = 30 วัน', () => {
    expect(ROTATION_COOLDOWN_DAYS).toBe(30);
  });
});
