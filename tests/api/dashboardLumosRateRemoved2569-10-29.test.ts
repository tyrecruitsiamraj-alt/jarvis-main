/** แผง "Rate ผลการโทร Lumos" บน Dashboard ถอดแล้ว (เจ้าของ 29 ต.ค. 2569 "เอาออกไป") — ห้ามเติมกลับ */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Dashboard ไม่มีแผง Rate ผลการโทร Lumos', () => {
  it('ไม่มีไฟล์แผง · หน้า Dashboard ไม่เรียก · DashboardShell ไม่มีช่องแผงเสริม', () => {
    expect(existsSync('src/components/dashboard/LumosCallRatePanel.tsx')).toBe(false);
    expect(readFileSync('src/pages/dashboard/SupervisorDashboard.tsx', 'utf8')).not.toContain('LumosCallRatePanel');
    expect(readFileSync('src/components/dashboard/analytics/DashboardShell.tsx', 'utf8')).not.toContain('extraPanels');
  });
});
