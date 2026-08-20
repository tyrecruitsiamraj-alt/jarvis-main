import { describe, expect, it } from 'vitest';
import { buildAppointmentBoard } from '@/lib/appointmentBoard';

/**
 * บอร์ดสรุปนัดหมาย (เจ้าของสั่ง 20 ส.ค. 2569 ข้อ 12) —
 * "นัดทั้งหมดเท่าไหร่ มาเท่าไหร่ ไม่มาเท่าไหร่" ต่อวัน
 */
describe('buildAppointmentBoard', () => {
  it('นับต่อวัน + ยอดรวม · แถวไม่มีวันนัดไม่นับ', () => {
    const rows = [
      { appointment_at: '2026-08-20T02:00:00.000Z', attendance_result: 'showed' },
      { appointment_at: '2026-08-20T05:00:00.000Z', attendance_result: 'no_show' },
      { appointment_at: '2026-08-20T08:00:00.000Z', attendance_result: null },
      { appointment_at: '2026-08-21T03:00:00.000Z', attendance_result: 'rescheduled' },
      { appointment_at: null, attendance_result: 'showed' }, // ยังไม่ได้นัด — ไม่นับ
    ];
    const b = buildAppointmentBoard(rows);
    expect(b.total).toMatchObject({ total: 4, showed: 1, noShow: 1, rescheduled: 1, pending: 1 });
    expect(b.days).toHaveLength(2);
    // วันใหม่สุดก่อน
    expect(b.days[0]).toMatchObject({ date: '2026-08-21', total: 1, rescheduled: 1 });
    expect(b.days[1]).toMatchObject({ date: '2026-08-20', total: 3, showed: 1, noShow: 1, pending: 1 });
  });

  it('🔴 มา+ไม่มา+เลื่อน+รอผล = ทั้งหมด เสมอ (ห้ามมีนัดตกหล่น)', () => {
    const rows = [
      { appointment_at: '2026-08-20T01:00:00.000Z', attendance_result: 'showed' },
      { appointment_at: '2026-08-20T02:00:00.000Z', attendance_result: 'ไม่ใช่ค่า' }, // ค่าเพี้ยน = รอผล
      { appointment_at: '2026-08-20T03:00:00.000Z', attendance_result: undefined },
    ];
    const b = buildAppointmentBoard(rows);
    const d = b.days[0];
    expect(d.showed + d.noShow + d.rescheduled + d.pending).toBe(d.total);
    expect(d).toMatchObject({ total: 3, showed: 1, pending: 2 });
  });

  it('🔴 ตัดวันตามปฏิทินกรุงเทพ — ดึกของไทย (17:30Z = 00:30 ไทย) ต้องเป็นวันถัดไป', () => {
    const b = buildAppointmentBoard([
      { appointment_at: '2026-08-20T17:30:00.000Z', attendance_result: null },
    ]);
    expect(b.days[0].date).toBe('2026-08-21');
  });

  it('ลิสต์ว่างไม่พัง', () => {
    const b = buildAppointmentBoard([]);
    expect(b.total.total).toBe(0);
    expect(b.days).toEqual([]);
  });
});
