import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TONE } from '@/lib/designTokens';
import { CALL_OUTCOME_TONE } from '@/lib/callOutcomeTone';
import type { FollowEntry } from '@/lib/followApi';
import { FOLLOW_OUTCOME_LABEL, type FollowOutcome } from '@/lib/followOutcome';
import {
  FOLLOW_STAFF_QUICK_RESULTS,
  STAFF_FINISH_EXTRA,
  STAFF_FINISH_OUTCOME,
  followStaffCallText,
  type FollowStaffCallOutcome,
} from '@/lib/followStaffCall';
import { cn } from '@/lib/utils';

const WHEN = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Bangkok',
});

/**
 * ═══ ลงผลของสายที่ "คนโทร" — 2 ขั้น (เจ้าของเคาะ 6 ต.ค. 2569) ═══
 *
 * > *"ถ้าเป็นคนโทรเองไม่ต้องเก็บผลคำตอบ แต่ต้องเก็บว่าเขาไปหรือไม่ไป"* ·
 * > *"ลงผลโทร เสร็จก็ค่อยเลือกว่า เสร็จสิ้นเลยไหม"*
 *
 * ขั้น 1 = ไป / ไม่ไป / ขอเลื่อน / ติดต่อไม่ได้ (บันทึกเป็นผลโทรของสายนี้ · migration 130)
 * ขั้น 2 = ถ้าผลเป็น ไป / ไม่ไป / ขอเลื่อน ⇒ ถาม "จบเรื่องนี้เลยไหม" — จบ (· ลา · จำวันผิด) = ปิดงาน + หยุดสายที่เหลือทั้งชุด ·
 *          โทรต่อ = แผนเดินต่อ · ติดต่อไม่ได้ = ไม่ถาม โทรต่อเลย
 *
 * ตัวเดียวกันทั้งช่อง "เขาตอบว่าอะไร" ของตารางรายวัน (`compact`) และป๊อปจัดการ — ไม่ซ้อน Dialog ·
 * 🔴 ตาราง (`compact`) = ปุ่ม "ลงผล" ปุ่มเดียว กดแล้วเด้ง Popover ให้เลือก (เจ้าของ 7 ต.ค. 2569 ปัญหา Lumos ข้อ 5:
 * *"เลื่อนดูงานแล้วมือมันไปกดโดนของคนอื่น"*) · ขั้น 2 "จบเรื่องนี้ไหม" อยู่ใน Popover เดียวกัน ·
 * ไม่มีช่องพิมพ์คำตอบ (คนโทรไม่ต้องเก็บคำตอบ) · หมายเหตุเก่าที่เคยพิมพ์ยังโชว์
 */
const FollowStaffCallControls: React.FC<{
  entry: FollowEntry;
  busy?: boolean;
  /** แถวตาราง = ปุ่มบรรทัดเดียว ไม่มีหัวข้อ */
  compact?: boolean;
  /** คืน `false` = บันทึกไม่สำเร็จ (ไม่ไปขั้น 2) */
  onRecord: (outcome: FollowStaffCallOutcome) => boolean | void | Promise<boolean | void>;
  /** ขั้น 2 "จบเรื่องนี้" — ปิดงานด้วยผลนี้ + หยุดสายที่เหลือทั้งชุด */
  onFinish: (outcome: FollowOutcome) => void | Promise<void>;
  /** ล้างผล (ป๊อปจัดการ) — ไม่ส่ง = ไม่มีปุ่มล้าง */
  onClear?: () => void | Promise<void>;
  /** ปุ่มยกเลิกสายต่อท้ายปุ่มผล (ตารางรายวัน) */
  extra?: React.ReactNode;
}> = ({ entry, busy = false, compact = false, onRecord, onFinish, onClear, extra }) => {
  const recorded = entry.staff_call_outcome && entry.staff_called_at ? (entry.staff_call_outcome as FollowStaffCallOutcome) : null;
  const closed = Boolean(entry.completed_at);
  const [editing, setEditing] = useState(false);
  /** ขั้น 2 ค้างอยู่ของผลไหน (null = ไม่ถาม) */
  const [askFinish, setAskFinish] = useState<FollowStaffCallOutcome | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  /** Popover ของตาราง (`compact`) */
  const [open, setOpen] = useState(false);

  const pick = async (outcome: FollowStaffCallOutcome) => {
    const ok = await onRecord(outcome);
    if (ok === false) return;
    setEditing(false);
    const ask = !closed && STAFF_FINISH_OUTCOME[outcome] ? outcome : null;
    setAskFinish(ask);
    if (!ask) setOpen(false);
  };

  const row = cn('flex items-center gap-1', compact ? 'flex-nowrap whitespace-nowrap' : 'flex-wrap');
  /** ใน Popover ปุ่มใหญ่ขึ้น 2 คอลัมน์ — กดง่าย ไม่โดนข้าง ๆ */
  const btnSize = compact ? 'sm' : 'xs';
  const panelRow = compact ? 'grid grid-cols-2 gap-2' : row;

  // ── ขั้น 2: จบเรื่องนี้เลยไหม ──
  const finishPanel = (ask: FollowStaffCallOutcome) => {
    const finishWith = STAFF_FINISH_OUTCOME[ask] as FollowOutcome;
    return (
      <span className={cn(compact ? 'flex flex-col gap-2' : row)} data-testid="staff-finish-ask">
        <span className={compact ? 'text-sm font-medium' : 'text-[11px] text-muted-foreground'}>จบเรื่องนี้เลยไหม</span>
        <span className={panelRow}>
          {/* ปุ่มจบหลักของผลนั้นมาก่อน แล้วตามด้วย ลา · จำวันผิด (6 ต.ค. 2569) */}
          {[finishWith, ...STAFF_FINISH_EXTRA.filter((o) => o !== finishWith)].map((o, i) => (
            <Button
              key={o}
              type="button"
              size={btnSize}
              variant={i === 0 ? 'default' : 'outline'}
              disabled={busy}
              onClick={async () => {
                await onFinish(o);
                setAskFinish(null);
                setOpen(false);
              }}
            >
              จบ · {FOLLOW_OUTCOME_LABEL[o]}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            size={btnSize}
            disabled={busy}
            onClick={() => {
              setAskFinish(null);
              setOpen(false);
            }}
          >
            โทรต่อตามแผน
          </Button>
        </span>
      </span>
    );
  };

  // ── ขั้น 1: ยังไม่ลงผล หรือกดแก้ ──
  const quickPanel = (
    <span className={panelRow} data-testid="staff-quick">
      {FOLLOW_STAFF_QUICK_RESULTS.map((q) => (
        <Button
          key={q.outcome}
          type="button"
          variant="outline"
          size={btnSize}
          disabled={busy}
          onClick={() => void pick(q.outcome)}
          className={cn(TONE[CALL_OUTCOME_TONE[q.outcome] ?? 'warn'].value, recorded === q.outcome && 'border-current')}
        >
          {q.label}
        </Button>
      ))}
    </span>
  );

  // ── ตาราง: ปุ่มเดียว เด้ง Popover ──
  if (compact && (askFinish || !recorded || editing)) {
    return (
      <span className={row}>
        <Popover
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setEditing(false);
          }}
        >
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="xs" disabled={busy} data-testid="staff-result-open">
              {askFinish ? 'จบเรื่องนี้ไหม' : editing ? 'แก้ผล' : 'ลงผล'}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="flex w-64 flex-col gap-2 p-3">
            {askFinish ? (
              finishPanel(askFinish)
            ) : (
              <>
                <span className="text-sm font-medium">เขาไปไหม</span>
                {quickPanel}
              </>
            )}
          </PopoverContent>
        </Popover>
        {extra}
      </span>
    );
  }

  if (askFinish) return finishPanel(askFinish);

  if (!recorded || editing) {
    return (
      <span className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">เขาไปไหม</span>
        <span className={row}>
          {quickPanel}
          {editing ? (
            <Button type="button" variant="ghost" size="xs" onClick={() => setEditing(false)}>
              ไม่แก้
            </Button>
          ) : (
            extra
          )}
        </span>
      </span>
    );
  }

  // ── ลงแล้ว ──
  return (
    <span className={cn('flex flex-col gap-1', !compact && 'gap-1.5')} data-testid="staff-recorded">
      <span className={cn(row, 'text-xs')}>
        <span className={TONE[CALL_OUTCOME_TONE[recorded] ?? 'warn'].chip}>{followStaffCallText(recorded)}</span>
        {closed ? <span className="text-muted-foreground">จบแล้ว</span> : null}
        <span className="tabular-nums text-muted-foreground">
          {[entry.staff_called_by_name, entry.staff_called_at ? `${WHEN.format(new Date(entry.staff_called_at))} น.` : null]
            .filter(Boolean)
            .join(' · ')}
        </span>
        {!closed ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={busy}
            onClick={() => {
              setEditing(true);
              setOpen(true);
            }}
          >
            แก้
          </Button>
        ) : null}
      </span>
      {entry.staff_call_note ? <span className="text-xs text-muted-foreground">{entry.staff_call_note}</span> : null}
      {onClear && !closed ? (
        confirmClear ? (
          <span className={row}>
            <span className="text-xs text-muted-foreground">ล้างผลนี้ไหม</span>
            <Button
              type="button"
              variant="destructive"
              size="xs"
              disabled={busy}
              onClick={async () => {
                await onClear();
                setConfirmClear(false);
              }}
            >
              {busy ? 'กำลังล้าง…' : 'ล้างเลย'}
            </Button>
            <Button type="button" variant="outline" size="xs" onClick={() => setConfirmClear(false)}>
              ไม่
            </Button>
          </span>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={busy}
            onClick={() => setConfirmClear(true)}
            className={cn('w-fit', TONE.danger.value)}
          >
            ล้างผล
          </Button>
        )
      ) : null}
    </span>
  );
};

export default FollowStaffCallControls;
