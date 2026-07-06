import type { DashboardData } from './types';

/** Demo payload when API feed is empty (local dev / offline). */
export const MOCK_DASHBOARD_DATA: DashboardData = {
  periodLabel: 'เดือนนี้',
  previousPeriodLabel: 'เดือนที่แล้ว',
  activityTrendLabel: 'ม.ค. 2026 – ก.ค. 2026',
  kpis: [
    { id: 'total', label: 'งานทั้งหมด', value: 48, description: 'ใบขอในช่วงที่เลือก', trendPercent: 12 },
    { id: 'open', label: 'รอดำเนินการ', value: 21, description: 'ยังไม่ปิด / ไม่ยกเลิก', trendPercent: -5 },
    { id: 'overdue', label: 'ล่าช้า', value: 6, description: 'เกินกำหนดหรือค้างนาน', trendPercent: 2 },
    { id: 'completed', label: 'สำเร็จ', value: 24, description: 'ปิดงานแล้ว', trendPercent: 18 },
    { id: 'success_rate', label: 'อัตราสำเร็จ', value: 50, description: '% ปิดงานจากทั้งหมด', trendPercent: 4, format: 'percent' },
  ],
  activityTrend: [
    { date: '2026-01-01', label: 'ม.ค.', resignations: 6, replacements: 4, newOpenings: 9 },
    { date: '2026-02-01', label: 'ก.พ.', resignations: 7, replacements: 5, newOpenings: 10 },
    { date: '2026-03-01', label: 'มี.ค.', resignations: 9, replacements: 6, newOpenings: 11 },
    { date: '2026-04-01', label: 'เม.ย.', resignations: 8, replacements: 5, newOpenings: 12 },
    { date: '2026-05-01', label: 'พ.ค.', resignations: 8, replacements: 5, newOpenings: 12 },
    { date: '2026-06-01', label: 'มิ.ย.', resignations: 11, replacements: 7, newOpenings: 15 },
    { date: '2026-07-01', label: 'ก.ค.', resignations: 4, replacements: 3, newOpenings: 6 },
  ],
  statusBreakdown: [
    { status: 'in_progress', label: 'กำลังดำเนินการ', count: 12, color: '#3b82f6' },
    { status: 'completed', label: 'สำเร็จ', count: 24, color: '#22c55e' },
    { status: 'overdue', label: 'ล่าช้า', count: 6, color: '#ef4444' },
  ],
  ageDaysBreakdown: [
    { bucket: '1-7', label: '1–7 วัน', count: 18 },
    { bucket: '8-14', label: '8–14 วัน', count: 11 },
    { bucket: '15-30', label: '15–30 วัน', count: 9 },
    { bucket: '30+', label: '30 วันขึ้นไป', count: 4 },
    { bucket: 'advance', label: 'ล่วงหน้า', count: 22 },
  ],
  recruiterOverview: [
    { name: 'สมหญิง ใจดี', total: 14, completed: 8, overdue: 2, sharePercent: 29.2 },
    { name: 'วิชัย รักงาน', total: 11, completed: 6, overdue: 1, sharePercent: 22.9 },
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
