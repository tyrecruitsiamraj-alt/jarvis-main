/**
 * ═══ แผงเลื่อนจากขวาตอนกดแท่ง (รอบ 5 → รอบ 15 · 30 ก.ย. 2569) ═══
 *
 * เจ้าของ: *"กดดูกราฟไหนก็โชว์แบบ Slide ให้เห็นหน้าจอมาทางขวาว่า ยอดใช้งาน 800 เกิดจาก BU ไหนบ้าง
 * แล้วแต่ละ BU ใช้คนหรือ AI อย่างละเท่าไหร่"*
 * รอบ 13: กราฟแท่งเปรียบเทียบ · รอบ 14: ถอดรายการ "มาจาก BU ไหนบ้าง"
 * รอบ 15: *"พอกดไปที่แท่งใดแท่งหนึ่ง ข้อมูลที่ Slide ออกมาบอกข้อมูลของแท่งนั้นว่า BU ไหนใช้เยอะสุด
 *        และเป็น AI หรือคนเยอะกว่ากัน"* ⇒ **สองกล่องเสมอ ไม่ขึ้นกับสวิตช์แยก BU**
 * - กล่อง BU: แท่งต่อ BU มากไปน้อย ซ้อนสี AI/คน/ยังไม่โทร (เลขในสี · จี้ดู AI %) · แท่งเยอะสุดมีป้าย "เยอะสุด" ·
 *   BU ที่ยังไม่มีงานเป็นบรรทัดเดียว (ห้ามหายเงียบ)
 * - กล่อง AI/คน: แท่ง AI โทร · คนโทร · (ทั้งสองทาง) · ยังไม่โทร · แท่งสูงสุดมีป้าย "สูงสุด"
 * รอบ 16: เจ้าของ *"BU ไหนใช้เยอะสุด · เยอะสุด LBD 50 สาย · 100% ไม่ต้องมีหรอกคำพวกนี้ · AI หรือคนโทรเยอะกว่า ·
 *        AI โทรเยอะกว่าคน 50 ต่อ 0 สาย นี่ด้วย"* ⇒ ถอดหัวคำถามกับประโยคคำตอบ เหลือกราฟพูดเอง
 *        (ชื่อกล่องยังอยู่ใน `aria-label` ให้โปรแกรมอ่านจอ — ไม่ขึ้นบนจอ)
 * - ตัวเลขทุกตัวมาจากแถววัน×BU ชุดเดียวกับกราฟหลัก (`detailBreakdown`) ⇒ รวมทุก BU = ยอดของแท่งนั้นเสมอ
 * 🔴 ใช้ Sheet ของ shadcn (`surface="glass"`) · เปิดจากหน้า ไม่ซ้อน Dialog
 */
import React from 'react';
import AiShareCompareChart, { type CompareBar } from '@/components/home-ai-share/AiShareCompareChart';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { segmentDotClass, segmentFillClass } from '@/components/home-ai-share/segmentStyle';
import { toneOfBu } from '@/components/team-online/teamOnlineTones';
import { EVEN_TYPE, TONE } from '@/lib/designTokens';
import {
  AI_SHARE_SEGMENTS,
  AI_SHARE_SEGMENT_LABEL,
  UNKNOWN_BU,
  detailBreakdown,
  sharesOfCalled,
  type AiShareDetailRow,
} from '@/lib/homeAiShare';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');

const buTone = (bu: string) => TONE[bu === UNKNOWN_BU ? 'neutral' : toneOfBu(bu)].value;

/** กล่องกราฟหนึ่งกล่อง — ไม่มีหัวข้อ/ประโยคบนจอ (รอบ 16) · ชื่อกล่องอยู่ใน `aria-label` */
function Question({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-foreground/10 bg-card/60 p-4" aria-label={title}>
      {children}
    </section>
  );
}

const AiShareBuSheet: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** ช่วงของแท่งที่กด เช่น "วันศุกร์ 25 ก.ย." หรือทั้งช่วง "7 วันล่าสุด" */
  scope: string;
  unit: string;
  rows: ReadonlyArray<AiShareDetailRow>;
  withBoth: boolean;
}> = ({ open, onOpenChange, title, scope, unit, rows, withBoth }) => {
  const { total, used, quiet } = detailBreakdown(rows);
  const showBoth = withBoth || total.both > 0;
  const segments = AI_SHARE_SEGMENTS.filter((k) => k !== 'both' || showBoth);

  /* ─ BU ไหนใช้เยอะสุด ─ */
  const buBars: CompareBar[] = used.map((r) => {
    const shares = sharesOfCalled(r);
    return {
      key: r.bu,
      label: r.bu,
      title: r.label,
      value: r.total,
      fill: buTone(r.bu),
      note: shares ? `AI ${NUM.format(shares.ai)}% ของที่โทรแล้ว` : 'ยังไม่มีที่โทรแล้ว',
      parts: segments.map((k) => ({
        key: k,
        label: AI_SHARE_SEGMENT_LABEL[k],
        value: r[k],
        fill: segmentFillClass(k),
        dot: k === 'notCalled' ? segmentDotClass(k) : cn('bg-current', segmentFillClass(k)),
        muted: k === 'notCalled',
      })),
    };
  });

  /* ─ AI หรือคนโทรเยอะกว่า ─ */
  const segBars: CompareBar[] = segments.map((k) => ({ key: k, label: AI_SHARE_SEGMENT_LABEL[k], value: total[k], fill: segmentFillClass(k) }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" surface="glass" className={cn('w-full space-y-4 overflow-y-auto sm:max-w-md', EVEN_TYPE)}>
        <SheetHeader className="pr-6">
          <SheetTitle className="space-y-1">
            <span className="block text-sm font-normal text-muted-foreground">{title}</span>
            <span className="block text-xl font-light">{scope}</span>
          </SheetTitle>
          <SheetDescription className="sr-only">BU ไหนใช้เยอะสุด และ AI หรือคนโทรเยอะกว่า</SheetDescription>
        </SheetHeader>

        <div className="flex items-baseline justify-between gap-3 px-1">
          <span className="text-sm text-muted-foreground">ยอดใช้งาน</span>
          <span className="text-3xl font-light tabular-nums text-foreground">
            {NUM.format(total.total)} <span className="text-base text-muted-foreground">{unit}</span>
          </span>
        </div>

        <Question title="BU ไหนใช้เยอะสุด">
          <AiShareCompareChart bars={buBars} topLabel="เยอะสุด" unit={unit} ariaLabel={`${title} เปรียบเทียบแต่ละ BU`} />
          {quiet.length > 0 ? <p className="text-xs text-muted-foreground">ยังไม่มีงาน {quiet.join(' ')}</p> : null}
        </Question>

        <Question title="AI หรือคนโทรเยอะกว่า">
          <AiShareCompareChart bars={segBars} topLabel="สูงสุด" unit={unit} ariaLabel={`${title} เปรียบเทียบ AI โทร คนโทร ยังไม่โทร`} />
        </Question>
      </SheetContent>
    </Sheet>
  );
};

export default AiShareBuSheet;
