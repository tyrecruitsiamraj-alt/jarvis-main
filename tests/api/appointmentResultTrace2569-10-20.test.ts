// @vitest-environment node
/**
 * ปิดจุดบอด 2 ข้อ (เจ้าของ 20 ต.ค. 2569 "ทำเลย")
 * 1. นัดเลยวันเกิน 24 ชม. ยังไม่ลงผลมา/ไม่มา ⇒ เตือนเจ้าของนัดวันละครั้ง + แถบแดงบนหัวกล่องงาน
 * 2. ผูกคนกับ iRecruit / ERP ด้วยเบอร์ — ป๊อปผู้สมัคร + ขั้น 8 ของหน้าความคุ้มค่า
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bangkokDayHour, groupByOwner, isReminderDue, overdueAppointmentsSql } from '../../api/_lib/appointmentResultReminder';
import { firstDaySince } from '../../src/lib/applicantSourceMatch';
import { buildStageSla } from '../../src/lib/valuePipeline';
import type { RecruitAppFact } from '../../src/lib/recruitOverviewTypes';

const read = (p: string) => readFileSync(p, 'utf8');

describe('เตือนนัดที่ยังไม่ลงผล', () => {
  it('เลยนัดเกิน 24 ชม. · ย้อนไม่เกิน 30 วัน · ไม่มีผลหรือเลื่อนนัด = ยังไม่ลง · ไม่นับ Lead/ใบที่ยกเลิกข้อมูล', () => {
    const sql = overdueAppointmentsSql();
    expect(sql).toContain("now() - interval '24 hours'");
    expect(sql).toContain("now() - interval '30 days'");
    expect(sql).toContain("'rescheduled') = 'rescheduled'");
    expect(sql).toContain('not coalesce(a.is_lead, false)');
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
  it('แถบแดงบนหัวกล่องงาน กดแล้วไปแท็บติดตามนัดหมาย', () => {
    expect(read('src/pages/jobs/StaffJobBoardPage.tsx')).toContain("<AppointmentOverdueBar onOpen={() => setView('appointments')}");
    expect(read('api/_handlers/registry.ts')).toContain("'/api/appointment-overdue': appointmentOverdueHandler");
  });
});

describe('ผูก iRecruit / ERP ด้วยเบอร์', () => {
  it('วันแรกตั้งแต่วันกรอก (เวลาไทย) · อ่านไม่ได้ = undefined · ไม่เจอ = null', () => {
    const days = new Map([['812345678', ['2026-10-01', '2026-10-09', '2026-10-12']]]);
    expect(firstDaySince(days, '812345678', '2026-10-08T20:00:00Z')).toBe('2026-10-09');
    expect(firstDaySince(days, '899999999', '2026-10-08T20:00:00Z')).toBeNull();
    expect(firstDaySince(null, '812345678', '2026-10-08T20:00:00Z')).toBeUndefined();
  });
  it('ขั้น 8 = คนที่มาตามนัดไปโผล่ iRecruit · ทันภายใน 24 ชม. หลังนัด', () => {
    const NOW = Date.parse('2026-10-20T12:00:00Z');
    const base = { createdAt: '2026-10-01T03:00:00Z', jobId: null, channelLabel: null, referralSource: null, position: null, phoneOk: true, calledByAi: false, calledByStaff: false, firstCalledAt: null, aiAnswer: null, aiAnswerAt: null, staffAnswer: null, staffAnswerAt: null, staffLastAt: null, contact: null, contactBy: null, logOk: true, logReason: null, logAt: '2026-10-05T03:00:00Z', attendance: 'showed', onBoard: null } as const;
    const facts: RecruitAppFact[] = [
      { ...base, id: 'a', appointmentAt: '2026-10-08T03:00:00Z', irecruitAt: '2026-10-08' },
      { ...base, id: 'b', appointmentAt: '2026-10-08T03:00:00Z', irecruitAt: '2026-10-15' },
      { ...base, id: 'c', appointmentAt: '2026-10-08T03:00:00Z', irecruitAt: null },
    ];
    const s = buildStageSla(facts, [], NOW).find((x) => x.key === 'inform')!;
    expect([s.done, s.onTime, s.stuck]).toEqual([2, 1, 1]);
    expect(s.stuckIds).toEqual(['c']);
  });
  it('ป๊อปผู้สมัครมี "ไปถึงไหนแล้ว" + ช่องทางของลิงก์', () => {
    const panel = read('src/components/recruit-rm/ApplicantInfoPanel.tsx');
    expect(panel).toContain('<ApplicantTraceField trace={trace} />');
    expect(panel).toContain('trace?.linkChannel');
    expect(read('api/_handlers/registry.ts')).toContain("'/api/application-trace': applicationTraceHandler");
  });
});
