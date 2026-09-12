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
import type { FollowRoundFilter } from '@/lib/followPlanning';
import {
  followCallResultSummary,
  countFollowCallResults,
  overdueWaitingCount,
} from '@/lib/followCallResults';
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
import { Rule2 } from '@/components/shared/ui-v2/Sheet2';
import { useUiV2 } from '@/lib/uiV2';
import { GitBranch, HelpCircle, Phone, RefreshCw } from 'lucide-react';

/**
 * คำอธิบายนิยาม "รอบโทรที่" — **ข้อความเดียว ใช้สองที่** (เดสก์ท็อปโชว์เต็ม ·
 * มือถือพับหลังไอคอน ?) ห้ามพิมพ์ซ้ำสองชุด ไม่งั้นวันหนึ่งจะแก้ได้แค่ที่เดียว
 */
const ROUND_HELP_TEXT =
  'รอบโทรที่ 1/2/3 = ลำดับสายของคนนั้น ตามที่เลือกไว้ตอนเพิ่ม (วันเวลาแต่ละสายตั้งเองได้ ไม่มีระยะห่างตายตัว) · กดรอบไหนก็เห็นเฉพาะคนที่อยู่รอบนั้น แล้วกดกล่องเพื่อดูรายชื่อ';

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
 *
 * ═══ 🔴 โฉมใหม่ (เฟส 5 · ทำจริง 7 ก.ย. 2569) ═══
 * รอบรื้อ 5 ก.ย. ติ๊กเฟส 5 ว่า ✅ แต่ไปแก้ที่ `CallFunnelPanel` ซึ่งเป็น **ไฟล์ตาย**
 * (ไม่มีหน้าไหน import ตั้งแต่ 18 ส.ค. 2569 · ตัวจริงคือแผงนี้) ⇒ หน้าติดตามไม่เคยถูกรื้อ
 * เปิดสวิตช์แล้วเห็นหน้าเดิม ปนอยู่กับหน้าอื่นที่เป็นผืนขาว จนอ่านได้ว่า "สวิตช์พัง"
 * (`docs/audit-v1-v2-functions-2569-09-07.md` §1.4 · งง-7)
 *
 * ⚠️ **เปลือกล้วน ๆ** — หน้านี้เพิ่งถูกรื้อ *ตรรกะ* รอบ ก.ย. 2569 จึงห้ามแตะนิยาม/การนับ/
 * ปฏิทิน · ที่เปลี่ยนคือคลาสสีและระยะเท่านั้น: ผืนขาวใบเดียวคั่นด้วยเส้นบาง แทนกล่อง
 * พาสเทลซ้อนกล่อง · **สีที่มีความหมายอยู่ครบ** (จุด · ตัวเลข · ป้าย ยังเป็นสีโทนเดิม)
 * และพื้นพาสเทลเหลือเฉพาะช่อง "ต้องลงมือ" ซึ่งเป็นกติกาเดิมของ TONE อยู่แล้ว
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
  round,
  onRoundChange,
  embedded = false,
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
   * รอบที่กำลังดู — **หน้าแม่เป็นเจ้าของ state** (รวมแผงกับปฏิทินเป็นการ์ดเดียว
   * 8 ก.ย. 2569) เดิมแผงนี้ถือ state เอง ⇒ จอมีตัวเลือกรอบสองที่ (แท็บบนแผง +
   * ชิปในปฏิทิน) ผู้ทดสอบตาใหม่ถามว่า *"ทำไมมีสองที่พูดเรื่องเดียวกัน"*
   */
  round: FollowRoundFilter;
  onRoundChange: (round: FollowRoundFilter) => void;
  /**
   * ฝังอยู่ในผืนของการ์ดอื่น — ไม่วาดเปลือกการ์ด/หัวเรื่อง/ปุ่มรีเฟรชของตัวเอง
   * (แพตเทิร์นเดียวกับ `embedded` ของ dialog ตามกติกา CLAUDE.md)
   */
  embedded?: boolean;
}) {
  /** โฉมใหม่อยู่ไหม — เปลี่ยนแค่คลาสสี/ระยะ โครง JSX และข้อมูลเส้นเดียวกันทั้งสองโฉม */
  const v2 = useUiV2();
  /** popup รายชื่อ — ใช้ร่วมกันทั้งกล่องถังและวันบนปฏิทิน · null = ปิดอยู่ */
  const [peopleDialog, setPeopleDialog] = useState<PeopleDialogState | null>(null);
  /** รอบที่กำลังดูอยู่ — มาจากหน้าแม่ (ตัวเลือกรอบมีที่เดียวทั้งหน้า) */
  const activeRound = round;
  const pickRound = (r: FollowRoundFilter) => onRoundChange(r);

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

  /**
   * คนของรอบที่เลือก — `'all'` = ทุกสายที่อยู่ในรอบใดรอบหนึ่งแล้ว
   * (คนที่ยังไม่เคยเข้าคิวและยังไม่มีผลไม่อยู่รอบไหน จึงไม่ถูกนับ — นิยามเดิมของ `roundRows`)
   */
  const rowsOfRound = useMemo(
    () =>
      activeRound === 'all'
        ? [...roundRows.values()].flat()
        : (roundRows.get(activeRound) ?? []),
    [roundRows, activeRound],
  );
  const countsOfRound = useMemo(() => countFollowRoundBuckets(rowsOfRound), [rowsOfRound]);
  const roundLabelOf = (r: FollowRoundFilter) => (r === 'all' ? 'ทุกสาย' : roundTabLabel(r));

  const openBucketDialog = (slot: FollowRoundFilter, b: FollowRoundBucket) => {
    const rows = slot === 'all' ? rowsOfRound : (roundRows.get(slot) ?? []);
    const list = rows.filter((r) => inFollowRoundBucket(r, b));
    setPeopleDialog({
      title: `${roundLabelOf(slot)} · ${FOLLOW_ROUND_BUCKET_LABEL[b]} (${list.length.toLocaleString('th-TH')} คน)`,
      hint: FOLLOW_ROUND_BUCKET_HINT[b],
      people: list,
    });
  };

  /** ป๊อปรายชื่อ — ใช้ร่วมทั้งโฉมเดิมและโฉมตามแบบอ้างอิง */
  const peopleDialogEl = (
    <>
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
    </>
  );

  /**
   * ═══ โฉมตามแบบอ้างอิงที่เจ้าของส่งมา (8 ก.ย. 2569) — การ์ด "ขั้นตอนของสาย" ═══
   *
   * เจ้าของทักว่า *"ตัวอย่างมันไม่ชัดเจนหรือว่าไง ถึงได้ทำออกมาให้เหมือนเขาไม่ได้"* —
   * รอบก่อนผมเอาโครงเดิม (การ์ดรอบใหญ่ 4 ใบ + ช่องถัง 7 ช่องแบน ๆ) มาทาสีใหม่เฉย ๆ
   * ซึ่งหน้าตาไม่ใช่ **Pipeline Stages** ของแบบอ้างอิงเลย
   *
   * แบบอ้างอิง = การ์ดใบเดียว หัวมีไอคอน+ชื่อเรื่องซ้าย เป้าหมายขวา · ข้างในเป็น
   * **การ์ดขั้นตอนย่อย** แต่ละใบมี: ป้าย "ขั้นที่ N" · ตัวเลขในวงกลมมุมขวา · ชื่อไทยตัวหนา ·
   * ชื่ออังกฤษตัวเทา · **หลอดหนาเต็มความกว้างที่ก้นการ์ด**
   *
   * ของเรา 7 ช่องสถานะสายคือ pipeline จริง ๆ อยู่แล้ว (รอโทร → กำลังโทร → โทรติด/ไม่ติด
   * → ไป/ไม่ไป) จึงจับมาวางในทรงเดียวกันเป๊ะ · ตัวเลือกรอบย่อเป็นเม็ดยาเล็กบนหัวการ์ด
   * (ของเดิมเป็นการ์ดใหญ่ 4 ใบ กินที่เท่า pipeline ทั้งแถบ)
   *
   * 🔴 ของเดิมอยู่ครบ: ยอดต่อรอบ · แถบสัญญาณ · บรรทัดผลจาก AI · 7 ช่องกดดูรายชื่อได้
   */
  if (embedded) {
    const signal = roundSignal(countsOfRound, overdueWaitingCount(rowsOfRound));
    const aiText = followCallResultSummary(rowsOfRound);
    /**
     * 🔴 **ไม่มีงานสักสายเลย ⇒ หุบเหลือหัวการ์ด** (12 ก.ย. 2569)
     *
     * ผู้ทดสอบตาใหม่เจอ 7 กล่องเลขศูนย์ตั้งแต่ยังไม่ได้ทำอะไร แล้วบอกว่า
     * *"งง จนไม่อยากกด"* — กำแพงคำศัพท์ตั้งแต่ยังไม่มีบริบทคือสิ่งที่ทำให้คนใหม่ถอย
     *
     * ⚠️ **ไม่ได้ลบหรือลดขั้น** (ดีไซน์ Stitch ที่เจ้าของเคาะ ห้ามรื้อ) — แค่หุบเมื่อว่างเปล่า
     * และกางเองทันทีที่มีงานเข้ามาสายแรก
     */
    const allEmpty = entries.length === 0;
    if (allEmpty) {
      return (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-4">
            <GitBranch className={cn('h-5 w-5', TONE.primary.value)} aria-hidden />
            <h2 className="text-[17px] font-bold text-foreground">ขั้นตอนของสาย (Call Pipeline)</h2>
            <span className="w-full text-[11.5px] leading-snug text-muted-foreground sm:w-auto sm:flex-1">
              ยังไม่มีสายในระบบ — ตารางนี้จะกางเองเมื่อมีสายแรกเข้ามา
            </span>
          </div>
        </div>
      );
    }
    return (
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {/* หัวการ์ด: ไอคอน + ชื่อเรื่อง ซ้าย · ตัวเลือกรอบ ขวา (แบบอ้างอิงวางเป้าหมายไว้ขวา) */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 pt-5">
          <GitBranch className={cn('h-5 w-5', TONE.primary.value)} aria-hidden />
          <h2 className="text-[17px] font-bold text-foreground">ขั้นตอนของสาย (Call Pipeline)</h2>
          <span className="flex-1" />
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="ตัวกรองรอบ">
            <span className="text-[11px] text-muted-foreground">ดูเฉพาะ</span>
            {(['all', 1, 2, 3] as FollowRoundFilter[]).map((r) => {
              const rows = r === 'all' ? [...roundRows.values()].flat() : (roundRows.get(r) ?? []);
              const active = r === activeRound;
              return (
                <button
                  key={String(r)}
                  type="button"
                  aria-pressed={active}
                  onClick={() => pickRound(r)}
                  title={`ตัวกรอง — แสดงเฉพาะ${roundLabelOf(r)} (ไม่ได้สั่งโทร)`}
                  className={cn(
                    'inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition-colors',
                    active ? 'border-primary bg-primary text-primary-foreground' : TONE.neutral.outline,
                  )}
                >
                  {roundLabelOf(r)}
                  <span className={cn('tabular-nums', active ? 'opacity-90' : 'text-muted-foreground')}>
                    {rows.length.toLocaleString('th-TH')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* การ์ดขั้นตอนย่อย — ทรงเดียวกับ Pipeline Stages ของแบบอ้างอิง */}
        <div className="grid grid-cols-2 gap-3 px-5 pb-4 pt-4 md:grid-cols-4 xl:grid-cols-7">
          {FOLLOW_ROUND_BUCKETS.map((b, i) => {
            const n = countsOfRound[b];
            const vis = bucketVisual(b, n);
            const tone = TONE[vis.tone];
            const pct = countsOfRound.all > 0 ? Math.round((n / countsOfRound.all) * 100) : 0;
            return (
              <button
                key={b}
                type="button"
                disabled={n === 0}
                title={FOLLOW_ROUND_BUCKET_HINT[b]}
                onClick={() => openBucketDialog(activeRound, b)}
                className={cn(
                  'flex flex-col rounded-xl border p-3 text-left transition-all',
                  vis.muted
                    ? 'cursor-default border-border/60 opacity-70'
                    : cn(
                        'border-border hover:-translate-y-0.5 hover:shadow-md',
                        vis.actionable && cn(tone.soft, 'border-transparent'),
                      ),
                )}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-medium text-muted-foreground">ขั้นที่ {i + 1}</span>
                  <span
                    className={cn(
                      'flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums',
                      tone.chip,
                    )}
                  >
                    {n.toLocaleString('th-TH')}
                  </span>
                </span>
                <span className={cn('mt-2 text-[14px] font-bold leading-tight', tone.value)}>
                  {FOLLOW_ROUND_BUCKET_LABEL[b]}
                </span>
                <span className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug text-muted-foreground">
                  {FOLLOW_ROUND_BUCKET_HINT[b]}
                </span>
                {/* หลอดหนาที่ก้นการ์ด — จุดเด่นของแบบอ้างอิง */}
                <span className="mt-auto block h-1.5 w-full overflow-hidden rounded-full bg-secondary" aria-hidden>
                  <span className={cn('block h-full rounded-full', tone.dot)} style={{ width: `${pct}%` }} />
                </span>
              </button>
            );
          })}
        </div>

        {/* สัญญาณ + ผลจาก AI ของรอบที่เลือก (ของเดิม ย้ายมาเป็นบรรทัดท้ายการ์ด) */}
        {signal.text ? (
          <div className="flex items-center gap-2 border-t border-border/70 px-5 py-2.5">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', TONE[signal.tone].dot)} aria-hidden />
            <p className={cn('text-[11.5px] font-semibold', TONE[signal.tone].value)}>{signal.text}</p>
          </div>
        ) : null}
        {aiText ? (
          <p className={cn('border-t border-border/70 px-5 py-2.5 text-[11.5px] font-semibold', TONE.info.value)}>
            {aiText}
          </p>
        ) : rowsOfRound.length > 0 ? (
          <p className={cn('border-t border-border/70 px-5 py-2.5 text-[11.5px]', DASH.muted)}>
            {roundLabelOf(activeRound)} ยังไม่มีผลกลับจาก AI เลย
          </p>
        ) : null}
        <p className={cn('border-t border-border/70 px-5 py-3 text-[10.5px]', DASH.muted)}>
          ตัวเลขชุดนี้คือ <span className="font-semibold">ทุกวัน</span> (ของปฏิทินข้างล่างคือวันที่เลือก) ·
          รอโทร/กำลังโทร/โทรติด/โทรไม่ติด = สถานะของสาย · ไป/ไม่ไป = ผลปิดงานติดตาม —
          คนเดียวอยู่ได้ทั้งสองแกน ช่องจึงไม่ได้บวกกันเป็น "ทั้งหมด"
        </p>
        {entries.length === 0 ? (
          <p className={cn('border-t border-border/70 px-5 py-3 text-[11.5px]', DASH.muted)}>
            ยังไม่มีงาน Follow — เพิ่มรายชื่อข้างล่างแล้วส่งโทร
          </p>
        ) : null}
        {peopleDialogEl}
      </div>
    );
  }

  return (
    <div
      className={cn(
        embedded
          ? /* การ์ดของตัวเองตามแบบอ้างอิง (หัวเรื่อง/ปุ่มรีเฟรชยังเป็นของหน้าแม่) */
            'overflow-hidden rounded-2xl border bg-card shadow-sm'
          : v2
            ? 'overflow-hidden rounded-2xl border border-border bg-card shadow-sm'
            : cn('space-y-3 rounded-2xl border p-4 md:p-5', DASH.card),
      )}
    >
      <div
        className={cn(
          'flex flex-wrap items-start justify-between gap-2',
          embedded && 'hidden',
          v2 && 'px-4 pb-3 pt-4 md:px-5',
        )}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2
              className={cn(
                v2 ? 'text-[12.5px] font-medium text-primary' : cn('text-sm font-bold', DASH.cellStrong),
              )}
            >
              การโทรของงาน Follow
            </h2>
            {/* Wave 2.1 (5 ก.ย. 2569): บนมือถือคำอธิบายยาวกินจอไปทั้งหน้าจอแรก
                ⇒ พับไว้หลังไอคอน (?) — ข้อความ **ตัวเดียวกันเป๊ะ** ไม่มีคำไหนหาย
                เดสก์ท็อป (sm ขึ้นไป) ยังโชว์เต็มเหมือนเดิม จึงซ่อนไอคอนที่ sm */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="คำอธิบายรอบโทรที่ 1/2/3"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-secondary sm:hidden"
                >
                  <HelpCircle className="h-4 w-4" aria-hidden />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 text-xs leading-relaxed">
                {ROUND_HELP_TEXT}
              </PopoverContent>
            </Popover>
          </div>
          {/* 🔴 นิยาม "รอบโทรที่" ต้องอ่านออกจากหน้านี้เลย (Haiku รอบสองถาม
              "สายที่ 1/2/3 ห่างกันกี่วัน" — คำตอบคือไม่ตายตัว คนตั้งเองตอนเพิ่ม)
              ⚠️ เปลี่ยนคำ "สายที่" → "รอบโทรที่" (เจ้าของเคาะ 5 ก.ย. 2569) */}
          <p className={cn('hidden text-[11px] sm:block', DASH.muted)}>{ROUND_HELP_TEXT}</p>
        </div>
        {/* มุมขวาบน: ปุ่มเสริมจากหน้าแม่ (เพิ่มเรื่อง/เพิ่มเจ้าหน้าที่) + รีเฟรช
            ⚠️ ปุ่มปฏิทินการโทรถูกเอาออกทั้งชุด (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-10) —
            การกรองรายวันย้ายไปที่ "ตัวกรอง" ของลิสต์ด้านล่างแล้ว (วันที่/ช่วงเวลา/เจ้าของงาน)
            ⚠️ Wave 2.1: เดิม `shrink-0` ทำให้บนจอ 375px ปุ่มตัวท้ายถูกตัดหายไปนอกกรอบ
            (กดไม่ได้เลย) — ปล่อยให้ยืดหยุ่นแล้วขึ้นบรรทัดใหม่แทน */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
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
      {/* Wave 2.1: จอ < sm เรียงตั้ง 1 คอลัมน์ (การ์ดละบรรทัดกระชับ) — เดิม 3 ใบเรียงนอน
          บน 375px ป้ายถูกตัดเหลือ "รอบโทร…" ทั้งสามใบ อ่านไม่ออกว่าใบไหนรอบไหน */}
      {v2 ? <Rule2 /> : null}
      <div
        className={cn(
          v2
            ? /* โฉมใหม่: แถวเดียวคั่นเส้นบาง ไม่ใช่การ์ดพาสเทล 3 ใบลอย ๆ ในกล่อง */
              cn(
                'grid grid-cols-2 sm:grid-cols-4',
                '[&>*]:border-border/60 max-sm:[&>*:nth-child(n+3)]:border-t sm:[&>*:not(:first-child)]:border-l',
                'max-sm:[&>*:nth-child(even)]:border-l',
              )
            : 'grid grid-cols-2 gap-1.5 sm:grid-cols-4',
        )}
      >
        {(['all', 1, 2, 3] as FollowRoundFilter[]).map((slot) => {
          const rows = slot === 'all' ? [...roundRows.values()].flat() : (roundRows.get(slot) ?? []);
          const counts = slot === 'all' ? countFollowRoundBuckets(rows) : countsByRound.get(slot);
          if (!counts) return null;
          const signal = roundSignal(counts, overdueWaitingCount(rows));
          const active = slot === activeRound;
          const tone = TONE[signal.tone];
          return (
            <button
              key={String(slot)}
              type="button"
              onClick={() => pickRound(slot)}
              aria-pressed={active}
              className={cn(
                'text-left transition-colors',
                v2
                  ? /* เลือกอยู่ = พื้น hover ของธีม + เส้นเน้นเบอร์กันดี (สีเน้นสีเดียวของโฉมใหม่)
                       ⚠️ จุดสี/ตัวเลข/ป้ายผลโทร ยังเป็นสีโทนเดิม = ความหมายไม่หาย */
                    cn(
                      'px-4 py-3 md:px-5',
                      active
                        ? 'bg-accent ring-1 ring-inset ring-primary/40'
                        : 'hover:bg-accent/60',
                    )
                  : cn(
                      'rounded-xl border px-2.5 py-2',
                      active ? cn(tone.soft, 'ring-2 ring-ring') : cn(TONE.neutral.soft, TONE.neutral.softHover),
                    ),
              )}
            >
              {/* มือถือ: ป้าย + ตัวเลขอยู่บรรทัดเดียวกัน (การ์ดเตี้ย เห็นครบสามรอบโดยไม่ต้องเลื่อน)
                  · sm ขึ้นไป: กลับเป็นซ้อนบน-ล่างเหมือนเดิมทุกอย่าง */}
              <span className="flex items-center justify-between gap-2 sm:block">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', tone.dot)} aria-hidden />
                  <span className={cn('text-[11px] font-bold sm:truncate', active ? tone.value : DASH.cellStrong)}>
                    {roundLabelOf(slot)}
                  </span>
                </span>
                <span
                  className={cn(
                    'block shrink-0 text-lg font-bold tabular-nums sm:mt-0.5',
                    active ? tone.num : DASH.cellStrong,
                  )}
                >
                  {rows.length.toLocaleString('th-TH')}
                  <span className={cn('ml-1 text-[10px] font-normal', DASH.muted)}>คน</span>
                </span>
              </span>
              <span className={cn('block text-[10px] sm:truncate', DASH.muted)}>
                {/* 🔴 "ไม่มีของค้าง" กว้างเกินจริง — มันดูแค่ **ผลโทรของรอบนี้**
                    ไม่ได้ดูว่ามีใครเลยเวลานัดแล้วหรือยัง · จอเคยขึ้น "ไม่มีของค้าง"
                    คู่กับ "เลยเวลานัดแล้ว 4" บนหน้าเดียวกัน (audit 26 ส.ค. 2569) */}
                {actionableSummary(counts) ?? (rows.length > 0 ? 'ไม่มีผลที่ต้องตามต่อ' : '—')}
              </span>
              {/* 🔴 ผลจากปาก AI ของสายนี้ (แก้ 3 ก.ย. 2569 — เจ้าของแจ้งว่าผลการโทร
                  ทั้งสองสายไม่ขึ้นบนแดชบอร์ด) · ป้ายบนแท็บบอกแค่ผลเด่นสองอันดับ
                  รายละเอียดครบอยู่บรรทัดใต้กล่อง */}
              {(() => {
                const res = countFollowCallResults(rows);
                if (res.length === 0) return null;
                const head = res
                  .slice(0, 2)
                  .map((r) => `${r.label} ${r.count.toLocaleString('th-TH')}`)
                  .join(' · ');
                return (
                  <span className={cn('block text-[10px] font-semibold sm:truncate', tone.value)}>
                    {head}
                    {res.length > 2 ? ` +${res.length - 2}` : ''}
                  </span>
                );
              })()}
            </button>
          );
        })}
      </div>

      {/* ช่องของรอบที่เลือก — 7 ช่องเท่าเดิมทุกรอบ (ช่อง 0 ก็ยังโชว์ให้เทียบกันได้)
          สีพื้นบอกว่าควรทำอะไร: เขียว=ดีแล้ว · เหลือง=ต้องตามต่อ · แดง=หลุด ต้องตัดสินใจ ·
          น้ำเงิน=กำลังเดิน · เทา=ยังไม่ถึงคิว หรือไม่มีใครในช่อง */}
      {(() => {
        const counts = countsOfRound;
        const signal = roundSignal(counts, overdueWaitingCount(rowsOfRound));
        const signalTone = TONE[signal.tone];
        return (
          <div className={cn(v2 ? '' : 'space-y-2')}>
            {/* รอบว่าง = ไม่มีข้อความ ไม่ต้องเรนเดอร์แถบ (เจ้าของสั่ง 18 ส.ค. 2569) */}
            {signal.text ? (
              <div
                className={cn(
                  'flex items-center gap-2',
                  v2
                    ? 'border-t border-border/70 px-4 py-2.5 md:px-5'
                    : cn('rounded-xl border px-3 py-2', signalTone.soft),
                )}
              >
                <span className={cn('h-2 w-2 shrink-0 rounded-full', signalTone.dot)} aria-hidden />
                <p className={cn('text-[11px] font-semibold', signalTone.value)}>{signal.text}</p>
              </div>
            ) : null}

            {/* 🔴 บรรทัดผลการโทรของสายที่เลือก — **เพิ่มใต้กล่อง ไม่แตะ 7 กล่องเดิม**
                (เจ้าของสั่งไว้ว่าเจ็ดกล่องคือเจ็ด) · ช่อง "ไป/ไม่ไป" ในกล่องคือผลที่
                **คนกดปิดงาน** ส่วนบรรทัดนี้คือคำตอบที่ **AI ได้มาจากปากคนรับสาย** */}
            {(() => {
              const rows = rowsOfRound;
              const text = followCallResultSummary(rows);
              if (!text) {
                return rows.length > 0 ? (
                  <p
                    className={cn(
                      'text-[11px]',
                      v2 && 'border-t border-border/70 px-4 py-2.5 md:px-5',
                      DASH.muted,
                    )}
                  >
                    สายนี้ยังไม่มีผลกลับจาก AI เลย
                  </p>
                ) : null;
              }
              return (
                <p
                  className={cn(
                    'text-[11px] font-semibold',
                    v2
                      ? 'border-t border-border/70 px-4 py-2.5 md:px-5'
                      : cn('rounded-xl border px-3 py-2', TONE.info.soft),
                    TONE.info.value,
                  )}
                >
                  {text}
                </p>
              );
            })()}

            {/* Wave 2.1: มือถือ 2 คอลัมน์ (ช่องกว้างพอให้ป้ายอ่านจบ) — เดิม 4 ช่องต่อแถว
                บน 375px ป้ายถูกตัดเป็น "ทั้งห…" "กำลัง…" "โทรไม่…" · ช่องครบ 7 ช่องเท่าเดิม */}
            {/* 🔴 บอกขอบเขตให้ชัด — ตัวเลขชุดนี้คือ "ทุกวัน" ส่วนตัวเลขของปฏิทินข้างล่างคือ
                "วันที่เลือก" · ผู้ทดสอบตาใหม่ (8 ก.ย. 2569) สับสนว่าทำไมมีตัวเลขสองชุด */}
            {embedded ? (
              <p className={cn('border-t border-border/70 px-4 py-2.5 text-[11px] md:px-5', DASH.muted)}>
                ขั้นตอนของสาย · <span className="font-semibold">{roundLabelOf(activeRound)}</span> ·{' '}
                <span className="font-semibold">ทุกวัน</span> — กดกล่องเพื่อดูรายชื่อ
              </p>
            ) : null}
            <div
              className={cn(
                v2
                  ? cn(
                      'grid grid-cols-2 border-t border-border/70 sm:grid-cols-7',
                      '[&>*]:border-border/50 [&>*:not(:first-child)]:border-l',
                      'max-sm:[&>*:nth-child(odd)]:border-l-0 max-sm:[&>*:nth-child(n+3)]:border-t',
                    )
                  : 'grid grid-cols-2 gap-1.5 sm:grid-cols-7',
              )}
            >
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
                      'text-left transition-colors',
                      v2
                        ? /* โฉมใหม่: ช่องอยู่บนผืนขาวคั่นเส้นบาง · **พื้นพาสเทลเหลือเฉพาะช่องที่
                             ต้องลงมือ** ตามกติกาเดิมของ TONE ("ใส่เกิน 1-2 ที่ต่อหน้าแล้วจะ
                             ไม่เหลือของที่เด่นจริง") · สีจุด/ป้าย/ตัวเลขของทุกช่องยังอยู่ครบ */
                          cn(
                            'px-3 py-3',
                            vis.muted
                              ? 'cursor-default opacity-70'
                              : vis.actionable
                                ? cn(tone.soft, tone.softHover, 'font-bold')
                                : 'hover:bg-accent/60',
                          )
                        : cn(
                            'rounded-lg border px-2 py-1.5',
                            // ช่องว่าง: สีประจำตัวยังอยู่ (จุด+ป้าย) แต่พื้นไม่ติดสี ไม่แย่งสายตา
                            vis.muted
                              ? cn('cursor-default border-border/60 bg-background/40 opacity-75')
                              : cn(tone.soft, tone.softHover, 'hover:brightness-105'),
                            // ช่องที่ต้องลงมือ = กรอบหนา กวาดตาเจอก่อนเพื่อน แม้เลขน้อย
                            vis.actionable ? 'border-2 font-bold shadow-sm' : '',
                          ),
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
                          'text-[10px] font-semibold sm:truncate',
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
                    {/* หลอดความคืบหน้าเทียบกับ "ทั้งหมด" — ยกมาจากการ์ดขั้นตอนของแบบอ้างอิง
                        (ช่อง "ทั้งหมด" เองเป็นฐาน จึงเต็มเสมอ) · ความกว้างเป็น inline style
                        เพราะเป็นค่าคำนวณ ไม่ใช่คลาสใหม่ */}
                    <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-secondary" aria-hidden>
                      <span
                        className={cn('block h-full rounded-full', tone.dot)}
                        style={{
                          width: `${counts.all > 0 ? Math.round((n / counts.all) * 100) : 0}%`,
                        }}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {entries.length === 0 ? (
        <p
          className={cn(
            'text-[11px]',
            v2
              ? 'border-t border-border/70 px-4 py-2.5 md:px-5'
              : cn('rounded-xl border px-3 py-2', TONE.neutral.soft),
            DASH.muted,
          )}
        >
          ยังไม่มีงาน Follow — เพิ่มรายชื่อข้างล่างแล้วส่งโทร
        </p>
      ) : null}
      {/* ⚠️ ช่องพวกนี้ **ซ้อนกันได้** — "โทรติด" กับ "ไป" คนละแกน (สถานะสาย vs ผลปิดงาน)
          บวกทุกช่องแล้วมากกว่า "ทั้งหมด" เป็นเรื่องปกติ ไม่ใช่บั๊ก */}
      <p
        className={cn(
          'text-[10px]',
          v2 && 'border-t border-border/70 px-4 py-3 md:px-5',
          DASH.muted,
        )}
      >
        รอโทร/กำลังโทร/โทรติด/โทรไม่ติด = สถานะของสาย · ไป/ไม่ไป = ผลปิดงานติดตาม —
        คนเดียวอยู่ได้ทั้งสองแกน ช่องจึงไม่ได้บวกกันเป็น "ทั้งหมด"
      </p>

      {peopleDialogEl}
    </div>
  );
}
