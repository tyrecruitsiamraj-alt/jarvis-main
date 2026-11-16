import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import type { TopicPart } from '@/lib/recruitTopics';
import { GrowStack } from '../stuck/GrowBar';

/**
 * สมการหนึ่งขั้น "กรอกมา 1,388 = AI โทรแล้ว 1,103 + …" + แท่งสีแบ่งก้อน + ชิปกดเปิดรายชื่อ
 * (เจ้าของ 16 พ.ย. 2569 "กรอกมา 1399 บล็อคนี้สีนี้ ยอด 1103+285 สีนึง") · ก้อน 0 ยังขึ้นชิป (ว่างห้ามหาย)
 * 🔴 รวมก้อนไม่เท่ายอด = บอกบนจอทันที (ห้ามซ่อนเลขที่ไม่ลงตัว)
 */
export default function TopicEquation({
  label,
  total,
  parts,
  unit = 'คน',
  onOpenNames,
}: {
  label: string;
  total: number;
  parts: readonly TopicPart[];
  unit?: string;
  onOpenNames?: (title: string, ids: readonly string[]) => void;
}) {
  const sum = parts.reduce((s, p) => s + p.value, 0);
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);
  return (
    <div className="min-w-0 space-y-2 rounded-xl border border-border p-3" data-testid="topic-equation">
      <p className="break-words text-sm text-foreground">
        <span className="font-medium">{label}</span> <span className="text-base font-medium tabular-nums">{fmt(total)}</span>
        <span className={cn('text-xs', DASH.sub)}> {unit}</span>
        {parts.length > 0 ? <span className={DASH.sub}> = {parts.map((p) => `${p.label} ${fmt(p.value)}`).join(' + ')}</span> : null}
        {sum !== total ? <span className={cn('ml-1 text-xs', TONE.danger.value)}>(รวมได้ {fmt(sum)} ไม่ลงตัว)</span> : null}
      </p>
      <GrowStack parts={parts.filter((p) => p.value > 0).map((p) => ({ pct: pct(p.value), tone: p.tone, label: p.label }))} />
      <div className="flex flex-wrap gap-1.5">
        {parts.map((p) => {
          const canOpen = Boolean(onOpenNames && p.ids && p.ids.length > 0);
          return (
            <Button
              key={p.key}
              type="button"
              variant="outline"
              size="xs"
              disabled={!canOpen}
              onClick={() => canOpen && onOpenNames?.(`${label} · ${p.label}`, p.ids ?? [])}
              className="h-auto min-h-7 max-w-full whitespace-normal gap-1.5 rounded-full px-2.5 font-normal disabled:opacity-100"
            >
              <span className={cn('size-2.5 rounded-sm', TONE[p.tone].dot)} aria-hidden />
              {p.label}
              <span className="shrink-0 font-medium tabular-nums">{fmt(p.value)}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
