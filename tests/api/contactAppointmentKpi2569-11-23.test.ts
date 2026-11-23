import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONTACT_CHIPS, contactEquation, isInContactChip, rmRowActionLabel } from '../../src/lib/recruitRm';
import { APPOINTMENT_KPI_IDS, appointmentChipCount, appointmentEquation, buildAppointmentBoard } from '../../src/lib/appointmentBoard';

/** หน้าการติดต่อ / ติดตามนัดหมาย ตามแบบร่างรอบ 4 (เจ้าของ "ทำเลย" 23 พ.ย. 2569) */
const read = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf8');

describe('กล่องเลขแท็บการติดต่อ — บวกลงตัว', () => {
  const rows = [
    { last_contact_ok: true },
    { last_contact_ok: true },
    { last_contact_ok: false },
    { last_contact_ok: null, dialed_last_at: '2026-11-21T03:42:00Z' }, // กดโทรแล้วยังไม่ลงผล = ยังไม่โทร
    {},
  ];
  const counts = Object.fromEntries(CONTACT_CHIPS.map((c) => [c.id, rows.filter((r) => isInContactChip(r, c.id)).length])) as Record<
    (typeof CONTACT_CHIPS)[number]['id'],
    number
  >;
  it('ทั้งหมด = ยังไม่โทร + โทรแล้ว · โทรแล้ว = ติดต่อได้ + ติดต่อไม่ได้', () => {
    expect(counts.all).toBe(counts.uncalled + counts.called);
    expect(counts.called).toBe(counts.ok + counts.fail);
    expect(contactEquation(counts)).toBe('ทั้งหมด 5 = ยังไม่โทร 2 + โทรแล้ว 3 · โทรแล้ว 3 = ติดต่อได้ 2 + ติดต่อไม่ได้ 1');
  });
  it('ปุ่มบนแถวมีคำทุกปุ่ม: โทร · ลงผล · ส่งเอกสาร · ถอย Lead', () => {
    expect(rmRowActionLabel('contact', 'view')).toBe('ลงผล');
    expect(read('src/components/recruit-rm/RmTable.tsx')).toContain("const worded = tab === 'contact' ||");
  });
});

describe('กล่องเลขแท็บติดตามนัดหมาย — นัดทั้งหมด = รอผล + มา + ไม่มา', () => {
  it('เลื่อนนัดนับอยู่ในรอผล ผลรวมเท่านัดทั้งหมด', () => {
    const b = buildAppointmentBoard([
      { appointment_at: '2026-11-20T03:00:00Z', attendance_result: 'showed' },
      { appointment_at: '2026-11-20T03:00:00Z', attendance_result: 'no_show' },
      { appointment_at: '2026-11-24T03:00:00Z', attendance_result: 'rescheduled' },
      { appointment_at: '2026-11-24T03:00:00Z', attendance_result: null },
    ]);
    expect(appointmentChipCount(b, 'pending') + appointmentChipCount(b, 'showed') + appointmentChipCount(b, 'no_show')).toBe(
      appointmentChipCount(b, 'all'),
    );
    expect(appointmentEquation(b)).toBe('นัดทั้งหมด 4 = รอผล 2 + มา 1 + ไม่มา 1');
    expect(APPOINTMENT_KPI_IDS).toEqual(['all', 'pending', 'showed', 'no_show', 'today']);
  });
});

describe('ตาราง', () => {
  const t = read('src/components/recruit-rm/RmTable.tsx');
  it('วันที่สมัครมีเวลา · หัวคอลัมน์ตามแบบร่าง', () => {
    expect(t).toContain('{r.created_at ? formatDateTimeTh(r.created_at) : EM_DASH}');
    expect(t).toContain('>หน่วยงาน · ใบขอ</th>');
    expect(t).toContain('สมัคร · ช่องทาง');
    expect(t).toContain("{ownerColumns ? 'ตัวเลือก' : 'ทำงาน'}");
  });
  it('นัดหมายไม่มีคอลัมน์ที่อยู่/สมัคร · เลยวันนัดบอกด้วยคำ', () => {
    expect(t).toContain('{apptColumns ? null : addressCell}');
    expect(t).toContain("overdue ? ' · เลยวันนัด' : ''");
    expect(t).toContain('ลงผลได้ตั้งแต่วันนัด');
  });
  it('กล่องเลขโหลดไม่เสร็จ = … · โหลดล้ม = — (ไม่ใช่ 0) · สมการจองที่ไว้', () => {
    const k = read('src/components/recruit-rm/RmKpiStrip.tsx');
    expect(k).toContain("n === null ? '…' : n === 'unknown' ? '—'");
    expect(k).toContain('min-h-4');
  });
});
