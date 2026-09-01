import React, { useMemo } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { monthGridDays, shiftMonth } from '@/lib/followCallCalendar';
import { toYmdBangkok, THAI_MONTHS, ceToBeYear } from '@/lib/dateTh';
import {
  buildFollowPlanningDays,
  FOLLOW_ROUND_STATE_LABEL,
  type FollowPlanningRow,
  type FollowRoundState,
} from '@/lib/followPlanning';

/**
 * ═══ ปฏิทิน Planning ของหน้าติดตาม (เจ้าของสั่ง 1 ก.ย. 2569) ═══
 *
 * > *"ตรง Planning ยังไม่ได้เป็นแบบปฏิทินที่มีรายละเอียด มีชื่อคนบอกไรงี้
 * >  เหมือนเป็นตารางบอกว่าวันนี้มีใครต้องติดตาม"*
 *
 * ⇒ **ช่องวันต้องมีชื่อคนอยู่ในนั้นจริง ๆ** ไม่ใช่แค่ตัวเลขจำนวนสาย
 * กดวันไหน = ทั้งหน้ากรองเหลือวันนั้น (ตอบข้อ 1.1 *"เผื่อต้องการดูแค่วันนั้นวันเดียว"*)
 * กดซ้ำที่วันเดิม = ล้างตัวกรอง กลับมาดูทั้งหมด
 *
 * 🔴 **ตัวกรองวันใช้ช่องเดียวกับแผงตัวกรอง (`fDate`)** — ห้ามมีตัวกรองวันสองตัวในหน้าเดียว
 * (เคยเจอมาแล้วกับ "ทั้งหมด" สามค่าบนจอเดียว: เลขไม่ตรงกันแล้วคนเลิกเชื่อทั้งหมด)
 */

/** สีจุดหน้าชื่อในช่องวัน — ความหมายเดียวกับชิปเวลาในตาราง */
const DOT: Record<FollowRoundState, string> = {
  overdue: TONE.danger.dot,
  sent: TONE.primary.dot,
  waiting: TONE.neutral.dot,
  result: TONE.success.dot,
  closed: TONE.success.dot,
  cancelled: TONE.neutral.dot,
};

const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

/** ชื่อเดือนไทย + ปี พ.ศ. จากคีย์ YYYY-MM */
function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  const name = THAI_MONTHS.find((x) => x.value === Number(m))?.label ?? m;
  return `${name} ${ceToBeYear(Number(y))}`;
}

const FollowPlanningCalendar: React.FC<{
  rows: readonly FollowPlanningRow[];
  month: string;
  onMonthChange: (monthKey: string) => void;
  /** วันที่เลือกอยู่ (YYYY-MM-DD) — '' = ดูทั้งหมด */
  selectedYmd: string;
  onSelect: (ymd: string) => void;
}> = ({ rows, month, onMonthChange, selectedYmd, onSelect }) => {
  const days = useMemo(() => buildFollowPlanningDays(rows), [rows]);
  const cells = useMemo(() => monthGridDays(month), [month]);
  const today = toYmdBangkok(new Date());

  return (
    <div className="glass-card rounded-2xl border border-white/70 p-3 dark:border-slate-700/70">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="text-sm font-bold text-foreground">ปฏิทินติดตาม</span>
        <span className="text-[11px] text-muted-foreground">
          กดวันไหน = ดูเฉพาะวันนั้น · กดซ้ำ = กลับมาดูทั้งหมด
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMonthChange(shiftMonth(month, -1))}
            aria-label="เดือนก่อนหน้า"
            className={cn('inline-flex h-8 w-8 items-center justify-center rounded-full border', TONE.neutral.outline)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <span className="min-w-[110px] text-center text-sm font-semibold text-foreground">
            {monthLabel(month)}
          </span>
          <button
            type="button"
            onClick={() => onMonthChange(shiftMonth(month, 1))}
            aria-label="เดือนถัดไป"
            className={cn('inline-flex h-8 w-8 items-center justify-center rounded-full border', TONE.neutral.outline)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => {
              onMonthChange(today.slice(0, 7));
              onSelect(today);
            }}
            className={cn(
              'ml-1 inline-flex h-8 items-center rounded-full border px-3 text-[11px] font-semibold',
              TONE.info.outline,
            )}
          >
            วันนี้
          </button>
          {selectedYmd ? (
            <button
              type="button"
              onClick={() => onSelect('')}
              className="ml-1 text-[11px] font-medium text-primary underline"
            >
              ดูทั้งหมด
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-1 pb-1 text-center text-[10px] font-semibold text-muted-foreground">
            {w}
          </div>
        ))}
        {cells.map((ymd, i) => {
          if (!ymd) return <div key={`x${i}`} aria-hidden />;
          const day = days.get(ymd);
          const selected = selectedYmd === ymd;
          const isToday = ymd === today;
          return (
            <button
              key={ymd}
              type="button"
              /* กดซ้ำวันเดิม = ล้าง (ปุ่มเดียวทำสองทาง ดีกว่ามีปุ่มล้างซ่อนอยู่ที่อื่น) */
              onClick={() => onSelect(selected ? '' : ymd)}
              aria-pressed={selected}
              className={cn(
                'min-h-[92px] rounded-xl border p-1.5 text-left transition-colors',
                selected
                  ? 'border-primary bg-primary/10'
                  : day
                    ? cn(TONE.neutral.soft, 'hover:bg-secondary')
                    : 'border-border/60 bg-background/40 hover:bg-secondary/60',
              )}
            >
              <div className="flex items-center gap-1">
                <span
                  className={cn(
                    'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-bold tabular-nums',
                    isToday ? 'bg-primary text-primary-foreground' : 'text-foreground',
                  )}
                >
                  {Number(ymd.slice(8))}
                </span>
                {day ? (
                  <span className="ml-auto text-[10px] font-semibold tabular-nums text-muted-foreground">
                    {day.calls} สาย
                  </span>
                ) : null}
              </div>
              {day ? (
                <>
                  <ul className="mt-1 space-y-0.5">
                    {day.people.slice(0, 3).map((p) => (
                      <li key={p.key} className="flex items-center gap-1">
                        <span
                          aria-hidden
                          title={FOLLOW_ROUND_STATE_LABEL[p.worst]}
                          className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT[p.worst])}
                        />
                        <span className="truncate text-[10px] font-medium text-foreground">{p.name}</span>
                        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                          {p.rounds[0]?.time ?? ''}
                          {p.rounds.length > 1 ? ` +${p.rounds.length - 1}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {day.people.length > 3 ? (
                    <p className="mt-0.5 text-[10px] font-medium text-primary">
                      +อีก {day.people.length - 3} คน
                    </p>
                  ) : null}
                  {/* ของค้างของวันนั้นต้องเห็นจากนอกช่อง ไม่ต้องกดเข้าไปหา */}
                  {day.overdue > 0 ? (
                    <p className="mt-0.5 text-[10px] font-bold text-rose-700 dark:text-red-300">
                      เลยเวลา {day.overdue}
                    </p>
                  ) : null}
                </>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FollowPlanningCalendar;
