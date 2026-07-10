import React from 'react';
import { ArrowRight, Minus, Plus } from 'lucide-react';
import type { DashboardFlowView, DashboardRequestControlSummary } from '@/lib/dashboard/types';

type Props = {
  flow: DashboardFlowView;
  summary?: DashboardRequestControlSummary;
  onSegmentClick?: (segment: string, label: string) => void;
};

function FlowStep({
  label,
  value,
  operator,
  accent,
  onClick,
}: {
  label: string;
  value: number;
  operator?: '+' | '=' | '−';
  accent?: string;
  onClick?: () => void;
}) {
  const inner = (
    <div
      className={`rounded-lg border px-3 py-2 min-w-[88px] text-center ${accent ?? 'border-slate-200 bg-slate-50'} ${onClick ? 'cursor-pointer hover:border-blue-300 hover:bg-blue-50/50' : ''}`}
    >
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-slate-900">{value.toLocaleString('th-TH')}</p>
    </div>
  );

  return (
    <div className="flex items-center gap-2">
      {operator === '+' ? <Plus className="h-4 w-4 text-slate-400 shrink-0" /> : null}
      {operator === '−' ? <Minus className="h-4 w-4 text-slate-400 shrink-0" /> : null}
      {operator === '=' ? <span className="text-slate-400 font-medium px-0.5">=</span> : null}
      {onClick ? (
        <button type="button" onClick={onClick} className="text-left">
          {inner}
        </button>
      ) : (
        inner
      )}
    </div>
  );
}

const DashboardFlowViewCard: React.FC<Props> = ({ flow, summary, onSegmentClick }) => {
  const click = onSegmentClick ? (id: string, label: string) => () => onSegmentClick(id, label) : undefined;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">Demand → Fulfillment → Backlog Flow</h3>
        <p className="text-xs text-slate-500 mt-0.5">การไหลของภาระงานตำแหน่งในเดือนนี้</p>
      </div>

      <div className="p-4 overflow-x-auto">
        <div className="flex flex-wrap items-center gap-2 min-w-max">
          <FlowStep
            label="Backlog ต้นเดือน"
            value={flow.startingBacklogPositions}
            accent="border-amber-200 bg-amber-50"
            onClick={click?.('carried_over', 'Backlog ต้นเดือน')}
          />
          <FlowStep label="ขอใหม่" value={flow.newRequestPositions} operator="+" accent="border-sky-200 bg-sky-50" onClick={click?.('new_requests', 'ขอใหม่เดือนนี้')} />
          <FlowStep label="ภาระงานรวม" value={flow.totalWorkloadPositions} operator="=" accent="border-violet-200 bg-violet-50" onClick={click?.('total_workload', 'ภาระงานรวมเดือนนี้')} />
          <ArrowRight className="h-4 w-4 text-slate-300 shrink-0 hidden sm:block" />
          <FlowStep label="หาได้แล้ว" value={flow.filledPositions} operator="−" accent="border-emerald-200 bg-emerald-50" onClick={click?.('fulfilled', 'หาได้แล้ว')} />
          <FlowStep label="ยกเลิก" value={flow.cancelledPositions} operator="−" accent="border-rose-200 bg-rose-50" onClick={click?.('cancelled', 'ยกเลิกเดือนนี้')} />
          <FlowStep label="Backlog ปลายเดือน" value={flow.endingBacklogPositions} operator="=" accent="border-slate-300 bg-slate-100" onClick={click?.('remaining', 'เหลือหา')} />
        </div>

        {summary ? (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {[
              { label: 'Fill Rate', value: `${summary.fillRatePercent}%` },
              { label: 'Full Closure', value: `${summary.fullClosureRatePercent}%` },
              { label: 'Backlog Burn', value: `${summary.backlogBurnRatePercent}%` },
              { label: 'New Absorption', value: `${summary.newDemandAbsorptionRatePercent}%` },
              { label: 'Net Backlog Δ', value: summary.netBacklogChange > 0 ? `+${summary.netBacklogChange}` : String(summary.netBacklogChange) },
              { label: 'Resignation %', value: `${summary.resignationPressureRatio}%` },
              { label: 'Cancellation', value: `${summary.cancellationRatePercent}%` },
            ].map((m) => (
              <div key={m.label} className="rounded-lg bg-slate-50 px-2.5 py-2 text-center">
                <p className="text-[10px] text-slate-500">{m.label}</p>
                <p className="text-sm font-semibold text-slate-800 tabular-nums">{m.value}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default DashboardFlowViewCard;
