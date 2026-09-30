/**
 * ═══ "ไม่ปล่อย + เหตุผล" ในป๊อปไล่งานของกล่องงาน (29 ก.ย. 2569 · migration 129) ═══
 *
 * เจ้าของเลือก (หน้าทีม Online รอบ 5): *"เพิ่มปุ่ม ไม่ปล่อย + เหตุผล ที่กล่องงาน"* — ทีม Online กดเลือกเหตุผล
 * แล้วใบไปอยู่ก้อน "ไม่อนุมัติ" ของหน้าทีม Online · จี้แล้วเห็นเหตุผล
 *
 * - ยังไม่ตั้ง + ยังไม่ปล่อย → ปุ่มเล็ก "ไม่ปล่อยใบนี้" กดแล้ว **กางฟอร์มในที่เดิม** (ห้ามซ้อน Dialog ในป๊อป)
 * - ตั้งแล้ว → กล่องบอกเหตุผล + ปุ่ม "ยกเลิก ไม่ปล่อย" (กลับไปเป็นใบรอดำเนินการ)
 * - ปล่อยขึ้นหน้าสาธารณะอยู่ → ไม่มีอะไร (เซิร์ฟเวอร์ก็ไม่รับ — ต้องดึงลงก่อน)
 * เหตุผล/ตัวตรวจมาจาก `@/lib/jobReleaseSkips` ที่เดียว (ตัวเดียวกับฝั่ง server)
 */
import React from 'react';
import { Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { clearReleaseSkip, markReleaseSkip } from '@/lib/jobReleaseSkipApi';
import {
  RELEASE_SKIP_NOTE_MAX,
  RELEASE_SKIP_REASONS,
  releaseSkipText,
  validateReleaseSkip,
  type JobReleaseSkip,
  type ReleaseSkipReason,
} from '@/lib/jobReleaseSkips';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { DASH, TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

const BKK_YMD = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' });

const ReleaseSkipControl: React.FC<{
  jobId: string;
  /** `undefined` = ยังอ่านทะเบียนไม่ได้ (ห้ามโชว์ปุ่มที่อาจขัดกับของจริง) · `null` = ยังไม่ได้ตั้ง */
  skip: JobReleaseSkip | null | undefined;
  released: boolean | null;
  onChanged: () => void;
}> = ({ jobId, skip, released, onChanged }) => {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState<ReleaseSkipReason | ''>('');
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (skip === undefined || released === null || released) return null;

  const save = async () => {
    const v = validateReleaseSkip({ reason, note });
    if (v.ok === false) {
      setError(v.message);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await markReleaseSkip(jobId, v.reason, v.note);
      setOpen(false);
      setReason('');
      setNote('');
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    setError(null);
    try {
      await clearReleaseSkip(jobId);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ยกเลิกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  if (skip) {
    return (
      <div className={cn('flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5', TONE.danger.soft)}>
        <div className="min-w-0">
          <p className={cn('text-sm font-medium', TONE.danger.value)}>ไม่ปล่อยใบนี้ · {releaseSkipText(skip)}</p>
          <p className={cn('text-xs', DASH.muted)}>ตั้งเมื่อ {formatYmdDmyBe(BKK_YMD.format(new Date(skip.skipped_at)))}</p>
          {error ? <p className={cn('text-xs', TONE.danger.value)}>{error}</p> : null}
        </div>
        <Button type="button" size="xs" variant="outline" disabled={busy} onClick={() => void clear()}>
          {busy ? 'กำลังบันทึก…' : 'ยกเลิก ไม่ปล่อย'}
        </Button>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button type="button" size="xs" variant="outline" onClick={() => setOpen(true)}>
          <Ban aria-hidden />
          ไม่ปล่อยใบนี้
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border/60 bg-card/60 p-4" aria-label="ไม่ปล่อยใบนี้">
      <p className="text-sm font-medium text-foreground">ไม่ปล่อยใบนี้ เพราะอะไร</p>
      <RadioGroup value={reason} onValueChange={(v) => setReason(v as ReleaseSkipReason)} className="gap-2">
        {RELEASE_SKIP_REASONS.map((r) => (
          <div key={r.key} className="flex items-center gap-2">
            <RadioGroupItem id={`skip-${r.key}`} value={r.key} />
            <Label htmlFor={`skip-${r.key}`} className="text-sm font-normal">
              {r.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
      <Textarea
        value={note}
        maxLength={RELEASE_SKIP_NOTE_MAX}
        onChange={(e) => setNote(e.target.value)}
        placeholder={reason === 'other' ? 'พิมพ์เหตุผล (ต้องกรอก)' : 'หมายเหตุเพิ่ม (ถ้ามี)'}
        aria-label="เหตุผลเพิ่มเติม"
        rows={2}
        className="text-sm"
      />
      {error ? <p className={cn('text-xs', TONE.danger.value)}>{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          ยกเลิก
        </Button>
        <Button type="button" size="xs" disabled={busy || !reason} onClick={() => void save()}>
          {busy ? 'กำลังบันทึก…' : 'บันทึก ไม่ปล่อย'}
        </Button>
      </div>
    </section>
  );
};

export default ReleaseSkipControl;
