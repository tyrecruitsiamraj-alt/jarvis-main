import React, { useEffect, useMemo, useState } from 'react';
import type { JobRequest } from '@/types';
import { jobBoardCardTitle } from '@/lib/unitRequestDisplay';
import { applyLinkPath, type RecruitChannel } from '@/lib/recruitPostings';
import {
  fetchRecruitChannels,
  createRecruitPosting,
  type CreatePostingBody,
} from '@/lib/recruitPostingsApi';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, Copy, Link2, Loader2 } from 'lucide-react';

export type GenApplyLinkDialogProps = {
  open: boolean;
  job: JobRequest | null;
  onClose: () => void;
  /** สร้างประกาศลอย (ไม่ผูกใบขอ) — ส่งประเภทกล่อง + BU มาแทน job */
  standalone?: { kind: string; kindLabel: string; departmentCode: string } | null;
  onCreated?: () => void;
};

function LinkRow({ url, label }: { url: string; label?: string | null }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — ผู้ใช้เลือกคัดลอกเองได้ */
    }
  };
  return (
    <div className="space-y-1">
      {label ? <p className="text-[11px] font-medium text-muted-foreground">{label}</p> : null}
      <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-secondary/40 px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{url}</span>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
        </button>
      </div>
    </div>
  );
}

const fieldCls =
  'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30';

/**
 * สร้างประกาศรับสมัคร + ลิงก์ต่อช่องทาง — ทำจบในที่เดียวจากกล่องงาน
 *
 * เดิมกล่องนี้แค่คัดลอก /apply?job=<id> เปล่า ๆ ตอนนี้กรอกรายละเอียดที่ผู้สมัครจะเห็น
 * แล้วติ๊กช่องทางได้หลายช่อง → ได้ลิงก์แยกช่องทางทีเดียว รู้ว่าคนสมัครมาจากช่องไหน
 */
const GenApplyLinkDialog: React.FC<GenApplyLinkDialogProps> = ({
  open,
  job,
  onClose,
  standalone = null,
  onCreated,
}) => {
  const [channels, setChannels] = useState<RecruitChannel[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [locationText, setLocationText] = useState('');
  const [salaryText, setSalaryText] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<Array<{ code: string; label: string | null }>>([]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLinks([]);
    setSaving(false);
    setPicked(new Set());
    // เติมค่าจากใบขอให้อัตโนมัติ — ไม่ต้องพิมพ์ซ้ำสิ่งที่ ERP มีอยู่แล้ว
    setTitle(job ? jobBoardCardTitle(job) : standalone ? standalone.kindLabel : '');
    setDetail('');
    setLocationText(job?.location_address ?? '');
    setSalaryText('');
    setContactName(job?.contact_name ?? '');
    setContactPhone(job?.contact_phone ?? '');
    void fetchRecruitChannels()
      .then(setChannels)
      .catch(() => setChannels([]));
  }, [open, job, standalone]);

  const flatChannels = useMemo(() => {
    const out: Array<{ id: string; label: string }> = [];
    for (const parent of channels) {
      const kids = parent.children ?? [];
      if (kids.length === 0) out.push({ id: parent.id, label: parent.name });
      for (const kid of kids) out.push({ id: kid.id, label: `${parent.name} · ${kid.name}` });
    }
    return out;
  }, [channels]);

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const body: CreatePostingBody = {
        jobId: job?.id ?? null,
        standaloneKind: job ? null : standalone?.kind ?? null,
        departmentCode: job ? job.department_code ?? null : standalone?.departmentCode ?? null,
        title,
        detail: detail || null,
        locationText: locationText || null,
        salaryText: salaryText || null,
        contactName: contactName || null,
        contactPhone: contactPhone || null,
        channels: flatChannels
          .filter((c) => picked.has(c.id))
          .map((c) => ({ channelId: c.id, label: c.label })),
      };
      const created = await createRecruitPosting(body);
      setLinks(created.links.map((l) => ({ code: l.code, label: l.channelLabel })));
      onCreated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'สร้างประกาศไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const heading = job ? jobBoardCardTitle(job) : standalone?.kindLabel ?? 'ประกาศรับสมัคร';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-[34rem] flex-col gap-0 overflow-hidden rounded-[1.5rem] border-border/70 p-0">
        <DialogHeader className="shrink-0 space-y-0 border-b border-border/50 bg-gradient-to-b from-primary/[0.07] to-transparent px-5 py-4 text-left">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <Link2 className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold leading-tight sm:text-lg">
                สร้างลิงก์รับสมัคร
              </DialogTitle>
              <DialogDescription className="mt-0.5 line-clamp-2 text-xs leading-snug">
                {heading} — กรอกรายละเอียดที่ผู้สมัครจะเห็น แล้วเลือกช่องทางที่จะส่ง
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
          {links.length > 0 ? (
            <div className="space-y-3">
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                สร้างประกาศแล้ว — ส่งลิงก์ตามช่องทางได้เลย ผู้สมัครที่กรอกเข้ามาจะอยู่ในกล่องนี้
              </p>
              {links.map((l) => (
                <LinkRow
                  key={l.code}
                  url={`${origin}${applyLinkPath(l.code)}`}
                  label={l.label ?? 'ไม่ระบุช่องทาง'}
                />
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">หัวข้อประกาศ *</label>
                <input className={fieldCls} value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  รายละเอียดที่ผู้สมัครเห็น
                </label>
                <textarea
                  className={`${fieldCls} min-h-[76px]`}
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  placeholder="เช่น ลักษณะงาน เวลาทำงาน สวัสดิการ"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">สถานที่ทำงาน</label>
                  <input
                    className={fieldCls}
                    value={locationText}
                    onChange={(e) => setLocationText(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">ค่าตอบแทน</label>
                  <input
                    className={fieldCls}
                    value={salaryText}
                    onChange={(e) => setSalaryText(e.target.value)}
                    placeholder="เช่น 15,000–18,000 บาท"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">ผู้ติดต่อ</label>
                  <input
                    className={fieldCls}
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">เบอร์ติดต่อ</label>
                  <input
                    className={fieldCls}
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  ช่องทางที่จะส่ง (เลือกได้หลายช่อง — ได้ลิงก์แยกช่องละอัน)
                </label>
                {flatChannels.length === 0 ? (
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    ยังไม่มีช่องทาง — เพิ่มได้ที่ปุ่ม "จัดการช่องทาง" หน้าบอร์ด · ถ้าไม่เลือกจะได้ลิงก์กลาง 1 อัน
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {flatChannels.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggle(c.id)}
                        className={
                          picked.has(c.id)
                            ? 'rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary'
                            : 'rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:bg-secondary'
                        }
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {error ? <p className="text-xs text-red-600">{error}</p> : null}

              <button
                type="button"
                onClick={() => void submit()}
                disabled={saving || !title.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                {saving ? 'กำลังสร้าง…' : 'สร้างประกาศ + ลิงก์'}
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GenApplyLinkDialog;
