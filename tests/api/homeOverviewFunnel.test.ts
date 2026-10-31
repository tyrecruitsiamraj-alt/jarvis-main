import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { appsInWindow, buildApplicantFunnel, FUNNEL_CHANNELS, funnelChannelOf } from '@/lib/homeOverviewFunnel';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';

/** เจ้าของ 28 ต.ค. 2569: หน้าหลักสรุปหน้าเดียว — เส้นผู้สมัคร 6 ขั้น + แถบช่องทาง (iRecruit แท่งแยก · ไม่มี "ไม่ระบุ") */
const f = (over: Partial<RecruitAppFact>): RecruitAppFact =>
  ({
    id: 'a', createdAt: '2026-10-10T03:00:00Z', jobId: 'siamraj-sql:LBM6910007', channelLabel: null, referralSource: null,
    calledByAi: false, calledByStaff: false, aiAnswer: null, logOk: null, appointmentAt: null, attendance: null, appointmentFailed: false,
    ...over,
  }) as RecruitAppFact;

describe('ช่องทางของใบ', () => {
  it('ป้ายจริงบนเว็บ 28 ต.ค. ลงช่องตามหน้าช่องทาง · iRecruit ทุกใบ = iRecruit · ไม่มีป้าย = Webjob (เว็บสมัครงานของเรา)', () => {
    const cases: Array<[string | null, string | null, string]> = [
      ['Facebook Group · กลุ่มหางานจังหวัด', null, 'Facebook'],
      ['Facebook · Facebook Page', null, 'Facebook'],
      ['Tiktok · Tiktok Live', null, 'Tiktok'],
      ['Webjob · JOBBKK', null, 'Webjob'],
      ['iRecruit', null, 'iRecruit'],
      ['iRecruit · Jobthai', null, 'iRecruit'],
      ['iRecruit · Line', null, 'iRecruit'],
      ['Call in', null, 'Offline'],
      [null, 'tiktok', 'Tiktok'],
      [null, null, 'Webjob'],
      [null, 'other', 'Webjob'],
      [null, 'line_oa', 'อื่น ๆ'],
      ['LINE OA', null, 'อื่น ๆ'],
      ['Webjob · เว็บสมัครงาน So Recruit', null, 'Webjob'],
    ];
    for (const [label, ref, want] of cases) expect(funnelChannelOf({ channelLabel: label, referralSource: ref }), `${label}|${ref}`).toBe(want);
    expect(FUNNEL_CHANNELS).not.toContain('ไม่ระบุ');
    // กติกาแยกช่องทางมีที่เดียว (`fourMainOf`) — รีวิว 28 ต.ค. 2569
    expect(readFileSync('src/lib/homeOverviewFunnel.ts', 'utf8')).not.toMatch(/jobthai\|jobbkk/);
  });
});

describe('เส้นผู้สมัคร 6 ขั้นต่อกันเป็นสายเดียว (31 ต.ค. 2569 Choice "เรียงใหม่ ทุกขั้นบวกลบลงตัว")', () => {
  const apps = [
    f({ channelLabel: 'Facebook Group', calledByAi: true, aiAnswer: 'said_yes', calledByStaff: true, logOk: true, appointmentAt: '2026-10-12T03:00:00Z', attendance: 'showed' }),
    f({ channelLabel: 'Tiktok', calledByAi: true, aiAnswer: 'said_yes', calledByStaff: true, logOk: true, appointmentAt: '2026-10-12T03:00:00Z' }),
    f({ channelLabel: 'Tiktok', calledByAi: true, aiAnswer: 'said_yes' }),
    f({ channelLabel: 'Tiktok', calledByAi: true, aiAnswer: 'said_no' }),
    f({ channelLabel: 'iRecruit', calledByAi: true, aiAnswer: 'no_pickup', calledByStaff: true, logOk: false }),
    f({ channelLabel: 'iRecruit', calledByAi: true, aiAnswer: 'talked_unclear' as never }),
    f({ aiQueued: true }),
    f({}),
    // นอกช่วง — ห้ามนับ
    f({ createdAt: '2026-09-20T03:00:00Z', calledByAi: true }),
  ];
  const inWin = appsInWindow(apps, '2026-10-01', '2026-10-28');
  const steps = buildApplicantFunnel(inWin);
  const rowsOf = (key: string) => Object.fromEntries(steps.find((s) => s.key === key)!.rows.map((r) => [r.key, r.value]));

  it('กรอกมา → AI โทรแล้ว → สนใจ → คนโทรต่อ → ติดต่อได้ → นัดได้', () => {
    expect(inWin).toHaveLength(8);
    expect(steps.map((s) => [s.key, s.label, s.value])).toEqual([
      ['applied', 'กรอกมา', 8], ['ai', 'AI โทรแล้ว', 6], ['interested', 'สนใจ', 3],
      ['staff', 'คนโทรต่อ', 3], ['reached', 'ติดต่อได้', 2], ['booked', 'นัดได้', 2],
    ]);
  });

  it('🔴 แถบช่องทางรวม = เลขขั้น · แถวย่อยรวม = เลขขั้น ทุกขั้น · ขั้นถัดไป = แถวของขั้นก่อน', () => {
    for (const s of steps) {
      expect(Object.values(s.channels).reduce((a, b) => a + b, 0), s.key).toBe(s.value);
      expect(s.rows.reduce((a, r) => a + r.value, 0), s.key).toBe(s.value);
    }
    expect(rowsOf('applied')).toEqual({ aiCalled: 6, aiQueued: 1, notCalled: 1 });
    expect(rowsOf('ai').yes).toBe(steps[2].value);
    expect(rowsOf('interested')).toEqual({ staffCalled: 2, staffNotYet: 1 });
    expect(steps[3].from).toBe('สนใจ 2 + กลุ่มอื่น 1');
    expect(rowsOf('staff').reached).toBe(steps[4].value);
    expect(rowsOf('reached').booked).toBe(steps[5].value);
    expect(rowsOf('booked')).toEqual({ showed: 1, noShow: 0, pending: 1 });
    expect(steps.flatMap((s) => s.rows.map((r) => r.label))).not.toContain('รับไปโทรในช่วงนี้');
  });

  it('ว่าง = ทุกขั้น 0 (ห้ามหาย)', () => {
    const empty = buildApplicantFunnel([]);
    expect(empty).toHaveLength(6);
    for (const s of empty) expect(s.value).toBe(0);
  });
});
