import React from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
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
    <div className={cn(DASH.card, 'overflow-hidden border-red-200 dark:border-red-900/70')}>
      {/* หัวการ์ดเป็นโทนแดง — การ์ดนี้คือ "ต้องแก้วันนี้" ต้องเห็นก่อนการ์ดอื่นในหน้า */}
      <div
        className={cn(
          'px-4 py-3 border-b flex items-center gap-2 border-red-100 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/40',
        )}
      >
        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
        <div>
          <h3 className={DASH.title}>ต้องแก้วันนี้</h3>
          <p className={DASH.sub}>
            {items.length} ใบขอ — เรียงตามเกิน SLA → เสี่ยง SLA → ฉุกเฉินย้อนหลัง → คงเหลือมาก → งานค้างเก่า
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className={cn('border-b text-left text-xs', DASH.divider, DASH.tableHead)}>
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
              <tr key={item.id} className={cn('border-b', DASH.tableRow)}>
                <td className={cn('px-3 py-2.5', DASH.cellStrong)}>{item.requestNo}</td>
                <td className={cn('px-3 py-2.5 max-w-[160px] truncate', DASH.cell)}>{item.unitName}</td>
                <td className={cn('px-3 py-2.5 tabular-nums font-semibold', TONE.danger.value)}>
                  {item.remainingPositions}
                </td>
                <td className={cn('px-3 py-2.5 text-xs', DASH.cellMuted)}>{item.lifecycleKind}</td>
                <td className="px-3 py-2.5">
                  <DashboardSlaBadge status={item.slaStatus} />
                </td>
                <td className={cn('px-3 py-2.5 text-xs whitespace-nowrap', DASH.cellMuted)}>
                  {item.slaDueDate ? formatYmdDmyBe(item.slaDueDate) : '—'}
                  {item.daysOverdue > 0 ? (
                    <span className={cn('ml-1', TONE.danger.value)}>+{item.daysOverdue}d</span>
                  ) : null}
                </td>
                <td className={cn('px-3 py-2.5 text-xs', DASH.cellMuted)}>{item.ownerName}</td>
                <td className="px-3 py-2.5 text-right">
                  <button type="button" onClick={() => onView(item)} className="jarvis-btn-ghost">
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
