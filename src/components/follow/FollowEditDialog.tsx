import React, { useEffect, useState } from 'react';
import { Building2, LoaderCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { updateFollowEntry, type FollowEntry } from '@/lib/followApi';
import { jobBoardCardTitle } from '@/lib/unitRequestDisplay';
import type { JobRequest } from '@/types';

/**
 * แก้ไขรายการติดตาม (096 · เจ้าของสั่ง 17 ส.ค. 2569: *"เพิ่มให้แก้ไขได้"*)
 *
 * ⚠️ **เจ้าของข้อมูลแก้ไม่ได้** — คนที่กรอกครั้งแรกคือเจ้าของตลอดไป (server ก็กันอีกชั้น)
 * คนแก้ทีหลังถูกบันทึกแยกที่ `updated_by_name` ประวัติจึงไม่หาย
 *
 * ⚠️ **ตารางโทร (ชุดหลายวัน) แก้ที่นี่ไม่ได้** — แก้ทีละแถวคือชุดเพี้ยน
 * จะเปลี่ยนตารางต้องยกเลิกทั้งชุดแล้วตั้งใหม่
 *
 * 🔴 หลังบันทึก server จะรีเฟรชบทพูดในคิว Lumos ให้ด้วย **เฉพาะสายที่ยังไม่ถูกดึงไป**
 * ถ้า `queue_refreshed = 0` แปลว่าสายที่ออกไปแล้วใช้ข้อมูลเดิม — ต้องบอกคนใช้ ไม่ใช่เงียบ
 */
export default function FollowEditDialog({
  entry,
  openJobs,
  onClose,
  onSaved,
}: {
  entry: FollowEntry | null;
  /** ใบขอที่ยังเปิด — ตัวเลือกหน่วยงาน (โหลดไว้แล้วจากหน้าแม่) */
  openJobs: JobRequest[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [topic, setTopic] = useState('');
  const [note, setNote] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [when, setWhen] = useState('');
  const [unitName, setUnitName] = useState('');
  const [siteCode, setSiteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!entry) return;
    setName(entry.recipient_name ?? '');
    setPhone(entry.recipient_phone ?? '');
    setTopic(entry.topic ?? '');
    setNote(entry.note ?? '');
    setStaffPhone(entry.staff_phone ?? '');
    setUnitName(entry.unit_name ?? '');
    setSiteCode(entry.site_code ?? '');
    // input datetime-local กินรูป YYYY-MM-DDTHH:mm ตามเวลาเครื่อง — ต้องแปลงจาก ISO ก่อน
    if (entry.scheduled_at) {
      const d = new Date(entry.scheduled_at);
      if (!Number.isNaN(d.getTime())) {
        const pad = (n: number) => String(n).padStart(2, '0');
        setWhen(
          `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
        );
      }
    }
    setError(null);
  }, [entry]);

  if (!entry) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const saved = await updateFollowEntry(entry.id, {
        recipient_name: name,
        recipient_phone: phone,
        topic,
        note: note || undefined,
        staff_phone: staffPhone || undefined,
        scheduled_at: when ? new Date(when).toISOString() : undefined,
        unit_name: unitName.trim() || undefined,
        site_code: siteCode.trim() || undefined,
      });
      // บอกตรง ๆ ว่าสายที่ออกไปแล้วใช้ข้อมูลเดิม — เงียบไว้คือเข้าใจผิดว่าแก้ทันทุกสาย
      onSaved(
        (saved.queue_refreshed ?? 0) > 0
          ? `แก้ไขแล้ว — อัปเดตบทพูดในคิว ${saved.queue_refreshed} สายด้วย`
          : 'แก้ไขแล้ว — แต่สายที่ AI รับไปแล้วยังใช้ข้อมูลเดิม (เรียกคืนไม่ได้)',
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'แก้ไขไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="แก้ไขรายการติดตาม"
    >
      <form
        onSubmit={save}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-background p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">แก้ไขรายการติดตาม</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              เจ้าของข้อมูล{' '}
              <span className="font-medium text-foreground">
                {entry.created_by_name || 'ไม่ทราบ'}
              </span>{' '}
              — แก้ไม่ได้ ใครกรอกคนนั้นเป็นเจ้าของ
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="feName" className="ml-1 text-xs font-medium text-muted-foreground">
              ชื่อผู้ที่ต้องติดตาม
            </label>
            <input
              id="feName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="jarvis-soft-field min-h-[46px] w-full"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="fePhone" className="ml-1 text-xs font-medium text-muted-foreground">
              เบอร์โทร
            </label>
            <input
              id="fePhone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              inputMode="tel"
              className="jarvis-soft-field min-h-[46px] w-full"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="feTopic" className="ml-1 text-xs font-medium text-muted-foreground">
              เรื่องที่จะให้โทรติดตาม
            </label>
            <input
              id="feTopic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
              className="jarvis-soft-field min-h-[46px] w-full"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="feUnit" className="ml-1 text-xs font-medium text-muted-foreground">
              หน่วยงาน
            </label>
            <select
              id="feUnit"
              value={siteCode || (unitName ? '__manual__' : '')}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) {
                  setUnitName('');
                  setSiteCode('');
                  return;
                }
                if (v === '__manual__') return;
                const job = openJobs.find((j) => (j.site_code || '') === v);
                if (job) {
                  setUnitName(job.unit_name || '');
                  setSiteCode(job.site_code || '');
                }
              }}
              className="jarvis-soft-field min-h-[46px] w-full"
            >
              <option value="">— ไม่ระบุหน่วยงาน —</option>
              {unitName && !openJobs.some((j) => (j.site_code || '') === siteCode) ? (
                <option value="__manual__">
                  {unitName}
                  {siteCode ? ` (${siteCode})` : ''}
                </option>
              ) : null}
              {openJobs
                .filter((j) => (j.site_code || '').trim())
                .map((j) => (
                  <option key={j.id} value={j.site_code || ''}>
                    {jobBoardCardTitle(j)}{j.request_no ? ` · ${j.request_no}` : ''}
                  </option>
                ))}
            </select>
            {siteCode ? (
              <p className="ml-1 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Building2 className="h-3 w-3" aria-hidden />
                รหัสไซต์ <span className="font-mono font-semibold text-foreground">{siteCode}</span>
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="feStaffPhone" className="ml-1 text-xs font-medium text-muted-foreground">
              เบอร์โทรเจ้าหน้าที่ที่ติดตาม
            </label>
            <input
              id="feStaffPhone"
              value={staffPhone}
              onChange={(e) => setStaffPhone(e.target.value)}
              inputMode="tel"
              className="jarvis-soft-field min-h-[46px] w-full"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="feWhen" className="ml-1 text-xs font-medium text-muted-foreground">
              ให้โทรเมื่อไหร่
            </label>
            <input
              id="feWhen"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="jarvis-soft-field min-h-[46px] w-full"
            />
            {entry.call_status !== 'pending' ? (
              <p className={cn('ml-1 rounded-lg px-2 py-1 text-[11px]', TONE.warn.soft, TONE.warn.value)}>
                สายนี้ AI รับไปแล้ว — แก้ที่นี่ไม่ทำให้สายที่ออกไปเปลี่ยนตาม
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="feNote" className="ml-1 text-xs font-medium text-muted-foreground">
              ข้อความที่อยากให้ AI พูดเพิ่ม
            </label>
            <textarea
              id="feNote"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="jarvis-soft-field w-full"
            />
          </div>
        </div>

        {error ? (
          <p className={cn('mt-3 rounded-lg px-3 py-2 text-xs', TONE.danger.soft, TONE.danger.value)}>
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'inline-flex min-h-[40px] items-center rounded-full border px-4 text-xs font-medium',
              TONE.neutral.outline,
            )}
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            บันทึกการแก้ไข
          </button>
        </div>
      </form>
    </div>
  );
}
