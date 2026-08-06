import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { formatYmdDmyBe } from '@/lib/dateTh';
import type { DashboardWorkItem } from '@/lib/dashboard/types';
import { DashboardSlaBadge } from './DashboardStatusBadge';

type Props = {
  items: DashboardWorkItem[];
  onView: (item: DashboardWorkItem) => void;
};

/**
 * "ต้องแก้วันนี้" แบบย่อ (mockup rev.3 ข้อ 02) — อยู่คู่กับการ์ดสมการงานค้างในแถวเดียว
 * เดิมเป็นตารางเต็ม 8 คอลัมน์กว้างทั้งจอ — ยุบเหลือคอลัมน์ที่ใช้ตัดสินใจ (ใบ/เหลือ/SLA/คน)
 * รายการไม่ถูกตัดทิ้ง: เกิน 6 แถวเลื่อนดูin-card ได้ · กดแถวเพื่อเปิดใบ (แทนปุ่ม "ดู" เดิม)
 * รายละเอียดเต็มของทุกใบยังอยู่ในตาราง "งานที่ต้องติดตาม" ข้างล่างตามเดิม
 */
const DashboardPriorityQueue: React.FC<Props> = ({ items, onView }) => {
  if (items.length === 0) return null;

  return (
    <div className={cn(DASH.card, 'flex flex-col overflow-hidden border-red-200 dark:border-red-900/70')}>
      {/* หัวการ์ดเป็นโทนแดง — การ์ดนี้คือ "ต้องแก้วันนี้" ต้องเห็นก่อนการ์ดอื่นในหน้า */}
      <div
        className={cn(
          'px-4 py-3 border-b flex items-center gap-2 border-red-100 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/40',
        )}
      >
        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
        <div>
          <h3 className={DASH.title}>ต้องแก้วันนี้ · {items.length.toLocaleString('th-TH')} ใบขอ</h3>
          <p className={DASH.sub}>เรียงตามเกิน SLA → เสี่ยง SLA → ฉุกเฉินย้อนหลัง → คงเหลือมาก → งานค้างเก่า</p>
        </div>
      </div>

      <div className="max-h-[280px] overflow-y-auto">
        <table className="w-full text-sm">
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                onClick={() => onView(item)}
                title={`${item.lifecycleKind} · ครบ SLA ${item.slaDueDate ? formatYmdDmyBe(item.slaDueDate) : '—'} — กดเพื่อเปิดใบ`}
                className={cn('cursor-pointer border-b last:border-b-0', DASH.tableRow)}
              >
                <td className="px-4 py-2.5">
                  <p className={DASH.cellStrong}>{item.requestNo}</p>
                  <p className={cn('max-w-[220px] truncate text-xs', DASH.cellMuted)}>{item.unitName}</p>
                </td>
                <td className={cn('px-2 py-2.5 text-right tabular-nums font-semibold whitespace-nowrap', TONE.danger.value)}>
                  {item.remainingPositions}
                  <span className={cn('ml-1 font-normal text-[10px]', DASH.muted)}>เหลือ</span>
                </td>
                <td className="px-2 py-2.5 whitespace-nowrap text-right">
                  <DashboardSlaBadge status={item.slaStatus} />
                  {item.daysOverdue > 0 ? (
                    <span className={cn('ml-1 text-xs', TONE.danger.value)}>+{item.daysOverdue}d</span>
                  ) : null}
                </td>
                <td className={cn('px-4 py-2.5 text-right text-xs whitespace-nowrap', DASH.cellMuted)}>
                  {item.ownerName}
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
