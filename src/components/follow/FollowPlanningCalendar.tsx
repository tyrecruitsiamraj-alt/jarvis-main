import React, { useEffect, useMemo, useRef } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { shiftMonth } from '@/lib/followCallCalendar';
import { toYmdBangkok, THAI_MONTHS, ceToBeYear, formatYmdDmyBe } from '@/lib/dateTh';
import {
  buildFollowMonthRows,
  monthDayColumns,
  roundResultLabel,
  FOLLOW_ROUND_STATE_LABEL,
  type FollowPlanningRound,
  type FollowPlanningRow,
  type FollowRoundState,
} from '@/lib/followPlanning';

/**
 * ═══ ปฏิทิน Planning ของหน้าติดตาม (เจ้าของสั่ง 1 ก.ย. 2569) ═══
 *
 * > *"ตรง Planning ยังไม่ได้เป็นแบบปฏิทินที่มีรายละเอียด มีชื่อคนบอกไรงี้
 * >  เหมือนเป็นตารางบอกว่าวันนี้มีใครต้องติดตาม"*
 * > *"ตรงปฏิทินเอาชื่อคนไปไว้ด้านซ้ายสิ"*
 *
 * ⇒ **แถว = คน (ชื่ออยู่ซ้าย ตรึงไว้) · คอลัมน์ = วันของเดือน · ช่อง = เวลาที่ต้องโทร**
 * ⚠️ เคยทำเป็นช่องปฏิทิน 7 คอลัมน์แล้วเอาชื่อยัดในช่อง — เจ้าของสั่งแก้เป็นแบบนี้
 * กดช่อง/กดหัวคอลัมน์วัน = ทั้งหน้ากรองเหลือวันนั้น · กดซ้ำ = กลับมาดูทั้งหมด
 *
 * 🔴 **ตัวกรองวันใช้ช่องเดียวกับแผงตัวกรอง (`fDate`)** — ห้ามมีตัวกรองวันสองตัวในหน้าเดียว
 */

/** สีของช่อง — ความหมายเดียวกับชิปเวลาในตารางรายละเอียดข้างล่าง */
const CELL_TONE: Record<FollowRoundState, string> = {
  overdue: TONE.danger.chip,
  sent: TONE.primary.chip,
  waiting: TONE.neutral.chip,
  result: TONE.success.chip,
  closed: TONE.success.chip,
  cancelled: TONE.neutral.chip,
};

/** ชื่อเดือนไทย + ปี พ.ศ. จากคีย์ YYYY-MM */
function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  const name = THAI_MONTHS.find((x) => x.value === Number(m))?.label ?? m;
  return `${name} ${ceToBeYear(Number(y))}`;
}

/** ข้อความบอกช่อง — ตัวเลขลอย ๆ อ่านไม่ออกว่าคืออะไร ต้องมีคำกำกับตอนเอาเมาส์จ่อ */
function cellTitle(name: string, ymd: string, rounds: FollowPlanningRound[]): string {
  const detail = rounds
    .map((r) => `${r.time ?? 'ไม่ได้ตั้งเวลา'} — ${FOLLOW_ROUND_STATE_LABEL[r.state]}`)
    .join(' · ');
  return `${name} · ${formatYmdDmyBe(ymd)} — ${detail} (กดเพื่อดูรายละเอียดและจัดการรอบนี้)`;
}

const FollowPlanningCalendar: React.FC<{
  rows: readonly FollowPlanningRow[];
  month: string;
  onMonthChange: (monthKey: string) => void;
  /** วันที่เลือกอยู่ (YYYY-MM-DD) — '' = ดูทั้งหมด */
  selectedYmd: string;
  onSelect: (ymd: string) => void;
  /** กดช่องเวลา = เปิดป๊อปรายละเอียดของคนนั้นในวันนั้น (เจ้าของเลือกเอง 1 ก.ย. 2569) */
  onOpenCell: (row: FollowPlanningRow, ymd: string, rounds: FollowPlanningRound[]) => void;
  /**
   * "การโทรครั้งที่" ที่แผงข้างบนเลือกอยู่ — ตารางนี้กรองตามแล้ว **ต้องเขียนบอกด้วย**
   * ไม่งั้นเห็นแถวน้อยกว่าเลขบนกล่องแล้วนึกว่าจอผิด (เลขบนกล่องนับทุกเดือน · ตารางนี้เดือนเดียว)
   */
  activeRound?: number;
}> = ({ rows, month, onMonthChange, selectedYmd, onSelect, onOpenCell, activeRound }) => {
  const monthRows = useMemo(() => buildFollowMonthRows(rows, month), [rows, month]);
  const cols = useMemo(() => monthDayColumns(month), [month]);
  const today = toYmdBangkok(new Date());
  const scrollRef = useRef<HTMLDivElement | null>(null);

  /**
   * เดือนหนึ่งมี 30 คอลัมน์ ⇒ เปิดมาเจอต้นเดือนซึ่งมักว่างเปล่า **ดูเหมือนไม่มีงาน**
   * จึงเลื่อนไปที่วันนี้เอง (ถ้าไม่ได้อยู่ในเดือนนี้ก็ไปวันแรกที่มีนัด)
   */
  const focusYmd = useMemo(() => {
    if (today.slice(0, 7) === month) return today;
    const all = monthRows.flatMap((r) => Array.from(r.byDay.keys())).sort();
    return all[0] ?? '';
  }, [today, month, monthRows]);

  useEffect(() => {
    const box = scrollRef.current;
    if (!box || !focusYmd) return;
    const cell = box.querySelector<HTMLElement>(`[data-ymd="${focusYmd}"]`);
    if (!cell) return;
    // เว้นที่ทางซ้ายไว้หน่อย ให้เห็นวันก่อนหน้าด้วย — กระโดดไปชิดขอบแล้วงงว่าอยู่ตรงไหน
    box.scrollLeft = Math.max(0, cell.offsetLeft - 220);
  }, [focusYmd]);

  return (
    <div className="glass-card rounded-2xl border border-white/70 p-3 dark:border-slate-700/70">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="text-sm font-bold text-foreground">ปฏิทินติดตาม</span>
        <span className="text-[11px] text-muted-foreground">
          แถว = คน · คอลัมน์ = วัน · กดช่องเวลา = เปิดรายละเอียด/จัดการรอบนั้น · กดหัววัน = ดูเฉพาะวันนั้น
        </span>
        {activeRound ? (
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', TONE.info.chip)}>
            กำลังดู การโทรครั้งที่ {activeRound} · เฉพาะเดือนนี้
          </span>
        ) : null}
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

      {/* คำอธิบายสี — ไม่มีคือเดาไม่ได้ว่าช่องสีหมายถึงอะไร */}
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {(
          [
            ['overdue', 'เลยเวลานัด'],
            ['sent', 'ส่งแล้วรอผล'],
            ['waiting', 'ยังไม่ถึงเวลา'],
            ['result', 'ได้ผลแล้ว / ปิดงาน'],
            ['cancelled', 'ยกเลิกแล้ว (ขีดฆ่า)'],
          ] as const
        ).map(([state, label]) => (
          <span key={state} className="inline-flex items-center gap-1">
            <span
              className={cn(
                'h-2.5 w-2.5 rounded-sm',
                TONE[
                  state === 'overdue'
                    ? 'danger'
                    : state === 'sent'
                      ? 'primary'
                      : state === 'result'
                        ? 'success'
                        : 'neutral'
                ].dot,
                state === 'cancelled' && 'opacity-60',
              )}
              aria-hidden
            />
            {label}
          </span>
        ))}
      </div>

      {monthRows.length === 0 ? (
        <p className={cn('rounded-xl border px-3 py-4 text-center text-xs text-muted-foreground', TONE.neutral.soft)}>
          เดือนนี้ไม่มีนัดโทรของใครเลย
          {activeRound ? ` ใน "การโทรครั้งที่ ${activeRound}" — กดครั้งที่อื่นข้างบนเพื่อดูรอบอื่น` : ''}
        </p>
      ) : (
        <div ref={scrollRef} className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border">
                {/* 🔴 ชื่อคนอยู่ซ้ายและตรึงไว้ — เลื่อนดูวันท้ายเดือนแล้วต้องยังรู้ว่าแถวนี้ใคร */}
                <th className="sticky left-0 z-10 min-w-[190px] max-w-[260px] bg-card px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">
                  คนที่ต้องติดตาม
                </th>
                {cols.map((c) => {
                  const selected = selectedYmd === c.ymd;
                  return (
                    <th key={c.ymd} data-ymd={c.ymd} className={cn('p-0.5', c.isSunday && 'bg-secondary/40')}>
                      <button
                        type="button"
                        onClick={() => onSelect(selected ? '' : c.ymd)}
                        aria-pressed={selected}
                        title={`${formatYmdDmyBe(c.ymd)} — กดเพื่อดูเฉพาะวันนี้`}
                        className={cn(
                          'flex min-w-[64px] flex-col items-center rounded-lg px-1 py-1 font-medium transition-colors hover:bg-secondary',
                          selected && 'bg-primary text-primary-foreground hover:bg-primary',
                          !selected && c.isSunday && 'text-rose-800 dark:text-red-300',
                          !selected && !c.isSunday && 'text-muted-foreground',
                          !selected && c.ymd === today && 'underline underline-offset-4',
                        )}
                      >
                        <span className="text-[9px] leading-none opacity-80">{c.weekday}</span>
                        <span className="text-[11px] tabular-nums">{c.day}</span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {monthRows.map(({ row, byDay }) => (
                <tr key={row.group.key} className="border-b border-border/50 last:border-0">
                  <td className="sticky left-0 z-10 max-w-[260px] bg-card px-3 py-1.5 align-middle">
                    <span className="block truncate text-[11px] font-bold text-foreground">
                      {row.group.name}
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {row.group.unitName || row.group.phone}
                    </span>
                  </td>
                  {cols.map((c) => {
                    const rounds = byDay.get(c.ymd);
                    const selected = selectedYmd === c.ymd;
                    return (
                      <td
                        key={c.ymd}
                        className={cn(
                          'p-0.5 text-center align-middle',
                          c.isSunday && 'bg-secondary/40',
                          selected && 'bg-primary/10',
                        )}
                      >
                        {rounds ? (
                          <button
                            type="button"
                            onClick={() => onOpenCell(row, c.ymd, rounds)}
                            title={cellTitle(row.group.name, c.ymd, rounds)}
                            className="flex w-full flex-col items-stretch gap-0.5"
                          >
                            {/* โชว์เวลาจริง ไม่ใช่จุดสีลอย ๆ — เจ้าของอยากเห็น "เวลาไหนบ้าง" */}
                            {rounds.slice(0, 2).map((r) => (
                              <span
                                key={r.entry.id}
                                className={cn(
                                  'block rounded px-0.5 py-0.5 leading-tight',
                                  CELL_TONE[r.state],
                                  /* 🔴 ยกเลิกแล้วต้องยังเห็น — แต่ต้องดูออกทันทีว่าไม่ใช่สายที่จะเกิดขึ้น
                                     (Lumos โชว์ว่ายกเลิก จอเราซ่อนไว้ = สองระบบเล่าคนละเรื่อง) */
                                  r.state === 'cancelled' && 'opacity-60',
                                )}
                              >
                                <span
                                  className={cn(
                                    'block text-[9px] font-bold tabular-nums',
                                    r.state === 'cancelled' && 'line-through',
                                  )}
                                >
                                  {r.time ?? '—'}
                                </span>
                                {/* 🔴 ผลต้องอ่านได้จากในช่องเลย (เจ้าของทัก 1 ก.ย. 2569:
                                    *"ทำไมไม่มีบอกผลด้วยเลยอะว่าผลเป็นยังไง"*)
                                    เดิมมีแต่เวลากับสี ⇒ ต้องกดเข้าไปดูถึงจะรู้ว่าคุยจบยังไง */}
                                <span className="block truncate text-[8px] font-medium leading-tight">
                                  {roundResultLabel(r)}
                                </span>
                              </span>
                            ))}
                            {rounds.length > 2 ? (
                              <span className="text-[9px] font-semibold text-primary">
                                +{rounds.length - 2}
                              </span>
                            ) : null}
                          </button>
                        ) : (
                          <div className="mx-auto h-4 w-full rounded bg-secondary/25" aria-hidden />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default FollowPlanningCalendar;
