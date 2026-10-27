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

  it('🔴 เลขลงตัว (เจ้าของ 20 ต.ค. 2569 "กรอกมา 42 แต่แยกย่อยแล้วได้แค่ 22"): กรอกมา = ยังไม่โทร + AI โทรแล้ว · AI โทรแล้ว = 4 คำตอบ', () => {
    const more = recruitDailyRows(
      [
        ...apps,
        fact('2026-10-15T05:00:00Z', { calledByAi: true, aiAnswer: null }),
        // คำตอบมาก่อนธงโทร — ยังนับเป็นโทรแล้ว ไม่ติดลบ
        fact('2026-10-15T06:00:00Z', { calledByAi: false, aiAnswer: 'said_yes' }),
      ],
      '2026-10-12',
      '2026-10-15',
    );
    const d = more.find((r) => r.ymd === '2026-10-15')!;
    expect(d).toMatchObject({ names: 5, notCalled: 1, aiCalled: 4, saidYes: 2, noPickup: 1, aiOther: 1 });
    for (const r of more) {
      expect(r.notCalled + r.aiCalled).toBe(r.names);
      expect(r.saidYes + r.saidNo + r.noPickup + r.aiOther).toBe(r.aiCalled);
    }
    const panel = readFileSync('src/components/recruit-rm/RecruitDailyPanel.tsx', 'utf8');
    expect(panel).toContain('<Sign>=</Sign>');
    expect(panel).toContain('<Bar dataKey="notCalled" name="ยังไม่โทร"');
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
  // 18 ต.ค. 2569 เจ้าของสั่งเพิ่ม "ภาพรวม" ต่อจาก Pre-Check (Journey ทั้งเส้น)
  it('โพสต์ประกาศ · ผู้สมัคร · การติดต่อ · ติดตามนัดหมาย · Pre-Check · ภาพรวม', () => {
    expect(BOARD_VIEW_TABS.map((t) => t.label)).toEqual(['โพสต์ประกาศ', 'ผู้สมัคร', 'การติดต่อ', 'ติดตามนัดหมาย', 'Pre-Check', 'ภาพรวม']);
  });
  it('🔴 ภาพรวมเดิมยังเปิดได้ที่ ?view=dashboard (ทางถอย) · Pre-Check ฝังแบบไม่มีหัวซ้อน', () => {
    const page = readFileSync('src/pages/jobs/StaffJobBoardPage.tsx', 'utf8');
    expect(page).toContain("const EXTRA_VIEWS = ['dashboard', 'precheck'] as const;");
    expect(page).toContain('<PreCheckPage embedded />');
    expect(page).toContain('<RecruitOverview published={boardPublished} openJobs={loading ? null : jobs} />');
    expect(readFileSync('src/pages/matching/PreCheckPage.tsx', 'utf8')).toContain('{embedded ? null : (');
  });
  it('ตัวเลขรายวันอยู่เฉพาะแท็บผู้สมัคร', () => {
    expect(readFileSync('src/components/recruit-rm/RmWorkspace.tsx', 'utf8')).toContain(
      "{!bucket && tab === 'candidates' ? <RecruitDailyPanel refreshKey={refreshKey} /> : null}",
    );
  });
});

describe('Pre-Check เห็นเฉพาะ BU ของบัญชี (เจ้าของ 15 ต.ค. 2569 "Bu ใคร Bu มัน")', () => {
  it('กรองใบขอด้วย department_code ของผู้ใช้ · ไม่มี BU = เห็นทุกใบ (แบบหน้าจับคู่งาน)', () => {
    const src = readFileSync('src/pages/matching/PreCheckPage.tsx', 'utf8');
    expect(src).toContain('const myBu = normalizeAppDepartmentCode(user?.department_code);');
    expect(src).toContain('feedJobs.filter((j) => normalizeAppDepartmentCode(j.department_code) === myBu)');
    expect(src).toContain(': feedJobs');
  });
});

it('Pre-Check ไม่มีช่องละติจูด/ลองจิจูดบนจอ (เจ้าของ 15 ต.ค. 2569)', () => {
  const src = readFileSync('src/pages/matching/PreCheckPage.tsx', 'utf8');
  expect(src).not.toContain('ละติจูด (ไม่บังคับ)');
  expect(src).not.toContain('ลองจิจูด (ไม่บังคับ)');
});

it('การ์ดไม่โชว์ "ต้องการ (วันที่)" แล้ว และไม่มี checkbox วันที่ต้องการ (เจ้าของ 15 ต.ค. 2569)', () => {
  const facts = readFileSync('src/components/jobs/JobPublicFacts.tsx', 'utf8');
  expect(facts).not.toContain('ต้องการ {');
  expect(readFileSync('src/lib/publicFieldVisibility.ts', 'utf8')).not.toContain("required_date: 'วันที่ต้องการ'");
});
