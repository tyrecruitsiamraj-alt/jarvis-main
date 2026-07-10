import React from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { formatYmdDmyBe } from '@/lib/dateTh';
import type { DashboardWorkItem } from '@/lib/dashboard/types';
import { DashboardSlaBadge } from './DashboardStatusBadge';

type Props = {
  items: DashboardWorkItem[];
  onView: (item: DashboardWorkItem) => void;
};

const DashboardPriorityQueue: React.FC<Props> = ({ items, onView }) => {
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-red-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-red-100 bg-red-50/60 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <div>
          <h3 className="text-sm font-semibold text-slate-900">ต้องแก้วันนี้</h3>
          <p className="text-xs text-slate-600">
            {items.length} ใบขอ — เรียงตามเกิน SLA → เสี่ยง SLA → ฉุกเฉินย้อนหลัง → คงเหลือมาก → งานค้างเก่า
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs text-slate-500">
              <th className="px-3 py-2.5 font-medium">ใบงาน</th>
              <th className="px-3 py-2.5 font-medium">หน่วยงาน</th>
              <th className="px-3 py-2.5 font-medium">เหลือ</th>
              <th className="px-3 py-2.5 font-medium">ประเภท</th>
              <th className="px-3 py-2.5 font-medium">SLA</th>
              <th className="px-3 py-2.5 font-medium">ครบ SLA</th>
              <th className="px-3 py-2.5 font-medium">ผู้รับผิดชอบ</th>
              <th className="px-3 py-2.5 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-3 py-2.5 font-medium text-slate-900">{item.requestNo}</td>
                <td className="px-3 py-2.5 text-slate-700 max-w-[160px] truncate">{item.unitName}</td>
                <td className="px-3 py-2.5 tabular-nums font-semibold text-red-700">{item.remainingPositions}</td>
                <td className="px-3 py-2.5 text-slate-600 text-xs">{item.lifecycleKind}</td>
                <td className="px-3 py-2.5">
                  <DashboardSlaBadge status={item.slaStatus} />
                </td>
                <td className="px-3 py-2.5 text-slate-600 text-xs whitespace-nowrap">
                  {item.slaDueDate ? formatYmdDmyBe(item.slaDueDate) : '—'}
                  {item.daysOverdue > 0 ? (
                    <span className="ml-1 text-red-600">+{item.daysOverdue}d</span>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 text-slate-600 text-xs">{item.ownerName}</td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => onView(item)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-white"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    ดู
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DashboardPriorityQueue;
