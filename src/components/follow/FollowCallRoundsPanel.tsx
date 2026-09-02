import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { type FollowEntry } from '@/lib/followApi';
import { CALL_OUTCOME_LABEL } from '@/lib/callOutcomeTone';

import {
  countFollowRoundBuckets,
  FOLLOW_ROUND_BUCKETS,
  FOLLOW_ROUND_BUCKET_HINT,
  FOLLOW_ROUND_BUCKET_LABEL,
  followRoundSlot,
  inFollowRoundBucket,
  type FollowRoundBucket,
} from '@/lib/followRoundBuckets';
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
import { Phone, RefreshCw } from 'lucide-react';

/**
 * แผงการโทรของหน้า Follow — **3 รอบ** (เจ้าของสั่ง 18 ส.ค. 2569)
 *
 * > *"เปลี่ยนเอา ทั้งหมด รอโทร กำลังโทร โทรสำเร็จ ไม่สำเร็จ ไปใส่แทนแบ่งเป็น 3 แถว
 * > เพื่อให้รู้ว่าโทร 3 รอบ แต่ละกล่องกดแล้วต้องแสดงชื่อขึ้นมาพร้อมรายละเอียดของแต่ละคน"*
 *
 * กดกล่องถังแล้วรายชื่อขึ้นเป็น Dialog ไม่ใช่กางต่อท้ายแผง
 *
 * ⚠️ ปฏิทินการโทร (popover ที่มุมขวาบน) ถูกเอาออกแล้ว (ค่ำ-10) — การกรองรายวันไปอยู่ที่
 * "ตัวกรอง" ของลิสต์ด้านล่างแทน (วันที่/ช่วงเวลา/เจ้าของงาน)
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
              {/* 🔴 คำไทยจาก CALL_OUTCOME_LABEL — เดิมพ่นรหัสอังกฤษดิบเหมือนหน้าแม่ */}
              ผล{p.call_outcome ? ` — ${(CALL_OUTCOME_LABEL as Record<string, string>)[p.call_outcome] ?? p.call_outcome}` : ''}
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

export default function FollowCallRoundsPanel({
  headerExtras,
  entries,
  loading = false,
  onReload,
  onRoundChange,
}: {
  /**
   * ปุ่มเสริมข้างไอคอนปฏิทิน (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-5: ปุ่ม "เพิ่มเรื่อง" /
   * "เพิ่มเจ้าหน้าที่" ย้ายมาไว้ตรงนี้ · supervisor+ เท่านั้น — หน้าแม่เป็นคนคุมสิทธิ์
   * และถือ dialog เอง แผงนี้แค่ให้ที่วาง)
   */
  headerExtras?: React.ReactNode;
  /**
   * 🔴 **รายการมาจากหน้าแม่เท่านั้น ห้ามโหลดเองอีก**
   * เดิมแผงนี้ยิง `listFollowEntries()` เป็นของตัวเองอีกชุด คนละก้อนกับที่หน้าแม่โหลด
   * ⇒ ยิงคนละจังหวะ ได้คนละยอด · จอเดียวจึงเคยขึ้น "ทั้งหมด 11" (แผงนี้) คู่กับ
   * "ทั้งหมด 17" (หัวหน้า) และ "กำลังตาม 12" (แท็บ) — สามยอดที่ไม่มีทางตรงกัน
   * และคนใหม่ไม่มีทางรู้ว่าอันไหนจริง (audit มุมพนักงานใหม่ 26 ส.ค. 2569)
   */
  entries: FollowEntry[];
  loading?: boolean;
  onReload?: () => void;
  /**
   * บอกหน้าแม่ว่ากำลังดูรอบไหนอยู่ (เจ้าของสั่ง 1 ก.ย. 2569:
   * *"ถ้าเลือกการโทรครั้งที่ 1 ตารางปฏิทินก็โชว์ข้อมูลแค่ของครั้งที่ 1 สิ"*)
   */
  onRoundChange?: (slot: number) => void;
}) {
  /** popup รายชื่อ — ใช้ร่วมกันทั้งกล่องถังและวันบนปฏิทิน · null = ปิดอยู่ */
  const [peopleDialog, setPeopleDialog] = useState<PeopleDialogState | null>(null);
  /** รอบที่กำลังดูอยู่ — แท็บ "การโทรครั้งที่ 1/2/3" กดแล้ว visual เปลี่ยนตาม */
  const [activeRound, setActiveRound] = useState(1);
  /** เปลี่ยนรอบ = บอกหน้าแม่ด้วย ปฏิทินข้างล่างจะได้กรองตาม */
  const pickRound = (slot: number) => {
    setActiveRound(slot);
    onRoundChange?.(slot);
  };

  /**
   * คนในแต่ละรอบ — นับจาก **ชุดเดียวกับที่แสดงชื่อ** ยอดกับรายชื่อจึงตรงกันเสมอ
   * (เดิมยอดมาจาก funnel ที่นับแถวคิว ทำให้มีเคสยอดไม่ตรงกับชื่อที่กางออกมา)
   */
  const roundRows = useMemo(() => {
    const map = new Map<number, FollowEntry[]>([
      [1, []],
      [2, []],
      [3, []],
    ]);
    for (const e of entries) {
      /**
       * 🔴 **ใช้ `followRoundSlot` นิยามกลาง** (แก้ 2 ก.ย. 2569 — feedback "แดชบอร์ดการโทรไม่ถูกต้อง")
       *
       * ของเดิมอ่านจาก `attempt_count` ของคิวตรง ๆ · โหมด "ระบุเวลาเอง" สร้าง
       * **หนึ่งแถวต่อหนึ่งรอบ** แต่ละแถวมีคิวของตัวเอง ⇒ `attempt_count` เป็น 1 หมด
       * **ทุกรอบจึงไปกองที่ "ครั้งที่ 1"** (วัดจริง 2 ก.ย.: 7 สายขึ้นครั้งที่ 1 ทั้งหมด
       * ทั้งที่จริงเป็นสายที่ 1 สี่ราย · สายที่ 2 สามราย)
       * ⚠️ ปฏิทินข้างล่างใช้ตัวนี้อยู่แล้ว — ก่อนแก้ แผงกับปฏิทินเลยเถียงกันเอง
       */
      const slot = followRoundSlot(e);
      if (slot === null) continue; // ยังไม่เคยเข้าคิวและยังไม่มีผล = ยังไม่อยู่รอบไหน
      map.get(slot)?.push(e);
    }
    return map;
  }, [entries]);

  const countsByRound = useMemo(() => {
    const map = new Map<number, ReturnType<typeof countFollowRoundBuckets>>();
    for (const [slot, rows] of roundRows) map.set(slot, countFollowRoundBuckets(rows));
    return map;
  }, [roundRows]);

  const openBucketDialog = (slot: number, b: FollowRoundBucket) => {
    const rows = roundRows.get(slot) ?? [];
    const list = rows.filter((r) => inFollowRoundBucket(r, b));
    setPeopleDialog({
      title: `${roundTabLabel(slot)} · ${FOLLOW_ROUND_BUCKET_LABEL[b]} (${list.length.toLocaleString('th-TH')} คน)`,
      hint: FOLLOW_ROUND_BUCKET_HINT[b],
      people: list,
    });
  };

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
        {/* มุมขวาบน: ปุ่มเสริมจากหน้าแม่ (เพิ่มเรื่อง/เพิ่มเจ้าหน้าที่) + รีเฟรช
            ⚠️ ปุ่มปฏิทินการโทรถูกเอาออกทั้งชุด (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-10) —
            การกรองรายวันย้ายไปที่ "ตัวกรอง" ของลิสต์ด้านล่างแล้ว (วันที่/ช่วงเวลา/เจ้าของงาน) */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {headerExtras}
          <button
            type="button"
            onClick={onReload}
            disabled={loading}
            aria-label="รีเฟรช"
            title="รีเฟรช"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border hover:bg-secondary disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden />
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
              onClick={() => pickRound(slot)}
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
                {/* 🔴 "ไม่มีของค้าง" กว้างเกินจริง — มันดูแค่ **ผลโทรของรอบนี้**
                    ไม่ได้ดูว่ามีใครเลยเวลานัดแล้วหรือยัง · จอเคยขึ้น "ไม่มีของค้าง"
                    คู่กับ "เลยเวลานัดแล้ว 4" บนหน้าเดียวกัน (audit 26 ส.ค. 2569) */}
                {actionableSummary(counts) ?? (rows.length > 0 ? 'ไม่มีผลที่ต้องตามต่อ' : '—')}
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
