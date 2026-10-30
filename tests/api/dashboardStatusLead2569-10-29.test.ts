/**
 * Dashboard: กดกล่องสถานะทำงาน → การ์ดเร่งด่วนเป็นใบของสถานะนั้น + รายการทีละใบ (เจ้าของ 29 ต.ค. 2569 "ทำเลย")
 * ร่าง 2 ("การนับคงเดิมไว้ก่อน 3 หน้า ส่วนอันนั้นแก้เลย"): กล่อง เข้ามา/หาได้แล้ว/ยกเลิก/คงเหลือ กดได้แบบเดียวกัน ·
 * ตาราง "ใครคีย์" · ใบขอชั่วคราวแยกกล่อง "ทั้งหมด" = ผลรวมสถานะ · ไม่มี %
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NO_KEYER, buildCohortLeadPanel, buildKeyerRows, buildStatusLeadPanel } from '../../src/lib/dashboard/statusLeadPanel';
import { buildCohortDrillDown } from '../../src/lib/dashboard/cohortDrillDown';
import { buildDashboardData, DEFAULT_DASHBOARD_FILTERS } from '../../src/lib/dashboard/buildDashboardData';
import type { ThroughputRecord } from '../../src/lib/dashboard/throughput';
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
    expect(rows[1]).toMatchObject({ submitted: '2026-10-27', submittedBy: 'เนตรนภา ยศนันท์', status: 'รอเริ่มงาน', required: '2026-11-01', amount: 1 });
    expect(rows[2].amount).toBe(2);
  });
  it('จอ: กดกล่องสถานะไม่เด้งป๊อป · การ์ดเร่งด่วนสลับเป็นแผงสถานะ · รายการเลื่อนในกล่อง · มีปุ่มกลับแบบเดิม', () => {
    const page = readFileSync('src/pages/dashboard/SupervisorDashboard.tsx', 'utf8');
    expect(page).toContain('const togglePick = () => setStatusPick(pickId === kpiId ? null : kpiId);');
    const shell = readFileSync('src/components/dashboard/analytics/DashboardShell.tsx', 'utf8');
    expect(shell).toContain('<DashboardStatusLeadPanel');
    expect(shell).toContain('selected={statusPick?.kpiId === kpi.id}');
    const panel = readFileSync('src/components/dashboard/analytics/DashboardStatusLeadPanel.tsx', 'utf8');
    expect(panel).toContain('max-h-96 overflow-auto');
    expect(panel).toContain('ดูแบบเดิม');
    for (const h of ['วันที่กรอก', 'คนกรอก']) expect(panel).toContain(h);
    // เลขที่ใบซ้ำได้ (ใบขอล่วงหน้า) — คีย์ต้องเป็น id ไม่งั้นแถวค้างตอนสลับกล่อง
    expect(panel).toContain('key={r.key}');
    // เจ้าของ "เอา % ออก"
    expect(panel).not.toMatch(/\}%</);
    expect(readFileSync('src/components/dashboard/analytics/DashboardLeadKindChart.tsx', 'utf8')).not.toContain('{s.percent}%');
    expect(readFileSync('src/components/dashboard/analytics/DashboardKpiCard.tsx', 'utf8')).not.toContain('{progressPercent}%');
  });
});

const rec = (over: Partial<ThroughputRecord>): ThroughputRecord => ({
  requestNo: 'OPL6910101',
  jobId: 'siamraj-sql:OPL6910101',
  requestNoDisplay: 'OPL6910101',
  unitName: 'ธนาคารกรุงศรีอยุธยา จำกัด (มหาชน)',
  requestDate: '2026-10-05',
  submittedDate: '2026-10-01',
  requiredDate: '2026-10-05',
  requesterName: 'กิตติญา จั่นระยับ',
  leadKind: 'urgent',
  closureDate: null,
  positionUnits: 1,
  isOpen: true,
  kind: 'remaining',
  ...over,
});

describe('กล่อง เข้ามา/หาได้แล้ว/ยกเลิก/คงเหลือ → การ์ดเร่งด่วน (ชุดเดียวกับเลขบนการ์ด)', () => {
  const records = [
    rec({}),
    rec({ requestNo: 'OPL6910087', jobId: 'siamraj-sql:OPL6910087', requestNoDisplay: 'OPL6910087', kind: 'filled', isOpen: false, positionUnits: 2, leadKind: 'advance', requesterName: 'ธนัญญา ธรรมศิริ' }),
    rec({ requestNo: 'OPL6910087', jobId: 'siamraj-sql:OPL6910087', requestNoDisplay: 'OPL6910087', kind: 'cancelled', isOpen: false, positionUnits: 1, leadKind: 'advance', requesterName: 'ธนัญญา ธรรมศิริ' }),
    rec({ requestNo: 'OPL6909082', jobId: 'siamraj-sql:OPL6909082', requestNoDisplay: 'OPL6909082', kind: 'cancelled', isOpen: false, leadKind: 'retroactive', requesterName: undefined }),
  ];
  const feed = new Map([['siamraj-sql:OPL6910101', job({ work_status: 'in_progress' })]]);
  const jobOf = (r: { jobId: string | null }) => {
    const j = r.jobId ? feed.get(r.jobId) : undefined;
    return { job: j ?? null, inFeed: Boolean(j) };
  };

  it('ยอดแผง = ยอดการ์ด (อัตรา + ใบ) ทุกกล่อง · จำนวนแถว = อัตราของถังนั้น', () => {
    for (const kpi of ['total_requests', 'closed', 'cancelled', 'remaining'] as const) {
      const drill = buildCohortDrillDown(records, '2026-10-01', '2026-10-31', kpi);
      const p = buildCohortLeadPanel(drill.rows, jobOf);
      expect([p.total.positions, p.total.requests]).toEqual([drill.positions, drill.requestCount]);
    }
    const cancelled = buildCohortLeadPanel(buildCohortDrillDown(records, '2026-10-01', '2026-10-31', 'cancelled').rows, jobOf);
    expect(cancelled.total).toEqual({ requests: 2, positions: 2 });
    expect([cancelled.kinds.retroactive.requests, cancelled.kinds.advance.requests]).toEqual([1, 1]);
  });

  it('แถวมีวันที่กรอก (ไม่ใช่วันอ้างอิงงวด) คนกรอก สถานะ · ใบที่ยังต้องหาใช้สถานะทำงานจาก feed', () => {
    const p = buildCohortLeadPanel(buildCohortDrillDown(records, '2026-10-01', '2026-10-31', 'total_requests').rows, jobOf);
    const byNo = new Map(p.rows.map((r) => [r.requestNo, r]));
    expect(byNo.get('OPL6910101')).toMatchObject({ submitted: '2026-10-01', submittedBy: 'กิตติญา จั่นระยับ', status: 'กำลังดำเนินการสรรหา', amount: 1 });
    expect(byNo.get('OPL6910087')).toMatchObject({ status: 'ปิดแล้ว', amount: 3, job: null });
    expect(byNo.get('OPL6909082')?.status).toBe('ยกเลิก');
    // ใบที่ยังต้องหาแต่ไม่อยู่ใน feed = ไม่มีสถานะ (ตรงกล่อง work_status_none)
    const outside = buildCohortLeadPanel(buildCohortDrillDown(records, '2026-10-01', '2026-10-31', 'remaining').rows, () => ({ job: null, inFeed: false }));
    expect(outside.rows.map((r) => r.status)).toEqual(['ไม่มีสถานะ']);
  });

  it('ใครคีย์: นับใบต่อคน แยกความเร่ง · มากสุดก่อน · ไม่มีชื่อยังนับ', () => {
    const p = buildCohortLeadPanel(buildCohortDrillDown(records, '2026-10-01', '2026-10-31', 'total_requests').rows, jobOf);
    const keyers = buildKeyerRows(p.rows);
    expect(keyers.map((k) => [k.name, k.total, k.retroactive, k.urgent, k.advance])).toEqual([
      ['กิตติญา จั่นระยับ', 1, 0, 1, 0],
      ['ธนัญญา ธรรมศิริ', 1, 0, 0, 1],
      [NO_KEYER, 1, 1, 0, 0],
    ]);
    expect(keyers.reduce((n, k) => n + k.total, 0)).toBe(p.total.requests);
  });

  it('จอ: กล่องบนกดแล้วไม่เด้งป๊อป — สลับการ์ดเร่งด่วน · มีตาราง ใครคีย์', () => {
    const page = readFileSync('src/pages/dashboard/SupervisorDashboard.tsx', 'utf8');
    expect(page).toContain('buildCohortLeadPanel(drill.rows');
    const shell = readFileSync('src/components/dashboard/analytics/DashboardShell.tsx', 'utf8');
    expect(shell).toContain('selected={statusPick?.kpiId === kpi.id}');
    expect(shell).toContain('data.prequestKpi');
    const panel = readFileSync('src/components/dashboard/analytics/DashboardStatusLeadPanel.tsx', 'utf8');
    expect(panel).toContain('ใครคีย์ใบขอพวกนี้');
  });
});

describe('ใบขอชั่วคราวแยกกล่อง · "ทั้งหมด" = ผลรวมสถานะ', () => {
  it('กล่องสถานะไม่นับใบชั่วคราว · กล่องใบขอชั่วคราวนับส่วนที่แยกออก', () => {
    const open = [
      job({ id: 'siamraj-sql:OPL6910101', work_status: 'in_progress', request_positions: 2 }),
      job({ id: 'siamraj-pre:OPL6910101', request_no: 'OPL6910101', work_status: 'in_progress', request_positions: 3, is_prequest: true }),
    ];
    const data = buildDashboardData(open, [], null, DEFAULT_DASHBOARD_FILTERS, new Date('2026-10-29T03:00:00Z'));
    const total = data.workStatusKpis.find((k) => k.id === 'work_status_total');
    const leaves = data.workStatusKpis.filter((k) => k.id !== 'work_status_total').reduce((n, k) => n + k.value, 0);
    expect([total?.value, total?.secondaryCount, leaves]).toEqual([2, 1, 2]);
    expect(data.prequestKpi).toMatchObject({ id: 'work_status_prequest', label: 'ใบขอชั่วคราว', value: 3, secondaryCount: 1 });
  });
});

describe('QA 30 ต.ค. 2569 ก้อน 3 Dashboard', () => {
  it('กล่องที่กดจำใน URL (?pick=) · แผงเลื่อนจอมาให้เห็น · ป๊อปรายการใช้สีธีม (โหมดมืดอ่านได้)', () => {
    const page = readFileSync('src/pages/dashboard/SupervisorDashboard.tsx', 'utf8');
    expect(page).toContain("searchParams.get('pick')");
    const panel = readFileSync('src/components/dashboard/analytics/DashboardStatusLeadPanel.tsx', 'utf8');
    expect(panel).toContain("rootRef.current?.scrollIntoView");
    const dlg = readFileSync('src/components/shared/DetailListDialog.tsx', 'utf8');
    expect(dlg).toContain('rounded-2xl border border-border bg-card p-3.5');
  });
  it('โหมดมีงวด: ถังอายุ/ภาระงาน = ชุดเดียวกับคงเหลือ (ไม่มีใบขอชั่วคราว)', () => {
    const src = readFileSync('src/lib/dashboard/buildDashboardData.ts', 'utf8');
    expect(src).toContain('buildAgeDaysBreakdown(period ? periodStockReal : openRemainingJobs, today)');
    expect(src).toContain('buildUnitOverview(period ? openRemainingJobs.filter((j) => !isPrequestJob(j)) : openRemainingJobs, today)');
  });
});
