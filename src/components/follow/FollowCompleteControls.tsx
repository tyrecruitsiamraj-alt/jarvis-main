import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import {
  FOLLOW_OUTCOMES,
  FOLLOW_OUTCOME_HINT,
  FOLLOW_OUTCOME_LABEL,
  requiresNote,
  type FollowOutcome,
} from '@/lib/followOutcome';

/**
 * ปิดงานติดตาม (migration 095 · เจ้าของสั่ง 17 ส.ค. 2569 ข้อ 7 ของงานคัดสรร:
 * *"เมื่อวันนั้น ๆ ไม่มีอะไรแล้วก็กดเสร็จสิ้น แต่ถ้าไม่ไปหรืออะไรให้กดว่า ยกเลิกงาน
 * ไม่ไปเริ่มงาน ลา อะไรต่าง ๆ ได้"*)
 *
 * ⚠️ **แยกจากปุ่ม "ยกเลิก" ที่มีอยู่เดิมโดยตั้งใจ** — ยกเลิก = ตัดสายทิ้งก่อนถึงวัน
 * (ไม่ต้องตามแล้ว) · ปิดงาน = ตามจนจบแล้ว บันทึกว่าจบแบบไหน · ยุบรวมเมื่อไหร่
 * สถิติต้นเหตุจะแยกไม่ออกว่า "ไม่ได้ตาม" กับ "ตามแล้วเขาไม่ไป" ต่างกันยังไง
 *
 * กดปุ่มเดียวจบสำหรับเคสปกติ (เสร็จสิ้น) · เคสอื่นค่อยกางตัวเลือก — คนส่วนใหญ่
 * กดเสร็จสิ้น ไม่ควรต้องเลือกจากลิสต์ทุกครั้ง
 */
const FollowCompleteControls: React.FC<{
  busy?: boolean;
  onComplete: (outcome: FollowOutcome, note?: string) => void | Promise<void>;
}> = ({ busy = false, onComplete }) => {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<FollowOutcome | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (outcome: FollowOutcome) => {
    if (requiresNote(outcome) && !note.trim()) {
      setPicked(outcome);
      setError('เลือก "อื่น ๆ" ต้องใส่หมายเหตุด้วย');
      return;
    }
    setError(null);
    await onComplete(outcome, note.trim() || undefined);
    setOpen(false);
    setPicked(null);
    setNote('');
  };

  if (!open) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit('done')}
          className={cn(
            'inline-flex min-h-[36px] items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold disabled:opacity-50',
            TONE.success.outline,
          )}
        >
          <CheckCircle2 className="h-3 w-3" aria-hidden />
          {busy ? 'กำลังบันทึก…' : 'เสร็จสิ้น'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpen(true)}
          title="จบด้วยเหตุอื่น — ยกเลิกงาน / ไม่ไปเริ่มงาน / ลา"
          className={cn(
            'inline-flex min-h-[36px] items-center rounded-full border px-3 py-1 text-[11px] font-medium disabled:opacity-50',
            TONE.neutral.outline,
          )}
        >
          เหตุอื่น…
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-xl border border-border/70 bg-muted/30 p-2.5">
      <p className="text-[11px] font-semibold text-foreground">ปิดงานนี้แบบไหน</p>
      <div className="flex flex-wrap gap-1.5">
        {FOLLOW_OUTCOMES.map((o) => (
          <button
            key={o}
            type="button"
            disabled={busy}
            title={FOLLOW_OUTCOME_HINT[o]}
            onClick={() => (requiresNote(o) ? setPicked(o) : void submit(o))}
            className={cn(
              'inline-flex min-h-[32px] items-center rounded-full border px-3 py-1 text-[11px] font-medium disabled:opacity-50',
              picked === o ? TONE.info.solid : TONE.neutral.outline,
            )}
          >
            {FOLLOW_OUTCOME_LABEL[o]}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={note}
        maxLength={300}
        onChange={(e) => setNote(e.target.value)}
        placeholder="หมายเหตุ (บังคับเมื่อเลือก “อื่น ๆ”)"
        className="min-h-[36px] rounded-lg border border-border bg-background px-2.5 text-[12px]"
      />
      {error ? <p className="text-[11px] font-medium text-red-600 dark:text-red-400">{error}</p> : null}
      <div className="flex gap-1.5">
        {picked ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit(picked)}
            className={cn(
              'inline-flex min-h-[32px] items-center rounded-full px-3 py-1 text-[11px] font-semibold disabled:opacity-50',
              TONE.success.solid,
            )}
          >
            {busy ? 'กำลังบันทึก…' : `ยืนยัน: ${FOLLOW_OUTCOME_LABEL[picked]}`}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setPicked(null);
            setError(null);
          }}
          className={cn(
            'inline-flex min-h-[32px] items-center rounded-full border px-3 py-1 text-[11px] font-medium',
            TONE.neutral.outline,
          )}
        >
          ปิด
        </button>
      </div>
    </div>
  );
};

export default FollowCompleteControls;
