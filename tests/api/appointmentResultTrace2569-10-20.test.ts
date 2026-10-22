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
import { AI_OWNER, NO_OWNER, buildStageSla, stuckByOwner, stuckWho } from '../../src/lib/valuePipeline';
import { stuckExtrasSql } from '../../api/_handlers/value-pipeline';
import type { RecruitAppFact } from '../../src/lib/recruitOverviewTypes';

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

describe('ค้างอยู่ที่ใคร = คนที่ต้องลงมือจริง (เจ้าของ 20 ต.ค. 2569 — เห็นชื่อเล็กแต่หาในหน้าติดตามไม่เจอ)', () => {
  const none = { claimer: null, postingOwner: null, aiWaiting: false, irecruitDup: false };
  it('ขั้น AI: อยู่ในคิวไม่มีผล = แถว AI · ซ้ำ iRecruit/คนเก็บ/ยังไม่ส่ง = คน', () => {
    expect(stuckWho('aiCall', 'AI โทรคัดกรอง', { ...none, aiWaiting: true }, 'เล็ก')).toMatchObject({ owner: AI_OWNER, kind: 'ai' });
    expect(stuckWho('aiCall', 'AI โทรคัดกรอง', { ...none, irecruitDup: true }, 'เล็ก')).toMatchObject({ owner: 'เล็ก', why: 'ซ้ำ iRecruit รอเลือกวิธีโทร' });
    expect(stuckWho('aiCall', 'AI โทรคัดกรอง', { ...none, claimer: 'แบงค์' }, 'เล็ก')).toMatchObject({ owner: 'แบงค์', why: 'เก็บไปโทรเองแล้ว ยังไม่โทร' });
    expect(stuckWho('aiCall', 'AI โทรคัดกรอง', { ...none, postingOwner: 'เจมส์' }, null)).toMatchObject({ owner: 'เจมส์', why: 'ยังไม่ส่ง AI' });
    expect(stuckWho('staffCall', 'คนโทรต่อคนสนใจ', none, null)).toMatchObject({ owner: NO_OWNER, kind: 'none' });
  });
  it('คนเดียวค้างหลายขั้นนับครั้งเดียว · แถว AI ขึ้นก่อน · มีรายชื่อให้กดดู', () => {
    const stage = (key: 'aiCall' | 'screening' | 'inform', ids: string[]) => ({ key, label: key, done: 1, onTime: 0, stuck: ids.length, stuckIds: ids });
    const facts = ['a', 'b', 'c'].map((id) => ({ id, jobId: 'J1' })) as unknown as RecruitAppFact[];
    const rows = stuckByOwner(
      [stage('aiCall', ['a', 'b']), stage('screening', ['c']), stage('inform', ['c'])],
      facts,
      new Map([['J1', 'เล็ก']]),
      new Map([['a', { ...none, aiWaiting: true }]]),
    );
    expect(rows.map((r) => [r.owner, r.stuck])).toEqual([[AI_OWNER, 1], ['เล็ก', 2]]);
    expect(rows[1].items.map((i) => i.id)).toEqual(['b', 'c']);
  });
  it('อ่านคนเก็บ · ผู้รับผิดชอบโพสต์ · คิว AI ที่ยังไม่มีผล · ซ้ำ iRecruit (ไม่มีชื่อ/เบอร์)', () => {
    const sql = stuckExtrasSql();
    expect(sql).toContain('a.claimed_by');
    expect(sql).toContain('coalesce(a.posting_id, l.posting_id)');
    expect(sql).toContain("q.status in ('pending', 'delivered')");
    expect(sql).not.toMatch(/full_name as|phone/);
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
