import React, { useEffect, useState } from 'react';
import type { JobRequest } from '@/types';
import { jobBoardCardTitle } from '@/lib/unitRequestDisplay';
import { formatYmdDmyBe } from '@/lib/dateTh';
import {
  APPLICATION_STATUS_CLASS,
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUSES,
  fetchJobApplications,
  GENDER_LABEL,
  updateJobApplication,
  type ApplicationStatus,
  type PublicApplication,
} from '@/lib/publicApplicationsApi';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, MapPin, Phone, Users } from 'lucide-react';

export type JobApplicantsDialogProps = {
  open: boolean;
  job: JobRequest | null;
  onClose: () => void;
};

function addressLine(a: PublicApplication): string {
  return [a.subdistrict, a.district, a.province, a.postal_code].filter(Boolean).join(' ');
}

const JobApplicantsDialog: React.FC<JobApplicantsDialogProps> = ({ open, job, onClose }) => {
  const [items, setItems] = useState<PublicApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const changeStatus = async (id: string, status: ApplicationStatus) => {
    setSavingId(id);
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    try {
      const updated = await updateJobApplication(id, { status });
      setItems((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'อัปเดตสถานะไม่สำเร็จ');
    } finally {
      setSavingId(null);
    }
  };

  useEffect(() => {
    if (!open || !job) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchJobApplications(job.id)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, job]);

  const dateLabel = (iso: string): string => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : formatYmdDmyBe(d.toISOString().slice(0, 10));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-[38rem] flex-col gap-0 overflow-hidden rounded-[1.5rem] border-border/70 p-0">
        <DialogHeader className="shrink-0 space-y-0 border-b border-border/50 bg-gradient-to-b from-primary/[0.07] to-transparent px-5 py-4 text-left sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <Users className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold leading-tight sm:text-lg">
                ผู้สมัครที่กรอกฟอร์ม
              </DialogTitle>
              <DialogDescription className="mt-0.5 line-clamp-2 text-xs leading-snug sm:text-[13px]">
                {job ? jobBoardCardTitle(job) : ''}
                {!loading && !error ? ` · ${items.length} คน` : ''}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              กำลังโหลดรายชื่อ...
            </div>
          ) : error ? (
            <p className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-600">{error}</p>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <Users className="h-7 w-7 text-muted-foreground/50" />
              </span>
              <p className="text-sm font-medium text-foreground">ยังไม่มีผู้สมัครสำหรับงานนี้</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                เมื่อมีผู้กรอกใบสมัครผ่านหน้าประกาศงาน รายชื่อจะแสดงที่นี่
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {items.map((a) => (
                <li
                  key={a.id}
                  className="rounded-2xl border border-border/70 bg-background/60 p-3.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{a.full_name}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        {a.age ? <span>อายุ {a.age} ปี</span> : null}
                        {a.gender ? <span>· {GENDER_LABEL[a.gender] ?? a.gender}</span> : null}
                        {a.position_interest ? <span>· สนใจ {a.position_interest}</span> : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          APPLICATION_STATUS_CLASS[a.status],
                        )}
                      >
                        {APPLICATION_STATUS_LABEL[a.status]}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{dateLabel(a.created_at)}</span>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-col gap-1 text-xs">
                    <a
                      href={`tel:${a.phone}`}
                      className="inline-flex w-fit items-center gap-1.5 font-medium text-primary hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {a.phone}
                    </a>
                    {addressLine(a) ? (
                      <span className="flex items-start gap-1.5 text-muted-foreground">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {addressLine(a)}
                      </span>
                    ) : null}
                    {a.note ? (
                      <p className="mt-1 rounded-lg bg-muted/50 px-2.5 py-1.5 text-muted-foreground">{a.note}</p>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-2.5">
                    <span className="mr-1 text-[11px] text-muted-foreground">สถานะ:</span>
                    {APPLICATION_STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={savingId === a.id}
                        onClick={() => void changeStatus(a.id, s)}
                        className={cn(
                          'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50',
                          a.status === s
                            ? APPLICATION_STATUS_CLASS[s]
                            : 'bg-muted/60 text-muted-foreground hover:bg-muted',
                        )}
                      >
                        {APPLICATION_STATUS_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JobApplicantsDialog;
