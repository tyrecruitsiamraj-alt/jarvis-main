import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatYmdDmyBe } from '@/lib/dateTh';
import type { DashboardSortDir, DashboardSortKey, DashboardWorkItem } from '@/lib/dashboard/types';
import { DashboardSlaBadge, DashboardStatusBadge } from './DashboardStatusBadge';

type Props = {
  items: DashboardWorkItem[];
  sortKey: DashboardSortKey;
  sortDir: DashboardSortDir;
  onSort: (key: DashboardSortKey) => void;
  onView: (item: DashboardWorkItem) => void;
  onAssign?: (item: DashboardWorkItem) => void;
};

function SortBtn({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: DashboardSortDir;
  onClick: () => void;
}) {
  const Icon = active ? (dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 hover:text-slate-900">
      {label}
      <Icon className={cn('h-3.5 w-3.5', active ? 'text-slate-700' : 'text-slate-400')} />
    </button>
  );
}

const DashboardWorkQueueTable: React.FC<Props> = ({
  items,
  sortKey,
  sortDir,
  onSort,
  onView,
  onAssign,
}) => {
  const toggle = (key: DashboardSortKey) => onSort(key);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">งานที่ต้องติดตาม</h3>
        <p className="text-xs text-slate-500">{items.length} รายการ — เรียงตามความสำคัญ</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs text-slate-500">
              <th className="px-3 py-2.5 font-medium">
                <SortBtn label="ใบงาน" active={sortKey === 'createdAt'} dir={sortDir} onClick={() => toggle('createdAt')} />
              </th>
              <th className="px-3 py-2.5 font-medium">ขอมา</th>
              <th className="px-3 py-2.5 font-medium">ปิดได้</th>
              <th className="px-3 py-2.5 font-medium">ยกเลิก</th>
              <th className="px-3 py-2.5 font-medium">เหลือ</th>
              <th className="px-3 py-2.5 font-medium">ประเภท</th>
              <th className="px-3 py-2.5 font-medium">
                <SortBtn label="สถานะ" active={sortKey === 'status'} dir={sortDir} onClick={() => toggle('status')} />
              </th>
              <th className="px-3 py-2.5 font-medium">SLA</th>
              <th className="px-3 py-2.5 font-medium">ครบ SLA</th>
              <th className="px-3 py-2.5 font-medium">เกิน</th>
              <th className="px-3 py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-slate-500">
                  ไม่พบงานตามเงื่อนไขที่เลือก
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer"
                  onClick={() => onView(item)}
                >
                  <td className="px-3 py-3 align-top">
                    <p className="font-medium text-slate-900">{item.requestNo}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.unitName}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{item.lifecycleKind}</p>
                    <p className="text-[10px] text-slate-400">{item.requestAction || item.requestKind}</p>
                  </td>
                  <td className="px-3 py-3 align-top tabular-nums text-xs">{item.requestPositions}</td>
                  <td className="px-3 py-3 align-top tabular-nums text-xs text-emerald-700">{item.filledPositions}</td>
                  <td className="px-3 py-3 align-top tabular-nums text-xs text-slate-600">{item.cancelledPositions}</td>
                  <td className="px-3 py-3 align-top tabular-nums text-xs font-medium">{item.remainingPositions}</td>
                  <td className="px-3 py-3 align-top text-xs text-slate-600">{item.requestKind}</td>
                  <td className="px-3 py-3 align-top">
                    <DashboardStatusBadge status={item.status} />
                    <p className="text-[10px] text-slate-500 mt-1">{item.controlStatus}</p>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <DashboardSlaBadge status={item.slaStatus} />
                  </td>
                  <td className="px-3 py-3 align-top text-xs text-slate-600 whitespace-nowrap">
                    {item.slaDueDate ? formatYmdDmyBe(item.slaDueDate) : '—'}
                  </td>
                  <td className="px-3 py-3 align-top text-xs tabular-nums text-red-600">
                    {item.daysOverdue > 0 ? item.daysOverdue : '—'}
                  </td>
                  <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onView(item)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        ดู
                      </button>
                      {onAssign ? (
                        <button
                          type="button"
                          onClick={() => onAssign(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          ติดตาม
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DashboardWorkQueueTable;
