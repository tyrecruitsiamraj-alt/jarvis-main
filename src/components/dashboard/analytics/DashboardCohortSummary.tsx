import React from 'react';
import type { DashboardRequestCohortSummary } from '@/lib/dashboard/types';

type Props = {
  summary: DashboardRequestCohortSummary;
  onRowClick?: (rowId: string, label: string) => void;
};

const DashboardCohortSummaryCard: React.FC<Props> = ({ summary, onRowClick }) => (
  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
    <p className="text-xs font-medium text-slate-600">ใบขอเก่าค้างมา vs ใบขอใหม่เดือนนี้</p>
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[520px] text-xs">
        <thead>
          <tr className="text-slate-500 border-b border-slate-100">
            <th className="text-left py-2 font-medium">กลุ่ม</th>
            <th className="text-right py-2 font-medium">ขอมา</th>
            <th className="text-right py-2 font-medium">ปิดได้</th>
            <th className="text-right py-2 font-medium">เหลือ</th>
            <th className="text-right py-2 font-medium">ปิดครบ</th>
            <th className="text-right py-2 font-medium">Partial</th>
            <th className="text-right py-2 font-medium">ยกเลิก</th>
          </tr>
        </thead>
        <tbody>
          {summary.rows.map((row) => (
            <tr
              key={row.id}
              className={onRowClick ? 'cursor-pointer hover:bg-slate-50' : undefined}
              onClick={onRowClick ? () => onRowClick(row.id, row.label) : undefined}
            >
              <td className="py-2 text-slate-800">{row.label}</td>
              <td className="py-2 text-right tabular-nums">
                {row.requestPositions.toLocaleString('th-TH')}
                <span className="text-slate-400"> · {row.requestCount}</span>
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
