import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import { STUCK_SCOPE_LABEL, stuckEquation, type StuckRequest, type StuckScope } from '@/lib/recruitStuck';

const thaiShort = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayText = (ymd: string) => thaiShort.format(new Date(`${ymd}T00:00:00Z`));

const BOXES: ReadonlyArray<{ key: StuckScope; op: string | null }> = [
  { key: 'carried', op: null },
  { key: 'new', op: '+' },
  { key: 'filled', op: '−' },
  { key: 'cancelled', op: '−' },
  { key: 'remaining', op: '=' },
];

/**
 * ═══ บนสุด: ยกมา + ขอใหม่ − ปิดแล้ว − ยกเลิก = เหลือหา (เจ้าของ 4 พ.ย. 2569 "มันต้อง Fil ดูได้หมดเลย") ═══
 * กดกล่อง = ทั้งหน้าดูเฉพาะใบชุดนั้น · กดซ้ำ/กดเหลือหา = กลับค่าเริ่ม · สมการลงตัวเสมอ (`stuckEquation`)
 * โฉมแถบกรมท่าแบบหน้าหลัก (เจ้าของ 9 พ.ย. 2569 "ทำหน้าภาพรวมให้สวยแบบเดียวกัน") — ผลลัพธ์พื้นเบอร์กันดี · กล่องที่เลือกมีกรอบขาว
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
    <div
      className="space-y-3 rounded-2xl bg-foreground p-4 text-background shadow-xl shadow-foreground/10 dark:bg-card dark:text-foreground sm:p-6"
      data-testid="stuck-equation"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-lg font-medium">ใบขอ</p>
        <p className="text-sm tabular-nums text-background/70 dark:text-foreground/70">{win ? `ขอใหม่ ${dayText(win.from)} – ${dayText(win.to)}` : null}</p>
      </div>
      {/* เครื่องหมายอยู่หน้าชื่อกล่อง (+ ขอใหม่ · − ปิดแล้ว · = เหลือหา) แบบเดียวกับหน้าหลัก */}
      <div className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-5">
        {BOXES.map((b) => {
          const result = b.key === 'remaining';
          return (
            <React.Fragment key={b.key}>
              <Button
                type="button"
                variant="ghost"
                aria-pressed={value === b.key}
                onClick={() => onChange(value === b.key ? 'remaining' : b.key)}
                className={cn(
                  'h-auto min-w-0 flex-col items-start gap-1 whitespace-normal rounded-xl p-4 text-left font-normal',
                  result
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                    : 'bg-background/10 text-background hover:bg-background/15 hover:text-background dark:bg-foreground/5 dark:text-foreground dark:hover:bg-foreground/10 dark:hover:text-foreground',
                  value === b.key && 'ring-2 ring-background dark:ring-foreground',
                )}
                data-testid={`stuck-eq-${b.key}`}
              >
                <span className={cn('text-sm', result ? 'text-primary-foreground/80' : 'text-background/70 dark:text-foreground/70')}>
                  {b.op ? `${b.op} ` : ''}
                  {STUCK_SCOPE_LABEL[b.key]}
                </span>
                <span className="text-4xl font-medium tabular-nums" data-testid={`stuck-eq-${b.key}-n`}>
                  {fmt(eq[b.key].length)}
                </span>
                <span className={cn('text-sm tabular-nums', result ? 'text-primary-foreground/80' : 'text-background/70 dark:text-foreground/70')}>
                  {result ? `${fmt(need)} อัตรา` : 'ใบ'}
                </span>
              </Button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
