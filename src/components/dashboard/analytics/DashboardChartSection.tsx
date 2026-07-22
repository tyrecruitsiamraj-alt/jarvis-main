import React from 'react';
import type { DashboardData } from '@/lib/dashboard/types';
import DashboardThroughputChart from './DashboardThroughputChart';
import DashboardLifecycleBoard from './DashboardLifecycleBoard';
import DashboardLifecycleMonthlyPanel from './DashboardLifecycleMonthlyPanel';
import DemandForecastPanel from '@/components/dashboard/request-control/DemandForecastPanel';

type Props = {
  data: Pick<
    DashboardData,
    'activityTrend' | 'activityTrendLabel' | 'lifecycleBoard' | 'periodLabel'
  >;
};

/** พยากรณ์แทนที่ตาราง Life Cycle — ปิดกลับเป็นตารางเดิมได้ด้วย env (rollback ตามกติกา skill) */
const FORECAST_ENABLED = import.meta.env.VITE_REQUEST_CONTROL_FORECAST_ENABLED !== 'false';

const DashboardChartSection: React.FC<Props> = ({ data }) => {
  const scopeLabel = data.activityTrendLabel || data.periodLabel;

  return (
    <div className="space-y-4">
      {FORECAST_ENABLED ? (
        <DemandForecastPanel />
      ) : data.lifecycleBoard ? (
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
