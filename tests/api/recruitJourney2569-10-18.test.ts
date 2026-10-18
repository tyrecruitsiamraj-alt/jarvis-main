// @vitest-environment node
/** Journey งานสรรหา ทีละขั้น + ผ่าน/ไม่ผ่าน (เจ้าของสั่ง 18 ต.ค. 2569) */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildRecruitJourney, filterByWeekdays } from '../../src/lib/recruitJourney';
import type { RecruitAppFact } from '../../src/lib/recruitOverviewTypes';
import { canRecordScreening, isScreeningResult } from '../../src/lib/appointmentScreening';

const base: RecruitAppFact = {
  createdAt: '2026-10-12T03:00:00Z', // จันทร์ 10:00 ไทย
  jobId: 'j',
  channelLabel: null,
  referralSource: null,
  position: null,
  phoneOk: true,
  calledByAi: false,
  calledByStaff: false,
  firstCalledAt: null,
  aiAnswer: null,
  aiAnswerAt: null,
  staffAnswer: null,
  staffAnswerAt: null,
  staffLastAt: null,
  contact: null,
  contactBy: null,
  logOk: null,
  logReason: null,
  logAt: null,
  appointmentAt: null,
  attendance: null,
  onBoard: null,
};
const f = (o: Partial<RecruitAppFact>): RecruitAppFact => ({ ...base, ...o });

describe('buildRecruitJourney', () => {
  const list = [
    f({ phoneOk: false }),
    f({ aiQueued: true }),
    f({}),
    f({ calledByAi: true, aiAnswer: 'said_no' }),
    f({ calledByAi: true, aiAnswer: 'not_yet' }),
    f({ calledByAi: true, aiAnswer: 'no_pickup' }),
    f({ calledByAi: true, aiAnswer: 'said_yes' }),
    f({ calledByAi: true, aiAnswer: 'said_yes', logOk: false }),
    f({ calledByAi: true, aiAnswer: 'said_yes', logOk: true, appointmentFailed: true }),
    f({ calledByAi: true, aiAnswer: 'said_yes', logOk: true }),
    f({ calledByAi: true, aiAnswer: 'said_yes', logOk: true, appointmentAt: '2026-10-14T03:00:00Z', attendance: 'no_show' }),
    f({ calledByAi: true, aiAnswer: 'said_yes', logOk: true, appointmentAt: '2026-10-14T03:00:00Z' }),
    f({ calledByAi: true, aiAnswer: 'said_yes', logOk: true, appointmentAt: '2026-10-14T03:00:00Z', attendance: 'showed', screening: 'passed' }),
    f({ calledByAi: true, aiAnswer: 'said_yes', logOk: true, appointmentAt: '2026-10-14T03:00:00Z', attendance: 'showed', screening: 'not_passed' }),
    f({ calledByAi: true, aiAnswer: 'said_yes', logOk: true, appointmentAt: '2026-10-14T03:00:00Z', attendance: 'showed' }),
  ];
  const steps = buildRecruitJourney(list);
  const part = (step: string, key: string) => steps.find((s) => s.key === step)!.parts.find((p) => p.key === key)!.value;

  it('ทุกขั้น ลูกรวมกัน = แม่', () => {
    for (const s of steps) expect(s.parts.reduce((n, p) => n + p.value, 0), s.key).toBe(s.total);
  });
  it('แต่ละขั้นนับถูก', () => {
    expect(steps.map((s) => s.total)).toEqual([15, 12, 9, 7, 5, 3]);
    expect([part('names', 'badData'), part('names', 'aiQueued'), part('names', 'notSent')]).toEqual([1, 1, 1]);
    expect([part('ai', 'yes'), part('ai', 'no'), part('ai', 'thinking'), part('ai', 'unreached')]).toEqual([9, 1, 1, 1]);
    expect([part('staff', 'ok'), part('staff', 'fail'), part('staff', 'waiting')]).toEqual([7, 1, 1]);
    expect([part('appointment', 'booked'), part('appointment', 'failed'), part('appointment', 'pending')]).toEqual([5, 1, 1]);
    expect([part('attendance', 'showed'), part('attendance', 'noShow'), part('attendance', 'pending')]).toEqual([3, 1, 1]);
    expect([part('screening', 'passed'), part('screening', 'notPassed'), part('screening', 'pending')]).toEqual([1, 1, 1]);
  });
  it('เฉพาะวันในสัปดาห์ (เวลาไทย)', () => {
    const mon = f({ createdAt: '2026-10-12T03:00:00Z' });
    const sunNightUtcMonBkk = f({ createdAt: '2026-10-11T18:30:00Z' }); // จันทร์ 01:30 ไทย
    const tue = f({ createdAt: '2026-10-13T03:00:00Z' });
    expect(filterByWeekdays([mon, sunNightUtcMonBkk, tue], [1])).toHaveLength(2);
    expect(filterByWeekdays([mon, tue], [])).toHaveLength(2);
  });
});

describe('ผ่าน/ไม่ผ่าน ลงผ่านหน้าจอ', () => {
  it('ลงได้หลังมาตามนัดเท่านั้น · ค่าที่ยอมรับมี 2 ค่า', () => {
    expect(canRecordScreening('showed')).toBe(true);
    expect(canRecordScreening('no_show')).toBe(false);
    expect(isScreeningResult('passed')).toBe(true);
    expect(isScreeningResult('showed')).toBe(false);
  });
  it('ปุ่มบนแถวนัดหมาย + API ตรวจซ้ำ + migration ไม่มี CHECK', () => {
    expect(readFileSync('src/components/recruit-rm/RmTable.tsx', 'utf8')).toContain('canRecordScreening(r.attendance_result)');
    const api = readFileSync('api/_handlers/application-attendance.ts', 'utf8');
    expect(api).toContain('ลงผลผ่าน/ไม่ผ่านได้หลังบันทึกว่ามาตามนัดแล้ว');
    expect(readFileSync('migrations/151_application_screening_results.sql', 'utf8')).not.toMatch(/\bcheck\s*\(/i);
  });
  it('แท็บภาพรวมอยู่ต่อจาก Pre-Check + มีตัวเลือกวัน', () => {
    expect(readFileSync('src/components/jobs/JobBoardView.tsx', 'utf8')).toContain("{ id: 'dashboard', label: 'ภาพรวม' }");
    expect(readFileSync('src/components/dashboard-trends/RecruitOverview.tsx', 'utf8')).toContain('<JourneyList steps={view.journey} />');
  });
});
