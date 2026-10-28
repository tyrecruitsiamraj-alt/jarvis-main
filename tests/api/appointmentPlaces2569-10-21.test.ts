/**
 * ═══ ตารางนัดของวันแยกสถานที่ + เวลา (เจ้าของ 21 ต.ค. 2569 · แบบ iRecruit "ติดตามนัด") ═══
 * มา + ไม่มา + รอผล = นัด · ใครนัดนับครบ · ตัดวันตามเวลาไทย · ไม่มีสถานที่ไม่หาย
 * "บูธเดียวกัน 11.00 กับ 15.00 น. จะแยกยังไงได้" → แถว = สถานที่ + เวลา · นัดเก่า (12:00 ที่ระบบตั้ง) = ไม่ระบุเวลา
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NO_PLACE, buildAppointmentPlaces, isInAppointmentPlace, placeKeyOf, shiftYmd } from '@/lib/appointmentPlaces';
import { APPOINTMENT_TIMES, LEGACY_NOON, appointmentAtWithTime, appointmentTimeOf, appointmentWhenText } from '@/lib/appointmentTime';

// เวลาไทย = UTC+7 : 04:00Z = 11:00 · 08:00Z = 15:00 · 05:00Z = 12:00 (นัดเก่า)
const rows = [
  { appointment_at: '2026-10-21T04:00:00Z', appointment_place: 'บูธโลตัส ลาดพร้าว', appointment_by: 'อัน', attendance_result: 'showed' },
  { appointment_at: '2026-10-21T04:00:00Z', appointment_place: 'บูธโลตัส ลาดพร้าว', appointment_by: 'อัน', attendance_result: null },
  { appointment_at: '2026-10-21T08:00:00Z', appointment_place: 'บูธโลตัส ลาดพร้าว', appointment_by: 'คิว', attendance_result: 'no_show' },
  { appointment_at: '2026-10-21T05:00:00Z', appointment_place: 'Online', appointment_by: null, attendance_result: 'rescheduled' },
  { appointment_at: '2026-10-21T05:00:00Z', appointment_place: '  ', appointment_by: 'เล็ก', attendance_result: null },
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

  it('🔴 มา + ไม่มา + เลื่อนนัด + รอผล = นัด ทุกแถว · รวมทุกแถว = นัดทั้งหมด', () => {
    for (const p of out.places) expect(p.showed + p.noShow + p.rescheduled + p.pending).toBe(p.total);
    expect(out.places.reduce((n, p) => n + p.total, 0)).toBe(out.total);
  });

  it('🔴 รวมแถวตามสถานที่ (28 ต.ค. 2569 แทนแยกตามเวลา) · เวลาที่มีนัดอยู่ในแถว · ไม่ระบุสถานที่ไว้ท้าย', () => {
    expect(out.places.map((p) => [p.place, p.times, p.noTime, p.total])).toEqual([
      ['บูธโลตัส ลาดพร้าว', ['11:00', '15:00'], false, 3],
      ['Online', ['06:30'], true, 2],
      [NO_PLACE, [], true, 1],
    ]);
    expect(out.places[0].by[0]).toEqual({ name: 'อัน', count: 2 });
  });

  it('กดแถว = กรองรายชื่อวัน+สถานที่นั้น (ทุกเวลา)', () => {
    const key = placeKeyOf(rows[0]);
    expect(rows.filter((r) => isInAppointmentPlace(r, '2026-10-21', key))).toHaveLength(3);
    expect(rows.filter((r) => isInAppointmentPlace(r, '2026-10-21', null))).toHaveLength(6);
  });

  it('เลื่อนวันข้ามเดือน', () => {
    expect(shiftYmd('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftYmd('2026-11-01', -1)).toBe('2026-10-31');
  });
});

describe('เวลานัด', () => {
  it('🔴 ช่องเวลาไม่มี 12:00 (เวลาที่นัดเก่าถูกตั้ง) · 08:00–18:00 ทีละครึ่งชั่วโมง', () => {
    expect(APPOINTMENT_TIMES).not.toContain(LEGACY_NOON);
    expect(APPOINTMENT_TIMES[0]).toBe('08:00');
    expect(APPOINTMENT_TIMES.at(-1)).toBe('18:00');
    expect(APPOINTMENT_TIMES).toContain('11:00');
    expect(APPOINTMENT_TIMES).toContain('15:00');
  });

  it('ส่งเป็นเวลาไทย แล้วอ่านกลับได้เวลาเดิม · นัดเก่า = ไม่มีเวลา', () => {
    const at = appointmentAtWithTime('2026-10-21', '15:00');
    expect(new Date(at).toISOString()).toBe('2026-10-21T08:00:00.000Z');
    expect(appointmentTimeOf(at)).toBe('15:00');
    expect(appointmentTimeOf('2026-10-21T05:00:00Z')).toBeNull();
    expect(appointmentWhenText(at)).toBe('21 ต.ค. 2569 15:00 น.');
    expect(appointmentWhenText('2026-10-21T05:00:00Z')).toBe('21 ต.ค. 2569');
  });

  it('ฟอร์มนัดมีช่องเวลาแบบต้องกรอก ทั้งนัดหมายและเลื่อนนัด', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/components/recruit-rm/ApplicantContactDialog.tsx'), 'utf8');
    expect(src).toContain('data-testid="appointment-time"');
    expect(src).toContain("if (apptPick === 'ok' && !apptTime) return setError('นัดหมายต้องใส่เวลา');");
    expect(src).toContain("if (followPicked === 'rescheduled' && !apptTime) return setError('เลื่อนนัดต้องใส่เวลา');");
    expect(src.match(/appointmentAtWithTime\(apptDate, apptTime\)/g)?.length).toBe(2);
  });
});

describe('โหลดเป็น PDF แบบใบ iRecruit', () => {
  const sheet = fs.readFileSync(path.join(process.cwd(), 'src/components/recruit-rm/AppointmentPrintSheet.tsx'), 'utf8');
  const ws = fs.readFileSync(path.join(process.cwd(), 'src/components/recruit-rm/RmWorkspace.tsx'), 'utf8');

  it('🔴 คอลัมน์ครบตามใบ iRecruit (ห้ามน้อยกว่า)', () => {
    expect(sheet).toContain(
      "['ลำดับ', 'เวลา', 'ชื่อ-นามสกุล', 'เบอร์โทรศัพท์', 'ตำแหน่งงาน', 'ช่องทาง', 'หน่วยงาน', 'เจ้าหน้าที่', 'หมายเหตุ']",
    );
    expect(sheet).toContain('รายชื่อผู้สมัครงาน {g.place}');
    expect(sheet).toContain('ประจำวันที่');
  });

  it('บนจอซ่อน โผล่ตอนพิมพ์ · ตารางปกติซ่อนตอนพิมพ์ · พิมพ์ทั้งวันไม่ใช่แค่หน้าที่แบ่ง', () => {
    expect(sheet).toContain('hidden print:block');
    expect(ws).toContain("{tab === 'appointments' ? <AppointmentPrintSheet groups={printGroups} /> : null}");
    expect(ws).toContain("<div className={tab === 'appointments' ? 'print:hidden' : undefined}>");
    expect(ws).toMatch(/rows: filtered\s*\n?\s*\.filter/);
  });
});
