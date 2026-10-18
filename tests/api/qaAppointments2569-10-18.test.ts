// @vitest-environment node
/** QA แท็บติดตามนัดหมาย 18 ต.ค. 2569 (docs/qa-2569-10-18-appointments.md) — เจ้าของ "แก้ทั้งหมด · ใช้คำว่า มา / ไม่มา" */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ATTENDANCE_LABEL } from '../../src/lib/appointmentAttendance';
import { APPOINTMENT_CHIPS, appointmentChipCount, buildAppointmentBoard, isInAppointmentChip } from '../../src/lib/appointmentBoard';

const read = (p: string) => readFileSync(p, 'utf8');

describe('คำเดียว มา / ไม่มา', () => {
  it('ป้ายกลาง + ปุ่มบนแถว + หัวคอลัมน์ + ป๊อป', () => {
    expect(ATTENDANCE_LABEL.showed).toBe('มา');
    expect(ATTENDANCE_LABEL.no_show).toBe('ไม่มา');
    const t = read('src/components/recruit-rm/RmTable.tsx');
    expect(t).not.toContain("'มาแล้ว'");
    expect(t).toContain('นัด · มา/ไม่มา');
    expect(read('src/components/recruit-rm/ApplicantContactDialog.tsx')).not.toMatch(/ติดตามสำเร็จ|ติดตามไม่สำเร็จ/);
  });
});

describe('ผ่าน/ไม่ผ่าน ในแท็บนี้', () => {
  const rows = [
    { appointment_at: '2026-10-08T05:00:00Z', attendance_result: 'showed', screening_result: 'passed' },
    { appointment_at: '2026-10-08T05:00:00Z', attendance_result: 'showed', screening_result: 'not_passed' },
    { appointment_at: '2026-10-08T05:00:00Z', attendance_result: 'showed' },
    { appointment_at: '2026-10-08T05:00:00Z', attendance_result: 'no_show', screening_result: 'passed' },
  ];
  it('ชิป ผ่าน/ไม่ผ่าน นับเฉพาะคนที่มา · ตารางรายวันมีคอลัมน์', () => {
    const b = buildAppointmentBoard(rows);
    expect(APPOINTMENT_CHIPS.map((c) => c.label)).toContain('ผ่าน');
    expect(appointmentChipCount(b, 'passed')).toBe(1);
    expect(appointmentChipCount(b, 'not_passed')).toBe(1);
    expect(rows.filter((r) => isInAppointmentChip(r, 'passed'))).toHaveLength(1);
    expect(b.days[0]).toMatchObject({ showed: 3, passed: 1, notPassed: 1 });
  });
  it('ป๊อปลงผ่าน/ไม่ผ่านได้หลังกด มา', () => {
    expect(read('src/components/recruit-rm/ApplicantContactDialog.tsx')).toContain('data-testid="step-screening"');
  });
});

describe('สถานะจอ + มือถือ + ปุ่ม', () => {
  it('โหลดล้ม: ตารางรายวันไม่โชว์เลขเก่า · PDF กดไม่ได้', () => {
    const w = read('src/components/recruit-rm/RmWorkspace.tsx');
    expect(w).toContain('(loadError ? [] : appointmentBoard.days)');
    expect(w).toContain('printDisabled={Boolean(loadError) || loading || rows.length === 0}');
  });
  it('แถบแท็บเลื่อนหาแท็บปัจจุบันหลังจัดหน้าเสร็จ', () => {
    expect(read('src/components/jobs/JobBoardView.tsx')).toContain('const t = window.setTimeout(run, 400);');
  });
  it('ปุ่มบันทึกผล/รีเฟรชมีคำ · ของฉัน/ทุกคน ตัวที่เลือกทึบ', () => {
    expect(read('src/components/recruit-rm/RmTable.tsx')).toContain("const worded = tab === 'appointments' && a === 'rule';");
    expect(read('src/components/jobs/JobBoardView.tsx')).toContain('<RefreshCw aria-hidden /> รีเฟรช');
    expect(read('src/components/ui/toggle.tsx')).toContain('data-[state=on]:bg-primary');
  });
  it('ป๊อปช่องทางถอยไปที่ผู้สมัครเลือกเอง · หน่วยงานจากใบขอ · "ลงงาน …"', () => {
    expect(read('src/components/recruit-rm/ApplicantInfoPanel.tsx')).toContain('REFERRAL_SOURCE_LABEL[a.referral_source]');
    const t = read('src/components/recruit-rm/RmTable.tsx');
    expect(t).toContain('unitOf?.(r)');
    expect(t).toContain('`ลงงาน ${r.appointment_job}`');
  });
});
