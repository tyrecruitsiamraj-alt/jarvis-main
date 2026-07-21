import React, { useEffect, useState } from 'react';
import type { JobRequest } from '@/types';
import { jobBoardCardTitle } from '@/lib/unitRequestDisplay';
import { apiFetch } from '@/lib/apiFetch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle2, Loader2, Send } from 'lucide-react';

export type PublicApplyDialogProps = {
  open: boolean;
  /** งานที่กดสมัคร — null เมื่อสมัครแบบไม่ระบุงาน (ปุ่มท้ายหน้า) */
  job: JobRequest | null;
  onClose: () => void;
};

const PublicApplyDialog: React.FC<PublicApplyDialogProps> = ({ open, job, onClose }) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [positionInterest, setPositionInterest] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setError(null);
    setPositionInterest(job ? jobBoardCardTitle(job) : '');
  }, [open, job]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (fullName.trim().length < 2) {
      setError('กรุณากรอกชื่อ-นามสกุล');
      return;
    }
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 9 || phoneDigits.length > 11) {
      setError('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (เช่น 0812345678)');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/public/apply', {
        method: 'POST',
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim(),
          job_id: job?.id ?? null,
          job_title: job ? jobBoardCardTitle(job) : null,
          unit_name: job?.unit_name ?? null,
          position_interest: positionInterest.trim() || null,
          note: note.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message || 'ส่งใบสมัครไม่สำเร็จ กรุณาลองใหม่');
      }
      setSubmitted(true);
      setFullName('');
      setPhone('');
      setNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ส่งใบสมัครไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[min(calc(100vw-1.25rem),28rem)] max-w-none">
        <DialogHeader className="text-left">
          <DialogTitle className="text-base font-semibold sm:text-lg">
            {submitted ? 'ส่งใบสมัครแล้ว' : 'กรอกใบสมัครงาน'}
          </DialogTitle>
          <DialogDescription>
            {submitted
              ? 'ทีมสรรหาจะติดต่อกลับตามเบอร์ที่ให้ไว้'
              : job
                ? `สมัคร: ${jobBoardCardTitle(job)}`
                : 'กรอกข้อมูลติดต่อ แล้วทีมสรรหาจะติดต่อกลับ'}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <p className="text-sm text-muted-foreground">
              ขอบคุณที่สนใจร่วมงานกับเรา เราได้รับข้อมูลของคุณเรียบร้อยแล้ว
            </p>
            <button
              type="button"
              onClick={onClose}
              className="jarvis-pill-btn w-full justify-center py-2.5 text-sm font-semibold"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
              ชื่อ-นามสกุล <span className="text-red-500">*</span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="เช่น สมชาย ใจดี"
                autoComplete="name"
                required
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
              เบอร์โทรศัพท์ <span className="text-red-500">*</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="เช่น 0812345678"
                autoComplete="tel"
                inputMode="tel"
                required
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
              ตำแหน่งที่สนใจ
              <input
                type="text"
                value={positionInterest}
                onChange={(e) => setPositionInterest(e.target.value)}
                placeholder="เช่น พนักงานขับรถ"
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
              ข้อมูลเพิ่มเติม (ถ้ามี)
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="เช่น พื้นที่สะดวกทำงาน ประสบการณ์ หรือเวลาที่สะดวกให้ติดต่อ"
                rows={3}
                className={inputCls}
              />
            </label>

            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="jarvis-pill-btn mt-1 inline-flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              ส่งใบสมัคร
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PublicApplyDialog;
