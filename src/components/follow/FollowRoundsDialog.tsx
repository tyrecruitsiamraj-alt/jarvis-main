import React from 'react';
import { Building2, Pencil, Phone, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import FollowDispatchBadge from '@/components/follow/FollowDispatchBadge';
import FollowCompleteControls from '@/components/follow/FollowCompleteControls';
import { FOLLOW_OUTCOME_LABEL, type FollowOutcome, type FollowOutcomeAny } from '@/lib/followOutcome';
import { CALL_OUTCOME_LABEL } from '@/lib/callOutcomeTone';
import type { FollowEntry } from '@/lib/followApi';
import type { FollowGroup } from '@/lib/followGrouping';
import {
  FOLLOW_ROUND_STATE_LABEL,
  type FollowPlanningRound,
  type FollowRoundState,
} from '@/lib/followPlanning';
import { formatYmdDmyBe } from '@/lib/dateTh';

/**
 * ═══ ป๊อปรายละเอียดของ "คนคนนี้ ในวันนี้" (เจ้าของสั่ง 1 ก.ย. 2569) ═══
 *
 * > *"คนที่ต้องติดตาม / หน่วยงาน / ติดตามวันไหน / แต่ละรอบ · เวลา · ไปถึงไหน
 * >  — หมายถึงเอากล่องพวกนี้ออกไปเลย"*
 *
 * ตารางรายละเอียดใต้ปฏิทินถูกถอดทิ้ง ⇒ **ปุ่มทำงานย้ายมาอยู่ในป๊อปนี้**
 * (เจ้าของเลือกเอง: *"กดช่องในปฏิทินแล้วเด้ง popup"*) กดช่องเวลาในปฏิทิน = เปิดอันนี้
 *
 * 🔴 **ห้ามซ้อน Dialog ใน Dialog** — ปุ่ม "แก้ไข" จึง **ปิดป๊อปนี้ก่อน** แล้วค่อยเปิด
 * กล่องแก้ไข (หน้าเรียกเป็นคนจัดให้) · ปุ่มเสร็จสิ้น/ยกเลิกไม่ใช่ Dialog จึงอยู่ในนี้ได้
 */

/** สีของชิปเวลา — ความหมายเดียวกับช่องในปฏิทิน */
const STATE_CHIP: Record<FollowRoundState, string> = {
  cancelled: TONE.neutral.chip,
  closed: TONE.success.chip,
  result: TONE.success.chip,
  overdue: TONE.danger.chip,
  sent: TONE.primary.chip,
  waiting: TONE.neutral.chip,
};

/**
 * ผลโทรเป็นคำไทย — อ่านจาก `CALL_OUTCOME_LABEL` ที่เป็นแหล่งเดียวของทั้งระบบ
 * 🔴 รหัสที่ยังไม่มีคำแปลให้โชว์รหัสไปตามตรง **ห้ามซ่อน**
 * (จอที่เดาแล้วบอกผิด แย่กว่าจอที่ยอมรับว่าไม่รู้)
 */
function callOutcomeText(code: string): string {
  return CALL_OUTCOME_LABEL[code] ?? code;
}

const FollowRoundsDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  group: FollowGroup | null;
  /** วันที่ของช่องที่กด (YYYY-MM-DD) — null = ยังไม่ได้เลือก */
  ymd: string | null;
  rounds: readonly FollowPlanningRound[];
  busyId: string | null;
  cancellingId: string | null;
  onAskCancel: (id: string | null) => void;
  onCancel: (id: string) => void;
  /** หน้าเรียกต้องปิดป๊อปนี้ก่อนเปิดกล่องแก้ไข — ห้ามซ้อน Dialog */
  onEdit: (entry: FollowEntry) => void;
  onComplete: (id: string, outcome: FollowOutcome, note?: string) => void | Promise<void>;
}> = ({
  open,
  onClose,
  group,
  ymd,
  rounds,
  busyId,
  cancellingId,
  onAskCancel,
  onCancel,
  onEdit,
  onComplete,
}) => {
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{group?.name ?? 'รายละเอียดการติดตาม'}</DialogTitle>
          <DialogDescription>
            {ymd ? `นัดของวันที่ ${formatYmdDmyBe(ymd)} · ` : ''}
            {group?.topic ?? ''}
          </DialogDescription>
        </DialogHeader>

        {group ? (
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <a
              href={`tel:${group.phone}`}
              className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-sky-200 bg-sky-50/70 px-2.5 py-1 font-medium text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-950"
            >
              <Phone className="h-3 w-3" aria-hidden />
              {group.phone}
            </a>
            {/* ⚠️ ไม่รู้ = "—" ห้าม fallback ไปค่าอื่น */}
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Building2 className="h-3 w-3 shrink-0" aria-hidden />
              <span className="font-medium text-foreground">{group.unitName || '—'}</span>
              {group.siteCode ? <span className="font-mono">({group.siteCode})</span> : null}
            </span>
            {group.createdByName ? (
              <span className="text-muted-foreground">คนคีย์ {group.createdByName}</span>
            ) : null}
          </div>
        ) : null}

        <ul className="space-y-2">
          {rounds.map((r) => {
            const it = r.entry;
            const busy = busyId === it.id;
            const canWork = !it.cancelled && !it.completed_at;
            return (
              <li
                key={it.id}
                className={cn('rounded-xl border p-2.5', TONE.neutral.soft, it.cancelled && 'opacity-60')}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={cn('tabular-nums', STATE_CHIP[r.state])}>
                    {r.time ? `${r.time} น.` : 'ไม่ได้ตั้งเวลา'}
                  </span>
                  <span className="text-[11px] font-medium text-foreground">
                    {FOLLOW_ROUND_STATE_LABEL[r.state]}
                  </span>
                  {/* ป้าย "ไม่ได้ส่งให้ AI เพราะอะไร" — call_status เป็น null เมื่อไม่เคยเข้าคิว
                      ไม่มีป้ายนี้จะกลายเป็นช่องว่างเปล่าที่คนอ่านว่าปกติ */}
                  <FollowDispatchBadge entry={it} />
                  {it.completed_at && it.outcome_code ? (
                    <span
                      title={it.outcome_note || undefined}
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        TONE.success.chip,
                      )}
                    >
                      ปิดงาน: {FOLLOW_OUTCOME_LABEL[it.outcome_code as FollowOutcomeAny] ?? it.outcome_code}
                    </span>
                  ) : null}
                  {it.staff_phone ? (
                    <span className="text-[11px] text-muted-foreground">โทรกลับ {it.staff_phone}</span>
                  ) : null}
                </div>

                {it.note ? <p className="mt-1 text-[11px] text-muted-foreground">{it.note}</p> : null}
                {it.call_outcome || it.call_summary ? (
                  <p className="mt-1 rounded-lg bg-background/70 px-2.5 py-1 text-[11px] text-slate-700 dark:text-slate-200">
                    ผลการโทร{it.call_outcome ? ` — ${callOutcomeText(it.call_outcome)}` : ''}
                    {it.call_summary ? `: ${it.call_summary}` : ''}
                  </p>
                ) : null}

                {/* 🔴 **ปุ่มต้องอ่านออกว่าเป็นปุ่ม ไม่ใช่ป้ายสถานะ** (เจ้าของทัก 1 ก.ย. 2569:
                    *"ทำไมขึ้นว่าเสร็จสิ้น เพราะในระบบ Lumos บอกยกเลิก"* — สิ่งที่เห็นคือ
                    **ปุ่มสีเขียว "เสร็จสิ้น"** ไม่ใช่สถานะของสาย) ⇒ มีหัวข้อกำกับว่าเป็นแถวคำสั่ง
                    และคำบนปุ่มขึ้นต้นด้วยกริยา */}
                <p className="mt-2 text-[10px] font-semibold text-muted-foreground">จัดการรอบนี้</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {canWork ? (
                    <button
                      type="button"
                      onClick={() => onEdit(it)}
                      title="แก้ไขรอบนี้"
                      className={cn(
                        'inline-flex min-h-[32px] items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium',
                        TONE.neutral.outline,
                      )}
                    >
                      <Pencil className="h-3 w-3" aria-hidden />
                      แก้ไข
                    </button>
                  ) : null}
                  {/* ปิดงาน — ไม่ผูกกับ call_status: ตามจนจบเองโดย AI ยังไม่โทรก็ปิดได้ */}
                  {canWork ? (
                    <FollowCompleteControls busy={busy} onComplete={(o, n) => onComplete(it.id, o, n)} />
                  ) : null}
                  {canWork && it.call_status === 'pending' ? (
                    cancellingId === it.id ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onCancel(it.id)}
                          className="inline-flex min-h-[32px] items-center rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {busy ? 'กำลังยกเลิก…' : 'ยืนยันยกเลิก'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onAskCancel(null)}
                          className={cn(
                            'inline-flex min-h-[32px] items-center rounded-full border px-2.5 py-1 text-[11px] font-medium',
                            TONE.neutral.outline,
                          )}
                        >
                          ไม่
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAskCancel(it.id)}
                        className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/50"
                      >
                        <X className="h-3 w-3" aria-hidden />
                        ยกเลิก
                      </button>
                    )
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
};

export default FollowRoundsDialog;
