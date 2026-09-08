import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { shiftMonth } from '@/lib/followCallCalendar';
import { roundTabLabel } from '@/lib/followRoundVisual';
import { toYmdBangkok, THAI_MONTHS, ceToBeYear, formatYmdDmyBe } from '@/lib/dateTh';
import {
  buildFollowDayCalls,
  buildFollowMonthRows,
  callCategory,
  FOLLOW_CALL_CATEGORY_LABEL,
  FOLLOW_CALL_CATEGORY_TONE,
  isGoodResult,
  monthDayColumns,
  personMonthSummary,
  roundAiSummary,
  roundDispatchReason,
  roundEmergencyPhone,
  roundResultLabel,
  roundSlotsOfDay,
  roundTone,
  summarizeFollowCalls,
  type FollowCallCategory,
  type FollowPlanningRound,
  type FollowPlanningRow,
  type FollowRoundFilter,
} from '@/lib/followPlanning';
import { Rule2, Sheet2, SheetHead2, Stat2 } from '@/components/shared/ui-v2/Sheet2';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DayCalendarPicker from '@/components/shared/DayCalendarPicker';

/**
 * ═══ ปฏิทินติดตาม — สองหน้าในผืนเดียว (เจ้าของสั่ง 7 ก.ย. 2569 · ฉบับที่ 2) ═══
 *
 * ฉบับแรก (แท็บ "ต้องลงมือ/สรุปทั้งเดือน" + ลิสต์) เจ้าของสั่งย้อนออกเพราะ *"ไม่สวย"*
 * ฉบับนี้ทำตามสเปกที่เจ้าของเขียนเองทีละข้อ:
 *
 * **หน้ารายวัน — "สายที่ต้องตาม"**
 *   1. บอกว่ามีกี่สายที่ต้องตาม (แถวตัวเลข)
 *   2. แยกผลของทุกสาย · กรองได้ว่าดูสายที่ 1/2/3 (ชิปกรอง)
 *   3. สายไหนจบแล้วเอาผลมาบอกเลย · สี = ความหมาย (เขียวตกลง · เหลืองติดต่อไม่ได้ · แดงไม่ไป)
 *   4. บอกว่าเขาตอบว่ายังไง (สรุปจาก AI ใต้ชื่อ)
 *   5. เลือกวันจากปฏิทินได้ (ตัวเลือกวันเดียวกับตัวกรองของหน้า — ห้ามมีสองตัว)
 *
 * **หน้ารายเดือน — "ภาพรวม"**
 *   1. แถวละคน: ทั้งเดือนติดตามกี่ครั้ง · ไปกี่ · ไม่ไปกี่ · ติดต่อไม่ได้กี่ · แล้วช่องวันบอกว่าวันไหนเป็นอะไร
 *   2. เลือกวัน/เดือนจากปฏิทินตัวเดียวกัน
 *
 * 🔴 ภาษาเดียวกับหน้าอื่นของโฉมใหม่: ผืนขาวใบเดียว คั่นด้วยเส้นบาง · เลขใหญ่ tabular · สีเน้นเดียว
 * 🔴 เลขทุกตัวมาจาก `callCategory` ชุดเดียว (followPlanning.ts) — หน้ารายวันกับสีหน้ารายเดือน
 *    จึงเล่าเรื่องเดียวกันเสมอ
 * 🔴 ตัวกรองวันใช้ช่องเดียวกับแผงตัวกรอง (`fDate`) — เลือกวันที่นี่ ลิสต์ข้างล่างกรองตามด้วย
 */

type View = 'day' | 'month';

/** ชื่อเดือนไทย + ปี พ.ศ. จากคีย์ YYYY-MM */
function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  const name = THAI_MONTHS.find((x) => x.value === Number(m))?.label ?? m;
  return `${name} ${ceToBeYear(Number(y))}`;
}

/** เลื่อนวัน (YYYY-MM-DD) ไป ±n วัน — คิดด้วย UTC ล้วน คีย์เป็นสตริงอยู่แล้ว ไม่แตะเขตเวลาเครื่อง */
function shiftYmd(ymd: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return d.toISOString().slice(0, 10);
}

const THAI_WEEKDAY_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
function dayHeading(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const dow = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
  return `วัน${THAI_WEEKDAY_FULL[dow]}ที่ ${formatYmdDmyBe(ymd)}`;
}

/**
 * ตำหนิ QA รอบสอง (6 ก.ย. 2569): บนมือถือช่องวันเล็ก (~30px) และแยกช่อง "มีนัด/มีผล"
 * จากช่องว่างข้าง ๆ ไม่ออก — ดึงเฉพาะโทนพื้นหลัง (bg-*) จาก TONE.*.soft มาบังคับ
 * เฉพาะจอเล็ก (`max-sm:`) ไม่แตะเดสก์ท็อป ไม่แตะความหมายสี (ยังเป็นโทนกลางเดิม)
 */
function mobileSoftBg(tone: keyof typeof TONE): string {
  return TONE[tone].soft
    .split(' ')
    .filter((cls) => cls.includes('bg-'))
    .map((cls) => `max-sm:${cls}`)
    .join(' ');
}

/** ข้อความบอกช่อง — ตัวเลขลอย ๆ อ่านไม่ออกว่าคืออะไร ต้องมีคำกำกับตอนเอาเมาส์จ่อ */
function cellTitle(name: string, ymd: string, rounds: FollowPlanningRound[]): string {
  const detail = rounds
    .map((r) => {
      const why = r.state === 'notSent' ? ` (${roundDispatchReason(r)})` : '';
      const ai = roundAiSummary(r);
      return `${r.time ?? 'ไม่ได้ตั้งเวลา'} — ${roundResultLabel(r)}${why}${ai ? `\n    เขาตอบ: ${ai}` : ''}`;
    })
    .join('\n');
  return `${name} · ${formatYmdDmyBe(ymd)}\n${detail}\n(กดเพื่อดูรายละเอียดและจัดการรอบนี้)`;
}

/**
 * คำอธิบายสี — **ใช้คำของเจ้าของเอง** (7 ก.ย. 2569: *"เขียวคือตกลง เหลืองติดต่อไม่ได้
 * แดงคือไม่ไป"*) · เหลืองรวม "เลยเวลายังไม่มีผล" ด้วยเพราะเป็นโทนเดียวกันบนชิป —
 * เขียนกำกับไว้ให้ไม่ต้องเดา
 */
const LEGEND: ReadonlyArray<[keyof typeof TONE, string]> = [
  ['success', 'เขียว = ตกลง · ไป'],
  ['warn', 'เหลือง = ติดต่อไม่ได้ / เลยเวลายังไม่มีผล'],
  ['danger', 'แดง = ไม่ไป'],
  ['primary', 'น้ำเงิน = รอผล'],
  ['orange', 'ส้ม = ไม่ได้ส่งให้ AI'],
  ['neutral', 'เทา = ยังไม่ถึงเวลา / ยกเลิก (ขีดฆ่า)'],
];

const NAV_BTN = cn(
  'inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
  TONE.neutral.outline,
);

const FollowPlanningCalendar: React.FC<{
  /** ทุกแถว **ไม่กรองรอบ** — การ์ดนี้มีตัวกรองรอบของตัวเอง */
  rows: readonly FollowPlanningRow[];
  month: string;
  onMonthChange: (monthKey: string) => void;
  /** วันที่เลือกอยู่ (YYYY-MM-DD) — '' = ยังไม่เลือก (หน้ารายวันจะโชว์วันนี้) */
  selectedYmd: string;
  onSelect: (ymd: string) => void;
  /** กดสาย/ช่อง = เปิดป๊อปรายละเอียดของคนนั้นในวันนั้น */
  onOpenCell: (row: FollowPlanningRow, ymd: string, rounds: FollowPlanningRound[]) => void;
  /**
   * รอบที่แผง "การโทรของงาน Follow" เลือกอยู่ — กดแท็บข้างบนเมื่อไหร่ ตัวกรองรอบของ
   * การ์ดนี้ตามไปด้วย (พฤติกรรมที่เจ้าของเคาะ 1 ก.ย. 2569) แต่กดชิปในการ์ดทับได้
   */
  activeRound?: number;
}> = ({ rows, month, onMonthChange, selectedYmd, onSelect, onOpenCell, activeRound }) => {
  const [view, setView] = useState<View>('day');
  const [roundFilter, setRoundFilter] = useState<FollowRoundFilter>('all');
  const today = toYmdBangkok(new Date());
  const dayYmd = selectedYmd || today;

  // ตามแท็บรอบข้างบน **เฉพาะตอนมันเปลี่ยน** — ค่าเริ่มต้นยังเป็น "ทุกสาย"
  const prevActiveRound = useRef(activeRound);
  useEffect(() => {
    if (activeRound !== prevActiveRound.current) {
      prevActiveRound.current = activeRound;
      if (activeRound === 1 || activeRound === 2 || activeRound === 3) setRoundFilter(activeRound);
    }
  }, [activeRound]);

  /* ─── หน้ารายวัน ─── */
  const dayCalls = useMemo(() => buildFollowDayCalls(rows, dayYmd, roundFilter), [rows, dayYmd, roundFilter]);
  const daySlots = useMemo(() => roundSlotsOfDay(rows, dayYmd), [rows, dayYmd]);
  const daySummary = useMemo(() => summarizeFollowCalls(dayCalls.map((c) => c.round)), [dayCalls]);

  /* ─── หน้ารายเดือน ─── */
  const monthRows = useMemo(() => buildFollowMonthRows(rows, month), [rows, month]);
  const cols = useMemo(() => monthDayColumns(month), [month]);
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
    if (view !== 'month') return;
    const box = scrollRef.current;
    if (!box || !focusYmd) return;
    const cell = box.querySelector<HTMLElement>(`[data-ymd="${focusYmd}"]`);
    if (!cell) return;
    box.scrollLeft = Math.max(0, cell.offsetLeft - 220);
  }, [focusYmd, view]);

  const statTone = (c: FollowCallCategory) => TONE[FOLLOW_CALL_CATEGORY_TONE[c]].value;

  return (
    <Sheet2>
      <SheetHead2
        eyebrow="ปฏิทินติดตาม"
        stamp={view === 'day' ? dayHeading(dayYmd) : monthLabel(month)}
        action={
          <DayCalendarPicker
            className="h-8 min-h-0 py-1 text-[11px]"
            value={selectedYmd}
            onChange={onSelect}
            emptyLabel="เลือกวัน"
          />
        }
      />

      {/* แถวควบคุม: สวิตช์สองหน้า (ซ้าย) · เลื่อนวัน/เดือน (ขวา) */}
      <div className="flex flex-wrap items-center gap-2 px-6 pb-4 pt-3 lg:px-8">
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList className="h-9 rounded-full bg-muted p-1">
            <TabsTrigger value="day" className="rounded-full px-4 text-xs">
              รายวัน · สายที่ต้องตาม
            </TabsTrigger>
            <TabsTrigger value="month" className="rounded-full px-4 text-xs">
              รายเดือน · ภาพรวม
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="flex-1" />
        {view === 'day' ? (
          <div className="flex items-center gap-1">
            <button type="button" aria-label="วันก่อนหน้า" className={NAV_BTN} onClick={() => onSelect(shiftYmd(dayYmd, -1))}>
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => onSelect(today)}
              disabled={dayYmd === today}
              className={cn(
                'inline-flex h-8 items-center rounded-full border px-3 text-[11px] font-semibold disabled:opacity-50',
                TONE.neutral.outline,
              )}
            >
              วันนี้
            </button>
            <button type="button" aria-label="วันถัดไป" className={NAV_BTN} onClick={() => onSelect(shiftYmd(dayYmd, 1))}>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button type="button" aria-label="เดือนก่อนหน้า" className={NAV_BTN} onClick={() => onMonthChange(shiftMonth(month, -1))}>
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => onMonthChange(today.slice(0, 7))}
              disabled={month === today.slice(0, 7)}
              className={cn(
                'inline-flex h-8 items-center rounded-full border px-3 text-[11px] font-semibold disabled:opacity-50',
                TONE.neutral.outline,
              )}
            >
              เดือนนี้
            </button>
            <button type="button" aria-label="เดือนถัดไป" className={NAV_BTN} onClick={() => onMonthChange(shiftMonth(month, 1))}>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}
      </div>

      {view === 'day' ? (
        <>
          {/* 1. มีกี่สายที่ต้องตาม — แถวตัวเลขมาตรฐานของโฉมใหม่ */}
          {/* 6 ช่องบนจอใหญ่ · 3×2 บนจอเล็ก — เขียนกริดเองแทน StatRow2 ที่ล็อกเส้นคั่นไว้สำหรับ 4 ช่อง */}
          <div
            className={cn(
              'grid grid-cols-3 border-t border-border/70 lg:grid-cols-6',
              '[&>*]:border-border/50 [&>*:not(:first-child)]:border-l',
              'max-lg:[&>*:nth-child(4)]:border-l-0 max-lg:[&>*:nth-child(-n+3)]:border-b',
            )}
          >
            <Stat2 value={daySummary.total} label="สายที่ต้องตาม" hint="ทุกสายของวันนี้ ไม่นับที่ยกเลิก" />
            <Stat2 value={daySummary.agreed} label={FOLLOW_CALL_CATEGORY_LABEL.agreed} valueClassName={statTone('agreed')} />
            <Stat2 value={daySummary.unreachable} label={FOLLOW_CALL_CATEGORY_LABEL.unreachable} valueClassName={statTone('unreachable')} />
            <Stat2 value={daySummary.lost} label={FOLLOW_CALL_CATEGORY_LABEL.lost} valueClassName={statTone('lost')} />
            <Stat2 value={daySummary.waiting} label={FOLLOW_CALL_CATEGORY_LABEL.waiting} valueClassName={statTone('waiting')} />
            <Stat2
              value={daySummary.overdue}
              label={FOLLOW_CALL_CATEGORY_LABEL.overdue}
              valueClassName={statTone('overdue')}
              hint={daySummary.overdue > 0 ? 'มีคนรอสายอยู่ — ต้องตามผล' : undefined}
            />
          </div>
          <Rule2 />

          {/* 2. แยกตามสาย — ชิปกรองเฉพาะสายที่มีจริงในวันนี้ */}
          <div className="flex flex-wrap items-center gap-2 px-6 py-3 lg:px-8">
            <span className="text-[12px] text-muted-foreground">ดูเฉพาะ</span>
            {(['all', ...daySlots] as FollowRoundFilter[]).map((f) => {
              const active = roundFilter === f;
              const label = f === 'all' ? 'ทุกสาย' : `สายที่ ${f}`;
              return (
                <button
                  key={String(f)}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRoundFilter(f)}
                  className={cn(
                    'inline-flex h-7 items-center rounded-full border px-3 text-[11px] font-semibold transition-colors',
                    active ? 'border-primary bg-primary text-primary-foreground' : TONE.neutral.outline,
                  )}
                >
                  {label}
                </button>
              );
            })}
            {roundFilter !== 'all' && !daySlots.includes(roundFilter) ? (
              <span className="text-[11px] text-muted-foreground">
                วันนี้ไม่มี{roundTabLabel(roundFilter)} — กด "ทุกสาย" เพื่อดูสายอื่น
              </span>
            ) : null}
            {daySummary.notSent > 0 ? (
              <span className={cn('ml-auto rounded-full px-2.5 py-1 text-[11px] font-semibold', TONE.orange.chip)}>
                {daySummary.notSent} สายไม่ได้ส่งให้ AI — ต้องคนจัดการ
              </span>
            ) : null}
          </div>
          <Rule2 />

          {/* 3-4. รายการทีละสาย: ผลสีตามความหมาย + เขาตอบว่าอะไร */}
          {dayCalls.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground lg:px-8">
              {dayYmd === today ? 'วันนี้' : 'วันนี้ที่เลือก'}ไม่มีสายที่ต้องตาม
              {roundFilter !== 'all' ? ` ใน${roundTabLabel(roundFilter)}` : ''} —
              เลื่อนดูวันอื่นด้วยลูกศร หรือกดปฏิทินเลือกวัน
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {dayCalls.map(({ row, round, slot, category }) => {
                const ai = roundAiSummary(round);
                const emg = roundEmergencyPhone(round);
                const tone = roundTone(round);
                const cancelled = round.state === 'cancelled';
                return (
                  <li
                    key={round.entry.id}
                    data-category={category}
                    className={cn(
                      /* 🔴 "ไม่ไป" ทาแดงอ่อนทั้งแถว — เปิดมาต้องรู้เลยว่าแถวนี้แหละไม่ไป
                         (เจ้าของสั่ง 8 ก.ย. 2569) · `wash` = พื้นย้อมโทนจาง ๆ ของ designTokens
                         (ไม่ใช่ `soft` ที่เป็นกระดาษเทา — อันนั้นบอกความหมายด้วยขอบ ไม่ใช่พื้น) */
                      'transition-colors',
                      category === 'lost' ? TONE.danger.wash : 'hover:bg-secondary/50',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenCell(row, round.ymd ?? dayYmd, [round])}
                      className={cn(
                        'grid w-full grid-cols-[56px_1fr] gap-x-3 px-6 py-3 text-left lg:grid-cols-[64px_1fr] lg:px-8',
                        cancelled && 'opacity-60',
                      )}
                      title="กดเพื่อดูรายละเอียดและจัดการสายนี้"
                    >
                      {/* เวลา — ตัวใหญ่ tabular เป็นจุดยึดสายตาของแถว */}
                      <span className={cn('text-[18px] font-semibold leading-none tabular-nums text-foreground', cancelled && 'line-through')}>
                        {round.time ?? '—'}
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-[13px] font-semibold text-foreground">{row.group.name}</span>
                          {row.group.unitName ? (
                            <span className="text-[12px] text-muted-foreground">{row.group.unitName}</span>
                          ) : null}
                          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            สายที่ {slot ?? '—'}
                          </span>
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                              TONE[tone].chip,
                            )}
                          >
                            {isGoodResult(round) ? <Check className="h-3 w-3" aria-hidden /> : null}
                            {FOLLOW_CALL_CATEGORY_LABEL[category]}
                            {/* ต่อท้ายรายละเอียดเฉพาะที่ **เพิ่มข้อมูล**: ติดต่อไม่ได้เพราะอะไร ·
                                "รับสายแล้ว" อ่อนกว่า "ยืนยันว่าไป" ต้องบอก · ที่เหลือซ้ำคำ ไม่ต่อ */}
                            {round.state === 'result' &&
                            (category === 'unreachable' || round.entry.call_outcome === 'acknowledged')
                              ? ` — ${roundResultLabel(round)}`
                              : ''}
                          </span>
                        </span>
                        {/* เขาตอบว่ายังไง — สรุปที่ AI เขียนกลับมา · ไม่มีก็บอกตรง ๆ */}
                        {ai ? (
                          <span className="mt-1 block text-[12px] leading-snug text-foreground/80">
                            <span className="text-muted-foreground">เขาตอบ: </span>
                            {ai}
                          </span>
                        ) : round.state === 'result' ? (
                          <span className="mt-1 block text-[12px] text-muted-foreground">(ไม่มีสรุปจาก AI)</span>
                        ) : round.state === 'notSent' ? (
                          <span className="mt-1 block text-[12px] text-muted-foreground">{roundDispatchReason(round)}</span>
                        ) : null}
                        {/* เบอร์ฉุกเฉิน — พูดได้แค่ "แนบไปแล้ว" (Lumos ไม่ส่งกลับว่าโทรหรือยัง) */}
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {emg ? (
                            <>
                              ฉุกเฉิน {emg}
                              {round.state === 'result' ? ' · ยังไม่รู้ว่าโทรหรือยัง' : ''}
                            </>
                          ) : (
                            <span className={cn('rounded px-1 py-0.5 font-medium', TONE.warn.chip)}>ไม่ได้แนบเบอร์ฉุกเฉิน</span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <>
          {/* คำอธิบายสี — บรรทัดเดียว คำของเจ้าของเอง */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3 text-[11px] text-muted-foreground lg:px-8">
            {LEGEND.map(([tone, label]) => (
              <span key={tone} className="flex items-center gap-1.5">
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-sm', TONE[tone].dot)} aria-hidden />
                {label}
              </span>
            ))}
          </div>
          <Rule2 />

          {monthRows.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground lg:px-8">
              เดือนนี้ไม่มีนัดโทรของใครเลย
            </p>
          ) : (
            <div ref={scrollRef} className="overflow-x-auto">
              <table className="min-w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border/70">
                    {/**
                     * ชื่อ + สรุปทั้งเดือนอยู่ **คอลัมน์เดียวที่ตรึงไว้** — ตารางเลื่อนไปหาวันนี้เอง
                     * ถ้าสรุปเป็นคอลัมน์แยก มันจะถูกเลื่อนหลุดจอไปพร้อมวันต้นเดือน (เจอตอนดูจอจริง)
                     */}
                    <th className="sticky left-0 z-10 min-w-[210px] max-w-[260px] bg-card px-6 py-2 text-left text-[11px] font-medium text-muted-foreground lg:px-8">
                      คนที่ต้องติดตาม · ทั้งเดือนนี้
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
                              'flex min-h-10 min-w-[52px] flex-col items-center justify-center rounded-lg px-1 py-1 font-medium transition-colors hover:bg-secondary sm:min-h-0',
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
                  {monthRows.map(({ row, byDay }) => {
                    const s = personMonthSummary(row, month);
                    const parts: Array<[FollowCallCategory, number]> = (
                      ['agreed', 'lost', 'unreachable', 'overdue', 'waiting', 'notSent'] as FollowCallCategory[]
                    )
                      .map((c) => [c, s[c]] as [FollowCallCategory, number])
                      .filter(([, n]) => n > 0);
                    return (
                      <tr key={row.group.key} className="border-b border-border/50 last:border-0">
                        <td className="sticky left-0 z-10 max-w-[260px] bg-card px-6 py-2 align-top lg:px-8">
                          <span className="block truncate text-[12px] font-semibold text-foreground">{row.group.name}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {row.group.unitName || row.group.phone}
                          </span>
                          {/* 1. ทั้งเดือนติดตามกี่ครั้ง · ไป/ไม่ไป/ติดต่อไม่ได้ — สีเดียวกับช่องวัน */}
                          <span className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[10px]">
                            <span className="font-semibold tabular-nums text-foreground">{s.total} ครั้ง</span>
                            {parts.map(([c, n]) => (
                              <span key={c} className={cn('font-medium', statTone(c))}>
                                {FOLLOW_CALL_CATEGORY_LABEL[c]} {n}
                              </span>
                            ))}
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
                                rounds && rounds[0] && mobileSoftBg(roundTone(rounds[0])),
                              )}
                            >
                              {rounds ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenCell(row, c.ymd, rounds)}
                                  title={cellTitle(row.group.name, c.ymd, rounds)}
                                  className="flex min-h-10 w-full flex-col items-stretch justify-center gap-0.5 sm:min-h-0"
                                >
                                  {/* ช่องละ 1 สาย (เจ้าของสั่ง 1 ก.ย. 2569) — เกินนั้นบอกเป็น +N ไม่ตัดเงียบ */}
                                  {rounds.slice(0, 1).map((r) => (
                                    <span
                                      key={r.entry.id}
                                      className={cn(
                                        'block rounded px-0.5 py-0.5 leading-tight',
                                        TONE[roundTone(r)].chip,
                                        r.state === 'cancelled' && 'opacity-60',
                                      )}
                                    >
                                      <span className={cn('block text-[10px] font-bold tabular-nums', r.state === 'cancelled' && 'line-through')}>
                                        {r.time ?? '—'}
                                      </span>
                                      {/* คำสั้นของหมวด — ช่องแคบ คำยาว ("ยกเลิก — ไม่ไปแล้ว") อ่านไม่ออก · คำเต็มอยู่ที่ tooltip */}
                                      <span className="block truncate text-[9px] font-medium leading-tight">
                                        {FOLLOW_CALL_CATEGORY_LABEL[callCategory(r)]}
                                      </span>
                                    </span>
                                  ))}
                                  {rounds.length > 1 ? (
                                    <span className="text-[9px] font-semibold text-primary">+{rounds.length - 1}</span>
                                  ) : null}
                                </button>
                              ) : (
                                <div className="mx-auto h-4 w-full rounded bg-secondary/25" aria-hidden="true" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Sheet2>
  );
};

export default FollowPlanningCalendar;
