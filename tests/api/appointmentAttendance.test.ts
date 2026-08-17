// @vitest-environment node
/**
 * ผลติดตามนัด (migration 089) — ตรรกะล้วนที่ใช้ทั้งฟอร์มและด่าน API
 * จุดสำคัญ: "บันทึกได้ตั้งแต่วันนัด" ต้องเทียบระดับ **วันตามปฏิทินกรุงเทพ** ไม่ใช่ UTC
 * และไม่ใช่ระดับเวลา (นัดบ่ายโมง คนมาเช้าก็บันทึกได้)
 */
import { describe, expect, it } from 'vitest';
import {
  ATTENDANCE_LABEL,
  ATTENDANCE_RESULTS,
  ATTENDANCE_TONE,
  canRecordAttendance,
  isAttendanceResult,
} from '../../src/lib/appointmentAttendance.js';

describe('isAttendanceResult', () => {
  it('รับเฉพาะ 3 ค่า', () => {
    expect(isAttendanceResult('showed')).toBe(true);
    expect(isAttendanceResult('no_show')).toBe(true);
    expect(isAttendanceResult('rescheduled')).toBe(true);
    expect(isAttendanceResult('SHOWED')).toBe(false);
    expect(isAttendanceResult('')).toBe(false);
    expect(isAttendanceResult(null)).toBe(false);
    expect(isAttendanceResult(1)).toBe(false);
  });

  it('ทุกค่ามี label + tone ครบ (กันเพิ่มค่าแล้วลืม map)', () => {
    for (const k of ATTENDANCE_RESULTS) {
      expect(ATTENDANCE_LABEL[k]).toBeTruthy();
      expect(ATTENDANCE_TONE[k]).toBeTruthy();
    }
  });
});

describe('canRecordAttendance — วันนัดตามปฏิทินกรุงเทพ', () => {
  // นัด 20 ส.ค. เที่ยงวันไทย (= 05:00Z)
  const APPT = '2026-08-20T05:00:00.000Z';

  it('ก่อนวันนัด → ยังบันทึกไม่ได้', () => {
    expect(canRecordAttendance(APPT, new Date('2026-08-19T10:00:00Z'))).toBe(false);
  });

  it('เช้าวันนัด (ก่อนเวลานัด) → บันทึกได้ (เทียบระดับวัน ไม่ใช่เวลา)', () => {
    // 20 ส.ค. 07:00 น. ไทย = 00:00Z — ก่อนเวลานัด 5 ชม. แต่เป็นวันเดียวกัน
    expect(canRecordAttendance(APPT, new Date('2026-08-20T00:00:00Z'))).toBe(true);
  });

  it('เที่ยงคืน–07:00 น. ไทยของวันนัด → บันทึกได้ (UTC ยังเป็นเมื่อวาน — จุดที่เคยพลาดทั้งระบบ)', () => {
    // 20 ส.ค. 01:00 น. ไทย = 19 ส.ค. 18:00Z — เทียบแบบ UTC จะบอกว่ายังไม่ถึงวันนัด (ผิด)
    expect(canRecordAttendance(APPT, new Date('2026-08-19T18:00:00Z'))).toBe(true);
  });

  it('หลังวันนัด → ยังบันทึกได้ (บันทึกย้อนหลังได้ — คนลืมกดวันนัดจริง)', () => {
    expect(canRecordAttendance(APPT, new Date('2026-08-25T10:00:00Z'))).toBe(true);
  });

  it('ไม่มีวันนัด / วันนัดอ่านไม่ได้ → ไม่ได้', () => {
    expect(canRecordAttendance(null, new Date())).toBe(false);
    expect(canRecordAttendance(undefined, new Date())).toBe(false);
    expect(canRecordAttendance('ไม่ใช่วันที่', new Date())).toBe(false);
  });
});
