import React from 'react';
import type { DashboardData } from '@/lib/dashboard/types';
import DashboardThroughputChart from './DashboardThroughputChart';
import DashboardLifecycleBoard from './DashboardLifecycleBoard';
import DashboardLifecycleMonthlyPanel from './DashboardLifecycleMonthlyPanel';

type Props = {
  data: Pick<
    DashboardData,
    'activityTrend' | 'activityTrendLabel' | 'lifecycleBoard' | 'periodLabel'
  >;
};

/**
 * เจ้าของสั่งถอด "พยากรณ์ใบขอเข้าใหม่ตามประเภท" (DemandForecastPanel) ออกจากหน้านี้
 * — component ยังอยู่ที่ request-control/DemandForecastPanel.tsx ถ้าจะเอากลับ (rollback = git revert)
 * ตาราง Life Cycle เดิมกลับมาแสดงแทนตามเดิม
 */
const DashboardChartSection: React.FC<Props> = ({ data }) => {
  const scopeLabel = data.activityTrendLabel || data.periodLabel;

  return (
    <div className="space-y-4">
      {data.lifecycleBoard ? (
        <DashboardLifecycleBoard board={data.lifecycleBoard} periodLabel={data.periodLabel} />
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <DashboardThroughputChart data={data.activityTrend} periodLabel={scopeLabel} />
        <DashboardLifecycleMonthlyPanel data={data.activityTrend} scopeLabel={scopeLabel} />
      </div>
    </div>
  );
};

export default DashboardChartSection;
