import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import { trendOf, trendTone, type TrendSense } from '@/lib/recruitScale';

/**
 * ป้ายเทียบช่วงก่อน (เจ้าของ 13 พ.ย. 2569 "มันต้องดูแนวโน้มได้ด้วย เพิ่มหรือลด")
 * ▲ เพิ่มขึ้น 587 · ▼ ลดลง 4 · ทรงตัว · ใหม่ (ช่วงก่อน 0) · เทียบไม่ได้ (ไม่มีเลขช่วงก่อน)
 * สีตามความหมายของตัวเลข (`sense`) ไม่ใช่ตามทิศ — ตัวหนังสือบอกทิศเสมอ ไม่ใช้สีอย่างเดียว
 */
export default function TrendDelta({
  cur,
  prev,
  sense = 'good',
  from = false,
  pct = false,
  className,
}: {
  cur: number | null | undefined;
  prev: number | null | undefined;
  sense?: TrendSense;
  /** ต่อท้าย "จาก 221" */
  from?: boolean;
  /** ต่อท้าย (176.6%) */
  pct?: boolean;
  className?: string;
}) {
  const t = trendOf(cur, prev);
  const tone = trendTone(t, sense);
  const color = tone === 'good' ? TONE.success.value : tone === 'bad' ? TONE.danger.value : t.kind === 'none' || t.kind === 'same' ? 'text-muted-foreground' : 'text-foreground';
  const text =
    t.kind === 'none'
      ? 'เทียบไม่ได้'
      : t.kind === 'same'
        ? 'ทรงตัว'
        : t.kind === 'new'
          ? from
            ? 'ใหม่ ช่วงก่อน 0'
            : 'ใหม่'
          : `${t.kind === 'up' ? '▲ เพิ่มขึ้น' : '▼ ลดลง'} ${fmt(t.diff)}${pct ? ` (${t.pct.toLocaleString('th-TH')}%)` : ''}${from ? ` จาก ${fmt(t.prev)}` : ''}`;
  return (
    <span className={cn('whitespace-nowrap text-xs font-normal tabular-nums', color, className)} data-trend={t.kind}>
      {text}
    </span>
  );
}
