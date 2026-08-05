import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DASH } from '@/lib/designTokens';
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
  hideHeader?: boolean;
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
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100">
      {label}
      <Icon className={cn('h-3.5 w-3.5', active ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500')} />
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
  hideHeader = false,
}) => {
  const toggle = (key: DashboardSortKey) => onSort(key);

  return (
    <div className={cn(DASH.card, 'overflow-hidden')}>
      {!hideHeader ? (
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">งานที่ต้องติดตาม</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{items.length} รายการ — เรียงตามความสำคัญ</p>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 text-left text-xs text-slate-500 dark:text-slate-400">
              <th className="px-3 py-2.5 font-medium">
                <SortBtn label="ใบงาน" active={sortKey === 'createdAt'} dir={sortDir} onClick={() => toggle('createdAt')} />
              </th>
              <th className="px-3 py-2.5 font-medium">ขอมา</th>
              <th className="px-3 py-2.5 font-medium">หาได้แล้ว</th>
              <th className="px-3 py-2.5 font-medium">ยกเลิก</th>
              <th className="px-3 py-2.5 font-medium">เหลือหา</th>
              <th className="px-3 py-2.5 font-medium">ประเภท</th>
              <th className="px-3 py-2.5 font-medium">
                <SortBtn label="สถานะ" active={sortKey === 'status'} dir={sortDir} onClick={() => toggle('status')} />
              </th>
              <th className="px-3 py-2.5 font-medium">สถานะทำงาน</th>
              <th className="px-3 py-2.5 font-medium">SLA</th>
              <th className="px-3 py-2.5 font-medium">ครบ SLA</th>
              <th className="px-3 py-2.5 font-medium">เกิน</th>
              <th className="px-3 py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                  ไม่พบงานตามเงื่อนไขที่เลือก
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 cursor-pointer"
                  onClick={() => onView(item)}
                >
                  <td className="px-3 py-3 align-top">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{item.requestNo}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.unitName}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{item.lifecycleKind}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">{item.requestAction || item.requestKind}</p>
                  </td>
                  <td className="px-3 py-3 align-top tabular-nums text-xs">{item.requestPositions}</td>
                  <td className="px-3 py-3 align-top tabular-nums text-xs text-emerald-700 dark:text-emerald-300">{item.filledPositions}</td>
                  <td className="px-3 py-3 align-top tabular-nums text-xs text-slate-600 dark:text-slate-400">{item.cancelledPositions}</td>
                  <td className="px-3 py-3 align-top tabular-nums text-xs font-medium">{item.remainingPositions}</td>
                  <td className="px-3 py-3 align-top text-xs text-slate-600 dark:text-slate-400">{item.requestKind}</td>
                  <td className="px-3 py-3 align-top">
                    <DashboardStatusBadge status={item.status} />
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{item.controlStatus}</p>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200">{item.workStatusLabel || 'ดำเนินการ'}</p>
                    {item.workPersonName ? (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{item.workPersonName}</p>
                    ) : null}
                    {item.workStatusDate ? (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{formatYmdDmyBe(item.workStatusDate)}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <DashboardSlaBadge status={item.slaStatus} />
                  </td>
                  <td className="px-3 py-3 align-top text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {item.slaDueDate ? formatYmdDmyBe(item.slaDueDate) : '—'}
                  </td>
                  <td className="px-3 py-3 align-top text-xs tabular-nums text-red-600 dark:text-red-400">
                    {item.daysOverdue > 0 ? item.daysOverdue : '—'}
                  </td>
                  <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onView(item)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        ดู
                      </button>
                      {onAssign ? (
                        <button
                          type="button"
                          onClick={() => onAssign(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40"
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
