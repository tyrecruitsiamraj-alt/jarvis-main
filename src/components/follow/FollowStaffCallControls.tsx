import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TONE } from '@/lib/designTokens';
import { CALL_OUTCOME_TONE } from '@/lib/callOutcomeTone';
import type { FollowEntry } from '@/lib/followApi';
import { FOLLOW_OUTCOME_LABEL, type FollowOutcome } from '@/lib/followOutcome';
import {
  FOLLOW_STAFF_QUICK_RESULTS,
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
 * ขั้น 2 = ถ้าผลเป็น ไป / ไม่ไป / ขอเลื่อน ⇒ ถาม "จบเรื่องนี้เลยไหม" — จบ = ปิดงาน + หยุดสายที่เหลือทั้งชุด ·
 *          โทรต่อ = แผนเดินต่อ · ติดต่อไม่ได้ = ไม่ถาม โทรต่อเลย
 *
 * ตัวเดียวกันทั้งช่อง "เขาตอบว่าอะไร" ของตารางรายวัน (`compact`) และป๊อปจัดการ — ไม่ซ้อน Dialog ·
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

  const pick = async (outcome: FollowStaffCallOutcome) => {
    const ok = await onRecord(outcome);
    if (ok === false) return;
    setEditing(false);
    setAskFinish(!closed && STAFF_FINISH_OUTCOME[outcome] ? outcome : null);
  };

  const row = cn('flex items-center gap-1', compact ? 'flex-nowrap whitespace-nowrap' : 'flex-wrap');

  // ── ขั้น 2: จบเรื่องนี้เลยไหม ──
  if (askFinish) {
    const finishWith = STAFF_FINISH_OUTCOME[askFinish] as FollowOutcome;
    return (
      <span className={row} data-testid="staff-finish-ask">
        <span className="text-[11px] text-muted-foreground">จบเรื่องนี้เลยไหม</span>
        <Button
          type="button"
          size="xs"
          disabled={busy}
          onClick={async () => {
            await onFinish(finishWith);
            setAskFinish(null);
          }}
        >
          จบ · {FOLLOW_OUTCOME_LABEL[finishWith]}
        </Button>
        <Button type="button" variant="outline" size="xs" disabled={busy} onClick={() => setAskFinish(null)}>
          โทรต่อตามแผน
        </Button>
      </span>
    );
  }

  // ── ขั้น 1: ยังไม่ลงผล หรือกดแก้ ──
  if (!recorded || editing) {
    return (
      <span className={cn('flex flex-col gap-1.5', compact && 'gap-1')}>
        {!compact ? <span className="text-xs font-medium text-muted-foreground">เขาไปไหม</span> : null}
        <span className={row} data-testid="staff-quick">
          {FOLLOW_STAFF_QUICK_RESULTS.map((q) => (
            <Button
              key={q.outcome}
              type="button"
              variant="outline"
              size="xs"
              disabled={busy}
              onClick={() => void pick(q.outcome)}
              className={cn(TONE[CALL_OUTCOME_TONE[q.outcome] ?? 'warn'].value, recorded === q.outcome && 'border-current')}
            >
              {q.label}
            </Button>
          ))}
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
          <Button type="button" variant="ghost" size="xs" disabled={busy} onClick={() => setEditing(true)}>
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
