// @vitest-environment node
/**
 * จับคู่งานย้ายไปอยู่ใต้ "โพสต์ประกาศ ▾" · การติดต่อเหลือที่เดียว (เจ้าของ 11 พ.ย. 2569 "ทำตามแบบร่างเลย")
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { POSTING_PICKS } from '@/components/jobs/JobBoardView';
import { CONVEYOR_STEPS, HOME_TEAM_NAV, stepForPath } from '@/lib/soRecruitNav';

const read = (p: string) => readFileSync(p, 'utf8');

describe('จับคู่งานใต้โพสต์ประกาศ', () => {
  it('ลูกศรที่แท็บแรกเลือกได้ 2 เรื่อง', () => {
    expect(POSTING_PICKS.map((p) => p.label)).toEqual(['โพสต์ประกาศ', 'จับคู่งาน']);
    const board = read('src/pages/jobs/StaffJobBoardPage.tsx');
    expect(board).toContain('<MatchingPage embedded />');
  });
  it('เมนูจับคู่งานพามาที่ ?view=match และไฮไลต์ถูกขั้น · ลิงก์เก่ายังเปิดได้', () => {
    expect(CONVEYOR_STEPS.find((s) => s.key === 'matching')?.path).toBe('/jobs/board?view=match');
    expect(stepForPath('/jobs/board', '?view=match')?.key).toBe('matching');
    expect(stepForPath('/jobs/board', '')).toBeNull();
    expect(HOME_TEAM_NAV.find((t) => t.key === 'closing')?.path).toBe('/jobs/board?view=match');
    const app = read('src/App.tsx');
    expect(app).toContain('<Route path="/matching/match" element={<MatchingMovedRedirect view="match" />} />');
    expect(app).toContain('<Route path="/matching/contact" element={<MatchingMovedRedirect view="contact" />} />');
  });
  it('การติดต่อตารางเดียว: คนจากจับคู่งานอยู่บนสุด · ชิปนับรวมสองทาง · ไม่มีปุ่มสลับ "มาจาก"', () => {
    const rm = read('src/components/recruit-rm/RmWorkspace.tsx');
    expect(rm).toContain('extraRows={');
    expect(rm).toContain('matchKeyed.filter((r) => isInSelectionChip(r, c.id)).length');
    expect(rm).not.toContain("searchParams.get('source')");
    expect(rm).not.toContain('มาจาก: ');
    expect(read('src/components/recruit-rm/RmTable.tsx')).toContain('rows.length === 0 && extraRowCount === 0');
  });
});
