import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { listFollowEntries, type FollowEntry } from '@/lib/followApi';
import { callAttemptSlot } from '@/lib/callOutcomeBuckets';
import {
  countFollowRoundBuckets,
  FOLLOW_ROUND_BUCKETS,
  FOLLOW_ROUND_BUCKET_HINT,
  FOLLOW_ROUND_BUCKET_LABEL,
  inFollowRoundBucket,
  type FollowRoundBucket,
} from '@/lib/followRoundBuckets';
import {
  buildCallCalendar,
  callDayKey,
  monthGridDays,
  shiftMonth,
} from '@/lib/followCallCalendar';
import {
  actionableSummary,
  bucketVisual,
  roundSignal,
  roundTabLabel,
} from '@/lib/followRoundVisual';
import { formatYmdDmyBe, toYmdBangkok } from '@/lib/dateTh';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarDays, ChevronLeft, ChevronRight, Phone, RefreshCw, X } from 'lucide-react';

/**
 * แผงการโทรของหน้า Follow — **3 รอบ + ปฏิทิน** (เจ้าของสั่ง 18 ส.ค. 2569)
 *
 * > *"เปลี่ยนเอา ทั้งหมด รอโทร กำลังโทร โทรสำเร็จ ไม่สำเร็จ ไปใส่แทนแบ่งเป็น 3 แถว
 * > เพื่อให้รู้ว่าโทร 3 รอบ แต่ละกล่องกดแล้วต้องแสดงชื่อขึ้นมาพร้อมรายละเอียดของแต่ละคน
 * > มี calendar ให้หน่อยเพื่อจะได้รู้ว่าแต่ละวันโทรกี่คน"*
 *
 * ปรับรอบสอง (18 ส.ค. บ่าย): *"ตัว calendar ย้ายไปมุมขวาบน และกล่องที่ให้กดอะ
 * กดแล้วต้องมี Popup ขึ้นมา"* — ปฏิทินเป็น Popover ที่มุมขวาบนของแผง ·
 * กดกล่องถัง/กดวันบนปฏิทินแล้วรายชื่อขึ้นเป็น Dialog ไม่ใช่กางต่อท้ายแผง
 *
 * แทน `CallFunnelPanel` (funnel 4 ช่อง) ซึ่งใช้ที่หน้า Follow ที่เดียว
 *
 * 🔴 **ยอดกับรายชื่อต้องมาจากชุดเดียวกัน** — ทั้งเลขบนกล่องและชื่อใน popup นับจาก
 * `entries` ชุดเดียว (เคยแยกเส้นแล้วเลขไม่ตรงกับชื่อ) ·
 * เงื่อนไขแบ่งถังอยู่ที่ `callOutcomeBuckets.ts` / `followRoundBuckets.ts` ที่เดียว
 */

/** รายละเอียดของคนหนึ่งคนใน popup — เจ้าของขอ "ชื่อพร้อมรายละเอียดของแต่ละคน" */
function PersonRow({ p }: { p: FollowEntry }) {
  return (
    <li className={cn('rounded-lg border px-2.5 py-2', TONE.neutral.soft)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-foreground">{p.recipient_name}</p>
          <p className={cn('truncate text-[11px]', DASH.muted)}>{p.topic}</p>
          {p.unit_name || p.site_code ? (
            <p className={cn('truncate text-[10px]', DASH.muted)}>
              {p.unit_name || '—'}
              {p.site_code ? ` (${p.site_code})` : ''}
            </p>
          ) : null}
          <p className={cn('mt-0.5 text-[10px]', DASH.muted)}>
            ให้โทร {p.scheduled_at ? formatYmdDmyBe(toYmdBangkok(new Date(p.scheduled_at))) : '—'}
            {p.created_by_name ? ` · เจ้าของข้อมูล ${p.created_by_name}` : ''}
          </p>
          {p.call_outcome || p.call_summary ? (
            <p className={cn('mt-1 rounded bg-background/60 px-1.5 py-1 text-[10px]', DASH.muted)}>
              ผล{p.call_outcome ? ` (${p.call_outcome})` : ''}
              {p.call_summary ? `: ${p.call_summary}` : ''}
            </p>
          ) : null}
        </div>
        <a
          href={`tel:${p.recipient_phone}`}
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium',
            TONE.info.outline,
          )}
        >
          <Phone className="h-3 w-3" aria-hidden />
          {p.recipient_phone}
        </a>
      </div>
    </li>
  );
}

/** ของที่ popup รายชื่อต้องรู้ — หัวเรื่อง + คำอธิบาย + คนในกล่องที่กด */
type PeopleDialogState = {
  title: string;
  hint: string;
  people: FollowEntry[];
};

export default function FollowCallRoundsPanel() {
  const [entries, setEntries] = useState<FollowEntry[]>([]);
  const [loading, setLoading] = useState(false);
  /** popup รายชื่อ — ใช้ร่วมกันทั้งกล่องถังและวันบนปฏิทิน · null = ปิดอยู่ */
  const [peopleDialog, setPeopleDialog] = useState<PeopleDialogState | null>(null);
  const [month, setMonth] = useState(() => toYmdBangkok(new Date()).slice(0, 7));
  /** ปฏิทินเป็น popover มุมขวาบน (เจ้าของสั่ง 18 ส.ค. 2569 บ่าย) */
  const [calendarOpen, setCalendarOpen] = useState(false);
  /** รอบที่กำลังดูอยู่ — แท็บ "การโทรครั้งที่ 1/2/3" กดแล้ว visual เปลี่ยนตาม */
  const [activeRound, setActiveRound] = useState(1);
  /**
   * วันที่เลือกบนปฏิทิน (เจ้าของสั่ง 18 ส.ค. 2569: *"เลือกวันที่แล้วให้รายละเอียดเปลี่ยนตาม"*)
   * — เลือกแล้วทั้งแท็บ/กล่อง/รายชื่อกรองเป็นของวันนั้น · กดวันเดิมซ้ำ = ยกเลิกเลือก
   */
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    void listFollowEntries()
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  /**
   * คนในแต่ละรอบ — นับจาก **ชุดเดียวกับที่แสดงชื่อ** ยอดกับรายชื่อจึงตรงกันเสมอ
   * (เดิมยอดมาจาก funnel ที่นับแถวคิว ทำให้มีเคสยอดไม่ตรงกับชื่อที่กางออกมา)
   */
  /** ชุดที่แผงทั้งแผงใช้ — เลือกวันบนปฏิทินแล้วเหลือเฉพาะของวันนั้น (ตั้งไว้หรือมีผลกลับ) */
  const scopedEntries = useMemo(() => {
    if (!selectedDay) return entries;
    return entries.filter(
      (e) => callDayKey(e.scheduled_at) === selectedDay || callDayKey(e.called_at) === selectedDay,
    );
  }, [entries, selectedDay]);

  const roundRows = useMemo(() => {
    const map = new Map<number, FollowEntry[]>([
      [1, []],
      [2, []],
      [3, []],
    ]);
    for (const e of scopedEntries) {
      // ยังไม่เคยเข้าคิวและยังไม่มีผล = ยังไม่อยู่รอบไหน
      if (e.call_attempt == null && e.call_status === 'pending' && !e.call_outcome) continue;
      map.get(callAttemptSlot(e.call_attempt))?.push(e);
    }
    return map;
  }, [scopedEntries]);

  const countsByRound = useMemo(() => {
    const map = new Map<number, ReturnType<typeof countFollowRoundBuckets>>();
    for (const [slot, rows] of roundRows) map.set(slot, countFollowRoundBuckets(rows));
    return map;
  }, [roundRows]);

  const calendar = useMemo(() => buildCallCalendar(entries), [entries]);
  const grid = useMemo(() => monthGridDays(month), [month]);

  const openBucketDialog = (slot: number, b: FollowRoundBucket) => {
    const rows = roundRows.get(slot) ?? [];
    const list = rows.filter((r) => inFollowRoundBucket(r, b));
    setPeopleDialog({
      title: `${roundTabLabel(slot)} · ${FOLLOW_ROUND_BUCKET_LABEL[b]} (${list.length.toLocaleString('th-TH')} คน)`,
      hint: FOLLOW_ROUND_BUCKET_HINT[b],
      people: list,
    });
  };

  const monthLabel = (() => {
    const [y, m] = month.split('-').map(Number);
    if (!y || !m) return month;
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('th-TH', {
      timeZone: 'UTC',
      month: 'long',
      year: 'numeric',
    });
  })();

  return (
    <div className={cn('space-y-3 rounded-2xl border p-4 md:p-5', DASH.card)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className={cn('text-sm font-bold', DASH.cellStrong)}>การโทรของงาน Follow</h2>
          <p className={cn('text-[11px]', DASH.muted)}>
            กดเลือกครั้งที่โทร แล้วกดกล่องเพื่อดูรายชื่อ · สีบอกว่าควรทำอะไรต่อ ·
            แต่ละครั้งคือ "ตอนนี้ใครอยู่รอบนั้น" ไม่ใช่ยอดสะสมทุกครั้งที่โทร
          </p>
        </div>
        {/* มุมขวาบน: ปฏิทิน (popover) + รีเฟรช */}
        <div className="flex shrink-0 items-center gap-2">
          {selectedDay ? (
            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold',
                TONE.info.soft,
                TONE.info.value,
              )}
              title="กดเพื่อกลับไปดูทุกวัน"
            >
              เฉพาะวันที่ {formatYmdDmyBe(selectedDay)}
              <X className="h-3 w-3" aria-hidden />
            </button>
          ) : null}
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="jarvis-btn-ghost shrink-0">
                <CalendarDays className="h-3 w-3" aria-hidden /> ปฏิทินการโทร
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[320px] p-2.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setMonth((m) => shiftMonth(m, -1))}
                  aria-label="เดือนก่อนหน้า"
                  className="rounded-full border border-border p-1 hover:bg-secondary"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                </button>
                <span className={cn('text-xs font-bold', DASH.cellStrong)}>{monthLabel}</span>
                <button
                  type="button"
                  onClick={() => setMonth((m) => shiftMonth(m, 1))}
                  aria-label="เดือนถัดไป"
                  className="rounded-full border border-border p-1 hover:bg-secondary"
                >
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
              <div className={cn('grid grid-cols-7 gap-1 text-center text-[10px]', DASH.muted)}>
                {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((d) => (
                  <span key={d} className="py-0.5 font-semibold">
                    {d}
                  </span>
                ))}
                {grid.map((ymd, i) => {
                  if (!ymd) return <span key={`x${i}`} />;
                  const day = calendar.get(ymd);
                  const planned = day?.planned ?? 0;
                  const called = day?.called ?? 0;
                  const has = planned > 0 || called > 0;
                  return (
                    <button
                      key={ymd}
                      type="button"
                      disabled={!has}
                      onClick={() => {
                        setSelectedDay((cur) => (cur === ymd ? null : ymd));
                        setCalendarOpen(false);
                      }}
                      title={has ? `ตั้งไว้ ${planned} · โทรแล้ว ${called}` : undefined}
                      className={cn(
                        'rounded-md border px-1 py-1 transition-colors',
                        has ? 'border-border hover:bg-secondary' : 'border-transparent opacity-45',
                      )}
                    >
                      <span className="block tabular-nums text-foreground">
                        {Number(ymd.slice(-2))}
                      </span>
                      {has ? (
                        <span className="mt-0.5 block leading-none">
                          <b className={cn('tabular-nums', TONE.primary.value)}>{planned}</b>
                          {called > 0 ? (
                            <b className={cn('ml-1 tabular-nums', TONE.success.value)}>✓{called}</b>
                          ) : null}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <p className={cn('mt-1.5 text-[10px]', DASH.muted)}>
                เลขน้ำเงิน = ตั้งไว้ว่าจะโทรวันนั้น · <b className={TONE.success.value}>✓</b>{' '}
                เขียว = มีผลโทรกลับมาแล้ว · สายที่ยกเลิกไม่ถูกนับ · กดวันเพื่อดูรายชื่อ
              </p>
            </PopoverContent>
          </Popover>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="jarvis-btn-ghost shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} /> รีเฟรช
          </button>
        </div>
      </div>

      {/* แท็บ "การโทรครั้งที่ 1/2/3" (เจ้าของสั่ง 18 ส.ค. 2569 บ่าย) —
          กดแล้ว visual เปลี่ยนตามรอบ · สีบนแท็บ = สถานะของรอบนั้น ไม่ใช่แค่ที่เลือกอยู่
          จะได้กวาดตาเห็นตั้งแต่ยังไม่กดว่ารอบไหนมีของค้าง */}
      <div className="grid grid-cols-3 gap-1.5">
        {[1, 2, 3].map((slot) => {
          const counts = countsByRound.get(slot);
          const rows = roundRows.get(slot) ?? [];
          if (!counts) return null;
          const signal = roundSignal(counts);
          const active = slot === activeRound;
          const tone = TONE[signal.tone];
          return (
            <button
              key={slot}
              type="button"
              onClick={() => setActiveRound(slot)}
              aria-pressed={active}
              className={cn(
                'rounded-xl border px-2.5 py-2 text-left transition-colors',
                active ? cn(tone.soft, 'ring-2 ring-ring') : cn(TONE.neutral.soft, TONE.neutral.softHover),
              )}
            >
              <span className="flex items-center gap-1.5">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', tone.dot)} aria-hidden />
                <span className={cn('truncate text-[11px] font-bold', active ? tone.value : DASH.cellStrong)}>
                  {roundTabLabel(slot)}
                </span>
              </span>
              <span className={cn('mt-0.5 block text-lg font-bold tabular-nums', active ? tone.num : DASH.cellStrong)}>
                {rows.length.toLocaleString('th-TH')}
                <span className={cn('ml-1 text-[10px] font-normal', DASH.muted)}>คน</span>
              </span>
              <span className={cn('block truncate text-[10px]', DASH.muted)}>
                {actionableSummary(counts) ?? (rows.length > 0 ? 'ไม่มีของค้าง' : '—')}
              </span>
            </button>
          );
        })}
      </div>

      {/* ช่องของรอบที่เลือก — 7 ช่องเท่าเดิมทุกรอบ (ช่อง 0 ก็ยังโชว์ให้เทียบกันได้)
          สีพื้นบอกว่าควรทำอะไร: เขียว=ดีแล้ว · เหลือง=ต้องตามต่อ · แดง=หลุด ต้องตัดสินใจ ·
          น้ำเงิน=กำลังเดิน · เทา=ยังไม่ถึงคิว หรือไม่มีใครในช่อง */}
      {(() => {
        const counts = countsByRound.get(activeRound);
        if (!counts) return null;
        const signal = roundSignal(counts);
        const signalTone = TONE[signal.tone];
        return (
          <div className="space-y-2">
            {/* รอบว่าง = ไม่มีข้อความ ไม่ต้องเรนเดอร์แถบ (เจ้าของสั่ง 18 ส.ค. 2569) */}
            {signal.text ? (
              <div className={cn('flex items-center gap-2 rounded-xl border px-3 py-2', signalTone.soft)}>
                <span className={cn('h-2 w-2 shrink-0 rounded-full', signalTone.dot)} aria-hidden />
                <p className={cn('text-[11px] font-semibold', signalTone.value)}>{signal.text}</p>
              </div>
            ) : null}

            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
              {FOLLOW_ROUND_BUCKETS.map((b) => {
                const n = counts[b];
                const vis = bucketVisual(b, n);
                const tone = TONE[vis.tone];
                return (
                  <button
                    key={b}
                    type="button"
                    disabled={n === 0}
                    title={FOLLOW_ROUND_BUCKET_HINT[b]}
                    onClick={() => openBucketDialog(activeRound, b)}
                    className={cn(
                      'rounded-lg border px-2 py-1.5 text-left transition-colors',
                      // ช่องว่าง: สีประจำตัวยังอยู่ (จุด+ป้าย) แต่พื้นไม่ติดสี ไม่แย่งสายตา
                      vis.muted
                        ? cn('cursor-default border-border/60 bg-background/40 opacity-75')
                        : cn(tone.soft, tone.softHover, 'hover:brightness-105'),
                      // ช่องที่ต้องลงมือ = กรอบหนา กวาดตาเจอก่อนเพื่อน แม้เลขน้อย
                      vis.actionable ? 'border-2 font-bold shadow-sm' : '',
                    )}
                  >
                    {/* จุดสี + ป้ายสีโทน — เดิมป้ายเป็นเทาทุกช่อง เห็นสีแค่ตัวเลข
                        กวาดตาแล้วยังแยกไม่ออกว่าช่องไหนคืออะไร (เจ้าของสั่งแบ่งสีให้ชัด) */}
                    <span className="flex items-center gap-1">
                      <span
                        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', tone.dot, vis.muted && 'opacity-50')}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          'truncate text-[10px] font-semibold',
                          tone.value,
                          vis.muted && 'opacity-60',
                        )}
                      >
                        {FOLLOW_ROUND_BUCKET_LABEL[b]}
                      </span>
                    </span>
                    <span
                      className={cn('block text-lg font-bold tabular-nums', tone.num, vis.muted && 'opacity-45')}
                    >
                      {n.toLocaleString('th-TH')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {entries.length === 0 ? (
        <p className={cn('rounded-xl border px-3 py-2 text-[11px]', TONE.neutral.soft, DASH.muted)}>
          ยังไม่มีงาน Follow — เพิ่มรายชื่อข้างล่างแล้วส่งโทร
        </p>
      ) : null}
      {/* ⚠️ ช่องพวกนี้ **ซ้อนกันได้** — "โทรติด" กับ "ไป" คนละแกน (สถานะสาย vs ผลปิดงาน)
          บวกทุกช่องแล้วมากกว่า "ทั้งหมด" เป็นเรื่องปกติ ไม่ใช่บั๊ก */}
      <p className={cn('text-[10px]', DASH.muted)}>
        รอโทร/กำลังโทร/โทรติด/โทรไม่ติด = สถานะของสาย · ไป/ไม่ไป = ผลปิดงานติดตาม —
        คนเดียวอยู่ได้ทั้งสองแกน ช่องจึงไม่ได้บวกกันเป็น "ทั้งหมด"
      </p>

      {/* popup รายชื่อ — ใช้ร่วมกันทั้งกล่องถังและวันบนปฏิทิน */}
      <Dialog open={peopleDialog != null} onOpenChange={(open) => !open && setPeopleDialog(null)}>
        <DialogContent className="flex max-h-[min(88dvh,720px)] w-[min(calc(100vw-1.25rem),34rem)] max-w-none flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-border/50 px-4 pb-3 pt-4 text-left">
            <DialogTitle className="pr-8 text-sm font-bold leading-snug">
              {peopleDialog?.title ?? ''}
            </DialogTitle>
            <DialogDescription className={cn('text-[11px]', DASH.muted)}>
              {peopleDialog?.hint ?? ''}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            {peopleDialog && peopleDialog.people.length > 0 ? (
              <ul className="space-y-1.5">
                {peopleDialog.people.map((p) => (
                  <PersonRow key={p.id} p={p} />
                ))}
              </ul>
            ) : (
              <p className={cn('py-4 text-center text-xs', DASH.muted)}>ไม่มีรายชื่อในกล่องนี้</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
