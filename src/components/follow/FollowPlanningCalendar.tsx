import React, { useEffect, useMemo, useRef } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { shiftMonth } from '@/lib/followCallCalendar';
import { roundTabLabel } from '@/lib/followRoundVisual';
import { followRoundSlot } from '@/lib/followRoundBuckets';
import { toYmdBangkok, THAI_MONTHS, ceToBeYear, formatYmdDmyBe } from '@/lib/dateTh';
import {
  buildFollowActionRows,
  buildFollowMonthRows,
  followActionSummary,
  isGoodResult,
  monthDayColumns,
  roundAiSummary,
  roundDispatchReason,
  roundEmergencyPhone,
  roundResultLabel,
  roundTone,
  type FollowPlanningRound,
  type FollowPlanningRow,
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

/** ชื่อเดือนไทย + ปี พ.ศ. จากคีย์ YYYY-MM */
function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  const name = THAI_MONTHS.find((x) => x.value === Number(m))?.label ?? m;
  return `${name} ${ceToBeYear(Number(y))}`;
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
      // สรุปของ AI ต่อท้ายสายที่มี — hover อ่านได้เต็มโดยไม่ต้องเปิดป๊อป
      const ai = roundAiSummary(r);
      return `${r.time ?? 'ไม่ได้ตั้งเวลา'} — ${roundResultLabel(r)}${why}${ai ? `\n    สรุปจาก AI: ${ai}` : ''}`;
    })
    .join('\n');
  return `${name} · ${formatYmdDmyBe(ymd)}\n${detail}\n(กดเพื่อดูรายละเอียดและจัดการรอบนี้)`;
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
  /**
   * ทุกสายของแต่ละคน (คีย์กลุ่ม → สายทั้งหมด เรียงตามเวลานัด)
   * — **ต้องมาจากชุดที่ยังไม่ถูกกรองรอบ**
   *
   * 🔴 เจ้าของสั่ง 7 ก.ย. 2569: *"ถ้าเพิ่มไว้ 2 สาย ช่วยเอาผลมาทั้ง 2 สาย"*
   * เดิมส่งมาแค่ **สายแรก** ⇒ ผลของสายที่ 2 ไม่มีที่โชว์ในตาราง ต้องกดเข้าป๊อป
   * และถ้าคำนวณจาก `rows` ที่กรองรอบแล้ว สลับแท็บทีคอลัมน์นี้จะขาดสายไปทันที
   */
  allCalls?: Map<string, readonly FollowPlanningRound[]>;
}> = ({ rows, month, onMonthChange, selectedYmd, onSelect, onOpenCell, activeRound, allCalls }) => {
  const monthRows = useMemo(() => buildFollowMonthRows(rows, month), [rows, month]);
  const cols = useMemo(() => monthDayColumns(month), [month]);

  /**
   * มีสายที่เท่าไหร่บ้างในข้อมูลจริง — คอลัมน์ผลจะขึ้นเท่าที่มี ไม่ยัด 3 ช่องว่างทุกแถว
   * 🔴 ต้องนับจาก **ทุกรอบของทุกคน** (`allCalls`) ไม่ใช่แถวที่กรองรอบแล้ว
   * ไม่งั้นเลือกแท็บ "ครั้งที่ 2" ปุ๊บ คอลัมน์ "สายที่ 1" หายทั้งตาราง
   * อย่างน้อยต้องมีสายที่ 1 เสมอ — ตารางไม่มีคอลัมน์ผลเลยจะอ่านไม่รู้เรื่อง
   */
  const [view, setView] = React.useState<'action' | 'month'>('action');

  /** งานที่ต้องลงมือ — คิดจาก `rows` ตรง ๆ ไม่ผูกกับเดือนที่กำลังดู (ของค้างข้ามเดือนได้) */
  const actions = useMemo(() => buildFollowActionRows(rows), [rows]);
  const actionSummary = useMemo(() => followActionSummary(actions), [actions]);

  const roundSlots = useMemo(() => {
    const found = new Set<number>();
    for (const { row } of monthRows) {
      for (const r of allCalls?.get(row.group.key) ?? row.rounds) {
        const slot = followRoundSlot(r.entry);
        if (slot != null) found.add(slot);
      }
    }
    if (found.size === 0) found.add(1);
    return [...found].sort((a, b) => a - b);
  }, [monthRows, allCalls]);
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
        {/**
         * 🔴 สองหน้าในการ์ดเดียว (เจ้าของสั่ง 7 ก.ย. 2569)
         * *"แบ่งเป็น 2 หน้า หน้าแรกเพื่อดูว่าต้องมีกี่คนที่ต้องโทร ต้องตามผลไรงี้
         *   อีกหน้าเป็นหน้าสรุปเลยว่าทั้งเดือนคนไหนถูกแท็กให้โทรวันไหนบ้างแล้วผลเป็นไง"*
         * ตาราง 30 คอลัมน์ตอบ "ภาพรวมทั้งเดือน" ได้ แต่ตอบ "วันนี้ต้องทำอะไร" ไม่ได้
         */}
        <div className="flex items-center gap-1" role="tablist" aria-label="มุมมองปฏิทินติดตาม">
          {(
            [
              ['action', 'ต้องลงมือ'],
              ['month', 'สรุปทั้งเดือน'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={cn(
                'inline-flex h-7 items-center rounded-full border px-3 text-[11px] font-semibold',
                view === key ? TONE.info.chip : TONE.neutral.outline,
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {view === 'action'
            ? 'เฉพาะคนที่มีงานค้างจริง — ของค้างขึ้นก่อน · กดแถวเพื่อจัดการสายนั้น'
            : 'แถว = คน · คอลัมน์ = วัน · กดช่องเวลา = เปิดรายละเอียด/จัดการรอบนั้น · กดหัววัน = ดูเฉพาะวันนั้น'}
        </span>
        {view === 'month' && activeRound ? (
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', TONE.info.chip)}>
            กำลังดู {roundTabLabel(activeRound)} · เฉพาะเดือนนี้
          </span>
        ) : null}
        <div className={cn('ml-auto flex items-center gap-1', view === 'action' && 'hidden')}>
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

      {/* คำอธิบายสี — 🔴 สีแปลว่า "เรื่องดีหรือเรื่องร้าย" ไม่ใช่ "ข้อมูลมาถึงหรือยัง"
          (เจ้าของทัก 1 ก.ย. 2569: *"ไม่ไปแล้วแต่เป็นเขียวเนี่ยนะ"*) */}
      {/* Wave 2.1 (5 ก.ย. 2569): ตัวหนังสือ 10px เล็กเกินอ่าน → ขั้นต่ำ `text-xs` ·
          มือถือเรียง 2 คอลัมน์ให้ขึ้นบรรทัดใหม่สวย ๆ (เดิมยัดแถวเดียวจนเบียด)
          · sm ขึ้นไปกลับเป็นแถวเดียวไหลตามเดิม · คำอธิบายครบ 6 ข้อเท่าเดิม */}
      <div className="mb-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground sm:flex sm:flex-wrap sm:items-center">
        {(
          [
            ['success', 'จบดี — ไป/ยืนยันว่าไป'],
            ['danger', 'จบไม่ดี — ยกเลิก/ไม่ไปแล้ว'],
            ['warn', 'ยังไม่จบ ต้องตามต่อ'],
            ['orange', 'ไม่ได้ส่งให้ AI — ต้องคนจัดการ'],
            ['primary', 'สายกำลังเดิน รอผล'],
            ['neutral', 'ยังไม่ถึงเวลา / ยกเลิกทิ้ง (ขีดฆ่า)'],
          ] as const
        ).map(([tone, label]) => (
          <span key={tone} className="flex items-start gap-1 leading-snug sm:items-center">
            <span className={cn('mt-0.5 h-2.5 w-2.5 shrink-0 rounded-sm sm:mt-0', TONE[tone].dot)} aria-hidden />
            {label}
          </span>
        ))}
      </div>

      {view === 'action' ? (
        <div>
          {/* สรุปหัวหน้า — นับ "คน" ไม่ใช่ "สาย" · เขียนกำกับว่าช่องไหนซ้อนกันได้ */}
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <span className={cn('rounded-full px-2.5 py-1 font-semibold', TONE.neutral.chip)}>
              ต้องลงมือ {actionSummary.people.toLocaleString('th-TH')} คน
            </span>
            <span className={cn('rounded-full px-2.5 py-1 font-semibold', TONE.warn.chip)}>
              เลยเวลานัดยังไม่มีผล {actionSummary.overduePeople.toLocaleString('th-TH')} คน
            </span>
            <span className={cn('rounded-full px-2.5 py-1 font-semibold', TONE.info.chip)}>
              มีนัดวันนี้ {actionSummary.todayPeople.toLocaleString('th-TH')} คน
            </span>
            <span className={cn('rounded-full px-2.5 py-1 font-semibold', TONE.primary.chip)}>
              สายที่ต้องตามผล {actionSummary.waitingResultCalls.toLocaleString('th-TH')} สาย
            </span>
            <span className="text-[11px] text-muted-foreground">
              ⚠️ "เลยเวลานัด" กับ "มีนัดวันนี้" ซ้อนกันได้ (นัดเช้าวันนี้แล้วเลยเวลา) — อย่าบวกกัน
            </span>
          </div>

          {actions.length === 0 ? (
            <p className={cn('rounded-xl border px-3 py-4 text-center text-xs text-muted-foreground', TONE.success.soft)}>
              ไม่มีใครค้างเลย — ทั้งของค้างและนัดวันนี้เคลียร์หมดแล้ว
              {activeRound ? ` (กำลังดู ${roundTabLabel(activeRound)})` : ''}
            </p>
          ) : (
            <ul className="divide-y divide-border/60 rounded-xl border border-border">
              {actions.map(({ row, overdue, today: todayRounds }) => (
                <li key={row.group.key} className="px-3 py-2">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-xs font-bold text-foreground">{row.group.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {row.group.unitName || row.group.phone}
                    </span>
                    {overdue.length > 0 ? (
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', TONE.warn.chip)}>
                        เลยเวลานัด {overdue.length} สาย — ต้องตามผล
                      </span>
                    ) : null}
                    {todayRounds.length > 0 ? (
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', TONE.info.chip)}>
                        นัดวันนี้ {todayRounds.length} สาย
                      </span>
                    ) : null}
                  </div>
                  {/* ทุกสายของคนนี้ (รวมสายที่จบแล้ว) — จะได้เห็นว่ารอบก่อนคุยไว้ว่าอะไร */}
                  <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    {(allCalls?.get(row.group.key) ?? row.rounds).map((r) => {
                      const slot = followRoundSlot(r.entry);
                      const ai = roundAiSummary(r);
                      return (
                        <li key={r.entry.id} className="min-w-[200px] max-w-[320px]">
                          <button
                            type="button"
                            onClick={() => onOpenCell(row, r.ymd ?? today, [r])}
                            className="w-full text-left"
                            title="กดเพื่อดูรายละเอียดและจัดการสายนี้"
                          >
                            <span className="flex items-center gap-1">
                              <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">
                                สายที่ {slot ?? '—'} · {r.time ?? '—'}
                              </span>
                              <span
                                className={cn(
                                  'inline-flex min-w-0 items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium',
                                  TONE[roundTone(r)].chip,
                                  r.state === 'cancelled' && 'opacity-60',
                                )}
                              >
                                {isGoodResult(r) ? <Check className="h-3 w-3 shrink-0" aria-hidden /> : null}
                                <span className="truncate">{roundResultLabel(r)}</span>
                              </span>
                            </span>
                            {ai ? (
                              <span
                                className="mt-0.5 line-clamp-2 block text-[10px] leading-snug text-muted-foreground"
                                title={ai}
                              >
                                {ai}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : monthRows.length === 0 ? (
        <p className={cn('rounded-xl border px-3 py-4 text-center text-xs text-muted-foreground', TONE.neutral.soft)}>
          เดือนนี้ไม่มีนัดโทรของใครเลย
          {activeRound ? ` ใน "${roundTabLabel(activeRound)}" — กดรอบอื่นข้างบนเพื่อดูรอบนั้น` : ''}
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
                {/**
                 * 🔴 **หนึ่งสาย = หนึ่งคอลัมน์** (เจ้าของสั่ง 7 ก.ย. 2569:
                 * *"แยกว่าสายแรก สาย 2 พอได้ผลก็แยกรอบ เอามารวมกันแบบนี้งงตาย"*)
                 * รอบก่อนกองทุกสายไว้ในช่องเดียว อ่านแล้วไม่รู้ว่าอันไหนของสายไหน
                 *
                 * แต่ละช่องเปลี่ยนสถานะของตัวเอง: รอผล → ได้ผลแล้วบอกคำตอบ (ไป/ไม่ไป)
                 * พร้อม **เหตุผลที่เขาตอบ** จากสรุปของ AI ⇒ สายที่ 1 ได้ผลก่อนก็เห็นก่อน
                 * ไม่ต้องรอสายที่ 2 · อ่านจากชุด **ไม่กรองรอบ** สลับแท็บแล้วต้องครบเหมือนเดิม
                 */}
                {roundSlots.map((slot) => (
                  <th
                    key={`slot-${slot}`}
                    className="min-w-[170px] max-w-[240px] border-l border-border/60 px-2 py-2 text-left text-[11px] font-semibold text-muted-foreground"
                  >
                    สายที่ {slot}
                  </th>
                ))}
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
                          'flex min-w-[64px] min-h-10 flex-col items-center justify-center rounded-lg px-1 py-1 font-medium transition-colors hover:bg-secondary sm:min-h-0',
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
                  {roundSlots.map((slot) => {
                    const r = (allCalls?.get(row.group.key) ?? row.rounds).find(
                      (x) => followRoundSlot(x.entry) === slot,
                    );
                    const ai = r ? roundAiSummary(r) : null;
                    return (
                      <td
                        key={`slot-${slot}`}
                        className="max-w-[240px] border-l border-border/60 px-2 py-1.5 align-top"
                      >
                        {!r ? (
                          /* คนนี้ไม่ได้ตั้งสายที่ N ไว้ — ต่างจาก "ตั้งไว้แต่ยังไม่มีผล" */
                          <span className="text-[10px] text-muted-foreground">ไม่ได้ตั้งสายนี้</span>
                        ) : (
                          <>
                            <span className="mb-0.5 flex items-center gap-1">
                              <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">
                                {r.time ?? '—'}
                              </span>
                              <span
                                className={cn(
                                  'inline-flex min-w-0 items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium',
                                  TONE[roundTone(r)].chip,
                                  r.state === 'cancelled' && 'opacity-60',
                                )}
                              >
                                {/* ✅ เขียว = ตกลงไป (เจ้าของขอเครื่องหมายถูกสีเขียวโดยเฉพาะ) */}
                                {isGoodResult(r) ? (
                                  <Check className="h-3 w-3 shrink-0" aria-hidden />
                                ) : null}
                                <span className="truncate">{roundResultLabel(r)}</span>
                              </span>
                            </span>
                            {ai ? (
                              /* เหตุผลที่เขาตอบ — คำเต็มที่ tooltip ในตารางตัด 3 บรรทัด */
                              <span
                                className="line-clamp-3 text-[10px] leading-snug text-muted-foreground"
                                title={ai}
                              >
                                {ai}
                              </span>
                            ) : r.state === 'result' ? (
                              /* มีผลแล้วแต่ AI ไม่ได้เขียนเหตุผล — บอกตรง ๆ ห้ามปล่อยว่างให้เดา */
                              <span className="block text-[10px] text-muted-foreground">
                                (ไม่มีสรุปจาก AI)
                              </span>
                            ) : null}
                            {/**
                             * 🔴 สถานะเบอร์ฉุกเฉิน (เจ้าของสั่ง 7 ก.ย. 2569)
                             * เขียนได้แค่ "แนบไปแล้ว" — ผลที่ Lumos ส่งกลับ **ไม่มีช่องบอก
                             * ว่าโทรเบอร์นี้หรือยัง** (ตรวจครบทุกคีย์ 7 ก.ย. 2569)
                             * ไม่ได้แนบเบอร์ไป = ความเสี่ยงจริง ต้องเห็นเป็นสีเตือน ไม่ใช่ช่องว่าง
                             */}
                            {(() => {
                              const emg = roundEmergencyPhone(r);
                              if (!emg) {
                                return (
                                  <span
                                    className={cn(
                                      'mt-1 inline-block rounded px-1 py-0.5 text-[9px] font-medium',
                                      TONE.warn.chip,
                                    )}
                                    title="สายนี้ไม่ได้แนบเบอร์ฉุกเฉินไปด้วย — ติดต่อผู้รับไม่ได้แล้ว AI ไม่มีใครให้โทรต่อ"
                                  >
                                    ไม่ได้แนบเบอร์ฉุกเฉิน
                                  </span>
                                );
                              }
                              return (
                                <span
                                  className="mt-1 block text-[9px] leading-snug text-muted-foreground"
                                  title={`เบอร์ที่ AI โทรหาเมื่อติดต่อผู้รับไม่ได้ · ${emg}\nฝั่ง Lumos ยังไม่ส่งกลับมาว่าโทรเบอร์นี้แล้วหรือยัง`}
                                >
                                  ฉุกเฉิน {emg} ·{' '}
                                  {r.state === 'result' ? 'ยังไม่รู้ว่าโทรหรือยัง' : 'แนบไปกับสายนี้'}
                                </span>
                              );
                            })()}
                          </>
                        )}
                      </td>
                    );
                  })}
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
                          /* มีนัด/มีผล = พื้นจาง ๆ ตามโทนกลาง แยกจากช่องว่างชัด ๆ บนมือถือ */
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
                            {/* โชว์เวลาจริง ไม่ใช่จุดสีลอย ๆ — เจ้าของอยากเห็น "เวลาไหนบ้าง" */}
                            {/* 🔴 ช่องละ 1 สาย (เจ้าของสั่ง 1 ก.ย. 2569) — เกินนั้นบอกเป็น +N ไม่ตัดเงียบ */}
                            {rounds.slice(0, 1).map((r) => (
                              <span
                                key={r.entry.id}
                                className={cn(
                                  'block rounded px-0.5 py-0.5 leading-tight',
                                  TONE[roundTone(r)].chip,
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
                            {rounds.length > 1 ? (
                              <span className="text-[9px] font-semibold text-primary">
                                +{rounds.length - 1}
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
