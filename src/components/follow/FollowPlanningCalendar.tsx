import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarIcon, Check, ChevronLeft, ChevronRight, Clock, Pencil, Phone, PhoneOff, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { shiftMonth } from '@/lib/followCallCalendar';
import { dayCallTabLabel, roundFilterLabel } from '@/lib/followRoundVisual';
import { followDayCallLabel } from '@/lib/followDayCall';
import {
  followStaffCallText,
  isStaffCallResult,
  type FollowStaffCallOutcome,
} from '@/lib/followStaffCall';
import type { FollowOutcome } from '@/lib/followOutcome';
import FollowStaffCallControls from '@/components/follow/FollowStaffCallControls';
import { toYmdBangkok, toYmdLocal, parseYmd, THAI_MONTHS, ceToBeYear, formatYmdDmyBe } from '@/lib/dateTh';
import {
  buildFollowDayCalls,
  buildFollowDayPeople,
  followDayPersonDone,
  type FollowDayDoneKind,
  type FollowDayPerson,
  buildFollowMonthRows,
  callCategory,
  callCategoryWashTone,
  FOLLOW_CALL_CATEGORY_LABEL,
  FOLLOW_CALL_CATEGORY_TONE,
  filterPlanningRowsByRound,
  isGoodResult,
  monthDayColumns,
  roundAiSummary,
  roundDispatchReason,
  roundEmergencyPhone,
  roundPushError,
  roundPushFailed,
  roundReplyText,
  followRoundLabel,
  roundResultLabel,
  answeredButMarkedUnreached,
  ANSWERED_UNCLEAR_LABEL,
  roundTone,
  type FollowPlanningRound,
  type FollowPlanningRow,
  type FollowRoundFilter,
} from '@/lib/followPlanning';
import { followRoundSlot } from '@/lib/followRoundBuckets';
import { followCallerOf } from '@/lib/followListFilter';
import FollowDayDoneCard from '@/components/follow/FollowDayDoneCard';
import type { FollowEntry } from '@/lib/followApi';
import { ChoiceDropdown } from '@/components/shared/ChoiceDropdown';
import { buildFollowCallMatrix, FOLLOW_MATRIX_COL_LABEL, FOLLOW_MATRIX_COL_TONE, followMatrixColOfCategory } from '@/lib/followCallMatrix';
import { DASH } from '@/lib/designTokens';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * ═══ หน้าติดตาม — ภาษาการออกแบบตามแบบอ้างอิงที่เจ้าของส่งมา (8 ก.ย. 2569) ═══
 *
 * เจ้าของส่งแบบจาก Stitch มาแล้วสั่ง *"ฉันต้องการเรื่อง Design เขา เปลี่ยนเลยเอาตามนั้น"*
 *
 * **ยกมาจากแบบอ้างอิง:**
 *   1. **การ์ดแยกใบวางบนพื้นฟ้าเทาอ่อน** — ไม่ใช่ผืนยาวใบเดียว (โทเคนธีมเราตรงอยู่แล้ว:
 *      `--background: 220 24% 97%` ≈ `#f8f9ff` ของเขา · `--card` ขาว)
 *   2. **การ์ดตัวเลข 4 ใบ** ตราไอคอนมุมขวาบน · เลขใหญ่ 40px · บรรทัดความหมายคั่นเส้นที่ท้ายการ์ด
 *   3. **สองคอลัมน์** รายการหลัก (2/3) + แผงข้างขวา (1/3) = วงสรุปเดือน + งานด่วนพร้อมปุ่มโทร
 *   4. **ป้ายสถานะเป็นเม็ดยากลมมีจุดสีนำหน้า** · แต่ละแถวมีวงกลมอักษรย่อชื่อ
 *   5. **เวลาอยู่ขวาสุด** เหมือนคอลัมน์ "กำหนดเริ่มงาน" ของเขา
 *
 * **ไม่ยกมา — ผิดกติกาที่เจ้าของเคาะไว้เอง:**
 *   · `backdrop-filter` 37 จุดของเขา — ถอดออกทั้งระบบ 5 ก.ย. เพราะเว็บกระตุก มีด่าน
 *     `tests/api/perfGuards.test.ts` คุมอยู่ · ใช้การ์ดขาวทึบ + เงานุ่มแทน ได้หน้าตาเดียวกัน
 *   · ฟอนต์ Be Vietnam Pro — ไม่มีชุดอักษรไทย (ไทยในภาพตัวอย่างตกไปฟอนต์สำรอง)
 *     เราล็อก Kanit ทั้งระบบ ซึ่งอ่านไทยดีกว่า
 *   · จานสี crimson `#9E2A2B` — ของเราเบอร์กันดี `#8c2f39` ใกล้กันมากอยู่แล้ว
 *
 * 🔴 **ข้อมูล/ตัวเลข/ปุ่มไม่มีอะไรหาย** — เปลี่ยนแค่การจัดวางและหน้าตา
 * 🔴 คำบนจอยังยืมจากแผง "การโทรของงาน Follow" ชุดเดียว (ด่านเทสต์คุมใน followPlanning.test.ts)
 */

type View = 'day' | 'month';

/**
 * คนต่อหน้าในตารางรายวัน — เลือกได้ 10 / 15 (เจ้าของสั่ง 3 ต.ค. 2569 "ทำเป็น Pagination 10-15 ต่อหน้า")
 * ค่าเริ่ม 10 · เดิมล็อก 12 ไม่มีตัวเลือก
 */
const DAY_PAGE_SIZES = [10, 15] as const;
/** รายเดือนหน้าละ 10 คน (5 ต.ค. 2569) */
const MONTH_PAGE_SIZE = 10;
type DayPageSize = (typeof DAY_PAGE_SIZES)[number];

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

/** ป้ายวันบนปุ่มเลือกวัน ("พฤ. 1 ต.ค. 2569") — 🔴 `Intl` ระดับโมดูล · คีย์วันเป็นสตริง จึงคิดเป็น UTC ล้วน */
const DAY_PILL = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
function dayPillLabel(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  return DAY_PILL.format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))));
}

/**
 * ═══ ปุ่มวันที่ของมุมมองรายวัน (เจ้าของสั่ง 1 ต.ค. 2569) ═══
 * เจ้าของ: *"มันต้องโชว์วันนั้นๆไม่ใช่โชว์แค่คำว่า วันนี้"* — ปุ่มโชว์วันที่เลือกอยู่เสมอ กดแล้วเลือกวันจากปฏิทิน
 * · "วันนี้" ย้ายไปเป็นทางลัดในปฏิทิน · ค่าที่คุยกันเป็น `YYYY-MM-DD` (แบบเดียวกับ `DayCalendarPicker`)
 */
const DayPickerPill: React.FC<{ value: string; today: string; onPick: (ymd: string) => void }> = ({
  value,
  today,
  onPick,
}) => {
  const [open, setOpen] = useState(false);
  const p = parseYmd(value);
  const selected = p ? new Date(p.y, p.m - 1, p.d) : undefined;
  const thisYear = new Date().getFullYear();
  const pick = (ymd: string) => {
    onPick(ymd);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="rounded-full tabular-nums"
          aria-label={`เลือกวัน · ${dayPillLabel(value)}`}
          data-testid="day-pill"
        >
          <CalendarIcon aria-hidden />
          {dayPillLabel(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => {
            if (d) pick(toYmdLocal(d));
          }}
          captionLayout="dropdown-buttons"
          fromYear={thisYear - 2}
          toYear={thisYear + 2}
          /* ⚠️ โหมด dropdown วาดป้ายเดือน/ปีซ้ำอีกชุด — ซ่อนแบบเดียวกับ `DayCalendarPicker` */
          classNames={{
            caption_label: 'sr-only',
            vhidden: 'sr-only',
            caption_dropdowns: 'flex items-center gap-1.5',
            dropdown: 'rounded-lg border border-border bg-background px-2 py-1 text-xs font-medium text-foreground',
          }}
          initialFocus
        />
        <div className="border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            disabled={value === today}
            onClick={() => pick(today)}
          >
            วันนี้
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

/** อักษรย่อในวงกลมหน้าแถว — แบบอ้างอิงใช้รูปคน ฐานเราไม่มีรูป จึงใช้อักษรแรกของชื่อ */
function initials(name: string): string {
  return name.replace(/^["']|["']$/g, '').trim().slice(0, 1) || '?';
}

/**
 * ตำหนิ QA รอบสอง (6 ก.ย. 2569): บนมือถือช่องวันเล็ก (~30px) และแยกช่อง "มีนัด/มีผล"
 * จากช่องว่างข้าง ๆ ไม่ออก — ดึงเฉพาะโทนพื้นหลัง (bg-*) จาก TONE.*.soft มาบังคับ
 * เฉพาะจอเล็ก (`max-sm:`) ไม่แตะเดสก์ท็อป ไม่แตะความหมายสี
 */
function mobileSoftBg(tone: keyof typeof TONE): string {
  return TONE[tone].soft
    .split(' ')
    .filter((cls) => cls.includes('bg-'))
    .map((cls) => `max-sm:${cls}`)
    .join(' ');
}

/** ข้อความบอกช่อง — ตัวเลขลอย ๆ อ่านไม่ออกว่าคืออะไร ต้องมีคำกำกับตอนเอาเมาส์จ่อ */
/** ตัวเลือกของ dropdown เลือกหน้า — "1/13" … "13/13" */
function pageOptions(count: number): Array<{ value: string; label: string }> {
  return Array.from({ length: count }, (_, i) => ({ value: String(i + 1), label: `${i + 1}/${count}` }));
}

function cellTitle(name: string, ymd: string, rounds: FollowPlanningRound[]): string {
  const detail = rounds
    .map((r) => {
      const why = r.state === 'notSent' ? ` (${roundDispatchReason(r)})` : '';
      const ai = roundAiSummary(r);
      return `${r.time ?? 'ไม่ได้ตั้งเวลา'} — ${roundResultLabel(r)}${why}${ai ? `\n    เขาตอบ: ${ai}` : ''}`;
    })
    .join('\n');
  return `${name} · ${formatYmdDmyBe(ymd)}\n${detail}`;
}

/**
 * ป้ายของสายเดียว — "วันที่ 2 · สายที่ 1" (ตารางหลายวัน) / "สายที่ 2" (เจ้าของสั่ง 1 ต.ค. 2569:
 * *"วันที่ 1 สายที่ 1 2 วันที่ 2 สายที่ 1 2 ไม่ใช่ 1 2 3 4 5 6"*) · แถวที่ไม่ได้ผ่าน `listFollowEntries` ถอยไปใช้ `call_round`
 */
function callLabelOf(round: FollowPlanningRound, slot: 1 | 2 | 3 | null): string {
  const e = round.entry;
  return (
    followDayCallLabel({ day: e.call_day ?? null, call: e.call_of_day ?? e.call_round ?? null }) ??
    (slot ? dayCallTabLabel(slot) : 'ยังไม่อยู่รอบไหน')
  );
}

/** เวลาที่คนลงผล (HH:MM ไทย) — 🔴 `Intl` ระดับโมดูล */
const STAFF_AT = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });

/**
 * คำอธิบายสี — ชุดเดียวใช้ทั้งสองมุมมอง (คำของเจ้าของ ปรับให้ตรงแผงข้างบน 8 ก.ย. 2569)
 * 🔴 เหลือแค่จุดสี + คำตอบ (เจ้าของสั่ง 1 ต.ค. 2569: *"พวกอักษรที่เขียนว่า เขียว แดง ฯลฯ เอาออก เหลือแค่สีกับคำตอบก็พอ มันรก"*)
 *    ห้ามเติมชื่อสี/วงเล็บอธิบายกลับ
 */
// 🔴 สร้างจากหมวดกลาง (คำ + สี) — คำเดียวกับป้ายในตารางและช่องบนแผง (6 ต.ค. 2569)
const DAY_LEGEND: ReadonlyArray<[keyof typeof TONE, string]> = (
  ['agreed', 'lost', 'unreachable', 'other', 'waiting', 'overdue', 'notSent', 'cancelled'] as const
).map((c) => [FOLLOW_CALL_CATEGORY_TONE[c], FOLLOW_CALL_CATEGORY_LABEL[c]]);

const NAV_BTN = cn(
  'inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
  TONE.neutral.outline,
);

/** วงสรุป — SVG ล้วน ไม่มีไลบรารีกราฟ ไม่มี CSS ใหม่ · สีมาจาก `TONE.hex` เท่านั้น */
const Donut: React.FC<{ percent: number | null; caption: string }> = ({ percent, caption }) => {
  const r = 52;
  const c = 2 * Math.PI * r;
  const p = percent == null ? 0 : Math.max(0, Math.min(100, percent));
  return (
    <svg viewBox="0 0 130 130" className="mx-auto h-[132px] w-[132px]" role="img" aria-label={caption}>
      <circle cx="65" cy="65" r={r} fill="none" strokeWidth="12" className="stroke-secondary" />
      {percent != null ? (
        <circle
          cx="65"
          cy="65"
          r={r}
          fill="none"
          stroke={TONE.success.hex}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${(c * p) / 100} ${c}`}
          transform="rotate(-90 65 65)"
        />
      ) : null}
      <text
        x="65"
        y="63"
        textAnchor="middle"
        className="fill-foreground text-[24px] font-medium"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {percent == null ? '—' : `${percent.toFixed(1)}%`}
      </text>
      <text x="65" y="82" textAnchor="middle" className="fill-muted-foreground text-[11px]">
        {caption}
      </text>
    </svg>
  );
};

/*
 * 🔴 การ์ด "เริ่มใช้งานหน้านี้" (การ์ดวันแรก 3 ขั้น · 12 ก.ย. 2569) ถอดออกแล้ว — เจ้าของสั่ง 1 ต.ค. 2569: *"เอาออกไปสิ"*
 *    (โผล่ทุกครั้งที่แท็บยังไม่มีรายชื่อ เช่น แท็บติดตามส่งคนแทน) · ห้ามเอากลับโดยไม่ได้สั่งใหม่
 */

const FollowPlanningCalendar: React.FC<{
  /** ทุกแถว **ไม่กรองรอบ** — ตัวกรองรอบอยู่ใน `roundsSlot` ที่เดียวทั้งหน้า */
  rows: readonly FollowPlanningRow[];
  month: string;
  onMonthChange: (monthKey: string) => void;
  /** วันที่เลือกอยู่ (YYYY-MM-DD) — '' = ยังไม่เลือก (มุมมองรายวันจะโชว์วันนี้) */
  selectedYmd: string;
  onSelect: (ymd: string) => void;
  /** กดสาย/ช่อง = เปิดป๊อปรายละเอียดของคนนั้นในวันนั้น */
  onOpenCell: (row: FollowPlanningRow, ymd: string, rounds: FollowPlanningRound[]) => void;
  /** กดดินสอบนแถว = เปิดกล่องแก้ไขของ **สายนั้น** ตรง ๆ (ไม่ต้องผ่านป๊อปจัดการ) */
  onEditRound?: (round: FollowPlanningRound) => void;
  roundFilter: FollowRoundFilter;
  /** แผงรอบโทร + 7 ช่องสถานะสาย — วางเป็นการ์ดของตัวเองใต้การ์ดตัวเลข */
  roundsSlot?: React.ReactNode;
  /** แถวตัวกรองของหน้า วางต่อจากแท็บรายวัน/รายเดือน (เจ้าของสั่ง 5 ต.ค. 2569) · ไม่ส่ง = ไม่มี */
  filtersSlot?: React.ReactNode;
  /** เวลาที่ดึงข้อมูลสำเร็จล่าสุด — ไว้บอกคนว่าหน้าไม่ได้ค้าง (`null` = ยังไม่เคยโหลดจบ) */
  lastLoadedAt?: Date | null;
  /**
   * ปุ่มบนแถวของ **สายที่คนโทร** (เจ้าของ Choice 1 ต.ค. 2569 "ติดต่อสำเร็จ / ไม่สำเร็จ / ยกเลิก")
   * ไม่ส่ง = ไม่มีปุ่ม (เช่นจอที่อ่านอย่างเดียว)
   */
  onStaffResult?: (
    round: FollowPlanningRound,
    outcome: FollowStaffCallOutcome,
    row?: FollowPlanningRow,
  ) => boolean | void | Promise<boolean | void>;
  /** ขั้น 2 ของสายคนโทร "จบเรื่องนี้" (6 ต.ค. 2569) — ปิดงานด้วยผลนี้ + หยุดสายที่เหลือทั้งชุด */
  onFinishRound?: (round: FollowPlanningRound, outcome: FollowOutcome) => void | Promise<void>;
  onCancelRound?: (round: FollowPlanningRound) => void | Promise<void>;
  /** รายการที่กำลังบันทึกอยู่ — ปุ่มของแถวนั้นกดซ้ำไม่ได้ */
  busyId?: string | null;
  /**
   * ชุดเต็มไม่ผ่านตัวกรองวัน/ใครโทร — ใช้หา "วันถัดไปที่มีแผน" เท่านั้น
   * (`rows` ถูกตัวกรองวันของหน้าแม่บีบเหลือวันเดียวเมื่อเลือกวัน ⇒ มองไม่เห็นแผนวันอื่น)
   */
  allRows?: readonly FollowPlanningRow[];
  /**
   * แถวของการ์ด "ผลของเดือนนี้" + "ต้องตามด่วน" — ทั้งเดือนตามตัวกรองเดียวกับแผงขั้นตอน (6 ต.ค. 2569)
   * ไม่ส่ง = ใช้ `rows` (พฤติกรรมเดิม · เทสต์)
   */
  summaryRows?: readonly FollowPlanningRow[];
  /**
   * สายชุดเดียวกับกล่อง "ขั้นตอนของสาย" (ช่วงวัน/เดือน + ตัวกรองเดียวกัน) — การ์ดผลนับจากชุดนี้ด้วย `buildFollowCallMatrix`
   * ตัวเดียวกับกล่อง ⇒ ทั้งหมดบนการ์ด = ทั้งหมดบนกล่อง (เจ้าของ 6 ต.ค. 2569 "มันก็ต้องแค่ของหน้านี้สิ่ ก็ยอด 202")
   * ไม่ส่ง = นับจาก `summaryRows` ทั้งเดือน (พฤติกรรมเดิม · เทสต์)
   */
  resultEntries?: readonly FollowEntry[];
  /**
   * แยกคนที่จัดการจบแล้วออกจากตารางรายวัน ไปการ์ด "สำเร็จ / ยกเลิก" ใต้ตาราง (เจ้าของ 6 ต.ค. 2569)
   * หน้าแม่ปิดตอนกดกล่องตัวเลขอยู่ (กล่องยกเลิกต้องเห็นคนยกเลิกในตาราง ไม่ใช่ตารางว่าง)
   */
  splitDone?: boolean;
  /** บอกหน้าแม่ว่าดูรายวันหรือรายเดือนอยู่ — แผงรอบโทรนับช่วงตามนี้ (3 ต.ค. 2569) */
  onViewChange?: (view: 'day' | 'month') => void;
}> = ({
  rows,
  summaryRows,
  resultEntries,
  splitDone = false,
  month,
  onMonthChange,
  selectedYmd,
  onSelect,
  onOpenCell,
  onEditRound,
  roundFilter,
  roundsSlot,
  filtersSlot,
  lastLoadedAt,
  onStaffResult,
  onFinishRound,
  onCancelRound,
  busyId = null,
  allRows,
  onViewChange,
}) => {
  const [view, setView] = useState<View>('day');
  /** สายที่กด "ยกเลิก" บนแถวแล้วรอยืนยัน (ยืนยันในที่เดิม ไม่เปิดป๊อป) */
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const today = toYmdBangkok(new Date());
  const dayYmd = selectedYmd || today;

  /* ─── มุมมองรายวัน ─── */
  const dayCalls = useMemo(
    () => buildFollowDayCalls(rows, dayYmd, roundFilter),
    [rows, dayYmd, roundFilter],
  );
  const daySlots = useMemo(() => {
    const found = new Set<1 | 2 | 3>();
    for (const c of buildFollowDayCalls(rows, dayYmd, 'all')) if (c.slot) found.add(c.slot);
    return [...found].sort((a, b) => a - b);
  }, [rows, dayYmd]);
  /**
   * วันถัดไปที่มีแผน (3 ต.ค. 2569 — เจ้าของแจ้ง *"ลงแผนเป็นเดือนแล้วแผนหาย"* · ตรวจฐานแล้ว
   * แผนอยู่ครบ ที่หายคือ**สายตา**: มุมมองรายวันเปิดที่วันนี้ แผนที่เริ่มวันหน้าเลยมองไม่เห็น)
   * วันว่างต้องชี้ทางต่อว่าแผนก้อนถัดไปอยู่วันไหน ไม่ใช่จบที่ "ไม่มีสาย"
   */
  const nextPlannedDay = useMemo(() => {
    let best: { ymd: string; calls: number } | null = null;
    const counts = new Map<string, number>();
    for (const row of allRows ?? rows) {
      for (const r of row.rounds) {
        if (!r.ymd || r.ymd <= dayYmd || r.entry.cancelled) continue;
        // นับตามสายที่เลือกอยู่ด้วย — ตารางกรองสายที่ 2 อยู่ ปุ่มต้องชี้วันถัดไปที่มีสายที่ 2 (3 ต.ค. 2569 "แก้ให้สอดคล้องกัน")
        if (roundFilter !== 'all' && followRoundSlot(r.entry) !== roundFilter) continue;
        counts.set(r.ymd, (counts.get(r.ymd) ?? 0) + 1);
      }
    }
    for (const [ymd, calls] of counts) if (!best || ymd < best.ymd) best = { ymd, calls };
    return best;
  }, [allRows, rows, dayYmd, roundFilter]);
  /**
   * 🔴 **ตารางนับเป็น "คน" ไม่ใช่ "สาย"** (เจ้าของทัก 11 ก.ย. 2569: *"เพิ่มโทรหลายรอบ
   * มันขึ้นหลายบรรทัด คนดูเขางง"*) · การ์ดตัวเลขด้านบนยังนับเป็นสายเหมือนเดิม
   * — คนละคำถาม: การ์ดถามว่า "มีกี่สายต้องตาม" ตารางถามว่า "ต้องตามใครบ้าง"
   */
  const allDayPeople = useMemo(
    () => buildFollowDayPeople(rows, dayYmd, roundFilter),
    [rows, dayYmd, roundFilter],
  );
  /** คนที่จัดการจบแล้ว (สำเร็จ/ยกเลิก) → การ์ดใต้ตาราง · ที่เหลือ = ตาราง "สายที่ต้องตาม" */
  const { dayPeople, donePeople } = useMemo(() => {
    if (!splitDone) return { dayPeople: allDayPeople, donePeople: [] as Array<{ person: FollowDayPerson; kind: FollowDayDoneKind }> };
    const active: FollowDayPerson[] = [];
    const done: Array<{ person: FollowDayPerson; kind: FollowDayDoneKind }> = [];
    for (const p of allDayPeople) {
      const kind = followDayPersonDone(p);
      if (kind) done.push({ person: p, kind });
      else active.push(p);
    }
    return { dayPeople: active, donePeople: done };
  }, [allDayPeople, splitDone]);

  /** แบ่งหน้าแบบแบบอ้างอิง — เปลี่ยนวัน/รอบแล้วต้องเด้งกลับหน้า 1 ไม่งั้นค้างหน้าว่าง */
  const [page, setPage] = useState(1);
  const [dayPageSize, setDayPageSize] = useState<DayPageSize>(10);
  // เปลี่ยนวัน/สาย/จำนวนต่อหน้า = กลับหน้า 1 (ไม่งั้นค้างหน้าที่ไม่มีของ)
  useEffect(() => setPage(1), [dayYmd, roundFilter, dayPageSize]);
  const pageCount = Math.max(1, Math.ceil(dayPeople.length / dayPageSize));
  const safePage = Math.min(page, pageCount);
  const firstIndex = (safePage - 1) * dayPageSize;
  const lastIndex = Math.min(firstIndex + dayPageSize, dayPeople.length);
  const pagePeople = dayPeople.slice(firstIndex, lastIndex);

  /* ─── มุมมองรายเดือน ─── */
  const monthSource = useMemo(
    () => (roundFilter === 'all' ? rows : filterPlanningRowsByRound(rows, roundFilter)),
    [rows, roundFilter],
  );
  const monthRows = useMemo(() => buildFollowMonthRows(monthSource, month), [monthSource, month]);
  /** การ์ดผลของเดือน + ต้องตามด่วน — ชุดทั้งเดือนจากหน้าแม่ (ไม่หดตามกล่อง/วัน) · ยังเคารพ "สายที่" */
  const summarySource = useMemo(() => {
    const base = summaryRows ?? rows;
    return roundFilter === 'all' ? base : filterPlanningRowsByRound(base, roundFilter);
  }, [summaryRows, rows, roundFilter]);
  /**
   * 🔴 รายเดือนแบ่งหน้า หน้าละ 10 คน (เจ้าของสั่ง 5 ต.ค. 2569: *"รายเดือน · ภาพรวม ทำเป็น pagination ด้วยหน้าละ 10"*)
   * เปลี่ยนเดือน/สาย = กลับหน้า 1 · ตัวเลขแผงข้างขวายังนับทั้งเดือน (ไม่ใช่แค่หน้าที่ดู)
   */
  const [monthPage, setMonthPage] = useState(1);
  useEffect(() => setMonthPage(1), [month, roundFilter]);
  const monthPageCount = Math.max(1, Math.ceil(monthRows.length / MONTH_PAGE_SIZE));
  const monthSafePage = Math.min(monthPage, monthPageCount);
  const monthFirst = (monthSafePage - 1) * MONTH_PAGE_SIZE;
  const monthLast = Math.min(monthFirst + MONTH_PAGE_SIZE, monthRows.length);
  const monthPageRows = monthRows.slice(monthFirst, monthLast);
  const cols = useMemo(() => monthDayColumns(month), [month]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  /**
   * ═══ แผงข้างขวา (ยกโครงจากแบบอ้างอิง) ═══
   * เขามีวง Show-up Rate + รายการ "ต้องโทรวันนี้" · ของเราใช้เฉพาะข้อมูลที่ **มีจริงในฐาน**:
   *   · วง = สัดส่วนคนที่ตอบว่าไป ในบรรดา **สายที่รู้ผลแล้ว** ของเดือนนี้
   *     🔴 สายที่ยังไม่รู้ผลห้ามเอามาหาร ไม่งั้นต้นเดือนเปอร์เซ็นต์จะต่ำปลอม ๆ
   *   · รายการ = สายที่เลยเวลานัดแล้วยังไม่มีผล **ข้ามวันทั้งเดือน** — คนละชุดกับรายการหลัก
   *     ที่เป็นรายวัน จึงไม่ใช่ของซ้ำ
   * ⚠️ ของเขามี Show-up Rate จริง (คนมาเริ่มงานจริงกี่ %) — **เราไม่มีข้อมูลนั้นในฐาน**
   *    จึงไม่ทำ ไม่ใช่ลืม (แต่งเลขใส่จอ = จอโกหก)
   */

  /**
   * ═══ ผลของเดือน = นิยามเดียวกับกล่องขั้นตอนของสาย (เจ้าของ 6 ต.ค. 2569) ═══
   * > *"จำเป็นต้องเยอะขนาดนี้ไหม"* · *"ไม่ต้องแยกไรนะรวมมันไม่รู้แยกเราเหมือนกันไหม"*
   * เดิมแยก 7 ถังด้วยตัวอ่านคำพูด (`followCallMicro` · 13 ก.ย.) คนละนิยามกับกล่องข้างบน ⇒ เหลือ ไป / ไม่ไป / ไม่รับสาย / สรุปไม่ได้
   * (4 ช่องตามนิยามเจ้าของ 6 ต.ค. 2569 — ตัวอ่านคำพูดย้ายไปอยู่ใน `callCategory` แล้ว ทุกจอใช้ตัวเดียว)
   * นับด้วย `callCategory` → `followMatrixColOfCategory` ตัวเดียวกับ `buildFollowCallMatrix` (เฉพาะสายที่มีเลขสาย)
   */
  /**
   * แยก AI โทร / คนโทร (เจ้าของ 6 ต.ค. 2569 — Choice "รวม AI กับคนโทร" ⇒ ต้องเห็นแยก) · ใครโทร = `followCallerOf`
   * ตัวเดียวกับตัวกรองใครโทร ⇒ AI + คน = รวม ทุกแถว
   */
  const monthBoxes = useMemo(() => {
    type Cols = Record<'went' | 'notWent' | 'noAnswer' | 'unclear' | 'waiting' | 'cancelled', number>;
    const zero = (): Cols => ({ went: 0, notWent: 0, noAnswer: 0, unclear: 0, waiting: 0, cancelled: 0 });
    const out = { ...zero(), ai: zero(), manual: zero() };
    if (resultEntries) {
      // ชุดเดียวกับกล่องขั้นตอนของสาย — แถวตามแท็บสายที่เลือก (ทุกสาย / สายที่ 1 / 2 / 3 ขึ้นไป)
      const row = buildFollowCallMatrix(resultEntries)[roundFilter];
      for (const k of ['went', 'notWent', 'noAnswer', 'unclear', 'waiting', 'cancelled'] as const) {
        for (const e of row[k]) {
          out[k] += 1;
          out[followCallerOf(e)][k] += 1;
        }
      }
      return out;
    }
    for (const r of summarySource) {
      for (const round of r.rounds) {
        if (round.ymd?.slice(0, 7) !== month || followRoundSlot(round.entry) === null) continue;
        const col = followMatrixColOfCategory(callCategory(round));
        out[col] += 1;
        out[followCallerOf(round.entry)][col] += 1;
      }
    }
    return out;
  }, [resultEntries, roundFilter, summarySource, month]);
  const monthWithResult = monthBoxes.went + monthBoxes.notWent + monthBoxes.noAnswer + monthBoxes.unclear;
  const monthTotal = monthWithResult + monthBoxes.waiting + monthBoxes.cancelled;
  /** หัวการ์ด — ตามช่วงที่กล่องขั้นตอนของสายนับอยู่ (มีชุดของหน้า) · ไม่มีชุด = ทั้งเดือนแบบเดิม */
  const resultIsDay = !!resultEntries && view === 'day';
  const resultTitle = resultIsDay ? (dayYmd === today ? 'ผลของวันนี้' : 'ผลของวันที่เลือก') : 'ผลของเดือนนี้';
  const resultSub = resultIsDay ? dayPillLabel(dayYmd) : monthLabel(month);

  const overdueAll = useMemo(() => {
    const out: Array<{ row: FollowPlanningRow; round: FollowPlanningRound }> = [];
    for (const row of summarySource) {
      for (const round of row.rounds) {
        // ทั้งเดือนจริง (หัวการ์ดบอก "ทั้งเดือน" · 6 ต.ค. 2569 เดิมไม่กรองเดือน)
        if (round.ymd?.slice(0, 7) !== month) continue;
        if (callCategory(round) === 'overdue') out.push({ row, round });
      }
    }
    return out.sort((a, b) =>
      (a.round.entry.scheduled_at ?? '').localeCompare(b.round.entry.scheduled_at ?? ''),
    );
  }, [summarySource, month]);

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


  return (
    <div className="space-y-4">
      {/* ── หัว "ปฏิทินติดตาม + วันที่" และปุ่มของหน้าย้ายขึ้นแถวบนสุดคู่กับแท็บแล้ว (เจ้าของสั่ง 3 ต.ค. 2569) ── */}
      {/* ── 1. การ์ดตัวเลข 4 ใบ ถูกถอด (เจ้าของเคาะ 3 ต.ค. 2569 — รวมเข้าตารางสายในแผงขั้นตอนข้างล่าง
          เลขชุดเดียวกันอยู่สองที่แล้วชนกันจนงง) · ห้ามเอากลับ ── */}
      {/* ── 2. แถบขั้นตอน = แผงรอบโทร + 7 ช่องสถานะสาย (การ์ดของตัวเอง) ── */}
      {roundsSlot}

      {/* ── 3. รายการหลัก (2/3) + แผงข้างขวา (1/3) ── */}
      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,2.4fr)_minmax(320px,1fr)]">
        <div className="min-w-0 space-y-4">
        <Card className="overflow-hidden rounded-2xl shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3 md:px-5">
            <Tabs
              value={view}
              onValueChange={(v) => {
                setView(v as View);
                onViewChange?.(v as View);
              }}
            >
              {/* จอ 375 ปุ่มรายเดือนล้นการ์ด 16px (QA 5 ต.ค. 2569) ⇒ ช่องไฟแคบลงบนจอเล็ก */}
              <TabsList className="h-9 rounded-full bg-muted p-1">
                <TabsTrigger value="day" className="rounded-full px-2.5 text-xs sm:px-4">
                  รายวัน · สายที่ต้องตาม
                </TabsTrigger>
                <TabsTrigger value="month" className="rounded-full px-2.5 text-xs sm:px-4">
                  รายเดือน · ภาพรวม
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {/* แถวตัวกรองของหน้า (สายที่ · ใครโทร · เจ้าของงาน · ใครเพิ่ม) — หน้าแม่ส่งมา (5 ต.ค. 2569) */}
            {filtersSlot}
            <span className="flex-1" />
            {view === 'day' ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="วันก่อนหน้า"
                  className={NAV_BTN}
                  onClick={() => onSelect(shiftYmd(dayYmd, -1))}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
                <DayPickerPill value={dayYmd} today={today} onPick={onSelect} />
                <button
                  type="button"
                  aria-label="วันถัดไป"
                  className={NAV_BTN}
                  onClick={() => onSelect(shiftYmd(dayYmd, 1))}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="เดือนก่อนหน้า"
                  className={NAV_BTN}
                  onClick={() => onMonthChange(shiftMonth(month, -1))}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => onMonthChange(today.slice(0, 7))}
                  disabled={month === today.slice(0, 7)}
                  className={cn(
                    'inline-flex h-8 items-center rounded-full border px-3 text-[11px] font-medium disabled:opacity-50',
                    TONE.neutral.outline,
                  )}
                >
                  เดือนนี้
                </button>
                <button
                  type="button"
                  aria-label="เดือนถัดไป"
                  className={NAV_BTN}
                  onClick={() => onMonthChange(shiftMonth(month, 1))}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            )}
          </div>

          <div
            role="group"
            aria-label="ความหมายของสี"
            className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border/70 px-4 py-2 text-[11px] text-muted-foreground md:px-5"
          >
            {DAY_LEGEND.map(([tone, label]) => (
              <span key={tone} className="flex items-center gap-1.5">
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-sm', TONE[tone].dot)} aria-hidden />
                {label}
              </span>
            ))}
          </div>

          {view === 'day' ? (
            <>
              {/* ป้าย "N สายไม่ได้ส่งให้ AI — ต้องคนจัดการ" ถอดออก (เจ้าของสั่ง 5 ต.ค. 2569) — สถานะ "ไม่ได้ส่งให้ AI" ยังขึ้นบนแถวของสายนั้น */}
              {roundFilter !== 'all' && !daySlots.includes(roundFilter) ? (
                <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-2.5 md:px-5">
                  <span className="text-[11px] text-muted-foreground">
                    วันที่ {formatYmdDmyBe(dayYmd)} ไม่มี{roundFilterLabel(roundFilter)} — กด "ทุกสาย" ข้างบนเพื่อดูสายอื่น
                  </span>
                </div>
              ) : null}

              {/* 🔴 ตาราง + แถบแบ่งหน้าอยู่เสมอ ว่างก็เป็นแถว "ไม่มีสาย" + เลข 0 (เจ้าของสั่ง 1 ต.ค. 2569 — สลับแท็บแล้วหน้าห้ามย่อ/ขยายเอง) */}
                <>
                  {/**
                   * 🔴 **ตารางมีหัวคอลัมน์** ตามแบบอ้างอิง (แก้ 8 ก.ย. 2569 — เจ้าของทักว่า
                   * *"ทำออกมาให้เหมือนเขาไม่ได้"*) · ของเดิมเป็นลิสต์ อ่านได้แต่ไม่ใช่ทรงเดียวกับเขา
                   * คอลัมน์จับคู่กับของเขา: ผู้สมัคร/ติดต่อ · หน่วยงาน · กำหนด(เวลานัด) ·
                   * สถานะ · บันทึกล่าสุด(สรุป AI) · เบอร์ฉุกเฉิน · จัดการ
                   */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                      <thead>
                        <tr className={cn('border-b border-border', DASH.tableHead)}>
                          <th className="min-w-[210px] px-4 py-2.5 text-[11px] font-medium md:px-5">
                            ผู้ที่ต้องติดตาม / ติดต่อ
                          </th>
                          <th className="min-w-[130px] px-3 py-2.5 text-[11px] font-medium">หน่วยงาน</th>
                          <th className="min-w-[110px] px-3 py-2.5 text-[11px] font-medium">เวลานัด / รอบ</th>
                          <th className="min-w-[140px] px-3 py-2.5 text-[11px] font-medium">สถานะการโทร</th>
                          <th className="min-w-[220px] px-3 py-2.5 text-[11px] font-medium">เขาตอบว่าอะไร</th>
                          <th className="min-w-[150px] px-3 py-2.5 text-[11px] font-medium">เบอร์ฉุกเฉิน</th>
                          <th className="px-3 py-2.5 text-right text-[11px] font-medium md:px-5">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody data-testid="day-calls">
                        {pagePeople.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">
                              <span className="block">
                                ไม่มีสายที่ต้องตาม{roundFilter !== 'all' ? `ใน${roundFilterLabel(roundFilter)}` : ''}
                              </span>
                              {/* วันว่างชี้วันถัดไปที่มีแผน — แผนที่เริ่มวันหน้าไม่ใช่ "แผนหาย" (3 ต.ค. 2569) */}
                              {nextPlannedDay ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="mt-3"
                                  onClick={() => {
                                    onMonthChange(nextPlannedDay.ymd.slice(0, 7));
                                    onSelect(nextPlannedDay.ymd);
                                  }}
                                >
                                  วันถัดไปที่มีแผน · {formatYmdDmyBe(nextPlannedDay.ymd)} ·{' '}
                                  {nextPlannedDay.calls.toLocaleString('th-TH')} สาย
                                </Button>
                              ) : null}
                            </td>
                          </tr>
                        ) : null}
                        {pagePeople.map(({ row, calls, headline }) => {
                          const washTone = callCategoryWashTone(headline);
                          /* ทุกสายของคนนี้ยกเลิกหมด = ทั้งแถวจาง (เดิมตัดสินรายสาย) */
                          const allCancelled = calls.every((c) => c.round.state === 'cancelled');
                          const headTone = roundTone(calls[0].round);
                          /* เบอร์ฉุกเฉินของคนเดียวกันมักเป็นเบอร์เดียว — โชว์ที่ไม่ซ้ำ */
                          const emgList = [
                            ...new Set(
                              calls.map((c) => roundEmergencyPhone(c.round)).filter((v): v is string => Boolean(v)),
                            ),
                          ];
                          const anyResult = calls.some((c) => c.round.state === 'result');
                          return (
                            <tr
                              key={row.group.key}
                              data-category={headline}
                              data-rounds={calls.length}
                              className={cn(
                                'border-b border-border/50 align-top transition-colors last:border-0',
                                /* เขียว=ตอบว่าไป · เหลือง=ไม่ได้คำตอบ · แดง=ตอบว่าไม่ไป
                                   ยังไม่มีผล = ขาว (นิยามอยู่ที่ callCategoryWashTone) */
                                washTone ? TONE[washTone].wash : 'hover:bg-secondary/50',
                                allCancelled && 'opacity-60',
                              )}
                            >
                              <td className="px-4 py-3 md:px-5">
                                <span className="flex items-start gap-2.5">
                                  {/* วงกลมอักษรย่อ — แบบอ้างอิงใช้รูปคน ฐานเราไม่มีรูป */}
                                  <span
                                    className={cn(
                                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-medium',
                                      TONE[headTone].soft,
                                      TONE[headTone].value,
                                    )}
                                    aria-hidden
                                  >
                                    {initials(row.group.name)}
                                  </span>
                                  <span className="min-w-0">
                                    {/* กดชื่อ = แผนทั้งหมดของคนนี้ทุกวัน (เจ้าของ 3 ต.ค. 2569: "อยากดูแผนแยกรายคน") */}
                                    <button
                                      type="button"
                                      onClick={() => onOpenCell(row, '', row.rounds)}
                                      title={`ดูแผนทั้งหมดของ ${row.group.name}`}
                                      className={cn(
                                        'block max-w-full truncate text-left text-[13.5px] font-medium underline-offset-2 hover:text-primary hover:underline',
                                        /* ยกเลิกหมด = สีจาง ไม่ขีดฆ่า (เจ้าของ 6 ต.ค. 2569: "ขีดกลางค่า… ใช้สีไม่ดีกว่าหรอ") */
                                        allCancelled ? 'text-muted-foreground' : 'text-foreground',
                                      )}
                                    >
                                      {row.group.name}
                                    </button>
                                    <span className="block truncate text-[11.5px] text-muted-foreground">
                                      {row.group.phone}
                                    </span>
                                    {/* บอกจำนวนสายไว้ใต้ชื่อ — กันคนอ่านว่าแถวนี้มีสายเดียว */}
                                    {calls.length > 1 ? (
                                      <span className="mt-0.5 block text-[10.5px] text-muted-foreground">
                                        {calls.length} สาย
                                      </span>
                                    ) : null}
                                    {/* ใครเพิ่มเข้ามา (Journey ข้อ 8 · เจ้าของสั่ง 3 ต.ค. 2569 "การ์ดในนี้ต้องบอกด้วยว่าใครเพิ่มมา")
                                        — เดิมต้องเปิดป๊อปจัดการถึงรู้ · "ดึงจาก iRecruit" เป็นชื่อแหล่งอยู่แล้ว ไม่เติมคำนำ */}
                                    {row.group.createdByName ? (
                                      <span className="mt-0.5 block truncate text-[10.5px] text-muted-foreground">
                                        {row.group.createdByName.startsWith('ดึงจาก')
                                          ? row.group.createdByName
                                          : `เพิ่มโดย ${row.group.createdByName}`}
                                      </span>
                                    ) : null}
                                  </span>
                                </span>
                              </td>
                              {/* 🔴 หน่วยงานโชว์ทุกจอ (5 ต.ค. 2569 เจ้าของเจอ "ชื่อหน่วยงานหาย" บนมือถือ — ตารางกลับเป็นแบบเดิมแล้วคอลัมน์นี้ยังซ่อนต่ำกว่า lg) */}
                              <td className="px-3 py-3 text-[12px] text-muted-foreground">
                                {row.group.unitName || '—'}
                              </td>

                              {/**
                               * 🔴 สามคอลัมน์ถัดไปเรียงบรรทัด **ตรงกันทีละรอบ** — บรรทัดที่ N
                               * ของทุกคอลัมน์คือสายเดียวกัน ถ้าเรียงไม่ตรง คนจะอ่านคำตอบผิดสาย
                               * (ใช้ `space-y-2` ชุดเดียวกันทั้งสามช่อง ห้ามใส่ระยะต่างกัน)
                               */}
                              <td className="px-3 py-3">
                                <span className="block space-y-2">
                                  {calls.map(({ round, slot }) => (
                                    <span key={round.entry.id} className="flex items-center gap-1.5">
                                      <span className="min-w-0">
                                        <span
                                          className={cn(
                                            'block text-[15px] font-medium leading-none tabular-nums',
                                            // ยกเลิก = สีจาง ไม่ขีดฆ่า (6 ต.ค. 2569) — ป้าย "ยกเลิก" ในช่องสถานะบอกอยู่แล้ว
                                            round.state === 'cancelled' ? 'text-muted-foreground' : 'text-foreground',
                                          )}
                                        >
                                          {round.entry.time_tbd ? 'ยังไม่ระบุเวลา' : (round.time ?? '—')}
                                        </span>
                                        <span className="mt-0.5 block whitespace-nowrap text-[10.5px] text-muted-foreground">
                                          {/* "วันที่ 2 · สายที่ 1" — ลำดับในวัน ไม่ใช่เลขทั้งชุด (1 ต.ค. 2569) */}
                                          {callLabelOf(round, slot)}
                                        </span>
                                      </span>
                                      {/* ดินสอติดกับ **รอบนั้น** — แก้เวลาได้ทีละสายโดยไม่ต้องเข้าป๊อป */}
                                      {onEditRound && round.state !== 'cancelled' && !round.entry.completed_at ? (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => onEditRound(round)}
                                          title={`แก้ไขวัน/เวลาของสายนี้ · ${row.group.name}`}
                                          aria-label={`แก้ไขวันเวลาของ ${row.group.name} ${callLabelOf(round, slot)}`}
                                          className="h-7 w-7 shrink-0 rounded-full"
                                        >
                                          <Pencil aria-hidden />
                                        </Button>
                                      ) : null}
                                    </span>
                                  ))}
                                </span>
                              </td>

                              <td className="px-3 py-3">
                                <span className="block space-y-2">
                                  {calls.map(({ round, category }) => {
                                    const tone = roundTone(round);
                                    /**
                                     * 🔴 **ส่งไม่ถึง Lumos ต้องเห็นบนแถว** (11 ก.ย. 2569)
                                     * วัดจริงวันนั้น 12 จาก 42 สายเป็น push_failed ไม่ได้ผลสักสาย
                                     * แต่จอขึ้นว่า "เลยเวลานัด" เหมือนสายที่เขารับไปแล้วแต่เงียบ
                                     * — คนละปัญหา อันนี้สายไม่ได้ออก อันนั้นออกแล้วรอผล
                                     *
                                     * ⚠️ **ไม่มีปุ่ม "ส่งใหม่" ด้วยมือ** (เจ้าของเคาะ 13 ก.ย. 2569: ใช้โทรเองแทน)
                                     * ⇒ ข้อความต้องชี้ไปที่ปุ่มโทรที่มีจริงในแถว ห้ามบอกให้ "กดส่งใหม่"
                                     */
                                    const failed = roundPushFailed(round);
                                    /* ผลที่คนลงเอง = คำของปุ่มที่เขากด ("คนโทร: ติดต่อสำเร็จ") — ไม่ใช่หัวหมวดของ AI */
                                    // ป้ายตัวเดียวกับสรุปแผน/รูป (`followRoundLabel` · 6 ต.ค. 2569)
                                    const chipText = followRoundLabel(round);
                                    return (
                                      <span
                                        key={round.entry.id}
                                        className="flex min-h-[34px] flex-wrap items-center gap-1"
                                      >
                                        {/* ป้ายสถานะ = เม็ดยากลม มีจุดสีนำหน้า (ตามแบบอ้างอิง) */}
                                        <span
                                          className={cn(
                                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
                                            TONE[tone].chip,
                                          )}
                                        >
                                          {isGoodResult(round) ? (
                                            <Check className="h-3 w-3" aria-hidden />
                                          ) : (
                                            <span className={cn('h-1.5 w-1.5 rounded-full', TONE[tone].dot)} aria-hidden />
                                          )}
                                          {chipText}
                                        </span>
                                        {failed ? (
                                          <span
                                            className={cn(
                                              'inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium',
                                              TONE.orange.chip,
                                            )}
                                            title={
                                              roundPushError(round) ??
                                              'ส่งไปหา Lumos ไม่สำเร็จ — ไม่มีสายไหนกำลังจะออก กดปุ่มโทรข้างชื่อเพื่อโทรเอง'
                                            }
                                          >
                                            ส่งไม่ถึง Lumos
                                          </span>
                                        ) : null}
                                      </span>
                                    );
                                  })}
                                </span>
                              </td>

                              <td className="px-3 py-3">
                                <span className="block space-y-2">
                                  {calls.map(({ round }) => {
                                    const ai = roundAiSummary(round);
                                    const reply = roundReplyText(round);
                                    const pushErr = roundPushFailed(round) ? roundPushError(round) : null;
                                    const e = round.entry;
                                    /**
                                     * 🔴 **สายที่คนโทร ลงผลในช่องนี้ 2 ขั้น** (เจ้าของเคาะ 6 ต.ค. 2569 — แทน "ติดต่อสำเร็จ / ไม่สำเร็จ" ของ 1 ต.ค.)
                                     * *"ถ้าเป็นคนโทรเองไม่ต้องเก็บผลคำตอบ แต่ต้องเก็บว่าเขาไปหรือไม่ไป"* ⇒ ช่องนี้ของสายคนโทร = ปุ่ม
                                     * ไป / ไม่ไป / ขอเลื่อน / ติดต่อไม่ได้ → ถามจบเรื่องเลยไหม (`FollowStaffCallControls` ตัวเดียวกับป๊อปจัดการ)
                                     * ยกเลิกสายต้องยืนยันในที่เดิมก่อน (ย้อนไม่ได้) · ปิดงานจากป๊อปไปแล้วโดยไม่มีผล = โชว์แบบเดิม
                                     */
                                    const manualRow =
                                      Boolean(onStaffResult && onCancelRound) &&
                                      e.call_mode === 'manual' &&
                                      round.state !== 'cancelled' &&
                                      !(round.state === 'closed' && !e.staff_call_outcome);
                                    const busy = busyId === e.id;
                                    return (
                                      <span key={round.entry.id} className="flex min-h-[34px] flex-col justify-center">
                                        {/* 🔴 คำพูดของเขามาก่อนเสมอ (สาย AI) — หัวคอลัมน์ถามว่า "เขาตอบว่าอะไร"
                                            🔴 ปุ่มอยู่บรรทัดเดียวเสมอ (ตัดบรรทัด = บรรทัดของคอลัมน์นี้ไม่ตรงกับเวลาของสายนั้น) */}
                                        {manualRow && confirmCancelId === e.id ? (
                                          <span className="flex flex-nowrap items-center gap-1 whitespace-nowrap">
                                            <span className="text-[11px] text-muted-foreground">ยกเลิกสายนี้ไหม</span>
                                            <Button
                                              type="button"
                                              variant="destructive"
                                              size="xs"
                                              disabled={busy}
                                              onClick={() => {
                                                setConfirmCancelId(null);
                                                void onCancelRound?.(round);
                                              }}
                                            >
                                              ยกเลิกเลย
                                            </Button>
                                            <Button type="button" variant="outline" size="xs" onClick={() => setConfirmCancelId(null)}>
                                              ไม่
                                            </Button>
                                          </span>
                                        ) : manualRow ? (
                                          <FollowStaffCallControls
                                            compact
                                            entry={e}
                                            busy={busy}
                                            onRecord={(o) => onStaffResult?.(round, o, row)}
                                            onFinish={(o) => onFinishRound?.(round, o)}
                                            extra={
                                              round.state !== 'closed' ? (
                                                <Button
                                                  type="button"
                                                  variant="outline"
                                                  size="xs"
                                                  disabled={busy}
                                                  onClick={() => setConfirmCancelId(e.id)}
                                                >
                                                  ยกเลิก
                                                </Button>
                                              ) : null
                                            }
                                          />
                                        ) : round.state === 'result' && isStaffCallResult(e) ? (
                                          /* ผลที่คนลงเอง (สายที่ปิดแล้ว/จอที่อ่านอย่างเดียว) — หมายเหตุ หรือใครลงเมื่อไหร่ */
                                          <span className="text-[12px] leading-snug text-muted-foreground">
                                            {e.staff_call_note ||
                                              [
                                                e.staff_called_by_name,
                                                e.staff_called_at ? `${STAFF_AT.format(new Date(e.staff_called_at))} น.` : null,
                                              ]
                                                .filter(Boolean)
                                                .join(' · ') ||
                                              followStaffCallText(e.staff_call_outcome ?? '')}
                                          </span>
                                        ) : pushErr ? (
                                          /* เหตุจริงจาก Lumos — มีค่ากว่าขีดกลางว่าง ๆ */
                                          <span className={cn('text-[11.5px] leading-snug', TONE.orange.value)} title={pushErr}>
                                            ส่งไม่สำเร็จ: <span className="line-clamp-2">{pushErr}</span>
                                          </span>
                                        ) : reply ? (
                                          <>
                                            {/* คำพูดจริงอย่างเดียว · สรุปของ AI ย้ายไปอยู่ตอนชี้ (QA 5 ต.ค. 2569: ร้อยแก้วทุกแถว) */}
                                            <span
                                              className="line-clamp-2 text-[12.5px] font-medium leading-snug text-foreground"
                                              title={ai ? `${reply}\n\nAI สรุป: ${ai}` : reply}
                                            >
                                              “{reply}”
                                            </span>
                                          </>
                                        ) : ai ? (
                                          <span className="line-clamp-3 text-[12px] leading-snug text-foreground/80" title={ai}>
                                            {ai}
                                          </span>
                                        ) : round.state === 'result' ? (
                                          /* ห้ามเขียนว่า "เขาไม่พูด" — ไม่มี transcript อาจแปลว่าสายไม่ติดก็ได้ */
                                          <span className="text-[12px] text-muted-foreground">
                                            ไม่มีคำตอบและไม่มีสรุปจาก AI
                                          </span>
                                        ) : round.state === 'notSent' &&
                                          !roundDispatchReason(round).startsWith(FOLLOW_CALL_CATEGORY_LABEL.notSent) ? (
                                          <span className="text-[12px] text-muted-foreground">{roundDispatchReason(round)}</span>
                                        ) : round.state === 'overdue' ? (
                                          /**
                                           * 🔴 "เลยเวลานัด" ไม่บอกว่า **ส่งไปแล้วหรือยัง** (ตาใหม่ถาม 13 ก.ย. 2569)
                                           * สภาพนี้แปลว่า **ส่งให้ AI แล้ว** (มีแถวในคิว) แค่ผลยังไม่กลับ —
                                           * คนละเรื่องกับ "ไม่ได้ส่งให้ AI" ที่อยู่บรรทัดข้างบน · ต้องเขียนให้ต่างกัน
                                           * ไม่งั้นคนใหม่ไม่รู้ว่าควรรอ หรือควรโทรเอง
                                           */
                                          <span className="text-[12px] text-muted-foreground">
                                            ส่งให้ AI แล้ว ยังไม่มีผลกลับ
                                          </span>
                                        ) : (
                                          <span className="text-[12px] text-muted-foreground">—</span>
                                        )}
                                        {/* ประวัติ: ปุ่ม ไป/ไม่ไป เคยอยู่ตรงนี้เช้า 3 ต.ค. แล้วถอดไปป๊อปจัดการ · 6 ต.ค. 2569 เจ้าของสั่งใหม่ให้กลับมา
                                            (เฉพาะสายคนโทร · 2 ขั้น · ตัวเดียวกับป๊อป) */}
                                      </span>
                                    );
                                  })}
                                </span>
                              </td>

                              {/* 🔴 **ห้ามซ่อนคอลัมน์นี้** (เจ้าของทัก 10 ก.ย. 2569:
                                  *"ไม่แสดงการโทรติดต่อเบอร์ฉุกเฉิน คือ ไม่ยอมบอกว่าโทรหาหรือยัง"*)
                                  เดิมเป็น `hidden xl:table-cell` ⇒ จอแคบกว่า 1280px มองไม่เห็นเลย
                                  ข้อมูลมีอยู่ในหน้าแต่ CSS ซ่อนไว้ = เท่ากับไม่มี */}
                              <td className="px-3 py-3">
                                {emgList.length > 0 ? (
                                  <span className="block text-[11.5px] text-muted-foreground">
                                    {emgList.map((p) => (
                                      <span key={p} className="block tabular-nums text-foreground">
                                        {p}
                                      </span>
                                    ))}
                                    {/**
                                     * ⚠️ **บอกได้แค่ "แนบเบอร์ไปแล้ว" ไม่ใช่ "โทรไปแล้ว"**
                                     * ตรวจผลจริง 18 สาย (10 ก.ย. 2569): 23 ช่องที่ Lumos ส่งกลับ
                                     * ไม่มีช่องไหนบอกว่าโทรเบอร์ฉุกเฉินหรือยัง และไม่มีผลไหน
                                     * เอ่ยถึงเบอร์นี้เลย · เขียนว่า "โทรแล้ว" เมื่อไหร่คือจอโกหก
                                     * QA 5 ต.ค. 2569: ย่อเหลือสถานะสั้น (เดิม "แนบไปกับสายแล้ว · Lumos ไม่ได้บอกว่าโทรหรือยัง")
                                     * ⚠️ ห้ามถอดทั้งบรรทัด — เจ้าของทัก 10 ก.ย. ว่า "ไม่ยอมบอกว่าโทรหาหรือยัง"
                                     */}
                                    <span className="block text-[10.5px]">ยังไม่รู้ว่าโทรหรือยัง</span>
                                  </span>
                                ) : (
                                  <span
                                    className={cn('inline-block rounded px-1.5 py-0.5 text-[10.5px] font-medium', TONE.warn.chip)}
                                  >
                                    ไม่ได้แนบเบอร์ฉุกเฉิน
                                  </span>
                                )}
                              </td>

                              <td className="px-3 py-3 text-right md:px-5">
                                <span className="inline-flex items-center gap-1.5">
                                  {/* แบบอ้างอิงมีปุ่มโทรในแถว — ของเราลิงก์ tel: ไปแอปโทรของเครื่อง */}
                                  <a
                                    href={`tel:${row.group.phone}`}
                                    aria-label={`โทรหา ${row.group.name}`}
                                    title={`โทรหา ${row.group.name} · ${row.group.phone}`}
                                    className={cn(
                                      'inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
                                      TONE.info.outline,
                                    )}
                                  >
                                    <Phone className="h-3.5 w-3.5" aria-hidden />
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onOpenCell(
                                        row,
                                        calls[0].round.ymd ?? dayYmd,
                                        calls.map((c) => c.round),
                                      )
                                    }
                                    title={
                                      calls.length > 1
                                        ? `ดูรายละเอียดและจัดการทั้ง ${calls.length} สายของคนนี้`
                                        : 'ดูรายละเอียดและจัดการสายนี้'
                                    }
                                    className={cn(
                                      'inline-flex h-8 items-center rounded-full border px-3 text-[11px] font-medium transition-colors',
                                      TONE.neutral.outline,
                                    )}
                                  >
                                    จัดการ
                                  </button>
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* แถบแบ่งหน้า — แบบอ้างอิงมี "แสดง 1 ถึง 4 จากทั้งหมด 48 รายการติดตาม" */}
                  <div className="flex flex-wrap items-center gap-2 border-t border-border/70 px-4 py-3 md:px-5">
                    <span className="text-[11.5px] text-muted-foreground">
                      แสดง {dayPeople.length === 0 ? 0 : firstIndex + 1} ถึง {lastIndex} จากทั้งหมด{' '}
                      {dayPeople.length.toLocaleString('th-TH')} คน ·{' '}
                      {/* สายของคนที่ยังอยู่ในตาราง (คนที่จัดการจบแล้วไปอยู่การ์ดข้างล่าง) */}
                      {dayPeople.reduce((n, p) => n + p.calls.length, 0).toLocaleString('th-TH')} สาย
                      {/**
                       * 🔴 เหลือแค่เวลาอัปเดต (เจ้าของสั่ง 1 ต.ค. 2569 · Choice "เอาออกทั้ง 2 จุด")
                       * ประโยคอธิบายเรื่องหน้าดึงเอง/ผลกลับช้าถูกถอดทั้งคู่ — ห้ามเติมกลับ
                       * (หน้ายัง auto-reload ทุก 25 วิเหมือนเดิม)
                       */}
                      {lastLoadedAt ? (
                        <span className="block text-[11px] text-muted-foreground">
                          อัปเดตล่าสุด{' '}
                          <span className="tabular-nums">
                            {lastLoadedAt.toLocaleTimeString('th-TH', {
                              timeZone: 'Asia/Bangkok',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>{' '}
                          น.
                        </span>
                      ) : null}
                    </span>
                    <span className="ml-auto flex flex-wrap items-center gap-2">
                    {/* ต่อหน้า 10 / 15 — อยู่เสมอแม้มีหน้าเดียว (หน้าห้ามย่อ/ขยายเองตามจำนวนข้อมูล) */}
                    <span className="flex items-center gap-1.5">
                      <span className="text-[11.5px] text-muted-foreground">ต่อหน้า</span>
                      <ChoiceDropdown<string>
                        value={String(dayPageSize)}
                        options={DAY_PAGE_SIZES.map((n) => ({ value: String(n), label: `${n} คน` }))}
                        onChange={(v) => setDayPageSize(Number(v) as DayPageSize)}
                        ariaLabel="จำนวนคนต่อหน้า"
                      />
                    </span>
                    {pageCount > 1 ? (
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="หน้าก่อนหน้า"
                          disabled={page <= 1}
                          onClick={() => setPage((n) => Math.max(1, n - 1))}
                          className={cn(NAV_BTN, 'disabled:opacity-40')}
                        >
                          <ChevronLeft className="h-4 w-4" aria-hidden />
                        </button>
                        {/* "1/13" แทนปุ่มเลขทุกหน้า (เจ้าของ 5 ต.ค. 2569: *"แถบหน้า 1 2 3 4 มันเยอะไปทำให้มันแบบเป็น 1/... ได้ไหม"*)
                            — รูปเดียวกับตัวเปลี่ยนหน้าของมุมมองรายเดือน */}
                        {/* 🔴 กด "1/13" แล้วเลือกหน้าได้เลย (เจ้าของ 6 ต.ค. 2569 *"เอาเป็น Dropdown ทีมงานบอกขี้เกียจเลื่อนทีละหน้า"*) */}
                        <span aria-current="page" data-testid="day-page-indicator">
                          <ChoiceDropdown<string>
                            value={String(page)}
                            options={pageOptions(pageCount)}
                            onChange={(v) => setPage(Number(v))}
                            ariaLabel="เลือกหน้า"
                          />
                        </span>
                        <button
                          type="button"
                          aria-label="หน้าถัดไป"
                          disabled={page >= pageCount}
                          onClick={() => setPage((n) => Math.min(pageCount, n + 1))}
                          className={cn(NAV_BTN, 'disabled:opacity-40')}
                        >
                          <ChevronRight className="h-4 w-4" aria-hidden />
                        </button>
                      </span>
                    ) : null}
                    </span>
                  </div>
                </>
            </>
          ) : (
            <div ref={scrollRef} className="overflow-x-auto">
              <table className="min-w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border/70">
                    <th className="sticky left-0 z-10 min-w-[210px] max-w-[260px] bg-card px-4 py-2 text-left text-[11px] font-medium text-muted-foreground md:px-5">
                      คนที่ต้องติดตาม · ทั้งเดือนนี้
                    </th>
                    {cols.map((c) => {
                      const selected = selectedYmd === c.ymd;
                      return (
                        <th
                          key={c.ymd}
                          data-ymd={c.ymd}
                          className={cn('p-0.5', c.isSunday && 'bg-secondary/40')}
                        >
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
                  {/* ว่างทั้งเดือน = หัวตาราง (วันทั้งเดือน) ยังอยู่ + แถวเดียวบอกว่าไม่มีนัด — ไม่สลับไปเป็นย่อหน้า */}
                  {monthRows.length === 0 ? (
                    <tr>
                      <td colSpan={cols.length + 1} className="px-5 py-10 text-center text-sm text-muted-foreground">
                        ไม่มีนัดโทรเดือนนี้
                      </td>
                    </tr>
                  ) : null}
                  {monthPageRows.map(({ row, byDay }) => {
                    // ช่องเดียวกับแผงขั้นตอน — รวมทุกช่อง = N สาย (6 ต.ค. 2569 "บวกลบกันแล้วต้องเท่ากัน")
                    const monthCalls = row.rounds.filter((r) => r.ymd?.slice(0, 7) === month);
                    const colCount = new Map<string, number>();
                    for (const r of monthCalls) {
                      const col = followMatrixColOfCategory(callCategory(r));
                      colCount.set(col, (colCount.get(col) ?? 0) + 1);
                    }
                    const parts = (['went', 'notWent', 'noAnswer', 'unclear', 'waiting', 'cancelled'] as const)
                      .map((c) => [c, colCount.get(c) ?? 0] as const)
                      .filter(([, n]) => n > 0);
                    return (
                      <tr key={row.group.key} className="border-b border-border/50 last:border-0">
                        <td className="sticky left-0 z-10 max-w-[260px] bg-card px-4 py-2 align-top md:px-5">
                          {/* กดชื่อ = แผนทั้งหมดของคนนี้ (เจ้าของ 3 ต.ค. 2569) — ไม่ต้องไล่กดทีละช่องวัน */}
                          <button
                            type="button"
                            onClick={() => onOpenCell(row, '', row.rounds)}
                            title={`ดูแผนทั้งหมดของ ${row.group.name}`}
                            className="block max-w-full truncate text-left text-[12px] font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
                          >
                            {row.group.name}
                          </button>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {row.group.unitName || row.group.phone}
                          </span>
                          <span className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[10px]">
                            <span className="font-medium tabular-nums text-foreground">
                              {monthCalls.length} สาย
                            </span>
                            {parts.map(([c, n]) => (
                              <span key={c} className={cn('font-medium', TONE[FOLLOW_MATRIX_COL_TONE[c]].value)}>
                                {FOLLOW_MATRIX_COL_LABEL[c]} {n}
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
                                  {rounds.slice(0, 1).map((r) => (
                                    <span
                                      key={r.entry.id}
                                      className={cn(
                                        'block rounded px-0.5 py-0.5 leading-tight',
                                        TONE[roundTone(r)].chip,
                                        r.state === 'cancelled' && 'opacity-60',
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          'block text-[10px] font-medium tabular-nums',
                                        )}
                                      >
                                        {r.time ?? '—'}
                                      </span>
                                      <span className="block truncate text-[9px] font-medium leading-tight">
                                        {FOLLOW_CALL_CATEGORY_LABEL[callCategory(r)]}
                                      </span>
                                    </span>
                                  ))}
                                  {rounds.length > 1 ? (
                                    <span className="text-[9px] font-medium text-primary">
                                      +{rounds.length - 1}
                                    </span>
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
          {/* ตัวเปลี่ยนหน้ารายเดือน — อยู่เสมอ (หน้าเดียวก็โชว์ 1 / 1 · ว่างแล้วห้ามหาย) */}
          {view === 'month' ? (
            <div
              className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-4 py-3 md:px-5"
              data-testid="month-pager"
            >
              <span className="text-xs tabular-nums text-muted-foreground">
                แสดง {monthRows.length === 0 ? 0 : monthFirst + 1} ถึง {monthLast} จากทั้งหมด{' '}
                {monthRows.length.toLocaleString('th-TH')} คน
              </span>
              <span className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="iconXs"
                  variant="outline"
                  aria-label="หน้าก่อนหน้า (รายเดือน)"
                  disabled={monthSafePage <= 1}
                  onClick={() => setMonthPage(monthSafePage - 1)}
                >
                  <ChevronLeft aria-hidden />
                </Button>
                {/* เลือกหน้าได้เลย (6 ต.ค. 2569) — ตัวเดียวกับรายวัน */}
                <span aria-current="page" data-testid="month-page-indicator">
                  <ChoiceDropdown<string>
                    value={String(monthSafePage)}
                    options={pageOptions(monthPageCount)}
                    onChange={(v) => setMonthPage(Number(v))}
                    ariaLabel="เลือกหน้า (รายเดือน)"
                  />
                </span>
                <Button
                  type="button"
                  size="iconXs"
                  variant="outline"
                  aria-label="หน้าถัดไป (รายเดือน)"
                  disabled={monthSafePage >= monthPageCount}
                  onClick={() => setMonthPage(monthSafePage + 1)}
                >
                  <ChevronRight aria-hidden />
                </Button>
              </span>
            </div>
          ) : null}
        </Card>
        {/* คนที่จัดการจบแล้วของวันนั้น — การ์ดแยกใต้ตาราง (เจ้าของ 6 ต.ค. 2569 · Choice "การ์ดแยกใต้ตาราง") */}
        {view === 'day' && splitDone ? (
          <FollowDayDoneCard
            people={donePeople}
            onOpen={(p) => onOpenCell(p.row, p.calls[0]?.round.ymd ?? dayYmd, p.calls.map((c) => c.round))}
          />
        ) : null}
        </div>

        {/* ── แผงข้างขวา ── */}
        <div className="space-y-4">
          <Card className="rounded-2xl p-5 shadow-sm">
            <h3 className="text-[13px] font-medium text-foreground">{resultTitle}</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {resultSub}
              {roundFilter !== 'all' ? ` · เฉพาะ${roundFilterLabel(roundFilter)}` : ''}
            </p>
            {/**
             * 🔴 **วงกลมอยู่เสมอ ไม่มีผลก็ 0%** (เจ้าของสั่ง 1 ต.ค. 2569 — "ถ้าไม่มีข้อมูลก็เป็น 0 ไป" · สลับแท็บแล้วการ์ดห้ามเปลี่ยนทรง)
             * แทนของ 12 ก.ย. ที่สลับวงกลมไปเป็นกล่องข้อความ + ประโยคอธิบาย (สูงไม่เท่าวงกลม)
             */}
            <div className="mt-3">
              <Donut percent={monthWithResult > 0 ? (monthBoxes.went / monthWithResult) * 100 : 0} caption="ตอบว่าไป" />
            </div>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{`จาก ${monthWithResult} สายที่มีผล`}</p>

            {/* 4 ช่องชุดเดียวกับกล่องขั้นตอนของสาย แยก AI โทร / คนโทร (6 ต.ค. 2569) — AI + คน = รวม */}
            <div className="mt-3 border-t border-border/70 pt-3 text-[12px]" data-testid="month-result-boxes">
              <div className="grid grid-cols-[1fr_auto_auto_auto] items-baseline gap-x-3 gap-y-1.5">
                <span />
                <span className="text-right text-[11px] text-muted-foreground">AI โทร</span>
                <span className="text-right text-[11px] text-muted-foreground">คนโทร</span>
                <span className="text-right text-[11px] text-muted-foreground">รวม</span>
                {(['went', 'notWent', 'noAnswer', 'unclear', 'waiting', 'cancelled'] as const).map((k) => (
                  <React.Fragment key={k}>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TONE[FOLLOW_MATRIX_COL_TONE[k]].dot)} aria-hidden />
                      {FOLLOW_MATRIX_COL_LABEL[k]}
                    </span>
                    <span className="text-right tabular-nums text-foreground" data-testid={`month-${k}-ai`}>{monthBoxes.ai[k]}</span>
                    <span className="text-right tabular-nums text-foreground" data-testid={`month-${k}-manual`}>{monthBoxes.manual[k]}</span>
                    <span className={cn('text-right font-medium tabular-nums', TONE[FOLLOW_MATRIX_COL_TONE[k]].value)}>{monthBoxes[k]}</span>
                  </React.Fragment>
                ))}
                {/* แถวทั้งหมด = เลข "ทั้งหมด" ของกล่องขั้นตอนของสาย */}
                <span className="border-t border-border/70 pt-1.5 font-medium text-foreground">{FOLLOW_MATRIX_COL_LABEL.total}</span>
                {(['ai', 'manual'] as const).map((c) => (
                  <span key={c} className="border-t border-border/70 pt-1.5 text-right tabular-nums text-foreground" data-testid={`month-total-${c}`}>
                    {Object.values(monthBoxes[c]).reduce((a, b) => a + b, 0)}
                  </span>
                ))}
                <span className="border-t border-border/70 pt-1.5 text-right font-medium tabular-nums text-foreground" data-testid="month-total">
                  {monthTotal}
                </span>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden rounded-2xl shadow-sm">
            <div className="flex items-center gap-2 px-4 pt-4">
              <PhoneOff className={cn('h-4 w-4', TONE.warn.value)} aria-hidden />
              <h3 className="text-[13px] font-medium text-foreground">ต้องตามด่วน · ทั้งเดือน</h3>
              <span
                className={cn('ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium', TONE.warn.chip)}
              >
                {overdueAll.length}
              </span>
            </div>
            {/* ประโยคสอนวิธีใช้ถอดแล้ว (QA 5 ต.ค. 2569) — ปุ่มโทรอยู่ข้างชื่อทุกแถว · "ทั้งเดือน" อยู่บนหัว */}
            <div className="pb-3" />
            {overdueAll.length === 0 ? (
              <p
                className={cn(
                  'mx-4 mb-4 rounded-xl px-3 py-3 text-center text-[12px]',
                  TONE.success.soft,
                  TONE.success.value,
                )}
              >
                ไม่มีสายค้าง
              </p>
            ) : (
              <ul className="divide-y divide-border/60 border-t border-border/70">
                {overdueAll.slice(0, 6).map(({ row, round }) => (
                  <li key={round.entry.id} className="flex items-center gap-2 px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => onOpenCell(row, round.ymd ?? dayYmd, [round])}
                      className="min-w-0 flex-1 text-left"
                      title="กดเพื่อดูรายละเอียดและจัดการสายนี้"
                    >
                      <span className="block truncate text-[12.5px] font-medium text-foreground">
                        {row.group.name}
                      </span>
                      <span className={cn('block text-[11px] font-medium', TONE.warn.value)}>
                        {round.ymd ? formatYmdDmyBe(round.ymd) : '—'} {round.time ?? ''}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {row.group.unitName || row.group.phone}
                      </span>
                    </button>
                    {/* แบบอ้างอิงมีปุ่มโทรในรายการ — ของเราลิงก์ tel: ไปแอปโทรของเครื่อง */}
                    <a
                      href={`tel:${row.group.phone}`}
                      aria-label={`โทรหา ${row.group.name}`}
                      title={`โทรหา ${row.group.name} · ${row.group.phone}`}
                      className={cn(
                        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors',
                        TONE.info.outline,
                      )}
                    >
                      <Phone className="h-4 w-4" aria-hidden />
                    </a>
                  </li>
                ))}
                {overdueAll.length > 6 ? (
                  <li className="px-4 py-2 text-[11px] text-muted-foreground">
                    และอีก {overdueAll.length - 6} สาย — ดูครบในรายการหลัก
                  </li>
                ) : null}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default FollowPlanningCalendar;
