/**
 * เจ้าของ 9 พ.ย. 2569: "ถ้าบอกชื่อกดไปต้องเห็นชื่อแล้วกดไปทำงานต่อได้ ถ้าใบก็ต้องใบ"
 * เลขคน → รายชื่อ (id ครบตามเลข) → กดชื่อเปิดคนนั้นในแท็บผู้สมัคร · เลขใบ → รายใบ → กดเปิดหน้าใบขอ (ใบชั่วคราวพก prefix)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildApplicantFunnel } from '@/lib/homeOverviewFunnel';
import { requestPathOfJobId } from '@/lib/jobNavigation';
import { applicantWorkLink, RM_OPEN_PARAM } from '@/lib/recruitRm';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';

const f = (id: string, over: Partial<RecruitAppFact>): RecruitAppFact =>
  ({
    id, createdAt: '2026-11-02T03:00:00Z', jobId: 'siamraj-sql:LBM6911007', channelLabel: null, referralSource: null,
    calledByAi: false, calledByStaff: false, aiAnswer: null, logOk: null, appointmentAt: null, attendance: null, appointmentFailed: false,
    ...over,
  }) as RecruitAppFact;

describe('เลขคน → รายชื่อ', () => {
  const apps = [
    f('e7d27d1d-0001', { calledByAi: true, aiAnswer: 'said_yes', calledByStaff: true, logOk: true, appointmentAt: '2026-11-05T03:00:00Z', attendance: 'showed' }),
    f('e7d27d1d-0002', { calledByAi: true, aiAnswer: 'said_yes' }),
    f('e7d27d1d-0003', { calledByAi: true, aiAnswer: 'no_pickup', calledByStaff: true, logOk: false }),
    f('e7d27d1d-0004', { aiQueued: true }),
    f('e7d27d1d-0005', {}),
  ];
  const steps = buildApplicantFunnel(apps);
  it('ทุกขั้น/ทุกแถว: จำนวน id = เลขบนจอ · แถวย่อยรวมกัน = ขั้น ไม่มีคนซ้ำ', () => {
    for (const s of steps) {
      expect(s.ids.length).toBe(s.value);
      for (const r of s.rows) expect(r.ids.length).toBe(r.value);
      const all = s.rows.flatMap((r) => r.ids);
      expect(new Set(all).size).toBe(all.length);
      expect(all.length).toBe(s.value);
    }
  });
  it('แถวตรงคน: สนใจแต่ยังไม่มีคนโทรต่อ = 0002 · รอ AI = 0004 · ยังไม่โทร = 0005', () => {
    const rowOf = (step: string, key: string) => steps.find((s) => s.key === step)!.rows.find((r) => r.key === key)!.ids;
    expect(rowOf('interested', 'staffNotYet')).toEqual(['e7d27d1d-0002']);
    expect(rowOf('applied', 'aiQueued')).toEqual(['e7d27d1d-0004']);
    expect(rowOf('applied', 'notCalled')).toEqual(['e7d27d1d-0005']);
    expect(rowOf('staff', 'unreached')).toEqual(['e7d27d1d-0003']);
  });
  it('กดชื่อ = แท็บผู้สมัคร รายชื่อทั้งหมด + เปิดคนนั้น', () => {
    expect(applicantWorkLink('e7d27d1d-0001')).toBe('/jobs/board?view=list&list=all&open=e7d27d1d-0001');
    const ws = readFileSync('src/components/recruit-rm/RmWorkspace.tsx', 'utf8');
    expect(ws).toContain('searchParams.get(RM_OPEN_PARAM)');
    expect(ws).toContain('setProfileApp(row)');
    expect(RM_OPEN_PARAM).toBe('open');
    expect(readFileSync('src/components/dashboard-trends/JourneyNamesDialog.tsx', 'utf8')).toContain('navigate(applicantWorkLink(a.id))');
  });
});

describe('เลขใบ → หน้าใบขอ', () => {
  it('ใบจริงใช้เลขเปล่า · ใบชั่วคราวพก prefix (เลขชนกับใบจริงได้)', () => {
    expect(requestPathOfJobId('siamraj-sql:LMO6911003')).toBe('/jobs/siamraj/LMO6911003');
    expect(requestPathOfJobId('siamraj-pre:LBM6910002')).toBe('/jobs/siamraj/siamraj-pre%3ALBM6910002');
  });
  it('รายใบทุกจุดบนหน้าหลัก/ภาพรวมมีทางไปหน้าใบขอ', () => {
    expect(readFileSync('src/components/home-exec/ExecDrill.tsx', 'utf8')).toContain('data-testid="exec-drill-open-request"');
    for (const p of ['src/components/dashboard-trends/DrillDownCard.tsx', 'src/components/dashboard-trends/RequestTab.tsx', 'src/components/dashboard-trends/stuck/RecruitStuckBody.tsx'])
      expect(readFileSync(p, 'utf8')).toContain('requestPathOfJobId(');
  });
});
