import React from 'react';
import { cn } from '@/lib/utils';
import { DASH } from '@/lib/designTokens';
import type { DashboardRequestCohortSummary } from '@/lib/dashboard/types';

type Props = {
  summary: DashboardRequestCohortSummary;
  onRowClick?: (rowId: string, label: string) => void;
};

const DashboardCohortSummaryCard: React.FC<Props> = ({ summary, onRowClick }) => (
  <div className={cn(DASH.card, 'px-4 py-3')}>
    <p className={DASH.label}>ยอดค้างจากงวดก่อน vs ขอใหม่งวดนี้</p>
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[520px] text-xs">
        <thead>
          <tr className={cn('border-b', DASH.divider, DASH.sub)}>
            <th className="text-left py-2 font-medium">กลุ่ม</th>
            <th className="text-right py-2 font-medium">ขอมา</th>
            <th className="text-right py-2 font-medium">หาได้แล้ว</th>
            <th className="text-right py-2 font-medium">เหลือหา</th>
            <th className="text-right py-2 font-medium">ปิดครบ</th>
            <th className="text-right py-2 font-medium">บางส่วน</th>
            <th className="text-right py-2 font-medium">ยกเลิก</th>
          </tr>
        </thead>
        <tbody className={DASH.cell}>
          {summary.rows.map((row) => (
            <tr
              key={row.id}
              className={onRowClick ? cn('cursor-pointer', DASH.tableRow) : undefined}
              onClick={onRowClick ? () => onRowClick(row.id, row.label) : undefined}
            >
              <td className="py-2">{row.label}</td>
              <td className="py-2 text-right tabular-nums">
                {row.requestPositions.toLocaleString('th-TH')}
                <span className={DASH.sub}> · {row.requestCount}</span>
              </td>
              <td className="py-2 text-right tabular-nums">{row.filledPositions.toLocaleString('th-TH')}</td>
              <td className="py-2 text-right tabular-nums">{row.remainingPositions.toLocaleString('th-TH')}</td>
              <td className="py-2 text-right tabular-nums">{row.fullyClosedRequests}</td>
              <td className="py-2 text-right tabular-nums">{row.partialRequests}</td>
              <td className="py-2 text-right tabular-nums">{row.cancelledRequests}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default DashboardCohortSummaryCard;
