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
import { buildFollowCallQueue, FOLLOW_QUEUE_GROUPS, lateText, type FollowQueueGroup, type FollowQueueItem } from '@/lib/followCallQueue';
import { canRecordStaffCall, type FollowStaffCallOutcome } from '@/lib/followStaffCall';
import type { FollowOutcome } from '@/lib/followOutcome';

/**
 * ═══ "ต้องโทรวันนี้" (เจ้าของ Choice 12 ต.ค. 2569 "แบบ B เป็นค่าเริ่ม") — ตัวคิดอยู่ `src/lib/followCallQueue.ts` ═══
 * สายของวันเรียงตามเวลา 3 กอง: คนต้องโทร (ปุ่มโทร + ลงผลบนแถว · เลยเวลาขึ้นแดง) · AI จะโทร (ดูอย่างเดียว) · จบแล้ว (พับไว้)
 * ปุ่มลงผล/ยกเลิก/จัดการ = ตัวเดียวกับตารางเดิม (`FollowStaffCallControls` · `FollowCancelMenu` · ป๊อปจัดการ)
 * ตารางเดิมยังเปิดได้จากปุ่มสลับ "ตาราง" (ทางถอย) · ว่าง = กองยังอยู่ + แถว "ไม่มี" (กติกาว่างแล้วห้ามหาย)
 */
const TIME_FMT = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });

const GROUP_TONE: Record<FollowQueueGroup, keyof typeof TONE> = { staff: 'danger', ai: 'info', done: 'neutral' };

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
        {FOLLOW_QUEUE_GROUPS.map((g) => (
          <span key={g.key} className={cn(TONE[GROUP_TONE[g.key]].chip, 'tabular-nums')} data-testid={`queue-count-${g.key}`}>
            {g.label} {queue[g.key].length.toLocaleString('th-TH')}
          </span>
        ))}
      </div>

      <section className="space-y-2">
        {/* แยกให้ทานกับแผงได้ (QA รอบ 4 ข้อ 3): รอโทร = แถวรอโทร·คน ของแผง · ที่เหลือคือสาย AI ที่ไม่ได้คำตอบ */}
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h3 className="text-sm font-medium text-foreground">คนต้องโทร</h3>
          <span className="text-xs tabular-nums text-muted-foreground" data-testid="queue-staff-split">
            รอโทร {staffSplit.waiting.toLocaleString('th-TH')} · AI โทรแล้วไม่ได้คำตอบ {staffSplit.afterAi.toLocaleString('th-TH')}
          </span>
        </div>
        <ul className="space-y-2">{queue.staff.length ? queue.staff.map(rowOf) : empty('ไม่มีสายที่คนต้องโทร')}</ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">AI จะโทร</h3>
        <ul className="space-y-2">{queue.ai.length ? queue.ai.map(rowOf) : empty('ไม่มีสายที่รอ AI โทร')}</ul>
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
