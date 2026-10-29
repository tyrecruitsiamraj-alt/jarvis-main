/**
 * Dashboard: กดกล่องสถานะทำงาน → การ์ดเร่งด่วนเป็นใบของสถานะนั้น + รายการทีละใบ (เจ้าของ 29 ต.ค. 2569 "ทำเลย")
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildStatusLeadPanel } from '../../src/lib/dashboard/statusLeadPanel';
import type { JobRequest } from '../../src/types';

const job = (over: Partial<JobRequest>): JobRequest =>
  ({
    id: 'siamraj-sql:OPL6910101',
    request_no: 'OPL6910101',
    unit_name: 'ธนาคารกรุงศรีอยุธยา จำกัด (มหาชน)',
    request_date: '2026-10-27',
    required_date: '2026-11-01',
    request_positions: 1,
    filled_positions: 0,
    cancelled_positions: 0,
    work_status: 'waiting_start',
    submittedByName: 'เนตรนภา ยศนันท์',
    ...over,
  }) as JobRequest;

describe('buildStatusLeadPanel', () => {
  const TODAY = new Date('2026-10-29T03:00:00Z');
  const jobs = [
    job({}),
    job({ id: 'siamraj-sql:OPL6910087', request_no: 'OPL6910087', request_date: '2026-10-22', required_date: '2026-11-02', request_positions: 2 }),
    job({ id: 'siamraj-sql:OPL6909082', request_no: 'OPL6909082', request_date: '2026-09-22', required_date: '2026-09-14' }),
    // หาครบแล้ว — ไม่นับ (กล่องสถานะก็ไม่นับ)
    job({ id: 'siamraj-sql:OPL6910070', request_no: 'OPL6910070', filled_positions: 1 }),
  ];
  it('นับเฉพาะใบที่ยังต้องหา · สามชนิดรวมกัน = ทั้งหมด (ใบและอัตรา)', () => {
    const p = buildStatusLeadPanel(jobs, TODAY);
    expect(p.total).toEqual({ requests: 3, positions: 4 });
    const sum = (k: 'requests' | 'positions') => p.kinds.retroactive[k] + p.kinds.urgent[k] + p.kinds.advance[k];
    expect([sum('requests'), sum('positions')]).toEqual([3, 4]);
    expect([p.kinds.retroactive.requests, p.kinds.urgent.requests, p.kinds.advance.requests]).toEqual([1, 1, 1]);
  });
  it('รายการ: ย้อนหลังขึ้นก่อน · มีวันที่กรอก คนกรอก สถานะ วันที่ต้องการ ต้องหา', () => {
    const rows = buildStatusLeadPanel(jobs, TODAY).rows;
    expect(rows.map((r) => [r.requestNo, r.kind])).toEqual([
      ['OPL6909082', 'retroactive'],
      ['OPL6910101', 'urgent'],
      ['OPL6910087', 'advance'],
    ]);
    expect(rows[1]).toMatchObject({ submitted: '2026-10-27', submittedBy: 'เนตรนภา ยศนันท์', status: 'รอเริ่มงาน', required: '2026-11-01', remaining: 1 });
    expect(rows[2].remaining).toBe(2);
  });
  it('จอ: กดกล่องสถานะไม่เด้งป๊อป · การ์ดเร่งด่วนสลับเป็นแผงสถานะ · รายการเลื่อนในกล่อง · มีปุ่มกลับแบบเดิม', () => {
    const page = readFileSync('src/pages/dashboard/SupervisorDashboard.tsx', 'utf8');
    expect(page).toContain('setStatusPick((cur) => (cur?.kpiId === kpiId ? null : { kpiId, label }));');
    const shell = readFileSync('src/components/dashboard/analytics/DashboardShell.tsx', 'utf8');
    expect(shell).toContain('<DashboardStatusLeadPanel');
    expect(shell).toContain('selected={statusPick?.kpiId === kpi.id}');
    const panel = readFileSync('src/components/dashboard/analytics/DashboardStatusLeadPanel.tsx', 'utf8');
    expect(panel).toContain('max-h-96 overflow-auto');
    expect(panel).toContain('ดูแบบเดิม');
    for (const h of ['วันที่กรอก', 'คนกรอก']) expect(panel).toContain(h);
    // เลขที่ใบซ้ำได้ (ใบขอล่วงหน้า) — คีย์ต้องเป็น id ไม่งั้นแถวค้างตอนสลับกล่อง
    expect(panel).toContain('key={String(r.job.id)}');
  });
});
