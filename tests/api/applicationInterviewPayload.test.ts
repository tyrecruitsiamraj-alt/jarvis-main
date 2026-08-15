// @vitest-environment node
/**
 * payload ส่งใบสมัครเข้าคิว AI โทร (S8 · migration 090) — ตรรกะล้วน
 * จุดสำคัญ: เบอร์ต้องแปลง E.164 ได้ · client_candidate_id ต้องมี prefix `app-`
 * (splitPersonRef/queuePersonRefFromSource รู้จัก app- แล้ว) · ไม่มี job_id = ส่งไม่ได้
 */
import { describe, expect, it } from 'vitest';
import { buildApplicationInterviewPayload } from '../../api/_lib/lumosDispatch.js';

const base = {
  id: 'a506aa87-7502-4886-8607-ccbb799b215c',
  full_name: 'ทดสอบ ระบบ',
  phone: '0812345678',
  job_id: 'siamraj-sql:OPL6908026',
  job_title: 'พนักงานขับรถ',
  unit_name: 'หน่วยงาน ก',
  position_interest: null,
};

describe('buildApplicationInterviewPayload', () => {
  it('เบอร์มือถือ 10 หลัก → payload ครบ + E.164 + client id มี prefix app-', () => {
    const p = buildApplicationInterviewPayload(base, new Date('2026-08-15T00:00:00Z'));
    expect(p).not.toBeNull();
    expect(p!.phone).toBe('+66812345678');
    expect(p!.client_candidate_id).toBe('siamraj-sql:OPL6908026::app-a506aa87-7502-4886-8607-ccbb799b215c');
    expect(p!.client_interview_id).toContain('::app-');
    expect(p!.position).toBe('พนักงานขับรถ');
    expect(p!.type).toBe('phone');
    expect(p!.questions.length).toBeGreaterThanOrEqual(1);
    expect(p!.questions.length).toBeLessThanOrEqual(15); // schema Lumos
    // คำถามแรกยืนยันความสนใจ (โจทย์เจ้าของ: โทรถามว่ายังสนใจอยู่ไหม)
    expect(p!.questions[0]).toContain('ยังสนใจ');
  });

  it('เบอร์บ้าน 9 หลัก (แปลง E.164 ไม่ได้) → null (ไปกล่องเบอร์ผิด ไม่หลุดเข้าคิว)', () => {
    expect(buildApplicationInterviewPayload({ ...base, phone: '021234567' })).toBeNull();
  });

  it('ไม่มี job_id → null (ไม่มี job_ref ให้เข้าคิว)', () => {
    expect(buildApplicationInterviewPayload({ ...base, job_id: null })).toBeNull();
  });

  it('ไม่มีชื่อ → null', () => {
    expect(buildApplicationInterviewPayload({ ...base, full_name: '  ' })).toBeNull();
  });

  it('ไม่มี job_title → ใช้ position_interest แล้วถอยไปคำ default', () => {
    const p = buildApplicationInterviewPayload({ ...base, job_title: null, position_interest: 'แม่บ้าน' });
    expect(p!.position).toBe('แม่บ้าน');
    const p2 = buildApplicationInterviewPayload({ ...base, job_title: null, position_interest: null });
    expect(p2!.position).toBe('งานที่เปิดรับ');
  });
});
