import { describe, it, expect } from 'vitest';
import {
  toE164Thai,
  jobPositionLabel,
  buildReminderPayload,
  buildInterviewPayload,
  bumpScheduledAtForward,
} from '../../api/_lib/lumosDispatch';

const NOW = new Date('2026-07-30T10:00:00+07:00');

const JOB = {
  unit_name: 'การประปาส่วนภูมิภาค เขต8',
  job_description_code_1: 'อ่านมาตร',
  job_description_code_2: 'ไม่ระบุ',
  staff_title_name: 'พนักงาน',
  required_date: '2026-08-01',
  total_income: 6000,
};

describe('toE164Thai', () => {
  it('แปลงเบอร์มือถือไทยเป็น +66', () => {
    expect(toE164Thai('0812345678')).toBe('+66812345678');
    expect(toE164Thai('081-234-5678')).toBe('+66812345678');
    expect(toE164Thai('66812345678')).toBe('+66812345678');
  });
  it('คืน null เมื่อแปลงไม่ได้', () => {
    expect(toE164Thai(null)).toBeNull();
    expect(toE164Thai('')).toBeNull();
    expect(toE164Thai('123')).toBeNull();
    expect(toE164Thai('02-123-4567')).toBeNull(); // เบอร์บ้าน 9 หลัก ไม่ใช่มือถือ 10 หลัก
  });
});

describe('jobPositionLabel', () => {
  it('ใช้ job description ก่อน โดยตัด "ไม่ระบุ" ทิ้ง', () => {
    expect(jobPositionLabel(JOB)).toBe('อ่านมาตร');
  });
  it('fallback เป็น staff title แล้วค่อย family label', () => {
    expect(jobPositionLabel({ staff_title_name: 'พนักงาน' })).toBe('พนักงาน');
    expect(jobPositionLabel({}, 'งานขับรถ')).toBe('งานขับรถ');
    expect(jobPositionLabel({})).toBe('ตามใบขอ');
  });
});

describe('buildReminderPayload', () => {
  const RESULT = { jobId: 'siamraj-sql:DS5812003', request_no: 'DS5812003', job_family_label: 'งานมิเตอร์' };

  it('สร้าง payload ตาม schema Lumos reminder', () => {
    const p = buildReminderPayload(JOB, RESULT, { card_id: 42, full_name: 'สมชาย ใจดี', mobile: '0812345678' }, NOW);
    expect(p).not.toBeNull();
    expect(p!.client_contact_id).toBe('siamraj-sql:DS5812003::card-42');
    expect(p!.recipient_phone).toBe('+66812345678');
    expect(p!.steps).toHaveLength(1);
    expect(p!.steps[0].type).toBe('remind');
    expect(p!.steps[0].message).toContain('อ่านมาตร');
    expect(p!.steps[0].message).toContain('การประปาส่วนภูมิภาค เขต8');
    expect(p!.steps[0].message).toContain('DS5812003');
    expect(p!.steps[0].scheduled_at).toBe(NOW.toISOString());
  });

  it('คืน null เมื่อไม่มีเบอร์ที่ใช้ได้ (Lumos ต้องมีเบอร์)', () => {
    expect(buildReminderPayload(JOB, RESULT, { card_id: 1, full_name: 'ไม่มีเบอร์', mobile: null }, NOW)).toBeNull();
  });
});

describe('bumpScheduledAtForward — Lumos บังคับ scheduled_at เป็น now or future', () => {
  const SERVE = new Date('2026-07-30T16:17:00+07:00');
  const FLOOR = new Date(SERVE.getTime() + 2 * 60_000).toISOString();

  it('เวลาที่เลยมาแล้ว (เข้าคิวก่อนถูกดึง) ถูกขยับเป็นอนาคต — ทั้งระดับบนและใน steps', () => {
    const past = '2026-07-30T16:10:00+07:00';
    const out = bumpScheduledAtForward(
      { scheduled_at: past, steps: [{ type: 'remind', message: 'ม', scheduled_at: past }] },
      SERVE,
    ) as { scheduled_at: string; steps: Array<{ scheduled_at: string }> };
    expect(out.scheduled_at).toBe(FLOOR);
    expect(out.steps[0].scheduled_at).toBe(FLOOR);
  });

  it('เวลาอนาคต (เช่น Follow ที่นัดล่วงหน้า) ต้องไม่ถูกแตะ', () => {
    const future = '2026-08-15T09:30:00+07:00';
    const out = bumpScheduledAtForward({ scheduled_at: future, steps: [{ scheduled_at: future }] }, SERVE) as {
      scheduled_at: string;
      steps: Array<{ scheduled_at: string }>;
    };
    expect(out.scheduled_at).toBe(future);
    expect(out.steps[0].scheduled_at).toBe(future);
  });

  it('ไม่พังกับ payload แปลก ๆ และไม่แก้ object เดิม', () => {
    expect(bumpScheduledAtForward(null, SERVE)).toBeNull();
    const original = { scheduled_at: '2026-07-30T16:10:00+07:00' };
    bumpScheduledAtForward(original, SERVE);
    expect(original.scheduled_at).toBe('2026-07-30T16:10:00+07:00');
  });
});

describe('buildInterviewPayload', () => {
  const RESULT = { jobId: 'siamraj-sql:OPL6902120', request_no: 'OPL6902120', job_family_label: 'งานขับรถ' };

  it('สร้าง payload ตาม schema Lumos interview พร้อมคำถาม 1–15 ข้อ', () => {
    const p = buildInterviewPayload(
      { ...JOB, job_description_code_1: 'ขับรถ', job_description_code_2: 'ชนิดที่ 2' },
      RESULT,
      { id: 7, full_name: 'สมหญิง รักงาน', phone_number: '0899999999', job_name_th: 'พนักงานขับรถ', position_name: null },
      NOW,
    );
    expect(p).not.toBeNull();
    expect(p!.client_candidate_id).toBe('siamraj-sql:OPL6902120::ir-7');
    expect(p!.client_interview_id).toBe('siamraj-sql:OPL6902120::ir-7::interview');
    expect(p!.phone).toBe('+66899999999');
    expect(p!.position).toBe('ขับรถ ชนิดที่ 2');
    expect(p!.questions.length).toBeGreaterThanOrEqual(1);
    expect(p!.questions.length).toBeLessThanOrEqual(15);
    expect(p!.type).toBe('phone');
    expect(p!.skills).toEqual(['พนักงานขับรถ']);
  });

  it('คืน null เมื่อไม่มีเบอร์', () => {
    expect(
      buildInterviewPayload(JOB, RESULT, { id: 1, full_name: 'ไม่มีเบอร์', phone_number: null, job_name_th: null, position_name: null }, NOW),
    ).toBeNull();
  });
});
