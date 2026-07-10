import React from 'react';
import { Lightbulb } from 'lucide-react';
import type { DashboardExecutiveInsights } from '@/lib/dashboard/types';

type Props = {
  insights: DashboardExecutiveInsights;
};

const DashboardExecutiveInsightsCard: React.FC<Props> = ({ insights }) => {
  if (insights.sentences.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        <div>
          <h3 className="text-sm font-semibold text-slate-900">สรุปผู้บริหาร</h3>
          <p className="text-xs text-slate-500">สรุปอัตโนมัติสำหรับผู้บริหาร</p>
        </div>
      </div>
      <ul className="px-4 py-3 space-y-2">
        {insights.sentences.map((sentence) => (
          <li key={sentence} className="text-sm text-slate-700 flex gap-2">
            <span className="text-slate-400 shrink-0">•</span>
            <span>{sentence}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DashboardExecutiveInsightsCard;
