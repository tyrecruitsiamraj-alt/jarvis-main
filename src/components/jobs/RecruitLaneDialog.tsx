import React, { useEffect, useState } from 'react';
import type { JobRequest } from '@/types';
import { jobBoardCardTitle } from '@/lib/unitRequestDisplay';
import {
  fetchRecruitLaneCandidates,
  recruitLanePoolSummary,
  recruitLaneSendSummary,
  tierChipClass,
  type RecruitLaneResult,
} from '@/lib/recruitLaneApi';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EM_DASH } from '@/lib/displayFallback';
import { Loader2, Search } from 'lucide-react';

/**
 * ผลค้น "หาคนเพิ่ม + ส่ง AI โทร" ของ **เลนสรรหา** (R2b · เจ้าของเคาะ 16 ส.ค. 2569)
 *
 * เปิดปุ๊บค้นเลย แล้วส่งเขียว+เหลืองเข้าคิว Lumos ทันที (ไม่ต้องอนุมัติ — นิยามของเลนนี้)
 * ⚠️ **ทุกคนต้องมีป้ายบอกแหล่ง** (จาก Checklist / จากฐานใหม่ / จาก iRecruit)
 * เจ้าของขอเพราะสรรหาต้องรู้ว่าคนคนนี้ต้องตามเอกสารแบบไหน
 */
export type RecruitLaneDialogProps = {
  open: boolean;
  job: JobRequest | null;
  onClose: () => void;
};

const RecruitLaneDialog: React.FC<RecruitLaneDialogProps> = ({ open, job, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecruitLaneResult | null>(null);

  useEffect(() => {
    if (!open || !job) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResult(null);
    // send=1 ตั้งแต่ครั้งแรก — ปุ่มนี้คือ "ค้นแล้วส่งเลย" ไม่ใช่ "ค้นดูก่อน"
    fetchRecruitLaneCandidates(job.id, { send: true })
      .then((r) => {
        if (!cancelled) setResult(r);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'ค้นหาไม่สำเร็จ');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, job]);

  const matches = result?.matches ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4" /> หาคนเพิ่ม + ส่ง AI โทร (เลนสรรหา)
          </DialogTitle>
          <DialogDescription>
            {job ? jobBoardCardTitle(job) : EM_DASH} — ค้นคนที่ยังไม่สมัครจาก 3 แหล่ง
            (Checklist · ฐานใหม่ · iRecruit) แล้วส่งคนที่ AI แนะนำเข้าคิว Lumos ทันที
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="flex items-center gap-2 rounded-xl border border-border/70 bg-secondary/40 px-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> กำลังค้นและให้ AI จัดอันดับ (ประมาณ 1–3 นาที)…
          </p>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
            {error}
          </p>
        ) : null}

        {result ? (
          <div className="space-y-3">
            {result.dispatch ? (
              <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
                🤖 {recruitLaneSendSummary(result.dispatch)}
              </p>
            ) : null}
            <p className="text-[11px] text-muted-foreground">{recruitLanePoolSummary(result)}</p>

            {matches.length === 0 ? (
              <p className="rounded-xl border border-border/70 bg-secondary/40 px-3 py-4 text-sm text-muted-foreground">
                ไม่มีใครเข้าข่ายในกองนี้ — ลองกดใหม่หลังมีคนใหม่เข้ามา หรือใช้ช่องทางประกาศเพิ่ม
              </p>
            ) : (
              <ul className="space-y-1.5">
                {matches.map((m) => (
                  <li
                    key={m.ref}
                    className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs"
                  >
                    <span className={tierChipClass(m.tier)}>
                      {m.tier === 'green' ? 'เข้าข่ายมาก' : m.tier === 'red' ? 'ห่างไกล' : 'พอได้'}
                    </span>
                    <span className="jarvis-chip jarvis-chip-violet">{m.source_label}</span>
                    <span className="font-semibold text-foreground">{m.full_name}</span>
                    <span className="text-muted-foreground">{m.position_text || EM_DASH}</span>
                    {m.location_label ? (
                      <span className="text-muted-foreground">· {m.location_label}</span>
                    ) : null}
                    {m.reason ? (
                      <span className="w-full text-[11px] text-muted-foreground">{m.reason}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {result.dispatch && result.dispatch.skipped.length > 0 ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                <p className="font-semibold">ส่งไม่ได้ {result.dispatch.skipped.length} คน</p>
                <ul className="mt-1 space-y-0.5">
                  {result.dispatch.skipped.slice(0, 10).map((s) => (
                    <li key={s.ref}>
                      {s.name} — {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default RecruitLaneDialog;
