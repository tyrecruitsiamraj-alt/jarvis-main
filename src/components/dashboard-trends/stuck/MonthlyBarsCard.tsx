import React from 'react';
import { BarChart3 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import { monthLabel } from '@/lib/recruitOverviewWindow';
import { STUCK_TREND_LABEL, monthlySeries, type StuckMonthlyRow, type StuckTrendKey } from '@/lib/recruitStuck';
import { OverviewCard, SectionError } from '../RecruitOverviewParts';
import { useGrown } from './GrowBar';

const KEYS = Object.keys(STUCK_TREND_LABEL) as StuckTrendKey[];

/**
 * ═══ ส่วนที่ 5: เทียบเดือน (เจ้าของ 4 พ.ย. 2569 "เทียบได้ว่าเดือนไหนเยอะ") ═══
 * แท่งละเดือน ย้อน 6 เดือน · เลือกดู ใบขอ / รายชื่อ / นัดได้ / ได้ลงงาน · แท่งยืดขึ้นตอนวาด · ตามตัวกรองบนสุด (`ok`)
 * กดแท่ง = เลือกช่วงเวลาของหน้าเป็นเดือนนั้น
 */
export default function MonthlyBarsCard({
  rows,
  error,
  ok,
  onPickMonth,
}: {
  rows: readonly StuckMonthlyRow[] | null;
  error?: string | null;
  ok: (jobId: string | null) => boolean;
  onPickMonth?: (month: string) => void;
}) {
  const [key, setKey] = React.useState<StuckTrendKey>('requests');
  const grown = useGrown();
  const series = React.useMemo(() => (rows ? monthlySeries(rows, key, ok) : []), [rows, key, ok]);
  const max = Math.max(1, ...series.map((s) => s.value));
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  const pct = prev && prev.value > 0 && last ? Math.round(((last.value - prev.value) / prev.value) * 100) : null;
  return (
    <OverviewCard
      icon={BarChart3}
      title="เทียบเดือน"
      sub="6 เดือนล่าสุด · เดือนนี้ยังไม่จบ"
      actions={
        <Tabs value={key} onValueChange={(v) => setKey(v as StuckTrendKey)}>
          <TabsList className="h-8">
            {KEYS.map((k) => (
              <TabsTrigger key={k} value={k} className="h-7 text-xs" data-testid={`stuck-trend-${k}`}>
                {STUCK_TREND_LABEL[k]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      }
    >
      {rows === null ? (
        <SectionError message={error ?? 'อ่านยอดรายเดือนไม่ได้'} />
      ) : (
        <>
          <div className="grid h-44 grid-flow-col auto-cols-fr items-end gap-2 pt-6" data-testid="stuck-trend">
            {series.map((s, i) => (
              <div key={s.month} className="flex h-full min-w-0 flex-col items-center justify-end gap-1">
                <span className="text-xs font-medium tabular-nums text-foreground">{fmt(s.value)}</span>
                <button
                  type="button"
                  aria-label={`${monthLabel(s.month)} ${fmt(s.value)}`}
                  onClick={() => onPickMonth?.(s.month)}
                  className={cn('w-full max-w-14 rounded-t-lg transition-all duration-700 ease-out motion-reduce:transition-none', i === series.length - 1 ? TONE.primary.dot : TONE.info.dot)}
                  style={{ height: `${grown ? (s.value / max) * 100 : 0}%` }}
                />
                <span className={cn('whitespace-nowrap text-xs', DASH.sub)}>{monthLabel(s.month).replace(/ \d+$/, '')}</span>
              </div>
            ))}
          </div>
          <p className={cn('text-xs tabular-nums', DASH.sub)}>
            {last ? `${STUCK_TREND_LABEL[key]} ${monthLabel(last.month)} ${fmt(last.value)}` : 'ยังไม่มีข้อมูล'}
            {prev ? ` · เดือนก่อน ${fmt(prev.value)}${pct !== null ? ` (${pct >= 0 ? '+' : ''}${pct}%)` : ''}` : ''}
            {' · กดแท่งเพื่อดูเดือนนั้น'}
          </p>
        </>
      )}
    </OverviewCard>
  );
}
