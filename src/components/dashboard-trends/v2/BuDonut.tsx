/**
 * โดนัทสัดส่วน + รายการใต้โดนัท กดได้ (ภาพรวม · เจ้าของ 19 พ.ย. 2569 "เอาไปทำกราฟโดนัท ข้างๆกราฟแท่งดีกว่า")
 * ชิ้นที่ 0 ไม่วาด แต่แถวในรายการยังอยู่ (ว่าง = 0) · กดชิ้นหรือแถว = เลือก · เลือกอยู่ = ชิ้นอื่นจาง
 */
import { cn } from '@/lib/utils';
import { DASH } from '@/lib/designTokens';
import { fmt } from './V2Parts';

export type DonutSlice = { key: string; label: string; value: number; hex: string };

const R = 42;
const C = 2 * Math.PI * R;

export default function BuDonut({
  slices,
  selected,
  onPick,
  center,
  unit,
  testId,
}: {
  slices: readonly DonutSlice[];
  selected: string | null;
  onPick: (key: string) => void;
  /** เลขกลางโดนัท */
  center: number;
  unit: string;
  testId?: string;
}) {
  const total = slices.reduce((n, s) => n + s.value, 0);
  let at = 0;
  const arcs = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const len = (s.value / (total || 1)) * C;
      const gap = slices.filter((x) => x.value > 0).length > 1 ? Math.min(2, len / 3) : 0;
      const arc = { ...s, dash: `${Math.max(0, len - gap)} ${C}`, offset: -at };
      at += len;
      return arc;
    });
  return (
    <div className="flex flex-col items-center gap-3" data-testid={testId}>
      <div className="relative size-40">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90">
          <circle cx="50" cy="50" r={R} fill="none" strokeWidth="12" className="stroke-muted" />
          {arcs.map((a) => (
            <circle
              key={a.key}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={a.hex}
              strokeWidth="12"
              strokeDasharray={a.dash}
              strokeDashoffset={a.offset}
              className={cn('cursor-pointer transition-opacity', selected && selected !== a.key && 'opacity-25')}
              onClick={() => onPick(a.key)}
            >
              <title>{`${a.label} ${fmt(a.value)} ${unit}`}</title>
            </circle>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-medium tabular-nums">{fmt(center)}</span>
          <span className={cn('text-xs', DASH.sub)}>{unit}</span>
        </div>
      </div>
      <div className="w-full space-y-0.5">
        {slices.map((s) => (
          <button
            key={s.key}
            type="button"
            disabled={!s.value}
            onClick={() => onPick(s.key)}
            className={cn('grid w-full grid-cols-[0.625rem_1fr_auto_2.5rem] items-center gap-2 rounded-lg px-1.5 py-1 text-left text-xs hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent', selected === s.key && 'bg-muted', selected && selected !== s.key && 'opacity-40')}
          >
            <span className="size-2.5 rounded-sm" style={{ background: s.hex }} />
            <span>{s.label}</span>
            <span className="font-medium tabular-nums">{fmt(s.value)}</span>
            <span className={cn('text-right tabular-nums', DASH.sub)}>{total ? Math.round((s.value / total) * 100) : 0}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}
