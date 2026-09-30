import React, { useState } from 'react';
import { PhoneCall } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TONE } from '@/lib/designTokens';
import { CALL_OUTCOME_TONE } from '@/lib/callOutcomeTone';
import type { FollowEntry } from '@/lib/followApi';
import {
  FOLLOW_STAFF_CALL_NOTE_MAX,
  FOLLOW_STAFF_CALL_OUTCOMES,
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
 * ═══ ลงผลโทรของรอบที่ตั้งให้ "คนโทร" (migration 130 · เจ้าของเคาะ 30 ก.ย. 2569) ═══
 *
 * หน้าหลักนับ "คนโทร" จาก **โทรจริงที่มีผลบันทึก** — รอบคนโทรเดิมไม่มีที่ลงผล ปุ่มนี้คือที่ลงผลนั้น
 * แพตเทิร์นเดียวกับ `FollowCompleteControls`: ปุ่มเดียว กดแล้วกางให้เลือกคำในที่เดิม (**ไม่ซ้อน Dialog**)
 * · พิมพ์หมายเหตุก่อนแล้วกดคำ = บันทึกทันที · ลงแล้วแก้ได้ ล้างได้ (ต้องยืนยันก่อนล้าง)
 * ⚠️ ไม่แตะคิวโทร ไม่แตะการปิดงาน — ปิดงานยังเป็นปุ่มของมันเอง
 */
const FollowStaffCallControls: React.FC<{
  entry: FollowEntry;
  busy?: boolean;
  onRecord: (outcome: FollowStaffCallOutcome, note?: string) => void | Promise<void>;
  onClear: () => void | Promise<void>;
}> = ({ entry, busy = false, onRecord, onClear }) => {
  const [open, setOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [note, setNote] = useState('');
  const recorded = entry.staff_call_outcome && entry.staff_called_at ? entry.staff_call_outcome : null;

  const submit = async (outcome: FollowStaffCallOutcome) => {
    await onRecord(outcome, note.trim() || undefined);
    setOpen(false);
    setNote('');
  };

  if (open) {
    return (
      <div className="flex w-full flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3">
        <p className="text-xs font-medium text-foreground">โทรแล้วได้ผลอะไร</p>
        <div className="flex flex-wrap gap-1.5">
          {FOLLOW_STAFF_CALL_OUTCOMES.map((o) => (
            <Button
              key={o}
              type="button"
              variant="outline"
              size="xs"
              disabled={busy}
              onClick={() => void submit(o)}
              className={cn(recorded === o && TONE[CALL_OUTCOME_TONE[o]].value)}
            >
              {followStaffCallText(o)}
            </Button>
          ))}
        </div>
        <Input
          value={note}
          maxLength={FOLLOW_STAFF_CALL_NOTE_MAX}
          onChange={(e) => setNote(e.target.value)}
          placeholder="มีหมายเหตุให้พิมพ์ก่อน แล้วค่อยกดผล"
          aria-label="หมายเหตุผลโทร"
          className="h-9 text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => {
            setOpen(false);
            setNote('');
          }}
          className="w-fit"
        >
          ปิด
        </Button>
      </div>
    );
  }

  if (!recorded) {
    return (
      <Button
        type="button"
        variant="outline"
        size="xs"
        disabled={busy}
        onClick={() => setOpen(true)}
        title="กดแล้วเลือกผล ระบบบันทึกตอนเลือกผล"
      >
        <PhoneCall aria-hidden />
        {busy ? 'กำลังบันทึก…' : 'ลงผลโทร'}
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={TONE[CALL_OUTCOME_TONE[recorded as FollowStaffCallOutcome] ?? 'warn'].chip}>
          คนโทร: {followStaffCallText(recorded)}
        </span>
        <span className="text-muted-foreground tabular-nums">
          {entry.staff_called_by_name ? `${entry.staff_called_by_name} · ` : ''}
          {entry.staff_called_at ? WHEN.format(new Date(entry.staff_called_at)) : ''}
        </span>
      </div>
      {entry.staff_call_note ? <p className="text-xs text-muted-foreground">{entry.staff_call_note}</p> : null}
      <div className="flex flex-wrap items-center gap-1.5">
        {confirmClear ? (
          <>
            <span className="text-xs text-muted-foreground">ล้างผลโทรนี้ไหม</span>
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
          </>
        ) : (
          <>
            <Button type="button" variant="outline" size="xs" disabled={busy} onClick={() => setOpen(true)}>
              แก้ผลโทร
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={busy}
              onClick={() => setConfirmClear(true)}
              className={TONE.danger.value}
            >
              ล้างผล
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default FollowStaffCallControls;
