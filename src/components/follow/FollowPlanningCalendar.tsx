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
  filterPlanningRowsByRound,
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
import { Rule2, Sheet2, SheetHead2, Stat2, StatRow2 } from '@/components/shared/ui-v2/Sheet2';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * ═══ ปฏิทินติดตาม — สองหน้าในผืนเดียว (เจ้าของสั่ง 7 ก.ย. 2569 · ฉบับที่ 2) ═══
 *
 * ฉบับแรก (แท็บ "ต้องลงมือ/สรุปทั้งเดือน" + ลิสต์) เจ้าของสั่งย้อนออกเพราะ *"ไม่สวย"*
 * ฉบับนี้ทำตามสเปกที่เจ้าของเขียนเองทีละข้อ:
 *
 * **หน้ารายวัน — "สายที่ต้องตาม"**
 *   1. บอกว่ามีกี่สายที่ต้องตาม (แถวตัวเลข)
 *   2. แยกผลของทุกสาย · กรองได้ว่าดูสายที่ 1/2/3 (ชิปกรอง)
 *   3. สายไหนจบแล้วเอาผลมาบอกเลย · สี = ความหมาย (เขียว ไป · เหลือง ยังไม่รู้ผล · แดง ไม่ไป)
 *   4. บอกว่าเขาตอบว่ายังไง (สรุปจาก AI ใต้ชื่อ)
 *   5. เลือกวันจากปฏิทินได้ (ตัวเลือกวันเดียวกับตัวกรองของหน้า — ห้ามมีสองตัว)
 *
 * **หน้ารายเดือน — "ภาพรวม"**
 *   1. แถวละคน: ทั้งเดือนติดตามกี่ครั้ง · ไปกี่ · ไม่ไปกี่ · ยังไม่รู้ผลกี่ · แล้วช่องวันบอกว่าวันไหนเป็นอะไร
 *   2. เลือกวัน/เดือนจากปฏิทินตัวเดียวกัน
 *
 * 🔴 ภาษาเดียวกับหน้าอื่นของโฉมใหม่: ผืนขาวใบเดียว คั่นด้วยเส้นบาง · เลขใหญ่ tabular · สีเน้นเดียว
 * 🔴 เลขทุกตัวมาจาก `callCategory` ชุดเดียว (followPlanning.ts) — หน้ารายวันกับสีหน้ารายเดือน
 *    จึงเล่าเรื่องเดียวกันเสมอ
 * 🔴 ตัวกรองวันใช้ช่องเดียวกับแผงตัวกรอง (`fDate`) — เลือกวันที่นี่ ลิสต์ข้างล่างกรองตามด้วย
 *
 * 🔴 **คำบนจอยืมจากแผง "การโทรของงาน Follow" ข้างบน** (แก้ 8 ก.ย. 2569 หลังผู้ทดสอบตาใหม่
 * ให้ 6/10 แล้วถามว่า *"โทรไม่ติด กับ ติดต่อไม่ได้ คือเรื่องเดียวกันไหม"*) — ห้ามประดิษฐ์
 * ศัพท์ชุดใหม่ที่นี่อีก มีด่านเทสต์คุมใน `tests/api/followPlanning.test.ts`
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
 * แดงคือไม่ไป"*) แต่เปลี่ยนคำให้ตรงกับแผงข้างบนแล้ว (8 ก.ย. 2569 — ดู
 * `FOLLOW_CALL_CATEGORY_LABEL`) · หน้ารายวันใช้ชุดสั้น หน้ารายเดือนใช้ชุดเต็ม
 * เพราะช่องวันมีสีครบทุกแบบ
 */
const DAY_LEGEND: ReadonlyArray<[keyof typeof TONE, string]> = [
  ['success', 'เขียว = ไป'],
  ['danger', 'แดง = ไม่ไป'],
  ['warn', 'เหลือง = ยังไม่รู้ผล (โทรไม่ติด · เลยเวลานัด)'],
  ['primary', 'น้ำเงิน = รอโทร'],
  ['orange', 'ส้ม = ไม่ได้ส่งให้ AI'],
  ['neutral', 'เทา = ยกเลิก (ขีดฆ่า)'],
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
   * รอบที่เลือกอยู่ — **ตัวเลือกรอบมีที่เดียวทั้งหน้า** อยู่ใน `roundsSlot`
   * (รวมแผง "การโทรของงาน Follow" เข้ามาเป็นการ์ดเดียว 8 ก.ย. 2569)
   */
  roundFilter: FollowRoundFilter;
  /** แผงรอบโทร + 7 กล่องสถานะสาย ที่ฝังอยู่ในผืนเดียวกัน */
  roundsSlot?: React.ReactNode;
  /** ปุ่มของหน้าแม่ (เพิ่มคน · ตัวกรอง · เพิ่มเรื่อง/เจ้าหน้าที่ · รีเฟรช) */
  headerAction?: React.ReactNode;
}> = ({
  rows,
  month,
  onMonthChange,
  selectedYmd,
  onSelect,
  onOpenCell,
  roundFilter,
  roundsSlot,
  headerAction,
}) => {
  const [view, setView] = useState<View>('day');
  const today = toYmdBangkok(new Date());
  const dayYmd = selectedYmd || today;

  /* ─── หน้ารายวัน ─── */
  const dayCalls = useMemo(() => buildFollowDayCalls(rows, dayYmd, roundFilter), [rows, dayYmd, roundFilter]);
  const daySlots = useMemo(() => roundSlotsOfDay(rows, dayYmd), [rows, dayYmd]);
  const daySummary = useMemo(() => summarizeFollowCalls(dayCalls.map((c) => c.round)), [dayCalls]);

  /* ─── หน้ารายเดือน ─── */
  /** 🔴 กรองรอบเหมือนหน้ารายวัน — เลือก "สายที่ 2" แล้วทั้งการ์ดต้องพูดเรื่องรอบนั้นเรื่องเดียว */
  const monthSource = useMemo(
    () => (roundFilter === 'all' ? rows : filterPlanningRowsByRound(rows, roundFilter)),
    [rows, roundFilter],
  );
  const monthRows = useMemo(() => buildFollowMonthRows(monthSource, month), [monthSource, month]);
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
          /* ตัวเลือกวันมาจากหน้าแม่ (ตัวเดียวกับตัวกรองของลิสต์ — ห้ามมีสองตัวในหน้าเดียว) */
          headerAction
        }
      />

      {/* แผงรอบโทร + 7 กล่องสถานะสาย — เดิมเป็นการ์ดแยกข้างบน (รวมเข้ามา 8 ก.ย. 2569) */}
      {roundsSlot ? (
        <>
          <Rule2 />
          {roundsSlot}
        </>
      ) : null}

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
          {/**
           * 1. มีกี่สายที่ต้องตาม — **4 ช่อง ตอบสามคำถามพอ** (แก้ 8 ก.ย. 2569)
           * เดิม 6 ช่อง (ตกลง · ติดต่อไม่ได้ · ไม่ไป · รอผล · เลยเวลา) ผู้ทดสอบตาใหม่อ่านแล้ว
           * ไม่รู้ว่าช่องไหนต่างกับช่องไหน — เหตุผลว่า "ทำไมยังไม่รู้ผล" ย้ายไปอยู่บนชิปของแต่ละแถว
           * ซึ่งเป็นที่ที่ต้องลงมือจริง
           */}
          <StatRow2>
            <Stat2 value={daySummary.total} label="สายที่ต้องตาม" hint="ทุกสายของวันนี้ ไม่นับที่ยกเลิก" />
            <Stat2 value={daySummary.went} label="ไป" valueClassName={statTone('agreed')} hint="รู้แล้วว่าไป" />
            <Stat2 value={daySummary.notWent} label="ไม่ไป" valueClassName={statTone('lost')} hint="รู้แล้วว่าไม่ไป" />
            <Stat2
              value={daySummary.unknown}
              label="ยังไม่รู้ผล"
              valueClassName={statTone('overdue')}
              hint="โทรไม่ติด · รอโทร · เลยเวลานัด · ไม่ได้ส่งให้ AI"
            />
          </StatRow2>

          {/**
           * ป้ายอธิบายสี — **หน้ารายวันก็ต้องมี** (ผู้ทดสอบตาใหม่ 8 ก.ย. 2569 ขอเพิ่ม:
           * เดิมมีแต่หน้ารายเดือน คนอ่านสีบนแถวไม่ออกว่าแปลว่าอะไร)
           */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/70 px-6 py-2 text-[11px] text-muted-foreground lg:px-8">
            {DAY_LEGEND.map(([tone, label]) => (
              <span key={tone} className="flex items-center gap-1.5">
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-sm', TONE[tone].dot)} aria-hidden />
                {label}
              </span>
            ))}
          </div>
          <Rule2 />

          {daySummary.notSent > 0 || (roundFilter !== 'all' && !daySlots.includes(roundFilter)) ? (
            <div className="flex flex-wrap items-center gap-2 px-6 py-3 lg:px-8">
              {roundFilter !== 'all' && !daySlots.includes(roundFilter) ? (
                <span className="text-[11px] text-muted-foreground">
                  วันนี้ไม่มี{roundTabLabel(roundFilter)} — กด "ทุกสาย" ข้างบนเพื่อดูสายอื่น
                </span>
              ) : null}
              {daySummary.notSent > 0 ? (
                <span className={cn('ml-auto rounded-full px-2.5 py-1 text-[11px] font-semibold', TONE.orange.chip)}>
                  {daySummary.notSent} สายไม่ได้ส่งให้ AI — ต้องคนจัดการ
                </span>
              ) : null}
            </div>
          ) : null}
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
                          {/* 🔴 คำเดียวกับตัวเลือกรอบข้างบน (`roundTabLabel`) — เคยเขียน "สายที่ N"
                              ที่นี่ แต่ตัวเลือกเขียน "รอบโทรที่ N" ⇒ จอเดียวสองคำอีกแล้ว */}
                          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {slot ? roundTabLabel(slot) : 'ยังไม่อยู่รอบไหน'}
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
                        ) : round.state === 'notSent' &&
                          !roundDispatchReason(round).startsWith(FOLLOW_CALL_CATEGORY_LABEL.notSent) ? (
                          /* เหตุผลว่าทำไมไม่ได้ส่ง — ข้ามถ้าซ้ำคำกับชิป (ค่าปริยายคือ "ไม่ได้ส่งให้ AI โทร") */
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
            {DAY_LEGEND.map(([tone, label]) => (
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
                    /**
                     * 🔴 สรุปใต้ชื่อเหลือ **สามคำตอบ** (แก้ 8 ก.ย. 2569) — เดิมไล่ทุกหมวด
                     * ได้บรรทัดอย่าง *"2 ครั้ง · เลยเวลา ยังไม่มีผล 2"* ที่ผู้ทดสอบตาใหม่
                     * อ่านแล้วไม่รู้ว่าคืออะไร · หมวดละเอียดยังอยู่บนชิปของช่องวันเหมือนเดิม
                     */
                    const parts: Array<[FollowCallCategory, number]> = (
                      [
                        ['agreed', s.went],
                        ['lost', s.notWent],
                        ['overdue', s.unknown],
                      ] as Array<[FollowCallCategory, number]>
                    ).filter(([, n]) => n > 0);
                    return (
                      <tr key={row.group.key} className="border-b border-border/50 last:border-0">
                        <td className="sticky left-0 z-10 max-w-[260px] bg-card px-6 py-2 align-top lg:px-8">
                          <span className="block truncate text-[12px] font-semibold text-foreground">{row.group.name}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {row.group.unitName || row.group.phone}
                          </span>
                          {/* 1. ทั้งเดือนติดตามกี่ครั้ง · ไป / ไม่ไป / ยังไม่รู้ผล — สีเดียวกับช่องวัน */}
                          <span className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[10px]">
                            <span className="font-semibold tabular-nums text-foreground">{s.total} ครั้ง</span>
                            {parts.map(([c, n]) => (
                              <span key={c} className={cn('font-medium', statTone(c))}>
                                {c === 'overdue' ? 'ยังไม่รู้ผล' : FOLLOW_CALL_CATEGORY_LABEL[c]} {n}
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
