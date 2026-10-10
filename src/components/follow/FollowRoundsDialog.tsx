import type { FollowStopScope } from '@/lib/followApi';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Building2, Pencil, Phone, RotateCcw, Trash2, X } from 'lucide-react';
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
import FollowStaffCallControls from '@/components/follow/FollowStaffCallControls';
import { canRecordStaffCall, type FollowStaffCallOutcome } from '@/lib/followStaffCall';
import { FOLLOW_OUTCOME_LABEL, type FollowOutcome, type FollowOutcomeAny } from '@/lib/followOutcome';
import { followCallOutcomeText } from '@/lib/callOutcomeTone';
import type { FollowEntry } from '@/lib/followApi';
import type { FollowGroup } from '@/lib/followGrouping';
import {
  followRoundLabel,
  roundTone,
  type FollowPlanningRound,
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
  /**
   * ย้อนสถานะปิดงาน (feedback 2 ก.ย. 2569) — เลือกผลผิดแล้วแก้ต่อได้ ไม่ต้องสร้างใหม่
   */
  onReopen: (id: string) => void | Promise<void>;
  onComplete: (id: string, outcome: FollowOutcome, note?: string, stopScope?: FollowStopScope) => void | Promise<void>;
  /** ลง/ล้างผลโทรของรอบคนโทร (130 · 30 ก.ย. 2569) — โชว์เฉพาะรอบที่ตั้งเป็นคนโทร */
  onStaffCall: (id: string, outcome: FollowStaffCallOutcome, note?: string) => boolean | void | Promise<boolean | void>;
  onStaffCallClear: (id: string) => void | Promise<void>;
  /**
   * ลบทิ้งจริง — โชว์เฉพาะ admin (เจ้าของสั่ง 3 ก.ย. 2569: *"ทำให้ฉันลบได้หน่อย
   * เฉพาะฉันนะ เพราะตอนนี้ทดสอบอยู่"*) · `null` = ไม่มีสิทธิ์ ไม่ต้องขึ้นปุ่ม
   */
  onPurge: ((id: string) => void | Promise<void>) | null;
  /** id ที่กดลบแล้วรอยืนยัน — ลบจริงกู้ไม่ได้ ต้องถามซ้ำเสมอ */
  purgingId: string | null;
  onAskPurge: (id: string | null) => void;
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
  onReopen,
  onStaffCall,
  onStaffCallClear,
  onPurge,
  purgingId,
  onAskPurge,
}) => {
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{group?.name ?? 'รายละเอียดการติดตาม'}</DialogTitle>
          <DialogDescription>
            {ymd ? `นัดของวันที่ ${formatYmdDmyBe(ymd)} · ` : `แผนทั้งหมด ${rounds.length.toLocaleString('th-TH')} สาย · `}
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
            /* 🔴 **กรอบของกล่องต้องเป็นสีเดียวกับชิป** (เจ้าของทัก 1 ก.ย. 2569: *"สีกรอบไม่แก้ไขหรอ"*)
               เดิมกรอบเป็นเทาทุกใบ ⇒ กวาดตาแล้วทุกรอบดูเหมือนกันหมด สีที่ชิปเลยไม่ช่วยอะไร */
            const tone = roundTone(r);
            /* รอบที่ยกเลิก/ปิดไปแล้วไม่มีปุ่มอะไรให้กด — ซ่อนหัวข้อ "จัดการรอบนี้" ไปด้วย
               ไม่งั้นเหลือหัวข้อลอยที่ไม่มีของอยู่ข้างใต้ */
            const canCancel = !it.cancelled && !it.completed_at && it.call_status === 'pending';
            const busy = busyId === it.id;
            const canWork = !it.cancelled && !it.completed_at;
            return (
              <li
                key={it.id}
                className={cn('rounded-xl border p-2.5', TONE[tone].soft, it.cancelled && 'opacity-60')}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {/* 🔴 สีตาม "ผลเป็นยังไง" ไม่ใช่ "มีผลหรือยัง" — ชุดเดียวกับช่องในปฏิทิน */}
                  <span className={cn('tabular-nums', TONE[tone].chip)}>
                    {/* โหมดแผนทั้งหมด (ymd ว่าง) ต้องบอกวันด้วย ไม่งั้นทุกสายดูเหมือนวันเดียวกัน */}
                    {!ymd && r.ymd ? `${formatYmdDmyBe(r.ymd)} · ` : ''}
                    {r.entry.time_tbd ? 'ยังไม่ระบุเวลา' : r.time ? `${r.time} น.` : 'ไม่ได้ตั้งเวลา'}
                  </span>
                  <span className="text-[11px] font-medium text-foreground">
                    {/* คำเดียวกับชิปบนตาราง (QA 10 ต.ค. 2569 ป๊อปเคยเขียน "ไป" / "ไม่ได้ส่ง" ขณะตารางเขียน "ตอบว่าไป" / "รอโทร · ไม่ได้ส่งให้ AI") */}
                    {followRoundLabel(r)}
                  </span>
                  {/* ป้าย "ไม่ได้ส่งให้ AI เพราะอะไร" — call_status เป็น null เมื่อไม่เคยเข้าคิว
                      ไม่มีป้ายนี้จะกลายเป็นช่องว่างเปล่าที่คนอ่านว่าปกติ */}
                  <FollowDispatchBadge entry={it} />
                  {it.completed_at && it.outcome_code ? (
                    <span
                      title={it.outcome_note || undefined}
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                        TONE.success.chip,
                      )}
                    >
                      ปิดงาน: {FOLLOW_OUTCOME_LABEL[it.outcome_code as FollowOutcomeAny] ?? it.outcome_code}
                    </span>
                  ) : null}
                  {it.staff_phone ? (
                    <span className="text-[11px] text-muted-foreground">โทรกลับ {it.staff_phone}</span>
                  ) : null}
                  {/* 🔴 สถานะเบอร์ฉุกเฉิน (feedback 2 ก.ย. 2569) — เขียนได้แค่ "ส่งเบอร์ไปแล้ว"
                      เพราะผลที่ Lumos ส่งกลับ **ยังไม่มีช่องบอกว่าโทรเบอร์นี้หรือยัง**
                      (ตรวจครบทุกช่องแล้ว) · เขียนว่า "โทรแล้ว" ตอนนี้คือจอโกหก */}
                  {it.emergency_phone ? (
                    <span
                      title="เบอร์ที่ AI โทรเมื่อติดต่อผู้รับไม่ได้"
                      className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', TONE.neutral.chip)}
                    >
                      เบอร์ฉุกเฉินที่ส่งไป {it.emergency_phone} · ยังไม่รู้ว่าโทรหรือยัง
                    </span>
                  ) : null}
                </div>

                {it.note ? <p className="mt-1 text-[11px] text-muted-foreground">{it.note}</p> : null}
                {it.call_outcome || it.call_summary ? (
                  <p className="mt-1 rounded-lg bg-background/70 px-2.5 py-1 text-[11px] text-slate-700 dark:text-slate-200">
                    ผลการโทร{it.call_outcome ? ` — ${followCallOutcomeText(it.call_outcome)}` : ''}
                    {it.call_summary ? `: ${it.call_summary}` : ''}
                  </p>
                ) : null}

                {/* 🔴 รอบคนโทร: ลงผล 2 ขั้น (เจ้าของเคาะ 6 ต.ค. 2569 *"ลงผลโทร เสร็จก็ค่อยเลือกว่า เสร็จสิ้นเลยไหม"*)
                    ขั้น 1 ไป / ไม่ไป / ขอเลื่อน / ติดต่อไม่ได้ → ขั้น 2 จบเรื่องเลยไหม — ตัวเดียวกับช่อง "เขาตอบว่าอะไร"
                    ⇒ รอบคนโทรไม่มีปุ่ม "บันทึกว่าเสร็จสิ้น" แยกแล้ว (ข้างล่าง) */}
                {/* 7 ต.ค. 2569: สาย AI ที่ไม่ได้คำตอบ (ถึงเวลาแล้ว/มีผลไม่ชัด) ลงผลเองได้ด้วย — สาย AI ที่ยังไม่ถึงเวลาไม่โชว์ */}
                {canRecordStaffCall(it) &&
                (it.call_mode === 'manual' ||
                  Boolean(it.staff_call_outcome) ||
                  Boolean(it.call_outcome) ||
                  Date.parse(it.scheduled_at ?? '') <= Date.now()) &&
                !(it.completed_at && !it.staff_call_outcome) ? (
                  <div className="mt-2">
                    <FollowStaffCallControls
                      entry={it}
                      busy={busy}
                      onRecord={(o) => onStaffCall(it.id, o)}
                      onFinish={(o) => onComplete(it.id, o, undefined, 'set')}
                      onClear={() => onStaffCallClear(it.id)}
                    />
                  </div>
                ) : null}

                {/* 🔴 **ปุ่มต้องอ่านออกว่าเป็นปุ่ม ไม่ใช่ป้ายสถานะ** (เจ้าของทัก 1 ก.ย. 2569:
                    *"ทำไมขึ้นว่าเสร็จสิ้น เพราะในระบบ Lumos บอกยกเลิก"* — สิ่งที่เห็นคือ
                    **ปุ่มสีเขียว "เสร็จสิ้น"** ไม่ใช่สถานะของสาย) ⇒ มีหัวข้อกำกับว่าเป็นแถวคำสั่ง
                    และคำบนปุ่มขึ้นต้นด้วยกริยา */}
                {/* 🔴 ปิดงานแล้วต้องมีทางย้อน (feedback 2 ก.ย. 2569:
                    *"แก้ไขสถานะเสร็จแล้ว อยากให้ทำได้ต่อเนื่อง (ย้อนกลับ) ไม่ต้องเริ่มใหม่ทุกครั้ง"*)
                    เดิมกดเสร็จสิ้นแล้วปุ่มหายหมด เลือกผิดคือแก้ไม่ได้เลย */}
                {it.completed_at && !it.cancelled ? (
                  <>
                    <p className="mt-2 text-[10px] font-medium text-muted-foreground">จัดการสายนี้</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => onReopen(it.id)}
                        title="ล้างผลปิดงาน · สายที่ถูกหยุดตอนปิดกลับมาด้วย"
                        className={cn('min-h-8 gap-1 px-2.5 text-[11px]', TONE.warn.value)}
                      >
                        <RotateCcw aria-hidden />
                        {busy ? 'กำลังย้อน…' : 'ย้อนสถานะ'}
                      </Button>
                    </div>
                  </>
                ) : null}
                {canWork || canCancel ? (
                  <>
                <p className="mt-2 text-[10px] font-medium text-muted-foreground">จัดการสายนี้</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {canWork ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(it)}
                      title="แก้ไขสายนี้"
                      className="min-h-8 gap-1 px-2.5 text-[11px]"
                    >
                      <Pencil aria-hidden />
                      แก้ไข
                    </Button>
                  ) : null}
                  {/* ปิดงาน — ไม่ผูกกับ call_status: ตามจนจบเองโดย AI ยังไม่โทรก็ปิดได้ */}
                  {/* รอบ AI ยังมี "บันทึกว่าเสร็จสิ้น" · รอบคนโทรจบเรื่องผ่านขั้น 2 ข้างบนแทน (6 ต.ค. 2569) */}
                  {canWork && it.call_mode !== 'manual' ? (
                    <FollowCompleteControls busy={busy} onComplete={(o, n, sc) => onComplete(it.id, o, n, sc)} />
                  ) : null}
                  {canCancel ? (
                    cancellingId === it.id ? (
                      <>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={busy}
                          onClick={() => onCancel(it.id)}
                          className="min-h-8 px-2.5 text-[11px]"
                        >
                          {busy ? 'กำลังยกเลิก…' : 'ยืนยันยกเลิก'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onAskCancel(null)}
                          className="min-h-8 px-2.5 text-[11px]"
                        >
                          ไม่
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onAskCancel(it.id)}
                        className={cn('min-h-8 gap-1 px-2.5 text-[11px]', TONE.danger.value)}
                      >
                        <X aria-hidden />
                        ยกเลิก
                      </Button>
                    )
                  ) : null}
                </div>
                  </>
                ) : null}
                {/* 🔴 ลบทิ้งจริง (admin) — แยกกล่องล่างสุดคนละแถวกับปุ่มทำงานปกติ
                    เพื่อไม่ให้กดพลาดตอนรีบ · โชว์ได้ทุกสถานะ เพราะแถวขยะช่วงทดลอง
                    ส่วนใหญ่คือแถวที่ยกเลิก/ปิดไปแล้วซึ่งไม่มีปุ่มอื่นเหลือ */}
                {onPurge ? (
                  <div className="mt-2 border-t border-dashed border-border/70 pt-2">
                    {purgingId === it.id ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">
                          ลบแล้วกู้ไม่ได้ ลบเลยไหม
                        </span>
                        {/* 🔴 ใช้ Button ของ shadcn — กติกา UI ของโปรเจกต์ (เจ้าของย้ำ 3 ก.ย. 2569:
                            *"ให้ใช้ Shadcn เพื่อคุม Framework ห้ามสร้าง component เอง"*) */}
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={busy}
                          onClick={() => onPurge(it.id)}
                          className="min-h-8 px-2.5 text-[11px]"
                        >
                          {busy ? 'กำลังลบ…' : 'ลบเลย'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onAskPurge(null)}
                          className="min-h-8 px-2.5 text-[11px]"
                        >
                          ไม่
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onAskPurge(it.id)}
                        title="ลบสายนี้ออกจากระบบถาวร (ผู้ดูแลระบบเท่านั้น)"
                        className={cn('min-h-8 gap-1 px-2.5 text-[11px]', TONE.danger.value)}
                      >
                        <Trash2 aria-hidden />
                        ลบทิ้ง
                      </Button>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
};

export default FollowRoundsDialog;
