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

describe('เส้นผู้สมัคร 6 ขั้น', () => {
  const apps = [
    f({ channelLabel: 'Facebook Group', calledByAi: true, aiAnswer: 'said_yes', calledByStaff: true, logOk: true, appointmentAt: '2026-10-12T03:00:00Z', attendance: 'showed' }),
    f({ channelLabel: 'Tiktok', calledByAi: true, aiAnswer: 'said_yes', calledByStaff: true, logOk: true, appointmentAt: '2026-10-12T03:00:00Z' }),
    f({ channelLabel: 'Tiktok', calledByAi: true, aiAnswer: 'said_no' }),
    f({ channelLabel: 'iRecruit', calledByAi: true, aiAnswer: 'no_pickup', calledByStaff: true, logOk: false, appointmentFailed: true }),
    f({ channelLabel: 'iRecruit', calledByAi: true, aiAnswer: 'talked_unclear' as never }),
    f({}),
    // นอกช่วง — ห้ามนับ
    f({ createdAt: '2026-09-20T03:00:00Z', calledByAi: true }),
  ];
  const inWin = appsInWindow(apps, '2026-10-01', '2026-10-28');
  const steps = buildApplicantFunnel(inWin, 3);

  it('นับเฉพาะใบในช่วง', () => {
    expect(inWin).toHaveLength(6);
    expect(steps.map((s) => [s.key, s.value])).toEqual([
      ['applied', 6], ['ai', 5], ['staff', 3], ['contact', 3], ['appointment', 3], ['showed', 2],
    ]);
  });

  it('🔴 แถบช่องทางรวม = เลขขั้นทุกขั้น · แถวย่อยรวม = เลขขั้น (ยกเว้นคนโทรต่อ)', () => {
    for (const s of steps) {
      expect(Object.values(s.channels).reduce((a, b) => a + b, 0), s.key).toBe(s.value);
      if (s.key !== 'staff') expect(s.rows.reduce((a, r) => a + r.value, 0), s.key).toBe(s.value);
    }
    const ai = steps.find((s) => s.key === 'ai')!;
    expect(Object.fromEntries(ai.rows.map((r) => [r.key, r.value]))).toEqual({ yes: 2, no: 1, noPickup: 1, other: 1 });
    const show = steps.find((s) => s.key === 'showed')!;
    expect(Object.fromEntries(show.rows.map((r) => [r.key, r.value]))).toEqual({ showed: 1, noShow: 0, pending: 1 });
    expect(steps.find((s) => s.key === 'staff')!.rows).toEqual([{ key: 'claimed', label: 'รับไปโทรในช่วงนี้', value: 3, tone: 'neutral' }]);
  });

  it('ว่าง = ทุกขั้น 0 (ห้ามหาย)', () => {
    const empty = buildApplicantFunnel([], null);
    expect(empty).toHaveLength(6);
    for (const s of empty) expect(s.value).toBe(0);
  });
});
