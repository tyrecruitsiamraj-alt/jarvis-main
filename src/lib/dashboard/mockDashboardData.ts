import type { DashboardData } from './types';

/** Demo payload when API feed is empty (local dev / offline). */
export const MOCK_DASHBOARD_DATA: DashboardData = {
  periodLabel: 'เดือนนี้',
  previousPeriodLabel: 'เดือนที่แล้ว',
  kpis: [
    { id: 'total', label: 'งานทั้งหมด', value: 48, description: 'ใบขอในช่วงที่เลือก', trendPercent: 12 },
    { id: 'open', label: 'รอดำเนินการ', value: 21, description: 'ยังไม่ปิด / ไม่ยกเลิก', trendPercent: -5 },
    { id: 'overdue', label: 'ล่าช้า', value: 6, description: 'เกินกำหนดหรือค้างนาน', trendPercent: 2 },
    { id: 'completed', label: 'สำเร็จ', value: 24, description: 'ปิดงานแล้ว', trendPercent: 18 },
    { id: 'success_rate', label: 'อัตราสำเร็จ', value: 50, description: '% ปิดงานจากทั้งหมด', trendPercent: 4, format: 'percent' },
  ],
  trend: [
    { date: '2026-07-01', current: 2, previous: 1 },
    { date: '2026-07-02', current: 3, previous: 2 },
    { date: '2026-07-03', current: 1, previous: 4 },
  ],
  statusBreakdown: [
    { status: 'in_progress', label: 'กำลังดำเนินการ', count: 12, color: '#3b82f6' },
    { status: 'completed', label: 'สำเร็จ', count: 24, color: '#22c55e' },
    { status: 'overdue', label: 'ล่าช้า', count: 6, color: '#ef4444' },
  ],
  recruiterOverview: [
    { name: 'สมหญิง ใจดี', total: 14, completed: 8, overdue: 2, sharePercent: 29.2 },
    { name: 'วิชัย รักงาน', total: 11, completed: 6, overdue: 1, sharePercent: 22.9 },
  ],
  resignationTrend: [
    { month: '2026-05', label: 'พ.ค. 2026', resignations: 8, replacements: 5 },
    { month: '2026-06', label: 'มิ.ย. 2026', resignations: 11, replacements: 7 },
    { month: '2026-07', label: 'ก.ค. 2026', resignations: 4, replacements: 3 },
  ],
  workQueue: [
    {
      id: 'demo-1',
      requestNo: 'RQ-240701',
      unitName: 'ศูนย์การค้าเซ็นทรัล',
      destination: 'กรุงเทพฯ',
      ownerName: 'สมหญิง ใจดี',
      screenerName: '—',
      status: 'overdue',
      slaStatus: 'breached',
      priority: 0,
      requestDate: '2026-07-01',
      requiredDate: '2026-07-05',
      updatedAt: '2026-07-01',
      nextAction: 'ติดตามด่วน',
      requestAction: 'ลาออก',
      sendReplacement: true,
      resignedName: 'นาย ก.',
      isResignation: true,
    },
  ],
};
