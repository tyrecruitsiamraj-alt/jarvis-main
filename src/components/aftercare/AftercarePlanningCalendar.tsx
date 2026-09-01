import React, { useEffect, useMemo, useRef } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { shiftMonth } from '@/lib/followCallCalendar';
import { toYmdBangkok, THAI_MONTHS, ceToBeYear, formatYmdDmyBe } from '@/lib/dateTh';
import { monthDayColumns, roundResultLabel, roundTone } from '@/lib/followPlanning';
import {
  buildAftercareMonthRows,
  type AftercareCell,
  type AftercareMonthRow,
} from '@/lib/aftercarePlanning';
import type { AftercarePerson } from '@/lib/aftercareApi';
import type { FollowEntry } from '@/lib/followApi';

/**
 * ═══ ปฏิทิน Planning ของหน้า "ดูแลหลังเริ่มงาน" (เจ้าของสั่ง 1 ก.ย. 2569) ═══
 *
 * > *"ขอเป็นภาพแบบ Planning ให้เห็นว่าแต่ละวันต้องโทรหาใครอะไรยังไงบ้าง"*
 *
 * รูปเดียวกับปฏิทินหน้าติดตาม: แถว = คน (ชื่อตรึงซ้าย) · คอลัมน์ = วันของเดือน
 * 🔴 **ช่องแยกสองชั้นเสมอ** — "ถึงกำหนดโทร" (คำนวณจากวันเริ่มงาน) กับ
 * "สายจริงที่ตั้งไว้/โทรแล้ว" คนละเรื่องกัน · ถึงกำหนดแล้วไม่ได้แปลว่าโทรแล้ว
 */

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  const name = THAI_MONTHS.find((x) => x.value === Number(m))?.label ?? m;
  return `${name} ${ceToBeYear(Number(y))}`;
}

/** ข้อความตอนเอาเมาส์จ่อ — ช่องแคบ คำเต็มต้องมีที่อยู่ */
function cellTitle(name: string, ymd: string, cell: AftercareCell): string {
  const parts: string[] = [];
  if (cell.round) {
    parts.push(`ถึงกำหนดโทร: ${cell.round.label}${cell.round.overdue ? ' (เลยกำหนด)' : ''}`);
  }
  for (const c of cell.calls) parts.push(`${c.time ?? 'ไม่ได้ตั้งเวลา'} — ${roundResultLabel(c)}`);
  if (cell.calls.length === 0) parts.push('ยังไม่ได้ตั้งสายของวันนี้');
  return `${name} · ${formatYmdDmyBe(ymd)} — ${parts.join(' · ')}`;
}

const AftercarePlanningCalendar: React.FC<{
  people: readonly AftercarePerson[];
  /** รายการติดตามหัวข้อ "ถามความเป็นอยู่ฯ" — หน้าเรียกกรองมาให้แล้ว */
  calls: readonly FollowEntry[];
  month: string;
  onMonthChange: (monthKey: string) => void;
  /** กดช่อง = พาไปตั้ง/ดูสายของคนนั้น */
  onOpenCell?: (row: AftercareMonthRow, ymd: string, cell: AftercareCell) => void;
  missingStartDate?: number;
}> = ({ people, calls, month, onMonthChange, onOpenCell, missingStartDate = 0 }) => {
  const rows = useMemo(() => buildAftercareMonthRows(people, calls, month), [people, calls, month]);
  const cols = useMemo(() => monthDayColumns(month), [month]);
  const today = toYmdBangkok(new Date());
  const scrollRef = useRef<HTMLDivElement | null>(null);

  /** เดือนหนึ่ง 30 คอลัมน์ — เปิดมาเจอต้นเดือนว่าง ๆ แล้วนึกว่าไม่มีงาน จึงเลื่อนไปวันนี้ให้ */
  const focusYmd = useMemo(() => {
    if (today.slice(0, 7) === month) return today;
    const all = rows.flatMap((r) => [...r.byDay.keys()]).sort();
    return all[0] ?? '';
  }, [today, month, rows]);

  useEffect(() => {
    const box = scrollRef.current;
    if (!box || !focusYmd) return;
    const cell = box.querySelector<HTMLElement>(`[data-ymd="${focusYmd}"]`);
    if (cell) box.scrollLeft = Math.max(0, cell.offsetLeft - 220);
  }, [focusYmd]);

  return (
    <div className="glass-card rounded-2xl border border-white/70 p-3 dark:border-slate-700/70">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="text-sm font-bold text-foreground">ปฏิทินดูแลหลังเริ่มงาน</span>
        <span className="text-[11px] text-muted-foreground">
          แถว = คน · คอลัมน์ = วัน · ช่องบอกว่าวันนั้นถึงกำหนดโทรรอบไหน และตั้งสายไว้หรือยัง
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
            onClick={() => onMonthChange(today.slice(0, 7))}
            className={cn(
              'ml-1 inline-flex h-8 items-center rounded-full border px-3 text-[11px] font-semibold',
              TONE.info.outline,
            )}
          >
            เดือนนี้
          </button>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {(
          [
            ['warn', 'ถึงกำหนดแล้ว ยังไม่ได้ตั้งสาย'],
            ['neutral', 'ถึงกำหนดวันข้างหน้า'],
            ['primary', 'ตั้งสายไว้แล้ว รอผล'],
            ['success', 'โทรแล้ว ได้ผล'],
          ] as const
        ).map(([tone, label]) => (
          <span key={tone} className="inline-flex items-center gap-1">
            <span className={cn('h-2.5 w-2.5 rounded-sm', TONE[tone].dot)} aria-hidden />
            {label}
          </span>
        ))}
        {missingStartDate > 0 ? (
          <span className={cn('rounded-full px-2 py-0.5 font-semibold', TONE.warn.chip)}>
            ยังไม่รู้วันเริ่มงาน {missingStartDate} คน — ขึ้นปฏิทินไม่ได้จนกรอกวัน
          </span>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className={cn('rounded-xl border px-3 py-4 text-center text-xs text-muted-foreground', TONE.neutral.soft)}>
          เดือนนี้ไม่มีใครถึงกำหนดโทรเลย
        </p>
      ) : (
        <div ref={scrollRef} className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border">
                {/* ชื่อคนตรึงซ้าย — เลื่อนดูวันท้ายเดือนแล้วต้องยังรู้ว่าแถวนี้ใคร */}
                <th className="sticky left-0 z-10 min-w-[190px] max-w-[260px] bg-card px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">
                  คนที่ดูแลอยู่
                </th>
                {cols.map((c) => (
                  <th
                    key={c.ymd}
                    data-ymd={c.ymd}
                    className={cn('p-0.5 text-center', c.isSunday && 'bg-secondary/40')}
                  >
                    <span
                      className={cn(
                        'flex min-w-[64px] flex-col items-center rounded-lg px-1 py-1 font-medium',
                        c.isSunday ? 'text-rose-800 dark:text-red-300' : 'text-muted-foreground',
                        c.ymd === today && 'underline underline-offset-4',
                      )}
                    >
                      <span className="text-[9px] leading-none opacity-80">{c.weekday}</span>
                      <span className="text-[11px] tabular-nums">{c.day}</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.person.phone_e164} className="border-b border-border/50 last:border-0">
                  <td className="sticky left-0 z-10 max-w-[260px] bg-card px-3 py-1.5 align-middle">
                    <span className="block truncate text-[11px] font-bold text-foreground">
                      {row.person.full_name}
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {row.person.start_date
                        ? `เริ่มงาน ${formatYmdDmyBe(row.person.start_date)}`
                        : 'ยังไม่รู้วันเริ่มงาน'}
                    </span>
                  </td>
                  {cols.map((c) => {
                    const cell = row.byDay.get(c.ymd);
                    return (
                      <td
                        key={c.ymd}
                        className={cn('p-0.5 text-center align-middle', c.isSunday && 'bg-secondary/40')}
                      >
                        {cell ? (
                          <button
                            type="button"
                            onClick={() => onOpenCell?.(row, c.ymd, cell)}
                            title={cellTitle(row.person.full_name, c.ymd, cell)}
                            className="flex w-full flex-col items-stretch gap-0.5"
                          >
                            {/* ชั้นที่ 1 — ถึงกำหนดโทรรอบไหน (ยังไม่ใช่สายจริง) */}
                            {cell.round ? (
                              <span
                                className={cn(
                                  'block rounded px-0.5 py-0.5 text-[9px] font-bold leading-tight',
                                  cell.round.overdue && cell.calls.length === 0
                                    ? TONE.warn.chip
                                    : TONE.neutral.chip,
                                )}
                              >
                                ครบ {cell.round.days} วัน
                              </span>
                            ) : null}
                            {/* ชั้นที่ 2 — สายจริง (เวลา + ผล) ใช้สีชุดเดียวกับหน้าติดตาม */}
                            {cell.calls.slice(0, 2).map((call) => (
                              <span
                                key={call.entry.id}
                                className={cn('block rounded px-0.5 py-0.5 leading-tight', TONE[roundTone(call)].chip)}
                              >
                                <span className="block text-[9px] font-bold tabular-nums">
                                  {call.time ?? '—'}
                                </span>
                                <span className="block truncate text-[8px] font-medium leading-tight">
                                  {roundResultLabel(call)}
                                </span>
                              </span>
                            ))}
                            {cell.calls.length > 2 ? (
                              <span className="text-[9px] font-semibold text-primary">
                                +{cell.calls.length - 2}
                              </span>
                            ) : null}
                            {/* 🔴 ถึงกำหนดแล้วแต่ไม่มีสาย = งานค้าง ต้องเขียนบอก ไม่ใช่ปล่อยว่าง */}
                            {cell.round && cell.calls.length === 0 ? (
                              <span className="block truncate text-[8px] font-medium text-amber-700 dark:text-amber-300">
                                ยังไม่ได้ตั้งสาย
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

export default AftercarePlanningCalendar;
