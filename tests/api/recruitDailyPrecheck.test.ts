import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import { recruitDailyRows, recruitDailySummary, recruitDailyWindowFrom } from '@/lib/recruitDaily';
import { BOARD_VIEW_TABS } from '@/components/jobs/JobBoardView';

/** เจ้าของสั่ง 15 ต.ค. 2569: Pre-check แทนแท็บภาพรวม + ตัวเลขรายวันพับได้บนแท็บผู้สมัคร */
const fact = (createdAt: string, over: Partial<RecruitAppFact> = {}): RecruitAppFact =>
  ({ createdAt, calledByAi: false, calledByStaff: false, aiAnswer: null, ...over }) as RecruitAppFact;

describe('ตัวเลขรายวัน (นับตามวันที่กรอก)', () => {
  const apps = [
    fact('2026-10-15T02:00:00Z', { calledByAi: true, aiAnswer: 'said_yes' }),
    fact('2026-10-15T03:00:00Z', { calledByAi: true, aiAnswer: 'no_pickup' }),
    fact('2026-10-15T04:00:00Z'),
    fact('2026-10-14T02:00:00Z', { calledByAi: true, aiAnswer: 'said_no' }),
    fact('2026-10-13T02:00:00Z', { calledByAi: true, aiAnswer: 'said_yes' }),
    fact('2026-10-13T03:00:00Z', { calledByAi: true, aiAnswer: 'said_yes' }),
    // 23:30 ไทย 14 ต.ค. = วันที่ 14 (เขตเวลาไทย)
    fact('2026-10-14T16:30:00Z'),
  ];
  const rows = recruitDailyRows(apps, '2026-10-12', '2026-10-15');

  it('ทุกช่องเป็นส่วนของ "กรอกมา" วันนั้น · วันไม่มีใคร = แถว 0', () => {
    const d = Object.fromEntries(rows.map((r) => [r.ymd, r]));
    expect(d['2026-10-15']).toMatchObject({ names: 3, aiCalled: 2, saidYes: 1, saidNo: 0, noPickup: 1 });
    expect(d['2026-10-14']).toMatchObject({ names: 2, aiCalled: 1, saidNo: 1 });
    expect(d['2026-10-12']).toMatchObject({ names: 0 });
    for (const r of rows) expect(r.saidYes + r.saidNo + r.noPickup).toBeLessThanOrEqual(r.names);
  });

  it('เฉลี่ยไม่นับวันนี้ · ไม่นับวันก่อนมีใบแรก', () => {
    const s = recruitDailySummary(rows, '2026-10-15', '7d');
    expect(s.today.names).toBe(3);
    // 12, 13, 14 อยู่ในช่วง (12 = 0) → (0 + 2 + 2) / 3
    expect(s.days).toBe(3);
    expect(s.avg?.names).toBe(Math.round(4 / 3));
    const s2 = recruitDailySummary(rows, '2026-10-15', '7d', '2026-10-13');
    expect(s2.days).toBe(2);
    expect(s2.avg?.names).toBe(2);
    expect(s2.chart.at(-1)?.ymd).toBe('2026-10-15');
  });

  it('ช่วงเฉลี่ย 7 วัน / 30 วัน / เดือนนี้', () => {
    expect(recruitDailyWindowFrom('7d', '2026-10-15')).toBe('2026-10-08');
    expect(recruitDailyWindowFrom('30d', '2026-10-15')).toBe('2026-09-15');
    expect(recruitDailyWindowFrom('month', '2026-10-15')).toBe('2026-10-01');
  });
});

describe('แท็บงานสรรหา', () => {
  it('โพสต์ประกาศ · ผู้สมัคร · การติดต่อ · ติดตามนัดหมาย · Pre-Check (ไม่มีแท็บภาพรวม)', () => {
    expect(BOARD_VIEW_TABS.map((t) => t.label)).toEqual(['โพสต์ประกาศ', 'ผู้สมัคร', 'การติดต่อ', 'ติดตามนัดหมาย', 'Pre-Check']);
  });
  it('🔴 ภาพรวมเดิมยังเปิดได้ที่ ?view=dashboard (ทางถอย) · Pre-Check ฝังแบบไม่มีหัวซ้อน', () => {
    const page = readFileSync('src/pages/jobs/StaffJobBoardPage.tsx', 'utf8');
    expect(page).toContain("const EXTRA_VIEWS = ['dashboard', 'precheck'] as const;");
    expect(page).toContain('<PreCheckPage embedded />');
    expect(page).toContain('<RecruitOverview published={boardPublished} />');
    expect(readFileSync('src/pages/matching/PreCheckPage.tsx', 'utf8')).toContain('{embedded ? null : (');
  });
  it('ตัวเลขรายวันอยู่เฉพาะแท็บผู้สมัคร', () => {
    expect(readFileSync('src/components/recruit-rm/RmWorkspace.tsx', 'utf8')).toContain(
      "{!bucket && tab === 'candidates' ? <RecruitDailyPanel refreshKey={refreshKey} /> : null}",
    );
  });
});
