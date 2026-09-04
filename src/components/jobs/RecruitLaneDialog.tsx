import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
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
import {
  SEARCH_ALL_POOLS,
  SEARCH_ALL_POOLS_AND_CALL,
} from '@/lib/candidateSearchLabels';
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
  /**
   * 🔴 **ยังไม่ยิงสายจนกดยืนยัน** (Phase 3 ข้อ 3.4 · 23 ส.ค. 2569)
   *
   * ของเดิมยิง `send: true` ทันทีที่ป๊อปเปิด → แค่กดปุ่มบนการ์ดคือโทรหาคนจริงไปแล้ว
   * โดยไม่มีจังหวะให้ทาน และปุ่มนั้นเคยใช้คำเดียวกับปุ่มที่ "ไม่โทร" ในหน้าอื่น
   * ทุกเส้นที่ยิงสายในระบบนี้มี popup ยืนยันหมดแล้ว เหลือเส้นนี้เส้นเดียว
   */
  const [confirmed, setConfirmed] = useState(false);

  // ปิด/เปลี่ยนใบขอ = เริ่มนับหนึ่งใหม่ (กันกดยืนยันของใบก่อนหน้าค้างมา)
  useEffect(() => {
    if (!open) {
      setConfirmed(false);
      setResult(null);
      setError(null);
    }
  }, [open, job?.id]);

  useEffect(() => {
    if (!open || !job || !confirmed) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResult(null);
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
  }, [open, job, confirmed]);

  const matches = result?.matches ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4" /> {SEARCH_ALL_POOLS_AND_CALL.label}
          </DialogTitle>
          <DialogDescription>
            {job ? jobBoardCardTitle(job) : EM_DASH} — {SEARCH_ALL_POOLS_AND_CALL.hint}
          </DialogDescription>
        </DialogHeader>

        {/* ขั้นยืนยัน — ยังไม่มีสายไหนออกจนกดปุ่มขวา (ห้ามยิงตอนป๊อปเปิด) */}
        {!confirmed ? (
          <div className="space-y-3 rounded-xl border border-border/70 bg-secondary/40 px-4 py-4">
            <p className="text-sm text-foreground">
              ระบบจะค้น <b>ทุกกอง</b> ที่มี (คนฝากประวัติเดิม · ผู้สมัครใหม่ · ถังคัดกรอง)
              แล้วส่งคนที่ AI แนะนำ (เขียว/เหลือง) <b>เข้าคิวให้ AI โทรทันที</b>
            </p>
            <p className="text-xs text-muted-foreground">
              คนที่เคยปฏิเสธงานนี้ · เบอร์ที่มีคนถืออยู่ · และคนที่เพิ่งถูกโทรไปภายใน 30 วัน
              ถูกตัดออกให้เองที่หลังบ้าน · <b>โทรออกไปแล้วเรียกคืนไม่ได้</b>
              <br />
              ถ้าอยากดูรายชื่อก่อนโดยไม่โทร ให้ใช้ปุ่ม “{SEARCH_ALL_POOLS.label}” ในหน้าใบขอ
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" size="sm" type="button" onClick={onClose} className="px-4 py-2">
                ยกเลิก
              </Button>
              <Button size="sm"
                type="button"
                onClick={() => setConfirmed(true)}
                className="px-4 py-2"
              >
                <Search className="h-3 w-3" /> {SEARCH_ALL_POOLS_AND_CALL.label}
              </Button>
            </div>
          </div>
        ) : null}

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
