/**
 * ═══ ภาพรวม: กราฟเทียบช่วงก่อน + รายวันแบบกดได้ · ค่าเริ่ม 7 วัน (เจ้าของ 21 ต.ค. 2569) ═══
 * "อยากได้เป็นกราฟเชิงเปรียบเทียบว่า เพิ่มขึ้นลดลง" · "Default เป็น 7 วันย้อนหลัง … พอกดเดือนไหนก็เป็นวันของเดือนนั้นๆ แบบ interactive"
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compareRowsOf, dailySeriesOf, daysBetween, deltaOf } from '@/lib/recruitCompare';
import { toRequestDays } from '../../api/_handlers/recruit-overview';
import type { RecruitTotals } from '@/lib/recruitOverview';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const T = (n: number): RecruitTotals => ({
  names: n, jobs: 0, called: 0, calledByAi: n, calledByStaff: 0, calledBoth: 0, reached: n, reachedByAi: 0, reachedByStaff: 0,
  aiSaidYes: n, aiSaidNo: 0, aiQueued: 0, staffFollowed: 0, aiCalledReached: 0, followedReached: 0, appointed: n, showed: 0, onBoard: null,
});

describe('deltaOf', () => {
  it('เพิ่ม/ลดเป็น % · เท่าเดิม · ช่วงก่อน 0 = ใหม่ · ไม่มีข้อมูล = เทียบไม่ได้', () => {
    expect(deltaOf(150, 100)).toEqual({ kind: 'up', pct: 50 });
    expect(deltaOf(80, 100)).toEqual({ kind: 'down', pct: 20 });
    expect(deltaOf(5, 5)).toEqual({ kind: 'same' });
    expect(deltaOf(3, 0)).toEqual({ kind: 'new' });
    expect(deltaOf(3, null)).toEqual({ kind: 'none' });
  });
});

describe('compareRowsOf', () => {
  it('ทุกแท็บมีแถว · ช่วงก่อนไม่มี = prev null (ไม่ใช่ 0)', () => {
    for (const t of ['requests', 'apps', 'staff', 'appt'] as const) expect(compareRowsOf(t, T(10), null, null, null).length).toBeGreaterThan(0);
    const apps = compareRowsOf('apps', T(10), null, null, null);
    expect(apps[0]).toMatchObject({ key: 'names', cur: 10, prev: null });
    const req = compareRowsOf('requests', T(0), null,
      { total: 9, released: 3, notReleased: 6, releasedWithApps: 2, releasedNoApps: 1, appsOnReleased: 5 },
      { total: 4, released: 1, notReleased: 3, releasedWithApps: 1, releasedNoApps: 0, appsOnReleased: 1 });
    expect(req.map((r) => [r.key, r.cur, r.prev])).toEqual([['total', 9, 4], ['released', 3, 1], ['releasedWithApps', 2, 1]]);
    // 27 ต.ค. 2569 เจ้าของ "ไม่ได้บอกว่าสนใจเท่าไหร่ ไม่สนใจเท่าไหร่ รอโทรเท่าไหร่"
    expect(apps.map((r) => r.label)).toEqual(['กรอกเข้ามา', 'AI โทรแล้ว', 'ติดต่อได้', 'สนใจ', 'ไม่สนใจ', 'รอโทร']);
  });

  it('กดชื่อช่วงแล้วเลขในกล่องเปลี่ยนตาม (27 ต.ค. 2569 "เลือกวันที่ 26 แล้วไม่เปลี่ยนตาม")', () => {
    const src = read('src/components/dashboard-trends/TrendLinesCard.tsx');
    expect(src).toContain("const shown = period === 'cur' ? r.cur : r.prev;");
    expect(src).toContain('{shown === null ? \'—\' : fmt(shown)}');
  });
});

describe('รายวัน', () => {
  const fact = (createdAt: string, extra: Partial<RecruitAppFact> = {}) => ({ createdAt, calledByAi: false, ...extra }) as unknown as RecruitAppFact;

  it('🔴 ทุกวันของช่วงอยู่ครบ (วันที่ไม่มี = 0) · ตัดวันตามเวลาไทย', () => {
    const facts = [fact('2026-10-19T03:00:00Z'), fact('2026-10-19T18:00:00Z'), fact('2026-10-21T01:00:00Z', { calledByAi: true })];
    expect(dailySeriesOf('names', '2026-10-19', '2026-10-21', facts, null)).toEqual([
      { day: '2026-10-19', n: 1 },
      { day: '2026-10-20', n: 1 },
      { day: '2026-10-21', n: 1 },
    ]);
    expect(dailySeriesOf('calledByAi', '2026-10-19', '2026-10-21', facts, null).map((d) => d.n)).toEqual([0, 0, 1]);
  });

  it('ใบขอรายวันจาก requestDays', () => {
    const days = toRequestDays([
      { day: '2026-10-20', releasedAt: '2026-10-20T03:00:00Z', applications: 2 },
      { day: '2026-10-20', releasedAt: null, applications: 0 },
      { day: '2026-10-21', releasedAt: '2026-10-21T03:00:00Z', applications: 0 },
    ]);
    expect(days).toEqual([
      { day: '2026-10-20', total: 2, released: 1, releasedWithApps: 1 },
      { day: '2026-10-21', total: 1, released: 1, releasedWithApps: 0 },
    ]);
    expect(dailySeriesOf('released', '2026-10-19', '2026-10-21', [], days).map((d) => d.n)).toEqual([0, 1, 1]);
  });

  it('daysBetween ข้ามเดือน', () => {
    expect(daysBetween('2026-09-30', '2026-10-02')).toEqual(['2026-09-30', '2026-10-01', '2026-10-02']);
  });
});

describe('หน้าจอ', () => {
  it('ค่าเริ่ม 7 วัน · มีปุ่ม 7 วันล่าสุด · การ์ดเทียบอยู่ครบ 4 แท็บ · กดช่วงได้', () => {
    const src = read('src/components/dashboard-trends/RecruitOverview.tsx');
    expect(src).toContain('useState<DateRangeYmd | null>(() => lastDays(7))');
    expect(src).toContain('data-testid="recruit-last7"');
    for (const t of ['requests', 'apps', 'staff', 'appt']) expect(src).toContain(`{compareCard('${t}')}`);
    // 21 ต.ค. 2569 ค่ำ: แท่งคู่ → กราฟเส้นรายวัน (เจ้าของ "อยากให้มันวิ่งแบบอันนี้")
    const card = read('src/components/dashboard-trends/TrendLinesCard.tsx');
    expect(card).toContain('data-testid={`trend-period-${p}`}');
    expect(card).toContain('data-testid="trend-chart"');
  });
});
