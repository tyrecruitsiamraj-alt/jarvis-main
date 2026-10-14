import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FollowStaffCallControls from '@/components/follow/FollowStaffCallControls';
import FollowCancelMenu, { type FollowCancelChoice } from '@/components/follow/FollowCancelMenu';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { followDayCallLabel } from '@/lib/followDayCall';
import { localThaiPhone } from '@/lib/followDayReport';
import {
  FOLLOW_CALL_CATEGORY_TONE,
  type FollowDayPerson,
  type FollowPlanningRound,
  type FollowPlanningRow,
} from '@/lib/followPlanning';
import {
  buildFollowCallQueue,
  clusterQueueByPerson,
  FOLLOW_QUEUE_PAGE_SIZES,
  lateText,
  type FollowQueueItem,
} from '@/lib/followCallQueue';
import { PagePager } from '@/components/shared/PagePager';
import { canRecordStaffCall, type FollowStaffCallOutcome } from '@/lib/followStaffCall';
import type { FollowOutcome } from '@/lib/followOutcome';

/**
 * ═══ "ต้องโทรวันนี้" (เจ้าของ Choice 12 ต.ค. 2569 "แบบ B เป็นค่าเริ่ม") — ตัวคิดอยู่ `src/lib/followCallQueue.ts` ═══
 * 🔴 14 ต.ค. 2569 เจ้าของ: *"ตรง ต้องโทร ไม่แยก Ai กับ คนโทร รวมเลยแต่บอกว่าอันไหนคน ไหน Ai ไว้หน่อยพอ"*
 * ⇒ กองเดียว "ต้องโทร" (คนต้องโทร + AI จะโทร) เรียงตามเวลา ชื่อเดียวกันติดกัน · ป้าย "คน"/"AI" ทุกแถว · จบแล้ว (พับไว้)
 * กติกาแยกกองใน lib คงเดิม (`followQueueGroupOf`) — เปลี่ยนแค่การวางบนจอ · คนโทร: ปุ่มโทร + ลงผล · เลยเวลาขึ้นแดง
 * ปุ่มลงผล/ยกเลิก/จัดการ = ตัวเดียวกับตารางเดิม (`FollowStaffCallControls` · `FollowCancelMenu` · ป๊อปจัดการ)
 * ตารางเดิมยังเปิดได้จากปุ่มสลับ "ตาราง" (ทางถอย) · ว่าง = กองยังอยู่ + แถว "ไม่มี" (กติกาว่างแล้วห้ามหาย)
 */
const TIME_FMT = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });

export default function FollowCallQueue({
  people,
  now = new Date(),
  busyId = null,
  onRecord,
  onFinish,
  onCancel,
  onOpen,
}: {
  people: readonly FollowDayPerson[];
  now?: Date;
  busyId?: string | null;
  onRecord?: (round: FollowPlanningRound, outcome: FollowStaffCallOutcome, row: FollowPlanningRow) => boolean | void | Promise<boolean | void>;
  onFinish?: (round: FollowPlanningRound, outcome: FollowOutcome) => void | Promise<void>;
  onCancel?: (round: FollowPlanningRound, choice?: FollowCancelChoice) => void | Promise<void>;
  onOpen: (row: FollowPlanningRow, ymd: string, rounds: FollowPlanningRound[]) => void;
}) {
  const queue = useMemo(() => buildFollowCallQueue(people, now), [people, now]);
  const [showDone, setShowDone] = useState(false);
  /** ต้องโทร (คน + AI รวมกัน): ชื่อเดียวกันติดกัน + แบ่งหน้าเป็น "ชื่อ" 10/20/30/40 (เจ้าของสั่ง 12 ต.ค. 2569) */
  const staffClusters = useMemo(() => clusterQueueByPerson([...queue.staff, ...queue.ai]), [queue]);
  const todoCount = queue.staff.length + queue.ai.length;
  const [staffPageSize, setStaffPageSize] = useState<number>(FOLLOW_QUEUE_PAGE_SIZES[0]);
  const [staffPage, setStaffPage] = useState(1);
  const staffPageCount = Math.max(1, Math.ceil(staffClusters.length / staffPageSize));
  const staffSafePage = Math.min(staffPage, staffPageCount);
  const staffPageClusters = staffClusters.slice((staffSafePage - 1) * staffPageSize, staffSafePage * staffPageSize);
  /** กองคนต้องโทร = รอโทร (ยังไม่มีผล) + สายที่ AI โทรแล้วแต่ไม่ได้คำตอบ (มีผลแล้ว) */
  const staffSplit = useMemo(() => {
    const afterAi = queue.staff.filter((it) => it.call.round.state === 'result').length;
    return { waiting: queue.staff.length - afterAi, afterAi };
  }, [queue]);

  const timeOf = (it: FollowQueueItem) =>
    it.call.round.entry.time_tbd ? 'ยังไม่ระบุเวลา' : it.at !== null ? TIME_FMT.format(new Date(it.at)) : '—';

  const rowOf = (it: FollowQueueItem) => {
    const { person, call } = it;
    const e = call.round.entry;
    const busy = busyId === e.id;
    const late = it.lateMinutes !== null && it.lateMinutes > 0;
    const callLabel = followDayCallLabel({ day: e.call_day ?? null, call: e.call_of_day ?? e.call_round ?? null });
    const canRecord = it.group === 'staff' && Boolean(onRecord) && canRecordStaffCall(e);
    return (
      <li
        key={e.id}
        data-testid={`queue-${it.group}`}
        className={cn(
          'grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2.5 md:grid-cols-[4.5rem_minmax(0,1fr)_auto]',
          late ? TONE.danger.soft : 'border-border/70',
        )}
      >
        <div className="tabular-nums">
          <div className={cn('text-sm font-medium', late ? TONE.danger.value : 'text-foreground')}>{timeOf(it)}</div>
          {late ? <div className={cn('text-[11px]', TONE.danger.value)}>{lateText(it.lateMinutes ?? 0)}</div> : null}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">
            {it.group !== 'done' ? (
              <span
                className={cn('mr-2 align-middle text-xs', it.group === 'ai' ? TONE.info.chip : TONE.neutral.chip)}
                data-testid="queue-caller"
              >
                {it.group === 'ai' ? 'AI' : 'คน'}
              </span>
            ) : null}
            {person.row.group.name}
            <span className="ml-2 font-normal tabular-nums text-muted-foreground">{localThaiPhone(person.row.group.phone)}</span>
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {[e.unit_name?.trim() || person.row.group.unitName, callLabel].filter(Boolean).join(' · ')}
            {' · '}
            <span className={it.group === 'done' ? TONE[FOLLOW_CALL_CATEGORY_TONE[call.category]].value : undefined}>{it.reason}</span>
          </div>
        </div>
        <div className="col-span-2 flex flex-wrap items-center gap-1.5 md:col-span-1 md:justify-end">
          {it.group === 'staff' ? (
            <Button asChild type="button" size="iconXs" variant="outline">
              <a href={`tel:${person.row.group.phone}`} aria-label={`โทรหา ${person.row.group.name}`}>
                <Phone aria-hidden />
              </a>
            </Button>
          ) : null}
          {canRecord ? (
            <FollowStaffCallControls
              compact
              entry={e}
              busy={busy}
              onRecord={(o) => onRecord?.(call.round, o, person.row)}
              onFinish={(o) => onFinish?.(call.round, o)}
              extra={onCancel ? <FollowCancelMenu busy={busy} onCancel={(c) => onCancel(call.round, c)} /> : null}
            />
          ) : it.group === 'ai' && onCancel ? (
            <FollowCancelMenu busy={busy} onCancel={(c) => onCancel(call.round, c)} />
          ) : null}
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => onOpen(person.row, call.round.ymd ?? '', person.calls.map((c) => c.round))}
          >
            จัดการ
          </Button>
        </div>
      </li>
    );
  };

  const empty = (text: string) => (
    <li className="rounded-xl border border-dashed border-border/70 px-3 py-3 text-center text-xs text-muted-foreground">{text}</li>
  );

  return (
    <div className="space-y-4 px-4 py-4 md:px-5" data-testid="follow-call-queue">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn(TONE.danger.chip, 'tabular-nums')} data-testid="queue-count-todo">
          ต้องโทร {todoCount.toLocaleString('th-TH')}
        </span>
        <span className={cn(TONE.neutral.chip, 'tabular-nums')} data-testid="queue-count-staff">
          คน {queue.staff.length.toLocaleString('th-TH')}
        </span>
        <span className={cn(TONE.info.chip, 'tabular-nums')} data-testid="queue-count-ai">
          AI {queue.ai.length.toLocaleString('th-TH')}
        </span>
        <span className={cn(TONE.neutral.chip, 'tabular-nums')} data-testid="queue-count-done">
          จบแล้ว {queue.done.length.toLocaleString('th-TH')}
        </span>
      </div>

      <section className="space-y-2">
        {/* แยกให้ทานกับแผงได้ (QA รอบ 4 ข้อ 3): รอโทร = แถวรอโทร·คน ของแผง · ที่เหลือคือสาย AI ที่ไม่ได้คำตอบ */}
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h3 className="text-sm font-medium text-foreground">ต้องโทร</h3>
          <span className="text-xs tabular-nums text-muted-foreground" data-testid="queue-staff-split">
            คน {queue.staff.length.toLocaleString('th-TH')} (รอโทร {staffSplit.waiting.toLocaleString('th-TH')} · AI โทรแล้วไม่ได้คำตอบ{' '}
            {staffSplit.afterAi.toLocaleString('th-TH')}) · AI {queue.ai.length.toLocaleString('th-TH')}
          </span>
        </div>
        <ul className="space-y-2">
          {staffPageClusters.length
            ? staffPageClusters.map((cluster) => (
                <li key={cluster[0].call.round.entry.id} data-testid="queue-staff-person">
                  <ul className="space-y-1">{cluster.map(rowOf)}</ul>
                </li>
              ))
            : empty('ไม่มีสายที่ต้องโทร')}
        </ul>
        <PagePager
          testId="queue-staff-pager"
          indicatorTestId="queue-staff-page"
          label=" (ต้องโทร)"
          page={staffSafePage}
          pageCount={staffPageCount}
          onPageChange={setStaffPage}
          summary={`${staffClusters.length.toLocaleString('th-TH')} ชื่อ · ${todoCount.toLocaleString('th-TH')} สาย`}
          size={{
            value: staffPageSize,
            options: FOLLOW_QUEUE_PAGE_SIZES,
            unit: 'ชื่อ',
            onChange: (n) => {
              setStaffPageSize(n);
              setStaffPage(1);
            },
          }}
        />
      </section>

      <section className="space-y-2">
        <Button type="button" size="xs" variant="ghost" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)}>
          {showDone ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
          จบแล้ว {queue.done.length.toLocaleString('th-TH')} สาย
        </Button>
        {showDone ? <ul className="space-y-2">{queue.done.length ? queue.done.map(rowOf) : empty('ยังไม่มีสายที่จบ')}</ul> : null}
      </section>
    </div>
  );
}
