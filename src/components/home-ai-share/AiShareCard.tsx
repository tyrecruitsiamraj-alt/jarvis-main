/**
 * ═══ แผง "AI โทร vs คนโทร" ของหัวข้อที่เลือก (30 ก.ย. 2569 · รอบ 5 เหลือแผงเดียว · รอบ 8 ยอดเป็น Visual Control) ═══
 *
 * รอบ 1–4 เป็นการ์ด 4 ใบ · รอบ 5 เจ้าของ: *"แต่ละการ์ดตอนนี้มันเยอะไปหมด ทำเป็น Filter แบบ Dropdown ดีกว่า"*
 * รอบ 7: *"เอากราฟโค้ง ๆ ออก · ขยับยอดมาชิดฝั่งซ้าย"* (ถอดเกจครึ่งวง)
 * รอบ 8: *"AI 100% ของสายที่โทรแล้ว 0 จุด จาก 7 วันก่อนหน้า — เอาออก · ยอด 4 ก้อน — ทำเป็น Visual Control ·
 *        −50 จาก 7 วันก่อนหน้า เปลี่ยนเป็น %"* → Choice **"กล่องไอคอน + แถบสัดส่วน"**
 * ```
 * ┌ ทั้งหมด     ↓20.2% ┐ ┌ AI โทร       ↓19.6% ┐ ┌ คนโทร        0% ┐ ┌ ยังไม่โทร  ↓100% ┐
 * │ 205 สาย             │ │ 205                 │ │ 0               │ │ 0                │
 * │ 7 วันก่อนหน้า 257     │ │ ██████████     100% │ │ ░░░░░░░░     0% │ │ ░░░░░░░░      0% │
 * └─────────────────────┘ └─────────────────────┘ └─────────────────┘ └──────────────────┘
 * ─────────────────────────────────────────────────────
 *  กราฟยอดใช้งานรายวัน
 * ```
 * - แถบในกล่อง = กี่ % ของทั้งหมด (ตัวหารที่สองของนิยามรอบ 1 · `segmentsOfTotal` ปัดรวมกันได้ 100 พอดี)
 * - ชิปมุมขวา = เปลี่ยนไปกี่ % จากช่วงก่อน (`countPill` ตัวเดียวกับหน้าทีม Online · ช่วงก่อนเป็น 0 = "ใหม่" ·
 *   ไม่ลงสีดี/เสีย เพราะงานน้อยลงไม่ได้แปลว่าแย่ — ห้ามลงสีหลอก)
 * - รอบ 9: ถอดไอคอน (เจ้าของเรียกว่า "อิโมจิ") · รอบ 10: dropdown หัวข้อย้ายไปหัวหน้าข้างปฏิทิน
 * - รอบ 16: ถอดป้าย "หนักไปทาง AI/คน" มุมขวาบน (เจ้าของสั่งเอาออก)
 * - รอบ 12: กล่อง**ไม่พลิกแล้ว** — เจ้าของ *"ฉันหมายถึงให้หมุนก้อนพวกแท่งกราฟ"* (ที่พลิกคือแท่งกราฟ · `AiShareUsageChart`)
 *   แล้วเลือก Choice "เอาออก เหลือกล่องเฉย ๆ"
 * - รอบ 17: เจ้าของ *"Visual เรียงใหม่ ทั้งหมด · AI โทร · คนโทร · ยังไม่โทร"* ⇒ กล่องทั้งหมดขึ้นก่อน (ทั้งสองทางอยู่ก่อนยังไม่โทร
 *   ตามลำดับก้อนเดิม) · *"Visual พอกดแล้วเด้ง Popup แสดงรายชื่อมา"* ⇒ กล่องเป็นปุ่ม (`Button` ของ shadcn) กดแล้วหน้าเปิด
 *   `AiShareListDialog` · กล่องที่เป็น 0 กดไม่ได้ (หน้าตาเหมือนเดิม ไม่จางลง)
 * วาดอย่างเดียว — ตัวคิดอยู่ `src/lib/homeAiShare.ts` · ป้ายจี้มาจาก `metricDictionary` (`aiShare.*`)
 * 🔴 คำบนจอเขียนแบบคนพูด (เจ้าของทัก 30 ก.ย. 2569: *"พวกคำอะไรต่าง ๆ มันดูเป็น AI"*)
 * 🔴 โฉมกระจก (`<Card variant="glass">`) · ตัวเลขใหญ่น้ำหนักบาง (`font-light`) ตามที่เจ้าของขอ "luxury"
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { segmentFillClass } from '@/components/home-ai-share/segmentStyle';
import { Pill } from '@/components/team-online/TeamKpiCard';
import { TONE } from '@/lib/designTokens';
import { metricHelp, type MetricKey } from '@/lib/metricDictionary';
import {
  AI_SHARE_SEGMENTS,
  AI_SHARE_SEGMENT_LABEL,
  segmentsOfTotal,
  type AiShareCounts,
  type AiShareListKey,
  type AiShareSegment,
} from '@/lib/homeAiShare';
import { countPill, type DeltaPill } from '@/lib/teamOnline';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');

export type AiShareCardProps = {
  title: string;
  /** หน่วยบนจอ — ทุกหัวข้อเป็น "รายชื่อ" (รอบ 18 · `AI_SHARE_UNIT`) */
  unit: string;
  counts: AiShareCounts | null;
  loading: boolean;
  error?: string | null;
  /**
   * หัวข้อนี้มี "ทั้งสองทาง" ไหม — ติดตาม/ดูแลหลังเริ่มงานไม่มี (รอบหนึ่งตั้งได้ทางเดียว)
   * ⚠️ ถ้ามีค่ามากกว่า 0 ขึ้นมาเมื่อไหร่ต้องโชว์เสมอ ห้ามซ่อนเลขที่มีจริง
   */
  withBoth: boolean;
  /** คีย์พจนานุกรมของแต่ละป้าย — ขึ้นเป็นคำอธิบายตอนจี้ */
  metrics: { total: MetricKey } & Record<AiShareSegment, MetricKey | null>;
  /** รายละเอียดของ "ยังไม่โทร" (ตอนจี้) เช่น "รอ AI โทร 1 · ยังไม่มีใครแตะ 14" */
  notCalledHint?: string | null;
  /** ธงบอกว่าเลขยังไม่ครบ — ขึ้นใต้กล่องเมื่อมีเท่านั้น */
  flag?: string | null;
  /**
   * ช่วงก่อนหน้าที่ยาวเท่ากัน (รอบ 4 · เจ้าของเลือก "เทียบกับช่วงก่อน") · null = ไม่เทียบ (ทั้งหมด / อ่านไม่ได้)
   * `previousLabel` = คำเรียก เช่น "7 วันก่อนหน้า" · `previousRange` = ช่วงวันที่เต็ม (ขึ้นตอนจี้)
   */
  previous?: AiShareCounts | null;
  previousLabel?: string | null;
  previousRange?: string | null;
  /** กดกล่อง = ให้หน้าเปิด Popup รายชื่อของกล่องนั้น (รอบ 17) · ไม่ส่ง = กล่องกดไม่ได้ */
  onPick?: (key: AiShareListKey) => void;
  /** กราฟยอดใช้งานของหัวข้อนี้ (หน้าเรียกเป็นคนโหลด) */
  children?: React.ReactNode;
  className?: string;
};

/**
 * กระจก (รอบ 13 · เจ้าของ: "ทำเป็นแบบ Glass ตอนนี้มันดูไม่ค่อยสวย") — ไล่โปร่ง · ขอบสว่าง · เส้นในจาง · เงานุ่ม · สีจากตัวแปรธีมล้วน
 * รอบ 17 เป็นปุ่ม: ทับคลาสของ `Button` (flex แนวตั้ง · ชิดซ้าย · ไม่ตัดบรรทัด · มุม xl) · ชี้แล้วลอยขึ้นนิด สว่างขึ้น ·
 * กล่อง 0 = ปุ่มปิด แต่ไม่จางลง (`disabled:opacity-100`) ให้ทุกกล่องหน้าตาเท่ากัน
 */
const TILE_CLASS = cn(
  'h-auto w-full flex-col items-stretch justify-start gap-3 whitespace-normal rounded-xl p-4 text-left font-normal',
  'border border-card/80 bg-gradient-to-br from-card/80 to-card/40 shadow-sm shadow-foreground/5 ring-1 ring-inset ring-foreground/5',
  'dark:border-foreground/10 dark:from-card/60 dark:to-card/20 dark:shadow-background/40',
  'hover:-translate-y-0.5 hover:bg-transparent hover:from-card hover:to-card/60 hover:text-foreground hover:shadow-md',
  'dark:hover:from-card/80 dark:hover:to-card/40 disabled:opacity-100',
);

/** กล่องหนึ่งก้อนของ Visual Control — ป้าย · ชิปเทียบช่วงก่อน · เลขใหญ่ · แถบสัดส่วน (หรือบรรทัดท้าย) · กดได้ (รอบ 17) */
function Tile({
  label,
  value,
  unit,
  share,
  shareClass,
  pill,
  pillTitle,
  foot,
  hint,
  onClick,
}: {
  label: string;
  value: number;
  unit?: string;
  /** กี่ % ของทั้งหมด · null = ไม่มีแถบ (กล่องทั้งหมด) */
  share: number | null;
  shareClass?: string;
  pill: DeltaPill | null;
  pillTitle?: string;
  foot?: string | null;
  hint?: string;
  /** กดแล้วเปิดรายชื่อ · ไม่มี หรือเลขเป็น 0 = กดไม่ได้ */
  onClick?: () => void;
}) {
  // ข้างในปุ่มใช้ span ล้วน (ปุ่มห้ามมี div/p ข้างใน) · ชื่อปุ่ม = ป้าย + เลข (โปรแกรมอ่านจอได้ยินเลขด้วย)
  return (
    <Button
      type="button"
      variant="ghost"
      aria-label={`${label} ${NUM.format(value)}${unit ? ` ${unit}` : ''}`}
      title={hint}
      disabled={!onClick || value <= 0}
      onClick={onClick}
      className={TILE_CLASS}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-sm text-muted-foreground">{label}</span>
        {pill ? (
          <span className="shrink-0" title={pillTitle}>
            <Pill pill={pill} />
          </span>
        ) : null}
      </span>
      <span className="block text-3xl font-light tabular-nums text-foreground">
        {NUM.format(value)}
        {unit ? (
          <>
            {' '}
            <span className="text-sm text-muted-foreground">{unit}</span>
          </>
        ) : null}
      </span>
      {share !== null ? (
        <span className="flex items-center gap-2">
          <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span className={cn('block h-full rounded-full bg-current', shareClass)} style={{ width: `${share}%` }} />
          </span>
          <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{NUM.format(share)}%</span>
        </span>
      ) : foot ? (
        <span className="block text-xs tabular-nums text-muted-foreground" title={pillTitle}>
          {foot}
        </span>
      ) : null}
    </Button>
  );
}

const AiShareCard: React.FC<AiShareCardProps> = ({
  title,
  unit,
  counts,
  loading,
  error = null,
  withBoth,
  metrics,
  notCalledHint = null,
  flag = null,
  previous = null,
  previousLabel = null,
  previousRange = null,
  onPick,
  children,
  className,
}) => {
  const showBoth = withBoth || (counts?.both ?? 0) > 0;
  const segments = AI_SHARE_SEGMENTS.filter((k) => k !== 'both' || showBoth);
  const total = counts?.total ?? 0;
  const helpOf = (k: AiShareSegment) => {
    const key = metrics[k];
    const help = key ? metricHelp(key) : undefined;
    return k === 'notCalled' && notCalledHint ? [help, notCalledHint].filter(Boolean).join('\n') : help;
  };
  const compareTitle = previousRange ? `เทียบกับ ${previousRange} ช่วงเวลาเดียวกัน` : undefined;
  /** % ของทั้งหมดต่อก้อน — ปัดรวมกันได้ 100 พอดี (ทั้งหมด 0 = ทุกก้อน 0%) */
  const shareOf = counts ? new Map(segmentsOfTotal(counts).map((s) => [s.key, s.pct])) : null;
  /** เปลี่ยนไปกี่ % จากช่วงก่อน — ไม่ลงสีดี/เสีย (`upIsGood` = null) */
  const pillOf = (cur: number, prev: number | undefined) => (previous && prev !== undefined ? countPill(cur, prev, null) : null);
  /** 5 กล่องเมื่อมี "ทั้งสองทาง" · ไม่งั้น 4 กล่อง */
  const cols = segments.length + 1 > 4 ? 'xl:grid-cols-5' : 'xl:grid-cols-4';

  return (
    <Card variant="glass" className={cn('flex flex-col gap-6 p-5 sm:p-6', className)}>
      {/* ป้าย "หนักไปทาง…" ถอดแล้ว (รอบ 16 · เจ้าของ: "หนักไปทาง AI นี่ก็เอาออก") · หัวข้อเหลือไว้ให้โปรแกรมอ่านจอ
          การ์ดเป็น flex + gap ⇒ หัวข้อที่ซ่อน (absolute) ไม่ดันช่องว่าง ต่างจาก space-y ที่นับลูกคนแรกเสมอ */}
      <h2 className="sr-only">{title}</h2>

      {loading && !counts ? (
        <div className={cn('grid gap-3 sm:grid-cols-2', cols)} aria-label={`กำลังโหลด${title}`}>
          {['total', ...segments].map((k) => (
            <Skeleton key={k} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : error && !counts ? (
        <p className={cn('text-sm', TONE.danger.value)}>{error}</p>
      ) : counts ? (
        <div className="space-y-3">
          {/* ทั้งหมดขึ้นก่อน (รอบ 17 · เจ้าของ: "เรียงใหม่ ทั้งหมด AI โทร คนโทร ยังไม่โทร") */}
          <div className={cn('grid gap-3 sm:grid-cols-2', cols)}>
            <Tile
              label="ทั้งหมด"
              value={total}
              unit={unit}
              share={null}
              pill={pillOf(total, previous?.total)}
              pillTitle={compareTitle}
              foot={previous && previousLabel ? `${previousLabel} ${NUM.format(previous.total)}` : null}
              hint={metricHelp(metrics.total)}
              onClick={onPick ? () => onPick('total') : undefined}
            />
            {segments.map((k) => (
              <Tile
                key={k}
                label={AI_SHARE_SEGMENT_LABEL[k]}
                value={counts[k]}
                share={shareOf?.get(k) ?? 0}
                shareClass={segmentFillClass(k)}
                pill={pillOf(counts[k], previous?.[k])}
                pillTitle={compareTitle}
                hint={helpOf(k)}
                onClick={onPick ? () => onPick(k) : undefined}
              />
            ))}
          </div>
          {error ? <p className={cn('text-xs', TONE.danger.value)}>{error}</p> : null}
          {flag ? <p className={cn('text-xs', TONE.warn.value)}>{flag}</p> : null}
        </div>
      ) : null}

      {children ? <div className="border-t border-foreground/10 pt-5">{children}</div> : null}
    </Card>
  );
};

export default AiShareCard;
