import React from 'react';
import type { DashboardData } from '@/lib/dashboard/types';
import DashboardThroughputChart from './DashboardThroughputChart';

type Props = {
  data: Pick<
    DashboardData,
    'activityTrend' | 'activityTrendLabel' | 'lifecycleBoard' | 'periodLabel'
  >;
};

/**
 * เจ้าของสั่งถอด "พยากรณ์ใบขอเข้าใหม่ตามประเภท" (DemandForecastPanel) ออกจากหน้านี้
 * — component ยังอยู่ที่ request-control/DemandForecastPanel.tsx ถ้าจะเอากลับ (rollback = git revert)
 *
 * 🔴 **18 ส.ค. 2569 เจ้าของสั่งถอด "Life Cycle ตามประเภทใบขอ" ออกอีกสองแผง**
 * (`DashboardLifecycleBoard` = กระดาน ลาออก/เปลี่ยนตัว/เพิ่มอัตรา/เปิดไซต์ ·
 * `DashboardLifecycleMonthlyPanel` = ตารางประเภทใบขอรายเดือน)
 * ไฟล์ component ยังอยู่บนดิสก์เป็นทางถอย แต่**ไม่มีที่ไหนเรียกแล้ว** ·
 * `data.lifecycleBoard` ยังถูกคิดใน `buildDashboardData` และยังมีเทสต์คุม เผื่อเอากลับ
 * (แพตเทิร์นเดียวกับ `priorityWorkQueue` ที่ถอดไปเมื่อ 10 ส.ค.)
 * เหลือแค่ **แนวโน้มรายเดือน เข้ามา/ปิดแล้ว/ยกเลิก/คงเหลือ** ซึ่งไม่ได้แบ่งตามประเภทใบขอ
 */
const DashboardChartSection: React.FC<Props> = ({ data }) => {
  const scopeLabel = data.activityTrendLabel || data.periodLabel;

  return (
    <div className="space-y-4">
      <DashboardThroughputChart data={data.activityTrend} periodLabel={scopeLabel} />
    </div>
  );
};

export default DashboardChartSection;
