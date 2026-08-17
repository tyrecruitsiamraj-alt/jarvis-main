// @vitest-environment node
/**
 * กติกากันโทรซ้ำของ "หาคนเพิ่มส่ง AI" (R1) — โครง SQL ต้องครบ 3 แหล่ง + เวลาถูกตัว
 * (พังเงียบ: ถ้าตกแหล่งใดแหล่งหนึ่ง คนที่เพิ่งถูกโทรจะโดนโทรซ้ำ)
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildContactedAboutJobSql,
  buildDeclinedThisJobSql,
  ROTATION_COOLDOWN_DAYS,
} from '../../api/_lib/applicationRotationSql.js';

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

/**
 * 🔴 กันเสนอซ้ำใบที่เคยปฏิเสธ — **ถาวร** (เจ้าของสั่ง 16 ส.ค. 2569:
 * "จะไม่เอาคนที่ลงงานแล้วและเคยปฏิเสธงานนั้นๆ มา match แล้วส่งให้ Lumos โทร")
 *
 * พังเงียบที่คุมไว้: ใช้ cooldown 30 วันแทนถาวร → พ้นเดือนแล้วโทรถามงานเดิม
 * ที่เขาปฏิเสธไปแล้วซ้ำหน้าตาเฉย
 */
describe('buildDeclinedThisJobSql — ปฏิเสธแล้วปฏิเสธเลย', () => {
  const sql = buildDeclinedThisJobSql();

  it('ไม่มีเงื่อนไขเวลาเลย — ถาวรโดยตั้งใจ', () => {
    // กันทุกรูปของหน้าต่างเวลา: param cutoff · now()-interval · เทียบเวลาตรง ๆ
    expect(sql).not.toContain('timestamptz');
    expect(sql).not.toContain('$3');
    expect(sql).not.toMatch(/now\(\)|interval|>=|<=/);
  });

  it('job-scoped ทั้งสองแหล่ง (ปฏิเสธใบนี้ ไม่ใช่ปฏิเสธทุกใบ)', () => {
    expect(sql).toContain('q.job_ref = $1');
    expect(sql).toContain('h.job_id = $1');
  });

  it('นับเฉพาะ outcome declined — ไม่ใช่ทุกการติดต่อ', () => {
    expect(sql).toContain(`= 'declined'`);
    expect(sql).not.toContain('is not null');
  });

  it('รวมผลสองทาง (คิว AI + ถังที่คนรับไปโทร)', () => {
    expect(sql).toContain('lumos_dispatch_queue');
    expect(sql).toContain('candidate_call_holds');
    expect((sql.match(/\bunion\b/g) || []).length).toBe(1);
  });

  it('เบอร์ในคิวอ่านสองคีย์ (reminder/interview)', () => {
    expect(sql).toContain(`coalesce(q.payload->>'recipient_phone', q.payload->>'phone')`);
  });
});

describe('ด่านถาวรอยู่ที่คอขวดเข้าคิว — ครอบทุกทางเข้า', () => {
  const src = fs.readFileSync(
    path.join(import.meta.dirname, '../../api/_lib/lumosDispatch.ts'),
    'utf8',
  );

  it('insertQueueItems เรียก phonesDeclinedThisJob และคัดออกเป็นกลุ่ม declined', () => {
    expect(src).toContain('phonesDeclinedThisJob(');
    expect(src).toMatch(/declinedPhones\.has\(phone\)/);
  });

  it('ยกเว้น job_ref=follow (ตารางโทรตามคนละเรื่อง ไม่ใช่การเสนองาน)', () => {
    expect(src).toMatch(/jobRef === 'follow'\s*\n?\s*\? new Set\(\)/);
  });

  it('มีเหตุผลรายงานให้ผู้ใช้เห็นว่าทำไมไม่ส่ง', () => {
    expect(src).toContain("'เคยปฏิเสธงานนี้ไปแล้ว — ไม่เสนอซ้ำ'");
  });

  it('คนที่ถูกคัดเพราะปฏิเสธ ต้องไม่ถูกนับซ้ำเป็น "เคยส่งแล้ว"', () => {
    expect(src).toMatch(/!declinedSet\.has\(ref\)/);
  });
});
