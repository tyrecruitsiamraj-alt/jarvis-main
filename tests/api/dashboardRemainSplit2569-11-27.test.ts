import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WORK_STATUS_ADVANCE_ID, WORK_STATUS_DUE_ID, jobInWorkStatusBox } from '@/lib/dashboard/workStatusBox';
import type { JobRequest } from '@/types';

/** Dashboard สถานะทำงาน: คงเหลือ = ถึงวันแล้ว + ล่วงหน้า (เจ้าของ 27 พ.ย. 2569 · Choice "แบ่งสองช่องในกล่อง") */
const today = new Date('2026-11-27T10:00:00+07:00');
const job = (no: string, urgency: 'urgent' | 'advance', required: string): JobRequest =>
  ({
    id: `siamraj-sql:${no}`,
    request_no: no,
    urgency,
    request_date: '2026-11-15',
    created_at: '2026-11-15T00:00:00.000Z',
    required_date: required,
    work_status: 'in_progress',
    request_positions: 1,
    filled_positions: 0,
    cancelled_positions: 0,
  }) as unknown as JobRequest;

describe('คงเหลือ = ถึงวันแล้ว + ล่วงหน้า', () => {
  const jobs = [
    job('OPL6911097', 'urgent', '2026-11-20'),
    job('LBM6910005', 'urgent', '2026-10-01'),
    job('OPL6911075', 'advance', '2026-12-15'),
  ];
  it('ทุกใบอยู่ในช่องเดียว — ถึงวันแล้ว หรือ ล่วงหน้า ไม่ซ้อน ไม่หลุด', () => {
    for (const j of jobs) {
      const inDue = jobInWorkStatusBox(j, WORK_STATUS_DUE_ID, today);
      const inAdv = jobInWorkStatusBox(j, WORK_STATUS_ADVANCE_ID, today);
      expect(inDue !== inAdv).toBe(true);
    }
    expect(jobs.filter((j) => jobInWorkStatusBox(j, WORK_STATUS_DUE_ID, today)).map((j) => j.request_no)).toEqual(['OPL6911097', 'LBM6910005']);
  });

  it('แถวบนมี คงเหลือ ต่อท้าย แบ่งสองช่อง · แถวสถานะนำด้วย ถึงวันแล้ว · กดช่องได้', () => {
    const shell = readFileSync('src/components/dashboard/analytics/DashboardShell.tsx', 'utf8');
    expect(shell).toContain('data-testid="dashboard-remain"');
    expect(shell).toContain('dashboard-remain-part-');
    expect(shell).toContain('rows: [dueKpi, ...list.slice(1)]');
    expect(readFileSync('src/pages/dashboard/SupervisorDashboard.tsx', 'utf8')).toContain("[WORK_STATUS_DUE_ID]: 'due'");
  });
});
