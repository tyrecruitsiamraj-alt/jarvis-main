import React, { useEffect, useState } from 'react';
import { TONE } from '@/lib/designTokens';
import type { JobRequest } from '@/types';
import { jobBoardCardTitle } from '@/lib/unitRequestDisplay';
import { formatYmdDmyBe, toYmdBangkok } from '@/lib/dateTh';
import {
  APPLICATION_ORIGIN_CLASS,
  APPLICATION_ORIGIN_HINT,
  APPLICATION_ORIGIN_LABEL,
  APPLICATION_STATUS_CLASS,
  APPLICATION_STATUS_LABEL,
  fetchApplicationDocument,
  fetchJobApplications,
  GENDER_LABEL,
  REFERRAL_SOURCE_LABEL,
  claimJobApplication,
  type PublicApplication,
} from '@/lib/publicApplicationsApi';
import { cn } from '@/lib/utils';
import { EM_DASH, dashIfEmpty } from '@/lib/displayFallback';
import { applicantAddressLine, applicantFactLine } from '@/lib/applicantDisplay';
import { isKnownOutcome, splitInterested } from '@/lib/applicantCallOutcome';
import { CALL_OUTCOME_LABEL, CALL_OUTCOME_TONE } from '@/lib/callOutcomeTone';
import { apiFetch } from '@/lib/apiFetch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Download, Loader2, MapPin, Phone, Users } from 'lucide-react';

export type JobApplicantsDialogProps = {
  open: boolean;
  job: JobRequest | null;
  onClose: () => void;
};

/** แท็บใน dialog — เจ้าของสั่ง 13 ส.ค. 2569: "กดเข้าไปอยากแยกหน้าแบบนี้" */
type ApplicantTab = 'all' | 'interested';

const JobApplicantsDialog: React.FC<JobApplicantsDialogProps> = ({ open, job, onClose }) => {
  const [items, setItems] = useState<PublicApplication[]>([]);
  const [tab, setTab] = useState<ApplicantTab>('all');
  /**
   * กรองตาม "ที่มา" (เจ้าของสั่ง 16 ส.ค.: *"แยกให้หน่อยว่าอันไหนมาจากการสมัครใหม่
   * อันไหนมาจาก AI หาให้"*) — กรองที่ลิสต์ต้นทางก้อนเดียว ทั้งสองแท็บจึงตรงกันเสมอ
   */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sendBusy, setSendBusy] = useState(false);
  const [sendNotice, setSendNotice] = useState<string | null>(null);

  const reload = (jobId: string) => {
    fetchJobApplications(jobId)
      .then(setItems)
      .catch(() => {});
  };

  /**
   * ปุ่ม "🤖 ส่งให้ AI โทร" (S8 · เจ้าของเคาะ 15 ส.ค. 2569) — เส้น auto ส่งตอนกรอกอยู่แล้ว
   * ปุ่มนี้ไว้เก็บใบตกค้าง (กรอกก่อนเปิดระบบ / เพิ่งแก้เบอร์) · server คัดคนเข้าเกณฑ์เอง
   * ทั้งหมด (client ส่งแค่ jobId) — ตัวเลขบนปุ่มเป็นค่าประมาณฝั่งหน้า ของจริงดูผลตอบกลับ
   */
  const sendableApprox = items.filter(
    (a) => a.phone_callable !== false && !isKnownOutcome(a.last_call_outcome) && !a.is_lead && !a.claimed,
  ).length;

  const sendAi = async () => {
    if (!job || sendBusy) return;
    if (!window.confirm(`ส่งผู้สมัครที่ยังไม่ถูกโทร (~${sendableApprox} คน) ให้ AI โทรถามความสนใจ?`)) return;
    setSendBusy(true);
    setSendNotice(null);
    try {
      const r = await apiFetch('/api/application-dispatch', {
        method: 'POST',
        body: JSON.stringify({ jobId: job.id }),
      });
      const body = (await r.json().catch(() => null)) as {
        eligible?: number;
        queued?: number;
        duplicated?: string[];
        skipped?: Array<{ name: string; reason: string }>;
        message?: string;
      } | null;
      if (!r.ok) throw new Error(body?.message || 'ส่งให้ AI โทรไม่สำเร็จ');
      const parts = [`เข้าคิว AI ${body?.queued ?? 0} คน`];
      if ((body?.duplicated?.length ?? 0) > 0) parts.push(`เคยส่งแล้ว ${body!.duplicated!.length}`);
      if ((body?.skipped?.length ?? 0) > 0) {
        parts.push(`ข้าม ${body!.skipped!.length} (${body!.skipped!.map((s) => `${s.name}: ${s.reason}`).join(' · ')})`);
      }
      const notice =
        (body?.eligible ?? 0) === 0
          ? 'ไม่มีใบที่เข้าเกณฑ์ส่ง (ทุกคนถูกโทร/อยู่ในคิว/มีคนถืออยู่แล้ว)'
          : parts.join(' · ');
      setSendNotice(notice);
      reload(job.id);
    } catch (e) {
      setSendNotice(e instanceof Error ? e.message : 'ส่งให้ AI โทรไม่สำเร็จ');
    } finally {
      setSendBusy(false);
    }
  };

  const downloadDoc = async (id: string) => {
    setDownloadingId(id);
    try {
      const doc = await fetchApplicationDocument(id);
      const a = document.createElement('a');
      a.href = `data:${doc.mime};base64,${doc.dataBase64}`;
      a.download = doc.filename || 'document';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดไฟล์แนบไม่สำเร็จ');
    } finally {
      setDownloadingId(null);
    }
  };

  /** เก็บไปติดต่อ / คืน — ไม่ optimistic เพราะอาจชนกับเพื่อน (409) ให้ server ตัดสินก่อน */
  const toggleClaim = async (a: PublicApplication) => {
    setSavingId(a.id);
    setError(null);
    try {
      const updated = await claimJobApplication(a.id, !a.claimed_by_me);
      setItems((prev) => prev.map((x) => (x.id === a.id ? updated : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เก็บไปติดต่อไม่สำเร็จ');
    } finally {
      setSavingId(null);
    }
  };

  useEffect(() => {
    if (!open || !job) return;
    let cancelled = false;
    setTab('all'); // เปิดใบใหม่เริ่มที่ "ทั้งหมด" เสมอ ไม่ค้างแท็บของใบก่อน
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

  /**
   * ⚠️ อ่านวันที่ไม่ได้ต้องคืนขีด ไม่ใช่สตริงว่าง — ว่างแล้ว span สูง 0
   * คอลัมน์ขวาเหลือแถวเดียวขณะที่การ์ดอื่นมีสองแถว
   * (ไม่แก้ที่ formatYmdDmyBe — ตัวนั้นคืน ASCII '-' มีเทสต์คุมและคนเรียกทั้งระบบ)
   */
  const dateLabel = (iso: string): string => {
    const d = new Date(iso);
    // ตัดวันตามปฏิทินกรุงเทพ — ห้าม toISOString (UTC) เพราะใบกรอกเที่ยงคืน–07:00 น.
    // ไทยจะโชว์ย้อนไป 1 วัน
    return Number.isNaN(d.getTime()) ? EM_DASH : formatYmdDmyBe(toYmdBangkok(d));
  };

  // กติกา "ใครนับว่าสนใจ" อยู่ที่ lib ที่เดียว (ไฟล์หน้าไม่ตัดสินเอง)
  // ⚠️ นับที่มาจาก `items` (ก้อนเต็ม) ไม่ใช่ก้อนที่กรองแล้ว — ไม่งั้นกดกรองแล้วเลขบนชิป
  // เปลี่ยนตามจนกดกลับไม่ได้
  // ไม่มีตัวกรองที่มาแล้ว — "รายชื่อทั้งหมด" คือทั้งหมดจริง ๆ
  const shownItems = items;
  const { interested } = splitInterested(shownItems);
  const visible = tab === 'interested' ? interested : shownItems;

  /** การ์ดผู้สมัคร 1 ใบ — ใช้ทั้งสองแท็บ (19 ส.ค. 2569: เลิกมุมมอง 2 คอลัมน์ของจอใหญ่) */
  const renderCard = (a: PublicApplication, inInterestedColumn: boolean) => (
    <li key={a.id} className="rounded-2xl border border-border/70 bg-background/60 p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-foreground">{a.full_name}</p>
            {/* ที่มาของคนนี้ (เจ้าของสั่ง 16 ส.ค.): สมัครใหม่ / AI หาให้ / เจ้าหน้าที่คีย์
                ⚠️ ไม่รู้ที่มา = ไม่ขึ้นชิป (ห้ามเดาว่า "สมัครใหม่") */}
            {a.origin ? (
              <span
                title={APPLICATION_ORIGIN_HINT[a.origin]}
                className={cn(
                  'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  APPLICATION_ORIGIN_CLASS[a.origin],
                )}
              >
                {APPLICATION_ORIGIN_LABEL[a.origin]}
              </span>
            ) : null}
          </div>
          <p
            title={applicantFactLine(a) || undefined}
            className="mt-0.5 truncate text-xs leading-4 text-muted-foreground"
          >
            {dashIfEmpty(applicantFactLine(a))}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', APPLICATION_STATUS_CLASS[a.status])}
          >
            {APPLICATION_STATUS_LABEL[a.status]}
          </span>
          {isKnownOutcome(a.last_call_outcome) ? (
            <span className={cn('text-[10px]', TONE[CALL_OUTCOME_TONE[a.last_call_outcome]].chip)}>
              โทรแล้ว · {CALL_OUTCOME_LABEL[a.last_call_outcome]}
            </span>
          ) : a.phone_callable === false ? (
            <span className={cn('rounded-full border px-1.5 text-[10px] font-semibold', TONE.danger.soft, TONE.danger.value)}>
              เบอร์ใช้โทรไม่ได้
            </span>
          ) : a.claimed ? (
            <span className="text-[10px] text-muted-foreground">🔒 มีคนเก็บแล้ว</span>
          ) : (
            <span className="text-[10px] text-muted-foreground">รอโทร</span>
          )}
          <span className="text-[11px] text-muted-foreground">{dateLabel(a.created_at)}</span>
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-1 text-xs">
        <a
          href={`tel:${a.phone}`}
          className="inline-flex w-fit items-center gap-1.5 font-medium text-primary hover:underline"
        >
          <Phone className="h-3.5 w-3.5" />
          {dashIfEmpty(a.phone)}
        </a>
        <span title={applicantAddressLine(a) || undefined} className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{dashIfEmpty(applicantAddressLine(a))}</span>
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <span
            aria-hidden
            className="invisible w-0 overflow-hidden rounded-full border px-0 py-0.5 text-[11px] font-medium"
          >
            0
          </span>
          {a.referral_source ? (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
              เห็นจาก {REFERRAL_SOURCE_LABEL[a.referral_source] ?? a.referral_source}
            </span>
          ) : null}
          {a.has_document ? (
            <button
              type="button"
              disabled={downloadingId === a.id}
              onClick={() => void downloadDoc(a.id)}
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/15 disabled:opacity-50"
            >
              {downloadingId === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
              เอกสารแนบ
            </button>
          ) : null}
          {!a.referral_source && !a.has_document ? (
            <span className="text-[11px] text-muted-foreground">ไม่มีข้อมูลช่องทาง/เอกสารแนบ</span>
          ) : null}
        </div>
      </div>

      {/* "เก็บไปติดต่อ" เฉพาะฝั่ง "รายชื่อที่สนใจ" (เจ้าของสั่ง — เก็บหลังโทรแล้วสนใจ) */}
      {inInterestedColumn ? (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-1.5 border-t border-border/50 pt-2.5">
          {a.claimed && !a.claimed_by_me ? (
            <span className="rounded-full border border-transparent bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              🔒 เพื่อนเก็บไปติดต่อแล้ว
            </span>
          ) : (
            <button
              type="button"
              disabled={savingId === a.id}
              onClick={() => void toggleClaim(a)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50',
                a.claimed_by_me
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
              )}
            >
              {a.claimed_by_me ? '✓ อยู่ในการติดต่อของฉัน — กดเพื่อคืน' : 'เก็บไปติดต่อ'}
            </button>
          )}
        </div>
      ) : null}

      {a.note ? (
        <p className="mt-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">{a.note}</p>
      ) : null}
    </li>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-[38rem] flex-col gap-0 overflow-hidden rounded-[1.5rem] border-border/70 p-0 lg:max-w-[64rem]">
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

          {/* ปุ่มส่ง AI โทร (S8) + ผลตอบกลับ · เส้น auto ส่งตอนกรอกอยู่แล้ว ปุ่มนี้เก็บตกค้าง */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={sendBusy || items.length === 0}
              onClick={() => void sendAi()}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {sendBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '🤖'} ส่งให้ AI โทร
              {sendableApprox > 0 ? ` (~${sendableApprox})` : ''}
            </button>
            {sendNotice ? <span className="text-[11px] text-muted-foreground">{sendNotice}</span> : null}
          </div>

          {/* แถวชิป "ที่มาของคน" (ทั้งหมด/สมัครใหม่/AI หาให้/เจ้าหน้าที่คีย์) ถูกถอดออก
              (เจ้าของสั่ง 17 ส.ค. 2569: "รายชื่อภายในกล่องมีแค่ รายชื่อทั้งหมด กับ คนที่สนใจ")
              ⚠️ ป้ายบอกที่มายังอยู่บนการ์ดของแต่ละคนเหมือนเดิม — ที่เอาออกคือตัวกรอง */}

          {/* แท็บ — **ทุกขนาดจอ** (เจ้าของเคาะ 19 ส.ค. 2569: *"เป็น 2 แท็บทุกขนาดจอ"*)
              เดิมจอ ≥lg กางเป็น 2 คอลัมน์คู่กัน ทำให้หน้าเดียวมีสองหน้าตาแล้วคนละที่กัน
              ⚠️ "ที่สนใจ" = คนที่ตอบสนใจ **ตอนโทร** ไม่ใช่สถานะใบสมัคร
              · เห็นทั้งสองแท็บเสมอแม้ยอด 0 — เลข 0 คือคำตอบ ไม่ใช่ช่องว่าง */}
          <div className="mt-3 flex items-center gap-1">
            {(
              [
                ['all', 'รายชื่อทั้งหมด', shownItems.length],
                ['interested', 'คนที่สนใจ', interested.length],
              ] as Array<[ApplicantTab, string, number]>
            ).map(([id, label, n]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                  tab === id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70',
                )}
              >
                {label} <span className="tabular-nums">({n})</span>
              </button>
            ))}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              กำลังโหลดรายชื่อ...
            </div>
          ) : error ? (
            <p className={cn('rounded-xl border px-3.5 py-3 text-sm', TONE.danger.soft, TONE.danger.value)}>{error}</p>
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
            <>
              {/* มุมมองแท็บเดียวทุกขนาดจอ (19 ส.ค. 2569) */}
              <div>
                {visible.length === 0 ? (
                  <p className="py-12 text-center text-xs text-muted-foreground">
                    {tab === 'interested'
                      ? 'ยังไม่มีใครตอบว่าสนใจ — เมื่อโทรแล้วได้ผล “สนใจ” ชื่อจะมาอยู่ที่นี่'
                      : 'ยังไม่มีผู้สมัคร'}
                  </p>
                ) : (
                  <ul className="space-y-2.5">{visible.map((a) => renderCard(a, tab === 'interested'))}</ul>
                )}
              </div>

            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JobApplicantsDialog;
