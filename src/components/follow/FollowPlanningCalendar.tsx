import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Clock, Phone, PhoneOff, X } from 'lucide-react';
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
  filterPlanningRowsByRound,
  isGoodResult,
  monthDayColumns,
  personMonthSummary,
  roundAiSummary,
  roundDispatchReason,
  roundEmergencyPhone,
  roundResultLabel,
  roundTone,
  summarizeFollowCalls,
  type FollowCallCategory,
  type FollowPlanningRound,
  type FollowPlanningRow,
  type FollowRoundFilter,
} from '@/lib/followPlanning';
import { DASH } from '@/lib/designTokens';
import { Card } from '@/components/ui/card';
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

/** จำนวนสายต่อหน้าในตารางรายวัน (แบบอ้างอิงแบ่งหน้าเหมือนกัน) */
const DAY_PAGE_SIZE = 12;

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

/** คำอธิบายสี — ชุดเดียวใช้ทั้งสองมุมมอง (คำของเจ้าของ ปรับให้ตรงแผงข้างบน 8 ก.ย. 2569) */
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

/**
 * การ์ดตัวเลขแบบแบบอ้างอิง — ตราไอคอนมุมขวาบน · เลขใหญ่ · บรรทัดความหมายคั่นเส้นที่ท้าย
 * (ของเดิมเป็นช่องในแถวเดียว ไม่มีตราและไม่มีบรรทัดท้าย)
 */
const StatCard: React.FC<{
  label: string;
  value: number;
  tone: keyof typeof TONE;
  icon: React.ReactNode;
  foot: React.ReactNode;
}> = ({ label, value, tone, icon, foot }) => (
  /* `data-stat` = จุดยึดของเทสต์ — โครงการ์ดเปลี่ยนหน้าตาได้ แต่เทสต์ยังเล็งค่าถูกใบ */
  <Card data-stat={label} className="flex flex-col justify-between rounded-2xl p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <span className="text-[13px] font-medium leading-snug text-muted-foreground">{label}</span>
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          TONE[tone].soft,
          TONE[tone].value,
        )}
        aria-hidden
      >
        {icon}
      </span>
    </div>
    <p className={cn('mt-3 text-[40px] font-bold leading-none tabular-nums', TONE[tone].value)}>
      {value.toLocaleString('th-TH')}
    </p>
    <p className="mt-4 border-t border-border/70 pt-2.5 text-[11px] leading-snug text-muted-foreground">
      {foot}
    </p>
  </Card>
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
        className="fill-foreground text-[24px] font-bold"
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
  roundFilter: FollowRoundFilter;
  /** แผงรอบโทร + 7 ช่องสถานะสาย — วางเป็นการ์ดของตัวเองใต้การ์ดตัวเลข */
  roundsSlot?: React.ReactNode;
  /** ปุ่มของหน้าแม่ (เพิ่มคน · เลือกวัน · เพิ่มเรื่อง/เจ้าหน้าที่ · รีเฟรช) */
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
  const daySummary = useMemo(() => summarizeFollowCalls(dayCalls.map((c) => c.round)), [dayCalls]);

  /** แบ่งหน้าแบบแบบอ้างอิง — เปลี่ยนวัน/รอบแล้วต้องเด้งกลับหน้า 1 ไม่งั้นค้างหน้าว่าง */
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [dayYmd, roundFilter]);
  const pageCount = Math.max(1, Math.ceil(dayCalls.length / DAY_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const firstIndex = (safePage - 1) * DAY_PAGE_SIZE;
  const lastIndex = Math.min(firstIndex + DAY_PAGE_SIZE, dayCalls.length);
  const pageCalls = dayCalls.slice(firstIndex, lastIndex);

  /* ─── มุมมองรายเดือน ─── */
  const monthSource = useMemo(
    () => (roundFilter === 'all' ? rows : filterPlanningRowsByRound(rows, roundFilter)),
    [rows, roundFilter],
  );
  const monthRows = useMemo(() => buildFollowMonthRows(monthSource, month), [monthSource, month]);
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
  const monthSummary = useMemo(
    () =>
      summarizeFollowCalls(
        monthSource.flatMap((r) => r.rounds.filter((x) => x.ymd?.slice(0, 7) === month)),
      ),
    [monthSource, month],
  );
  const decided = monthSummary.went + monthSummary.notWent;
  const wentRate = decided > 0 ? (monthSummary.went / decided) * 100 : null;

  const overdueAll = useMemo(() => {
    const out: Array<{ row: FollowPlanningRow; round: FollowPlanningRound }> = [];
    for (const row of monthSource) {
      for (const round of row.rounds) {
        if (callCategory(round) === 'overdue') out.push({ row, round });
      }
    }
    return out.sort((a, b) =>
      (a.round.entry.scheduled_at ?? '').localeCompare(b.round.entry.scheduled_at ?? ''),
    );
  }, [monthSource]);

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
    <div className="space-y-4">
      {/* ── หัวเรื่อง + ปุ่มทั้งหมดของหน้า (แบบอ้างอิงวางปุ่มหลักไว้มุมขวาบน) ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[20px] font-bold leading-tight text-foreground">ปฏิทินติดตาม</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            {view === 'day' ? dayHeading(dayYmd) : monthLabel(month)}
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">{headerAction}</div>
      </div>

      {/* ── 1. การ์ดตัวเลข 4 ใบ ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="สายที่ต้องตาม"
          value={daySummary.total}
          tone="neutral"
          icon={<Phone className="h-5 w-5" />}
          foot="ทุกสายของวันที่เลือก ไม่นับที่ยกเลิก"
        />
        <StatCard
          label="ไป"
          value={daySummary.went}
          tone="success"
          icon={<Check className="h-5 w-5" />}
          foot="รู้แล้วว่าไป — ไม่ต้องตามต่อ"
        />
        <StatCard
          label="ไม่ไป"
          value={daySummary.notWent}
          tone="danger"
          icon={<X className="h-5 w-5" />}
          foot={daySummary.notWent > 0 ? 'ต้องหาคนแทน / แจ้งหน่วยงาน' : 'ยังไม่มีใครบอกว่าไม่ไป'}
        />
        <StatCard
          label="ยังไม่รู้ผล"
          value={daySummary.unknown}
          tone="warn"
          icon={<Clock className="h-5 w-5" />}
          foot="โทรไม่ติด · รอโทร · เลยเวลานัด · ไม่ได้ส่งให้ AI"
        />
      </div>

      {/* ── 2. แถบขั้นตอน = แผงรอบโทร + 7 ช่องสถานะสาย (การ์ดของตัวเอง) ── */}
      {roundsSlot}

      {/* ── 3. รายการหลัก (2/3) + แผงข้างขวา (1/3) ── */}
      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,2.4fr)_minmax(320px,1fr)]">
        <Card className="overflow-hidden rounded-2xl shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3 md:px-5">
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
                <button
                  type="button"
                  aria-label="วันก่อนหน้า"
                  className={NAV_BTN}
                  onClick={() => onSelect(shiftYmd(dayYmd, -1))}
                >
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
                    'inline-flex h-8 items-center rounded-full border px-3 text-[11px] font-semibold disabled:opacity-50',
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

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border/70 px-4 py-2 text-[11px] text-muted-foreground md:px-5">
            {DAY_LEGEND.map(([tone, label]) => (
              <span key={tone} className="flex items-center gap-1.5">
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-sm', TONE[tone].dot)} aria-hidden />
                {label}
              </span>
            ))}
          </div>

          {view === 'day' ? (
            <>
              {daySummary.notSent > 0 || (roundFilter !== 'all' && !daySlots.includes(roundFilter)) ? (
                <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-2.5 md:px-5">
                  {roundFilter !== 'all' && !daySlots.includes(roundFilter) ? (
                    <span className="text-[11px] text-muted-foreground">
                      วันนี้ไม่มี{roundTabLabel(roundFilter)} — กด "ทุกสาย" ข้างบนเพื่อดูสายอื่น
                    </span>
                  ) : null}
                  {daySummary.notSent > 0 ? (
                    <span
                      className={cn(
                        'ml-auto rounded-full px-2.5 py-1 text-[11px] font-semibold',
                        TONE.orange.chip,
                      )}
                    >
                      {daySummary.notSent} สายไม่ได้ส่งให้ AI — ต้องคนจัดการ
                    </span>
                  ) : null}
                </div>
              ) : null}

              {dayCalls.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                  วันที่เลือกไม่มีสายที่ต้องตาม
                  {roundFilter !== 'all' ? ` ใน${roundTabLabel(roundFilter)}` : ''} — เลื่อนดูวันอื่นด้วยลูกศร
                  หรือกดปฏิทินเลือกวัน
                </p>
              ) : (
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
                          <th className="min-w-[210px] px-4 py-2.5 text-[11px] font-semibold md:px-5">
                            ผู้ที่ต้องติดตาม / ติดต่อ
                          </th>
                          <th className="hidden min-w-[130px] px-3 py-2.5 text-[11px] font-semibold lg:table-cell">หน่วยงาน</th>
                          <th className="min-w-[110px] px-3 py-2.5 text-[11px] font-semibold">เวลานัด / รอบ</th>
                          <th className="min-w-[140px] px-3 py-2.5 text-[11px] font-semibold">สถานะการโทร</th>
                          <th className="min-w-[220px] px-3 py-2.5 text-[11px] font-semibold">เขาตอบว่าอะไร</th>
                          <th className="hidden min-w-[150px] px-3 py-2.5 text-[11px] font-semibold xl:table-cell">เบอร์ฉุกเฉิน</th>
                          <th className="px-3 py-2.5 text-right text-[11px] font-semibold md:px-5">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody data-testid="day-calls">
                        {pageCalls.map(({ row, round, slot, category }) => {
                          const ai = roundAiSummary(round);
                          const emg = roundEmergencyPhone(round);
                          const tone = roundTone(round);
                          const cancelled = round.state === 'cancelled';
                          return (
                            <tr
                              key={round.entry.id}
                              data-category={category}
                              className={cn(
                                'border-b border-border/50 align-top transition-colors last:border-0',
                                category === 'lost' ? TONE.danger.wash : 'hover:bg-secondary/50',
                                cancelled && 'opacity-60',
                              )}
                            >
                              <td className="px-4 py-3 md:px-5">
                                <span className="flex items-start gap-2.5">
                                  {/* วงกลมอักษรย่อ — แบบอ้างอิงใช้รูปคน ฐานเราไม่มีรูป */}
                                  <span
                                    className={cn(
                                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-bold',
                                      TONE[tone].soft,
                                      TONE[tone].value,
                                    )}
                                    aria-hidden
                                  >
                                    {initials(row.group.name)}
                                  </span>
                                  <span className="min-w-0">
                                    <span
                                      className={cn(
                                        'block truncate text-[13.5px] font-bold text-foreground',
                                        cancelled && 'line-through',
                                      )}
                                    >
                                      {row.group.name}
                                    </span>
                                    <span className="block truncate text-[11.5px] text-muted-foreground">
                                      {row.group.phone}
                                    </span>
                                  </span>
                                </span>
                              </td>
                              <td className="hidden px-3 py-3 text-[12px] text-muted-foreground lg:table-cell">
                                {row.group.unitName || '—'}
                              </td>
                              <td className="px-3 py-3">
                                <span
                                  className={cn(
                                    'block text-[16px] font-bold leading-none tabular-nums text-foreground',
                                    cancelled && 'line-through',
                                  )}
                                >
                                  {round.time ?? '—'}
                                </span>
                                <span className="mt-1 block text-[10.5px] text-muted-foreground">
                                  {slot ? roundTabLabel(slot) : 'ยังไม่อยู่รอบไหน'}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                {/* ป้ายสถานะ = เม็ดยากลม มีจุดสีนำหน้า (ตามแบบอ้างอิง) */}
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                                    TONE[tone].chip,
                                  )}
                                >
                                  {isGoodResult(round) ? (
                                    <Check className="h-3 w-3" aria-hidden />
                                  ) : (
                                    <span className={cn('h-1.5 w-1.5 rounded-full', TONE[tone].dot)} aria-hidden />
                                  )}
                                  {FOLLOW_CALL_CATEGORY_LABEL[category]}
                                  {round.state === 'result' &&
                                  (category === 'unreachable' || round.entry.call_outcome === 'acknowledged')
                                    ? ` — ${roundResultLabel(round)}`
                                    : ''}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                {ai ? (
                                  <span className="line-clamp-3 text-[12px] leading-snug text-foreground/80" title={ai}>
                                    {ai}
                                  </span>
                                ) : round.state === 'result' ? (
                                  <span className="text-[12px] text-muted-foreground">(ไม่มีสรุปจาก AI)</span>
                                ) : round.state === 'notSent' &&
                                  !roundDispatchReason(round).startsWith(FOLLOW_CALL_CATEGORY_LABEL.notSent) ? (
                                  <span className="text-[12px] text-muted-foreground">{roundDispatchReason(round)}</span>
                                ) : (
                                  <span className="text-[12px] text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="hidden px-3 py-3 xl:table-cell">
                                {emg ? (
                                  <span className="block text-[11.5px] text-muted-foreground">
                                    {emg}
                                    {round.state === 'result' ? (
                                      <span className="block text-[10.5px]">ยังไม่รู้ว่าโทรหรือยัง</span>
                                    ) : null}
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
                                    onClick={() => onOpenCell(row, round.ymd ?? dayYmd, [round])}
                                    title="ดูรายละเอียดและจัดการสายนี้"
                                    className={cn(
                                      'inline-flex h-8 items-center rounded-full border px-3 text-[11px] font-semibold transition-colors',
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
                      แสดง {firstIndex + 1} ถึง {lastIndex} จากทั้งหมด {dayCalls.length.toLocaleString('th-TH')} สาย
                    </span>
                    {pageCount > 1 ? (
                      <span className="ml-auto flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="หน้าก่อนหน้า"
                          disabled={page <= 1}
                          onClick={() => setPage((n) => Math.max(1, n - 1))}
                          className={cn(NAV_BTN, 'disabled:opacity-40')}
                        >
                          <ChevronLeft className="h-4 w-4" aria-hidden />
                        </button>
                        {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                          <button
                            key={n}
                            type="button"
                            aria-current={n === page ? 'page' : undefined}
                            onClick={() => setPage(n)}
                            className={cn(
                              'inline-flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-[11px] font-semibold tabular-nums transition-colors',
                              n === page ? 'border-primary bg-primary text-primary-foreground' : TONE.neutral.outline,
                            )}
                          >
                            {n}
                          </button>
                        ))}
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
                  </div>
                </>
              )}
            </>
          ) : monthRows.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              เดือนนี้ไม่มีนัดโทรของใครเลย
            </p>
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
                  {monthRows.map(({ row, byDay }) => {
                    const s = personMonthSummary(row, month);
                    const parts: Array<[FollowCallCategory, number]> = (
                      [
                        ['agreed', s.went],
                        ['lost', s.notWent],
                        ['overdue', s.unknown],
                      ] as Array<[FollowCallCategory, number]>
                    ).filter(([, n]) => n > 0);
                    return (
                      <tr key={row.group.key} className="border-b border-border/50 last:border-0">
                        <td className="sticky left-0 z-10 max-w-[260px] bg-card px-4 py-2 align-top md:px-5">
                          <span className="block truncate text-[12px] font-semibold text-foreground">
                            {row.group.name}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {row.group.unitName || row.group.phone}
                          </span>
                          <span className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[10px]">
                            <span className="font-semibold tabular-nums text-foreground">
                              {s.total} ครั้ง
                            </span>
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
                                          'block text-[10px] font-bold tabular-nums',
                                          r.state === 'cancelled' && 'line-through',
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
                                    <span className="text-[9px] font-semibold text-primary">
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
        </Card>

        {/* ── แผงข้างขวา ── */}
        <div className="space-y-4">
          <Card className="rounded-2xl p-5 shadow-sm">
            <h3 className="text-[13px] font-bold text-foreground">ผลของเดือนนี้</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {monthLabel(month)}
              {roundFilter !== 'all' ? ` · เฉพาะ${roundTabLabel(roundFilter)}` : ''}
            </p>
            <div className="mt-3">
              <Donut percent={wentRate} caption="ตอบว่าไป" />
            </div>
            <dl className="mt-3 space-y-1.5 border-t border-border/70 pt-3 text-[12px]">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">ไป</dt>
                <dd className={cn('font-semibold tabular-nums', statTone('agreed'))}>
                  {monthSummary.went}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">ไม่ไป</dt>
                <dd className={cn('font-semibold tabular-nums', statTone('lost'))}>
                  {monthSummary.notWent}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">ยังไม่รู้ผล</dt>
                <dd className={cn('font-semibold tabular-nums', statTone('overdue'))}>
                  {monthSummary.unknown}
                </dd>
              </div>
            </dl>
            {/* 🔴 บอกฐานให้ชัด — ห้ามให้คนเดาว่าเปอร์เซ็นต์คิดจากอะไร */}
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              {decided > 0
                ? `คิดจาก ${decided} สายที่รู้ผลแล้ว — สายที่ยังไม่รู้ผลไม่ถูกนำมาหาร`
                : 'เดือนนี้ยังไม่มีสายไหนรู้ผล จึงยังคิดสัดส่วนไม่ได้'}
            </p>
          </Card>

          <Card className="overflow-hidden rounded-2xl shadow-sm">
            <div className="flex items-center gap-2 px-4 pt-4">
              <PhoneOff className={cn('h-4 w-4', TONE.warn.value)} aria-hidden />
              <h3 className="text-[13px] font-bold text-foreground">ต้องตามด่วน</h3>
              <span
                className={cn('ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold', TONE.warn.chip)}
              >
                {overdueAll.length}
              </span>
            </div>
            <p className="px-4 pb-3 pt-1 text-[11px] leading-snug text-muted-foreground">
              เลยเวลานัดแล้วยังไม่มีผลกลับ — ทั้งเดือน ไม่ใช่เฉพาะวันที่เลือก
            </p>
            {overdueAll.length === 0 ? (
              <p
                className={cn(
                  'mx-4 mb-4 rounded-xl px-3 py-3 text-center text-[12px]',
                  TONE.success.soft,
                  TONE.success.value,
                )}
              >
                ไม่มีสายไหนค้าง — ตามครบแล้ว
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
                      <span className="block truncate text-[12.5px] font-semibold text-foreground">
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
