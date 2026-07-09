import type { DashboardData } from './types';

/** Demo payload when API feed is empty (local dev / offline). */
export const MOCK_DASHBOARD_DATA: DashboardData = {
  periodLabel: 'เดือนนี้',
  previousPeriodLabel: 'เดือนที่แล้ว',
  activityTrendLabel: 'ม.ค. 2026 – ก.ค. 2026',
  kpis: [
    { id: 'total', label: 'งานทั้งหมด', value: 52, description: 'ตำแหน่งที่ต้องการตามตัวกรอง', trendPercent: 12 },
    { id: 'open', label: 'รอดำเนินการ', value: 21, description: 'ยังไม่ปิด / ไม่ยกเลิก', trendPercent: -5 },
    { id: 'overdue', label: 'ล่าช้า', value: 6, description: 'เกินกำหนดหรือค้างนาน', trendPercent: 2 },
    { id: 'completed', label: 'ปิดใบขอ', value: 24, description: 'ตำแหน่งที่ปิดแล้วทุกประเภท', trendPercent: 18 },
    { id: 'success_rate', label: 'อัตราปิด', value: 50, description: '% ปิดได้จากที่ขอ', trendPercent: 4, format: 'percent' },
  ],
  activityTrend: [
    { date: '2026-01-01', label: 'ม.ค.', resignations: 6, replacements: 4, newOpenings: 9, requestedPositions: 22, closedPositions: 18 },
    { date: '2026-02-01', label: 'ก.พ.', resignations: 7, replacements: 5, newOpenings: 10, requestedPositions: 24, closedPositions: 20 },
    { date: '2026-03-01', label: 'มี.ค.', resignations: 9, replacements: 6, newOpenings: 11, requestedPositions: 28, closedPositions: 21 },
    { date: '2026-04-01', label: 'เม.ย.', resignations: 8, replacements: 5, newOpenings: 12, requestedPositions: 26, closedPositions: 23 },
    { date: '2026-05-01', label: 'พ.ค.', resignations: 8, replacements: 5, newOpenings: 12, requestedPositions: 25, closedPositions: 22 },
    { date: '2026-06-01', label: 'มิ.ย.', resignations: 11, replacements: 7, newOpenings: 15, requestedPositions: 31, closedPositions: 27 },
    { date: '2026-07-01', label: 'ก.ค.', resignations: 4, replacements: 3, newOpenings: 6, requestedPositions: 14, closedPositions: 11 },
  ],
  unitOverview: [
    { name: 'ธนาคารกรุงศรี', total: 18, open: 9, overdue: 2, sharePercent: 34.6 },
    { name: 'ศูนย์การค้าเซ็นทรัล', total: 14, open: 6, overdue: 1, sharePercent: 26.9 },
    { name: 'ไทยพาณิชย์ สำนักงานใหญ่', total: 11, open: 4, overdue: 0, sharePercent: 21.2 },
  ],
  ageDaysBreakdown: [
    { bucket: 'advance', label: 'ล่วงหน้า', count: 22 },
    { bucket: '1-7', label: '1–7 วัน', count: 18 },
    { bucket: '8-14', label: '8–14 วัน', count: 11 },
    { bucket: '15-30', label: '15–30 วัน', count: 9 },
    { bucket: '30+', label: '30 วันขึ้นไป', count: 4 },
  ],
  ageDaysPositionTotal: 52,
  ageDaysRequestTotal: 48,
  recruiterOverview: [
    { name: 'สมหญิง ใจดี', role: 'recruiter', total: 14, completed: 8, overdue: 2, sharePercent: 29.2 },
    { name: 'วิชัย รักงาน', role: 'recruiter', total: 11, completed: 6, overdue: 1, sharePercent: 22.9 },
    { name: 'อรทัย คัดสรร', role: 'screener', total: 12, completed: 7, overdue: 1, sharePercent: 26.1 },
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
