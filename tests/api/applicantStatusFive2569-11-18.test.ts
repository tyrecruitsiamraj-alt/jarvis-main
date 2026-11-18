/**
 * สถานะเดียวของผู้สมัคร 5 คำ (เจ้าของ 18 พ.ย. 2569):
 * "ถ้ามาก็ลงสถานะว่าสำเร็จ ถ้าโทรไม่ติด หรือ โทรแล้วไม่สนใจ หรือ นัดแล้วไม่มาก็เปลี่ยนเป็นไม่สำเร็จ
 *  ส่วนถ้านัดได้แล้วรอมาสมัครก็เปลี่ยนเป็น นัดได้" · เลื่อนแล้วมีวันใหม่ = เลื่อนนัด · ยังไม่มีใครทำอะไร = รอดำเนินการ
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { applicantProcessOf, PROCESS_STATE_LABEL } from '@/lib/applicantProcess';
import { isEarlierAppointment } from '@/lib/appointmentAttendance';
import type { PublicApplication } from '@/lib/publicApplicationsApi';

const app = (over: Partial<PublicApplication>): PublicApplication =>
  ({ id: 'x', full_name: 'ก ข', phone: '0800000000', status: 'new', created_at: '2026-11-10T03:00:00Z', ...over }) as PublicApplication;
const label = (over: Partial<PublicApplication>) => PROCESS_STATE_LABEL[applicantProcessOf(app(over)).state];
const APPT = '2026-11-20T03:00:00Z';

describe('สถานะผู้สมัคร 5 คำ', () => {
  it('ยังไม่มีใครทำอะไร = รอดำเนินการ', () => {
    expect(label({})).toBe('รอดำเนินการ');
  });
  it('โทรไม่ติด / ไม่สนใจ / ไม่มา = ไม่สำเร็จ พร้อมเหตุผล', () => {
    expect(applicantProcessOf(app({ last_contact_ok: false, last_contact_reason: 'ไม่รับสาย' }))).toMatchObject({ state: 'fail', reason: 'ไม่รับสาย' });
    expect(applicantProcessOf(app({ last_contact_ok: true, last_appointment_failed: true, last_contact_reason: 'ไม่สนใจ' }))).toMatchObject({
      state: 'fail',
      reason: 'ไม่สนใจ',
    });
    expect(applicantProcessOf(app({ appointment_at: APPT, attendance_result: 'no_show' }))).toMatchObject({ state: 'fail', reason: 'ไม่มาตามนัด' });
  });
  it('นัดได้ รอมา = นัดได้ · มา = สำเร็จ', () => {
    expect(label({ last_contact_ok: true, appointment_at: APPT })).toBe('นัดได้');
    expect(label({ appointment_at: APPT, attendance_result: 'showed' })).toBe('สำเร็จ');
  });
  it('เลื่อนแล้วมีวันใหม่ = เลื่อนนัด', () => {
    expect(label({ appointment_at: APPT, rescheduled_from: '2026-11-18T03:00:00Z' })).toBe('เลื่อนนัด');
  });
  it('ผลของนัดรอบก่อนไม่นับเป็นผลของนัดใหม่', () => {
    expect(isEarlierAppointment('2026-11-18T03:00:00Z', APPT)).toBe(true);
    expect(isEarlierAppointment(APPT, APPT)).toBe(false);
    expect(isEarlierAppointment('2026-11-20T03:00:30Z', APPT)).toBe(false);
    expect(isEarlierAppointment(null, APPT)).toBe(false);
  });
  it('ตัวกรองสถานะมีครบ 5 คำ เรียงตามเส้นทาง', () => {
    expect(Object.values(PROCESS_STATE_LABEL)).toEqual(['รอดำเนินการ', 'นัดได้', 'เลื่อนนัด', 'สำเร็จ', 'ไม่สำเร็จ']);
    const src = readFileSync('src/lib/applicantFilters.ts', 'utf8');
    expect(src).toContain('order: Object.keys(PROCESS_STATE_LABEL)');
  });
  it('server ไม่ยอมบันทึกติดต่อสำเร็จโดยไม่มีผลนัด', () => {
    const src = readFileSync('api/_handlers/application-contacts.ts', 'utf8');
    expect(src).toContain('ติดต่อสำเร็จต้องเลือก นัดหมาย (ใส่วัน) หรือ นัดหมายไม่สำเร็จ (ใส่เหตุผล)');
  });
});
