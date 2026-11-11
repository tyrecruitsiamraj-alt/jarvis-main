// @vitest-environment node
/**
 * ปุ่มรีเฟรชถอดทุกหน้า (เจ้าของ 11 พ.ย. 2569 "เอาปุ่มนี่ออกไปเกะกะอะ" · "ทุกหน้าเลยนะ")
 * เหลือแค่ "ลองใหม่" ตอนโหลดไม่สำเร็จ (กล่องแจ้งพัง) และปุ่มที่สั่งงาน ("คิดใหม่" · ค้นอีกรอบ)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const files = [
  'src/components/jobs/JobBoardView.tsx',
  'src/components/recruit-rm/RmWorkspace.tsx',
  'src/components/dashboard/analytics/DashboardShell.tsx',
  'src/components/dashboard-trends/RecruitOverview.tsx',
  'src/components/follow/CallFunnelPanel.tsx',
  'src/components/follow/FollowCallRoundsPanel.tsx',
  'src/components/home/FollowTodayPanel.tsx',
  'src/components/home/TeamBoardPanel.tsx',
  'src/components/matching/AiCallFlowPanel.tsx',
  'src/components/recruit-rm/RecruitFunnelPanel.tsx',
  'src/pages/HomeV3Page.tsx',
  'src/pages/TeamOnlinePage.tsx',
  'src/pages/aftercare/AftercarePage.tsx',
  'src/pages/jobs/JobDashboard.tsx',
  'src/pages/jobs/JobListPage.tsx',
  'src/pages/jobs/UnitRequestTabPage.tsx',
  'src/pages/settings/ApplicationAutoMoveTab.tsx',
  'src/pages/settings/SystemHealthTab.tsx',
  'src/pages/work/WorkQueuePage.tsx',
  'src/pages/follow/FollowPage.tsx',
];

describe('ไม่มีปุ่มรีเฟรชบนหน้า', () => {
  it.each(files)('%s', (f) => {
    const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');
    expect(src).not.toMatch(/>\s*รีเฟรช\s*</);
    expect(src).not.toMatch(/\/>\s*รีเฟรช/);
    expect(src).not.toMatch(/aria-label="รีเฟรช/);
    expect(src).not.toContain('title="รีเฟรช');
  });
});
