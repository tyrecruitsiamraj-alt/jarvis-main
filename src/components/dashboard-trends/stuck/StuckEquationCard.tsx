import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import { STUCK_SCOPE_LABEL, stuckEquation, type StuckRequest, type StuckScope } from '@/lib/recruitStuck';

const thaiShort = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayText = (ymd: string) => thaiShort.format(new Date(`${ymd}T00:00:00Z`));

const BOXES: ReadonlyArray<{ key: StuckScope; op: string | null; tone: ToneKey }> = [
  { key: 'carried', op: null, tone: 'neutral' },
  { key: 'new', op: '+', tone: 'info' },
  { key: 'filled', op: '−', tone: 'success' },
  { key: 'cancelled', op: '−', tone: 'danger' },
  { key: 'remaining', op: '=', tone: 'warn' },
];

/**
 * ═══ บนสุด: ยกมา + ขอใหม่ − ปิดแล้ว − ยกเลิก = เหลือหา (เจ้าของ 4 พ.ย. 2569 "มันต้อง Fil ดูได้หมดเลย") ═══
 * กดกล่อง = ทั้งหน้าดูเฉพาะใบชุดนั้น · กดซ้ำ/กดเหลือหา = กลับค่าเริ่ม · สมการลงตัวเสมอ (`stuckEquation`)
 */
export default function StuckEquationCard({
  rows,
  window: win,
  value,
  onChange,
}: {
  rows: readonly StuckRequest[];
  window: { from: string; to: string } | null;
  value: StuckScope;
  onChange: (next: StuckScope) => void;
}) {
  const eq = React.useMemo(() => stuckEquation(rows), [rows]);
  const need = eq.remaining.reduce((s, r) => s + r.remaining, 0);
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-card p-3" data-testid="stuck-equation">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-medium text-foreground">ใบขอ</p>
        <p className={cn('text-xs tabular-nums', DASH.sub)}>{win ? `ขอใหม่ ${dayText(win.from)} – ${dayText(win.to)}` : null}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {BOXES.map((b) => (
          <React.Fragment key={b.key}>
            {b.op ? <span className={cn('w-3 text-center text-lg', DASH.sub)} aria-hidden>{b.op}</span> : null}
            <Button
              type="button"
              variant="ghost"
              aria-pressed={value === b.key}
              onClick={() => onChange(value === b.key ? 'remaining' : b.key)}
              className={cn(
                'h-auto min-w-20 flex-1 flex-col items-start gap-0 whitespace-normal rounded-xl border px-3 py-2 text-left font-normal',
                TONE[b.tone].soft,
                value === b.key && 'ring-2 ring-ring',
              )}
              data-testid={`stuck-eq-${b.key}`}
            >
              <span className={cn('text-2xl font-medium tabular-nums', TONE[b.tone].num)}>{fmt(eq[b.key].length)}</span>
              <span className="text-xs text-foreground">
                {STUCK_SCOPE_LABEL[b.key]}
                {b.key === 'remaining' ? <span className={cn('tabular-nums', DASH.sub)}> · {fmt(need)} อัตรา</span> : null}
              </span>
            </Button>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
