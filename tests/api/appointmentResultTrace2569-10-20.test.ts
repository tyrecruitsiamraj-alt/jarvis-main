// @vitest-environment node
/**
 * ปิดจุดบอด 2 ข้อ (เจ้าของ 20 ต.ค. 2569 "ทำเลย")
 * 1. นัดเลยวันเกิน 24 ชม. ยังไม่ลงผลมา/ไม่มา ⇒ เตือนเจ้าของนัดวันละครั้ง + แถบแดงบนหัวกล่องงาน
 * 2. ผูกคนกับ iRecruit / ERP ด้วยเบอร์ — ป๊อปผู้สมัคร (หน้าความคุ้มค่าถอดแล้ว 28 ต.ค. 2569)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bangkokDayHour, groupByOwner, isReminderDue, overdueAppointmentsSql } from '../../api/_lib/appointmentResultReminder';
import { firstDaySince } from '../../src/lib/applicantSourceMatch';

const read = (p: string) => readFileSync(p, 'utf8');

describe('เตือนนัดที่ยังไม่ลงผล', () => {
  it('เลยนัดเกิน 24 ชม. · ย้อนไม่เกิน 30 วัน · ไม่มีผลหรือเลื่อนนัด = ยังไม่ลง · ไม่นับใบที่ยกเลิกข้อมูล', () => {
    const sql = overdueAppointmentsSql();
    expect(sql).toContain("now() - interval '24 hours'");
    expect(sql).toContain("now() - interval '30 days'");
    expect(sql).toContain("'rescheduled') = 'rescheduled'");
    // นับ Lead ด้วย — ให้เท่าชิป "เลยวันนัด" ของแท็บติดตามนัดหมาย (เจ้าของ 20 ต.ค. 2569)
    expect(sql).not.toContain('is_lead');
  });
  it('เตือนตั้งแต่ 08:00 เวลาไทย วันละครั้ง · จัดกลุ่มตามคนบันทึกนัด', () => {
    const at = (iso: string) => new Date(iso);
    expect(isReminderDue(at('2026-10-20T00:30:00Z'), null)).toBe(false); // 07:30
    expect(isReminderDue(at('2026-10-20T01:05:00Z'), null)).toBe(true); // 08:05
    expect(isReminderDue(at('2026-10-20T05:00:00Z'), '2026-10-20')).toBe(false);
    expect(bangkokDayHour(at('2026-10-20T18:00:00Z'))).toEqual({ day: '2026-10-21', hour: 1 });
    const g = groupByOwner([{ owner_id: 'u1' }, { owner_id: 'u1' }, { owner_id: null }]);
    expect(g.byOwner.get('u1')).toBe(2);
    expect(g.noOwner).toBe(1);
    expect(read('server/local-api.ts')).toContain('startAppointmentReminderWorker();');
  });
  it('แถบแดงบนหัวกล่องงานถอดแล้ว (เจ้าของ 22 ต.ค. 2569 "เอาออก") · ชิปเลยวันนัดในแท็บติดตามนัดหมายยังอยู่', () => {
    const page = read('src/pages/jobs/StaffJobBoardPage.tsx');
    expect(page).not.toContain('AppointmentOverdueBar');
    expect(read('api/_handlers/registry.ts')).not.toContain('/api/appointment-overdue');
  });
});

describe('ผูก iRecruit / ERP ด้วยเบอร์', () => {
  it('วันแรกตั้งแต่วันกรอก (เวลาไทย) · อ่านไม่ได้ = undefined · ไม่เจอ = null', () => {
    const days = new Map([['812345678', ['2026-10-01', '2026-10-09', '2026-10-12']]]);
    expect(firstDaySince(days, '812345678', '2026-10-08T20:00:00Z')).toBe('2026-10-09');
    expect(firstDaySince(days, '899999999', '2026-10-08T20:00:00Z')).toBeNull();
    expect(firstDaySince(null, '812345678', '2026-10-08T20:00:00Z')).toBeUndefined();
  });
  it('ป๊อปผู้สมัครมี "ไปถึงไหนแล้ว" + ช่องทางของลิงก์', () => {
    const panel = read('src/components/recruit-rm/ApplicantInfoPanel.tsx');
    expect(panel).toContain('<ApplicantTraceField trace={trace} />');
    expect(panel).toContain('trace?.linkChannel');
    expect(read('api/_handlers/registry.ts')).toContain("'/api/application-trace': applicationTraceHandler");
  });
});

describe('ชิป "เลยวันนัด" = เกณฑ์เดียวกับแถบแดง (เจ้าของ 20 ต.ค. 2569 "มันไม่ตรงกันปะ")', () => {
  it('ยังไม่ลงผล/เลื่อนนัด · เลยเกิน 24 ชม. · ไม่เกิน 30 วัน · นัดวันนี้ยังไม่นับ', async () => {
    const { isInAppointmentChip, APPOINTMENT_CHIPS } = await import('../../src/lib/appointmentBoard');
    const NOW = Date.parse('2026-10-20T03:00:00Z');
    const at = (iso: string, result: string | null = null) => ({ appointment_at: iso, attendance_result: result });
    const today = '2026-10-20';
    expect(isInAppointmentChip(at('2026-10-16T05:00:00Z'), 'overdue', today, NOW)).toBe(true);
    expect(isInAppointmentChip(at('2026-10-16T05:00:00Z', 'rescheduled'), 'overdue', today, NOW)).toBe(true);
    expect(isInAppointmentChip(at('2026-10-16T05:00:00Z', 'showed'), 'overdue', today, NOW)).toBe(false);
    expect(isInAppointmentChip(at('2026-10-20T05:00:00Z'), 'overdue', today, NOW)).toBe(false);
    expect(isInAppointmentChip(at('2026-09-01T05:00:00Z'), 'overdue', today, NOW)).toBe(false);
    expect(APPOINTMENT_CHIPS.map((c) => c.label)).toContain('เลยวันนัด');
    expect(read('src/components/recruit-rm/RmWorkspace.tsx')).toContain("searchParams.get('appt') === 'overdue'");
  });
});
