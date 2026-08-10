import React from 'react';
import { cn } from '@/lib/utils';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import type { DashboardFlowView, DashboardRequestControlSummary } from '@/lib/dashboard/types';

type Props = {
  flow: DashboardFlowView;
  summary?: DashboardRequestControlSummary;
  onSegmentClick?: (segment: string, label: string) => void;
};

/** เลขหนึ่งตัวในสมการ — สีตามความหมายเดียวกับการ์ด KPI · กดได้ถ้ามี handler */
function Num({
  value,
  label,
  tone,
  onClick,
}: {
  value: number;
  label: string;
  tone: ToneKey;
  onClick?: () => void;
}) {
  const cls = cn('font-bold tabular-nums', TONE[tone].value);
  const text = value.toLocaleString('th-TH');
  return (
    <span className="whitespace-nowrap">
      {onClick ? (
        <button type="button" onClick={onClick} className={cn(cls, 'hover:underline')}>
          {text}
        </button>
      ) : (
        <span className={cls}>{text}</span>
      )}{' '}
      <span className={DASH.muted}>{label}</span>
    </span>
  );
}

/**
 * การ์ด "การไหลของงาน" แบบย่อ (mockup rev.3 ข้อ 02) — อยู่คู่กับ "ต้องแก้วันนี้" ในแถวเดียว
 * เดิมเป็นกล่องสมการแนวนอนเต็มความกว้าง — ยุบเป็นสมการบรรทัดเดียว + อัตรา 8 ช่อง
 * ข้อมูลครบเท่าเดิมทุกตัว (ภาระงานรวมย้ายไปอยู่ในตารางอัตรา)
 */
const DashboardFlowViewCard: React.FC<Props> = ({ flow, summary, onSegmentClick }) => {
  const click = onSegmentClick
    ? (id: string, label: string) => () => onSegmentClick(id, label)
    : undefined;

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

  const rates: { label: string; value: string }[] = summary
    ? [
        { label: 'ภาระงานรวม', value: flow.totalWorkloadPositions.toLocaleString('th-TH') },
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
      ]
    : [];

  return (
    <div className={cn(DASH.card, 'flex flex-col px-4 py-3')}>
      <h3 className={DASH.title}>การไหลของงาน · สมการงานค้าง</h3>
      <p className={cn('mt-0.5 text-[11px]', DASH.muted)}>
        ยอดค้างต้นงวด + ขอใหม่ − หาได้แล้ว − ยกเลิก = ยอดค้างปลายงวด
      </p>

      {/* สมการด้วยเลขจริง — สีเดียวกับการ์ด KPI (ต้นงวด/ปลายงวด=เหลือง ขอใหม่=ฟ้า หาได้=เขียว ยกเลิก=เทา) */}
      <p className="mt-2.5 text-sm leading-relaxed">
        <Num value={flow.startingBacklogPositions} label="ต้นงวด" tone="warn" onClick={click?.('carried_over', 'ยอดค้างต้นงวด')} />
        <span className={cn('px-1', DASH.muted)}>+</span>
        <Num value={flow.newRequestPositions} label="ขอใหม่" tone="info" onClick={click?.('new_requests', 'ขอใหม่ในงวดที่เลือก')} />
        <span className={cn('px-1', DASH.muted)}>−</span>
        <Num value={flow.filledPositions} label="หาได้แล้ว" tone="success" onClick={click?.('fulfilled', 'หาได้แล้ว')} />
        <span className={cn('px-1', DASH.muted)}>−</span>
        <Num value={flow.cancelledPositions} label="ยกเลิก" tone="neutral" onClick={click?.('cancelled', 'ยกเลิกในงวดที่เลือก')} />
        <span className={cn('px-1', DASH.muted)}>→</span>
        <Num value={flow.endingBacklogPositions} label="ปลายงวด" tone="warn" onClick={click?.('remaining', 'เหลือหา')} />
      </p>

      {unexplainedGap !== 0 ? (
        <div className="mt-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
          <span className="font-medium">กระทบยอดไม่ลงตัว {Math.abs(unexplainedGap).toLocaleString('th-TH')} ตำแหน่ง</span>
          {' — '}
          สมการให้ {derivedEnding.toLocaleString('th-TH')} แต่ยอดเหลือจริงคือ{' '}
          {flow.endingBacklogPositions.toLocaleString('th-TH')} · "หาได้แล้ว" นับเฉพาะรายการที่มีวันที่เหตุการณ์ในงวดนี้
          ส่วนต่างคืออัตราที่ออกจากงานค้างโดยไม่มีวันที่ (snapshot_fallback) — ยอดเหลือจริงเชื่อถือได้
          ตัวที่ยังนับไม่ครบคือ "หาได้แล้ว"
        </div>
      ) : null}

      {rates.length > 0 ? (
        <div className="mt-auto grid grid-cols-2 gap-1.5 pt-3 sm:grid-cols-4">
          {rates.map((m) => (
            <div key={m.label} className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-2 py-1.5 text-center">
              <p className={cn('text-[10px]', DASH.muted)}>{m.label}</p>
              <p className={cn('text-sm font-semibold tabular-nums', DASH.cellStrong)}>{m.value}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default DashboardFlowViewCard;
