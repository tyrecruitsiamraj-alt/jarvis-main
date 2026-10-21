/**
 * ═══ ตารางนัดของวันแยกสถานที่ (เจ้าของ 21 ต.ค. 2569 · แบบ iRecruit "ติดตามนัด") ═══
 * มา + ไม่มา + รอผล = นัด · ใครนัดนับครบ · ตัดวันตามเวลาไทย · ไม่มีสถานที่ไม่หาย
 */
import { describe, expect, it } from 'vitest';
import { NO_PLACE, buildAppointmentPlaces, isInAppointmentPlace, shiftYmd } from '@/lib/appointmentPlaces';

const rows = [
  { appointment_at: '2026-10-21T02:00:00Z', appointment_place: 'บูรโลตัส ลาดพร้าว', appointment_by: 'อัน', attendance_result: 'showed' },
  { appointment_at: '2026-10-21T03:00:00Z', appointment_place: 'บูรโลตัส ลาดพร้าว', appointment_by: 'อัน', attendance_result: null },
  { appointment_at: '2026-10-21T04:00:00Z', appointment_place: 'บูรโลตัส ลาดพร้าว', appointment_by: 'คิว', attendance_result: 'no_show' },
  { appointment_at: '2026-10-21T05:00:00Z', appointment_place: 'Online', appointment_by: null, attendance_result: 'rescheduled' },
  { appointment_at: '2026-10-21T06:00:00Z', appointment_place: '  ', appointment_by: 'เล็ก', attendance_result: null },
  // 20 ต.ค. 23:30 UTC = 21 ต.ค. 06:30 ไทย → นับเป็นวันที่ 21
  { appointment_at: '2026-10-20T23:30:00Z', appointment_place: 'Online', appointment_by: 'เล็ก', attendance_result: null },
  // 21 ต.ค. 17:30 UTC = 22 ต.ค. ไทย → ไม่นับ
  { appointment_at: '2026-10-21T17:30:00Z', appointment_place: 'Online', appointment_by: 'เล็ก', attendance_result: null },
  { appointment_at: null, appointment_place: 'Online', appointment_by: 'เล็ก', attendance_result: null },
];

describe('buildAppointmentPlaces', () => {
  const out = buildAppointmentPlaces(rows, '2026-10-21');

  it('นัดทั้งหมดของวัน (ตัดวันตามเวลาไทย)', () => {
    expect(out.total).toBe(6);
  });

  it('🔴 มา + ไม่มา + เลื่อนนัด + รอผล = นัด ทุกสถานที่ · รวมทุกสถานที่ = นัดทั้งหมด', () => {
    for (const p of out.places) expect(p.showed + p.noShow + p.rescheduled + p.pending).toBe(p.total);
    expect(out.places.reduce((n, p) => n + p.total, 0)).toBe(out.total);
  });

  it('เรียงสถานที่นัดมากก่อน · ใครนัดนับครบ · ไม่มีสถานที่ไม่หาย', () => {
    expect(out.places.map((p) => [p.place, p.total])).toEqual([
      ['บูรโลตัส ลาดพร้าว', 3],
      ['Online', 2],
      [NO_PLACE, 1],
    ]);
    expect(out.places[0].by).toEqual([{ name: 'อัน', count: 2 }, { name: 'คิว', count: 1 }]);
    expect(out.places[1].by.map((b) => b.name).sort()).toEqual(['ไม่ระบุ', 'เล็ก'].sort());
  });

  it('กดแถว = กรองรายชื่อวัน+สถานที่นั้น', () => {
    expect(rows.filter((r) => isInAppointmentPlace(r, '2026-10-21', 'Online'))).toHaveLength(2);
    expect(rows.filter((r) => isInAppointmentPlace(r, '2026-10-21', null))).toHaveLength(6);
  });

  it('เลื่อนวันข้ามเดือน', () => {
    expect(shiftYmd('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftYmd('2026-11-01', -1)).toBe('2026-10-31');
  });
});
