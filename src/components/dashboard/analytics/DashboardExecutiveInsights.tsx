import React from 'react';
import { Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DASH } from '@/lib/designTokens';
import type { DashboardExecutiveInsights } from '@/lib/dashboard/types';

type Props = {
  insights: DashboardExecutiveInsights;
};

/**
 * การ์ดดำของหน้า /dashboard — ตามรูป reference ที่เจ้าของส่งมา ("การ์ดดำ" 1 ใบต่อหน้า)
 * เลือกใบนี้เพราะเป็นข้อความสรุปสำหรับผู้บริหาร: อ่านเป็นประโยค ไม่ต้องเทียบตัวเลขกับการ์ดอื่น
 * จึงเป็นใบเดียวที่ดึงออกจากพื้นขาวได้โดยไม่ทำให้แถวตัวเลขอ่านยากขึ้น
 */
const DashboardExecutiveInsightsCard: React.FC<Props> = ({ insights }) => {
  if (insights.sentences.length === 0) return null;

  return (
    <div className={cn(DASH.darkCard, 'overflow-hidden')}>
      <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3.5">
        <Lightbulb className="h-4 w-4 text-amber-400" />
        <div>
          <h3 className="text-sm font-semibold text-white">สรุปผู้บริหาร</h3>
          <p className="text-xs text-white/60">สรุปอัตโนมัติสำหรับผู้บริหาร</p>
        </div>
      </div>
      <ul className="space-y-2 px-5 py-4">
        {insights.sentences.map((sentence) => (
          <li key={sentence} className="flex gap-2 text-sm text-white/90">
            <span className="shrink-0 text-amber-400/80">•</span>
            <span>{sentence}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DashboardExecutiveInsightsCard;
