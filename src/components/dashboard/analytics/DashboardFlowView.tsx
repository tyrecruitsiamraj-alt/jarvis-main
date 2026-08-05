import React from 'react';
import { ArrowRight, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
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
  tone,
  onClick,
}: {
  label: string;
  value: number;
  operator?: '+' | '=' | '−';
  tone: ToneKey;
  onClick?: () => void;
}) {
  const t = TONE[tone];
  const inner = (
    <div
      className={cn(
        'rounded-lg border px-3 py-2 min-w-[88px] text-center transition-colors',
        t.soft,
        onClick && cn('cursor-pointer', t.softHover),
      )}
    >
      <p className={cn('text-[10px] uppercase tracking-wide', DASH.muted)}>{label}</p>
      <p className={cn('text-lg font-semibold tabular-nums', t.num)}>{value.toLocaleString('th-TH')}</p>
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

  /**
   * กระทบยอดสมการหลัก — ต้นงวด + ขอใหม่ − หาได้แล้ว − ยกเลิก = ปลายงวด
   *
   * "หาได้แล้ว" นับเฉพาะเหตุการณ์ที่มีวันที่อยู่ในงวด ส่วนปลายงวดคือยอดเหลือจริง
   * ถ้าใบไหนหาได้/ปิดโดยไม่มีวันที่เหตุการณ์ (snapshot_fallback) สองข้างจะไม่เท่ากัน
   * กติกาโปรเจกต์: ต้องโชว์ส่วนต่างให้เห็น ห้ามเงียบ และห้ามแก้เลขให้สมการดูสวย
   */
  const derivedEnding =
    flow.totalWorkloadPositions - flow.filledPositions - flow.cancelledPositions;
  const unexplainedGap = derivedEnding - flow.endingBacklogPositions;
  const netBacklogChange = flow.endingBacklogPositions - flow.startingBacklogPositions;

  return (
    <div className={cn(DASH.card, 'overflow-hidden')}>
      <div className={cn('px-4 py-3 border-b', DASH.divider)}>
        <h3 className={DASH.title}>การไหลของงาน: ขอ → หาได้ → งานค้าง</h3>
        <p className={cn('mt-0.5', DASH.sub)}>ยอดค้างต้นงวด + ขอใหม่ − หาได้แล้ว − ยกเลิก = ยอดค้างปลายงวด</p>
      </div>

      <div className="p-4 overflow-x-auto">
        {/* โทนสีของแต่ละก้อนตรงกับความหมายเดียวกันในการ์ด KPI ด้านบน — ยกเลิกเป็นเทา ไม่ใช่ชมพู */}
        <div className="flex flex-wrap items-center gap-2 min-w-max">
          <FlowStep
            label="ยอดค้างต้นงวด"
            value={flow.startingBacklogPositions}
            tone="warn"
            onClick={click?.('carried_over', 'ยอดค้างต้นงวด')}
          />
          <FlowStep label="ขอใหม่" value={flow.newRequestPositions} operator="+" tone="info" onClick={click?.('new_requests', 'ขอใหม่เดือนนี้')} />
          <FlowStep label="ภาระงานรวม" value={flow.totalWorkloadPositions} operator="=" tone="violet" onClick={click?.('total_workload', 'ภาระงานรวมเดือนนี้')} />
          <ArrowRight className="h-4 w-4 text-slate-300 shrink-0 hidden sm:block" />
          <FlowStep label="หาได้แล้ว" value={flow.filledPositions} operator="−" tone="success" onClick={click?.('fulfilled', 'หาได้แล้ว')} />
          <FlowStep label="ยกเลิก" value={flow.cancelledPositions} operator="−" tone="neutral" onClick={click?.('cancelled', 'ยกเลิกเดือนนี้')} />
          <FlowStep label="ยอดค้างปลายงวด" value={flow.endingBacklogPositions} operator="=" tone="warn" onClick={click?.('remaining', 'เหลือหา')} />
        </div>

        {unexplainedGap !== 0 ? (
          <div className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
            <span className="font-medium">กระทบยอดไม่ลงตัว {Math.abs(unexplainedGap).toLocaleString('th-TH')} ตำแหน่ง</span>
            {' — '}
            สมการให้ {derivedEnding.toLocaleString('th-TH')} แต่ยอดเหลือจริงคือ{' '}
            {flow.endingBacklogPositions.toLocaleString('th-TH')}
            <br />
            "หาได้แล้ว" นับเฉพาะรายการที่มีวันที่เหตุการณ์ในงวดนี้ · ส่วนต่างคืออัตราที่ออกจากงานค้าง
            โดยไม่มีวันที่ (snapshot_fallback) — ยอดเหลือจริงเชื่อถือได้ ตัวที่ยังนับไม่ครบคือ "หาได้แล้ว"
          </div>
        ) : null}

        {summary ? (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {[
              { label: 'อัตราหาได้', value: `${summary.fillRatePercent}%` },
              { label: 'อัตราปิดครบ', value: `${summary.fullClosureRatePercent}%` },
              { label: 'อัตราลดงานค้าง', value: `${summary.backlogBurnRatePercent}%` },
              { label: 'อัตรารับงานใหม่', value: `${summary.newDemandAbsorptionRatePercent}%` },
              // คิดจากเลขที่การ์ดโชว์จริง ไม่ใช่ summary.netBacklogChange ที่คิดจากยอดปลายงวดแบบ derived
              // (ไม่งั้นการ์ดจะขัดกันเอง เช่น 388 → 387 แต่ขึ้นว่าสุทธิ +75)
              {
                label: 'งานค้างสุทธิ',
                value: netBacklogChange > 0 ? `+${netBacklogChange}` : String(netBacklogChange),
              },
              { label: '% ลาออก', value: `${summary.resignationPressureRatio}%` },
              { label: 'อัตรายกเลิก', value: `${summary.cancellationRatePercent}%` },
            ].map((m) => (
              <div key={m.label} className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-2.5 py-2 text-center">
                <p className={cn('text-[10px]', DASH.muted)}>{m.label}</p>
                <p className={cn('text-sm font-semibold tabular-nums', DASH.cellStrong)}>{m.value}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default DashboardFlowViewCard;
