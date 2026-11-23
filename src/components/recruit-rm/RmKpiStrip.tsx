import { Button } from '@/components/ui/button';
import { TONE, DASH, type ToneKey } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

/**
 * ═══ กล่องเลขหัวแท็บการติดต่อ / ติดตามนัดหมาย (แบบร่างรอบ 4 · เจ้าของ "ทำเลย" 23 พ.ย. 2569) ═══
 * กล่องเลขเรียงแถวเดียว กดแล้วรายการข้างล่างกรองตาม (ข้อมูลชุดเดียวกับชิปกรองเดิม) · บรรทัดสมการใต้กล่องให้บวกลงตัวเห็นกับตา
 * 🔴 เลข 0 ต้องโชว์ · `null` = กำลังโหลด ("…") · 'unknown' = โหลดไม่ได้ ("—" ไม่ใช่ 0)
 * ปุ่มมาจาก shadcn `Button` · สีจาก `TONE` · เลือกอยู่ = พื้นจางของสีกล่อง + กรอบสีแบรนด์ (`ring-ring`)
 */
export type RmKpi<T extends string> = { id: T; label: string; count: number | null | 'unknown'; tone: ToneKey };

export const kpiText = (n: number | null | 'unknown'): string =>
  n === null ? '…' : n === 'unknown' ? '—' : n.toLocaleString('th-TH');

export default function RmKpiStrip<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  equation,
  testId,
}: {
  items: readonly RmKpi<T>[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
  /** บรรทัดสมการ — ไม่มี (โหลดไม่เสร็จ/ล้ม) = ไม่ขึ้น แต่จองที่ไว้ จอไม่ขยับ */
  equation: string | null;
  testId?: string;
}) {
  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" role="group" aria-label={ariaLabel}>
        {items.map((k) => {
          const active = k.id === value;
          return (
            <Button
              key={k.id}
              type="button"
              variant="outline"
              aria-pressed={active}
              onClick={() => onChange(k.id)}
              data-testid={testId ? `${testId}-${k.id}` : undefined}
              className={cn(
                'h-auto flex-col items-start justify-start gap-1 rounded-xl px-3 py-2 text-left whitespace-normal',
                active && cn(TONE[k.tone].soft, 'ring-2 ring-ring'),
              )}
            >
              <span className={cn('flex items-center gap-1.5 text-xs font-normal', DASH.label)}>
                <span className={cn('size-2 shrink-0 rounded-full', TONE[k.tone].dot)} aria-hidden />
                {k.label}
              </span>
              <span className={cn('text-2xl font-medium tabular-nums', TONE[k.tone].value)}>{kpiText(k.count)}</span>
            </Button>
          );
        })}
      </div>
      <p className={cn('min-h-4 text-xs tabular-nums', DASH.cellMuted)} data-testid={testId ? `${testId}-equation` : undefined}>
        {equation ?? ''}
      </p>
    </div>
  );
}
