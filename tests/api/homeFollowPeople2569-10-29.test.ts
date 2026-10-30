/**
 * การ์ดติดตามหน้าหลักบอกทั้งคนและสาย (เจ้าของ 29 ต.ค. 2569 *"264 คือคนหรือสาย มันต้องบอกแบบนี้ กี่คน กี่สาย ไปกี่คน ไม่ไปกี่คน"*)
 * · "AI โทร" ห้ามนับสายที่ยังรอ · ปุ่ม "ทั้งหมด" ของภาพรวมงานสรรหา
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildFollowPersonCells, followPersonBucket, followPersonKey, type FollowBuCell } from '../../src/lib/homeLumosSummary';
import { followCallsMade, followPersonResults, followPersonTeams } from '../../src/lib/homeSplit';
import { ALL_MAX_DAYS, RANGE_MAX_DAYS, rangeWindow } from '../../src/lib/recruitOverviewWindow';

const read = (p: string) => readFileSync(p, 'utf8');
const COLS = [
  { key: 'went', label: 'ไป' },
  { key: 'notWent', label: 'ไม่ไป' },
  { key: 'leave', label: 'ลางาน' },
  { key: 'unclear', label: 'สรุปไม่ได้' },
  { key: 'failed', label: 'ไม่รับสาย' },
  { key: 'waiting', label: 'รอโทร' },
] as const;

describe('ผลรายคน', () => {
  it('ผลชี้ขาดก่อน · ยังมีสายรอ = รอโทร (ก่อนสรุปไม่ได้/ไม่รับสาย) · ยกเลิกหมด = ยกเลิก', () => {
    expect(followPersonBucket(['failed', 'went', 'waiting'])).toBe('went');
    expect(followPersonBucket(['failed', 'waiting'])).toBe('waiting');
    expect(followPersonBucket(['failed', 'unclear'])).toBe('unclear');
    expect(followPersonBucket([])).toBe('cancelled');
  });
  it('คน = เบอร์ 9 หลักท้าย + วัน · ไม่มีเบอร์ = แยกทีละสาย', () => {
    expect(followPersonKey('+66 89-123-4567', '2026-10-29', 'x')).toBe(followPersonKey('0891234567', '2026-10-29', 'y'));
    expect(followPersonKey('0891234567', '2026-10-29', 'x')).not.toBe(followPersonKey('0891234567', '2026-10-30', 'x'));
    expect(followPersonKey(null, '2026-10-29', 'a1b2')).toBe('id:a1b2');
  });
  it('คนแทน 3 สาย (16:00 ไม่รับ · ก่อน 1 ชม. ไป · ก่อน 15 นาที รอ) = 1 คน ไป · ทุกช่องรวม = จำนวนคน', () => {
    const k1 = followPersonKey('+66891234567', '2026-10-29', 'r1');
    const k2 = followPersonKey('+66812223333', '2026-10-29', 'r4');
    const cells = buildFollowPersonCells([
      { key: k1, bu: 'LBD', team: 'replacement', bucket: 'failed' },
      { key: k1, bu: 'LBD', team: 'replacement', bucket: 'went' },
      { key: k1, bu: 'LBD', team: 'replacement', bucket: 'waiting' },
      { key: k2, bu: 'LBD', team: 'main', bucket: 'failed' },
    ]);
    const lines: FollowBuCell[] = [
      { bu: 'LBD', team: 'replacement', caller: 'ai', bucket: 'failed', n: 1 },
      { bu: 'LBD', team: 'replacement', caller: 'ai', bucket: 'went', n: 1 },
      { bu: 'LBD', team: 'replacement', caller: 'ai', bucket: 'waiting', n: 1 },
      { bu: 'LBD', team: 'main', caller: 'manual', bucket: 'failed', n: 1 },
    ];
    const rows = followPersonResults(cells, lines, COLS);
    // ว่างแล้วห้ามหาย (QA 30 ต.ค. 2569) — ทุกผลขึ้นแม้ 0
    expect(rows.map((r) => [r.key, r.people, r.calls])).toEqual(COLS.map((c) => [c.key, ...({ went: [1, 1], failed: [1, 2], waiting: [0, 1] } as Record<string, number[]>)[c.key] ?? [0, 0]]));
    expect(rows.reduce((n, r) => n + r.people, 0)).toBe(2);
    expect(followPersonTeams(cells)).toEqual({ main: 1, replacement: 1 });
    expect(followCallsMade(lines)).toEqual({ aiDone: 2, aiWaiting: 1, staffDone: 1, staffWaiting: 0 });
  });
  it('การ์ดหน้าหลัก: ทั้งหมดเป็นคน · AI/คน "โทรแล้ว" + รอ · บรรทัดบวกทั้งคนและสาย · ไม่มีกล่อง "AI โทร" แบบรวมสายที่รอ', () => {
    const page = read('src/pages/HomeOverviewPage.tsx');
    expect(page).toContain('label="AI โทรแล้ว"');
    expect(page).toContain('label="คนโทรแล้ว"');
    expect(page).toContain('data-testid="overview-follow-people-sum"');
    expect(page).toContain('data-testid="overview-follow-calls-sum"');
    expect(page).not.toContain('label="AI โทร" value={follow?.ai}');
    expect(read('api/_lib/homeLumosSummarySql.ts')).toContain('followPeople: buildFollowPersonCells(personRows)');
  });
});

describe('ปุ่ม "ทั้งหมด" ภาพรวมงานสรรหา', () => {
  it('ช่วงทั้งหมดยาวได้ถึง 2 ปี · ช่วงปกติยังตัดที่ 62 วัน', () => {
    const all = rangeWindow('2026-08-20', '2026-10-29', '2026-10-29', true)!;
    expect([all.from, all.to, all.all]).toEqual(['2026-08-20', '2026-10-29', true]);
    const normal = rangeWindow('2026-08-20', '2026-10-29', '2026-10-29')!;
    expect(normal.all).toBeUndefined();
    expect(normal.from).not.toBe('2026-08-20');
    expect(RANGE_MAX_DAYS).toBe(62);
    expect(ALL_MAX_DAYS).toBe(731);
  });
  it('มีปุ่มทั้งหมด · ป้ายปุ่มช่วงเวลาขึ้น "ทั้งหมด" · API ส่ง all=1', () => {
    const ui = read('src/components/dashboard-trends/RecruitOverview.tsx');
    expect(ui).toContain('data-testid="recruit-all"');
    expect(ui).toContain("const periodLabel = win.all ? 'ทั้งหมด'");
    expect(read('src/lib/recruitOverviewApi.ts')).toContain("if (range.all) p.set('all', '1');");
    expect(read('api/_handlers/recruit-overview.ts')).toContain("all: req.query?.all === '1'");
  });
});
