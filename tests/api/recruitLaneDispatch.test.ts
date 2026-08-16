// @vitest-environment node
/**
 * เส้นส่งคิวของเลนสรรหา (R2b) — payload + กติกากันโทรซ้ำ
 *
 * ⚠️ ไฟล์นี้ **ห้ามแตะฐาน/ห้ามยิงสายจริง** — ทดสอบเฉพาะฟังก์ชัน pure กับโครง SQL
 * (การเข้าคิวจริงมีเทสต์ที่ insertQueueItems/มีเส้นเดิมคุมอยู่แล้ว)
 */
import { describe, expect, it } from 'vitest';
import { buildRecruitLaneInterviewPayload } from '../../api/_lib/lumosDispatch.js';
import { buildContactedAnyJobSql } from '../../api/_lib/applicationRotationSql.js';
import { buildSoRecruitLeadsSql } from '../../api/_lib/soRecruitLeadsSql.js';

const job = {
  job_description_code_1: 'พนักงานขับรถ',
  job_description_code_2: 'ผู้บริหาร',
  unit_name: 'ศูนย์กระจายสินค้าชลบุรี',
};
const result = { jobId: 'siamraj-sql:DS5812003', job_family_label: 'พนักงานขับรถ' };
const at = new Date('2026-08-16T03:00:00.000Z');

describe('buildRecruitLaneInterviewPayload', () => {
  it('ref ของทุกแหล่งกลายเป็น client_candidate_id รูปเดียวกับเส้นเดิม', () => {
    for (const ref of ['ir-206387', 'app-aaaa-bbbb', 'card-4821']) {
      const p = buildRecruitLaneInterviewPayload(
        job,
        result,
        { ref, full_name: 'สมชาย ใจดี', phone_number: '081-234-5678', position_text: 'ขับรถ' },
        at,
      );
      expect(p?.client_candidate_id).toBe(`siamraj-sql:DS5812003::${ref}`);
      expect(p?.client_interview_id).toBe(`siamraj-sql:DS5812003::${ref}::interview`);
    }
  });

  it('เบอร์ถูกแปลงเป็น E.164 · ตำแหน่งมาจากใบขอ ไม่ใช่จากคน', () => {
    const p = buildRecruitLaneInterviewPayload(
      job,
      result,
      { ref: 'ir-1', full_name: 'สมชาย ใจดี', phone_number: '081-234-5678', position_text: 'ส่งของ' },
      at,
    );
    expect(p?.phone).toBe('+66812345678');
    expect(p?.position).toBe('พนักงานขับรถ ผู้บริหาร');
    expect(p?.skills).toEqual(['ส่งของ']);
  });

  it('คำถามแรกบอกว่าเป็นการ "เสนองาน" ไม่ใช่ทวงใบสมัคร (คนกลุ่มนี้ยังไม่ได้สมัคร)', () => {
    const p = buildRecruitLaneInterviewPayload(
      job,
      result,
      { ref: 'ir-1', full_name: 'สมชาย', phone_number: '0812345678', position_text: '' },
      at,
    );
    expect(p?.questions[0]).toContain('ตอนนี้เรามีงานตำแหน่ง');
    expect(p?.questions[0]).toContain('ศูนย์กระจายสินค้าชลบุรี');
    // schema ของ Lumos รับ 1–15 ข้อ
    expect(p!.questions.length).toBeGreaterThanOrEqual(1);
    expect(p!.questions.length).toBeLessThanOrEqual(15);
  });

  it('เบอร์บ้าน 9 หลัก / ไม่มีเบอร์ / ไม่มีชื่อ / ไม่มี ref = null (ไม่เข้าคิว)', () => {
    const base = { ref: 'ir-1', full_name: 'สมชาย', phone_number: '0812345678', position_text: '' };
    expect(buildRecruitLaneInterviewPayload(job, result, { ...base, phone_number: '021234567' }, at)).toBeNull();
    expect(buildRecruitLaneInterviewPayload(job, result, { ...base, phone_number: null }, at)).toBeNull();
    expect(buildRecruitLaneInterviewPayload(job, result, { ...base, full_name: '  ' }, at)).toBeNull();
    expect(buildRecruitLaneInterviewPayload(job, result, { ...base, ref: '' }, at)).toBeNull();
  });

  it('ไม่มี position_text = ไม่ใส่ skills (ห้ามส่งคีย์ว่างให้ Lumos)', () => {
    const p = buildRecruitLaneInterviewPayload(
      job,
      result,
      { ref: 'ir-1', full_name: 'สมชาย', phone_number: '0812345678', position_text: '   ' },
      at,
    );
    expect(p?.skills).toBeUndefined();
  });
});

describe('buildContactedAnyJobSql — cooldown ข้ามงานของกองใบสนใจ', () => {
  const sql = buildContactedAnyJobSql();

  it('ครบ 3 แหล่งเหมือนตัว job-scoped', () => {
    expect(sql).toContain('lumos_dispatch_queue');
    expect(sql).toContain('candidate_call_holds');
    expect(sql).toContain('application_contact_logs');
    expect((sql.match(/\bunion\b/g) || []).length).toBe(2);
  });

  it('ไม่มีเงื่อนไข job — เป็น cooldown ข้ามทุกใบขอโดยตั้งใจ', () => {
    expect(sql).not.toContain('job_ref =');
    expect(sql).not.toContain('job_id =');
  });

  it('param มีแค่ 2 ตัว ($1 เบอร์ · $2 เวลา) — เกิน/ขาดทำให้ทั้ง endpoint 500', () => {
    expect(sql).toContain('$1::text[]');
    expect(sql).toContain('$2::timestamptz');
    expect(sql).not.toContain('$3');
  });

  it('ยังตัด cancelled และใช้ stamp ของ 088 เหมือนเดิม', () => {
    expect(sql).toContain(`<> 'cancelled'`);
    expect(sql).toContain('q.first_result_at');
    expect(sql).toContain('h.result_at');
  });
});

describe('buildSoRecruitLeadsSql — กองใบสนใจที่ยังว่าง', () => {
  const sql = buildSoRecruitLeadsSql();

  it('เอาเฉพาะคนที่มีเบอร์ใช้ได้ (phone_e164 ไม่ null)', () => {
    expect(sql).toContain('a.phone_e164 is not null');
  });

  it('ตัดใบที่จบเรื่องแล้ว — rejected (ไม่เอา) กับ converted (ได้ใบสมัครแล้ว)', () => {
    expect(sql).toContain(`not in ('rejected', 'converted')`);
    expect(sql).toContain(`coalesce(a.status, 'new')`);
  });

  it('ไม่กรอง claimed_by — คนเก็บไปติดต่อเองยังส่ง AI ได้ (ล็อกอยู่ที่เบอร์ ที่เดียว)', () => {
    expect(sql).not.toContain('claimed_by');
  });

  it('param เดียว = limit', () => {
    expect(sql).toContain('limit $1');
    expect(sql).not.toContain('$2');
  });
});
