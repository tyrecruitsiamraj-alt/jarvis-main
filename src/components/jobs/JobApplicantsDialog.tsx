import React, { useEffect, useState } from 'react';
import { TONE } from '@/lib/designTokens';
import type { JobRequest } from '@/types';
import { jobBoardCardTitle } from '@/lib/unitRequestDisplay';
import { formatYmdDmyBe, toYmdBangkok } from '@/lib/dateTh';
import {
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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
  const { interested } = splitInterested(items);
  const visible = tab === 'interested' ? interested : items;

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

          {/* แท็บ ทั้งหมด / ที่สนใจ (เจ้าของสั่ง 13 ส.ค. 2569)
              ⚠️ "ที่สนใจ" = คนที่ตอบสนใจ **ตอนโทร** (ผลจาก AI หรือคนก็ได้)
              ไม่ใช่สถานะใบสมัคร ซึ่งมีแค่ ใหม่/ติดต่อแล้ว/รับเข้าทำงาน/ปฏิเสธ
              · เห็นทั้งสองแท็บเสมอแม้ยอดเป็น 0 — เลข 0 คือคำตอบ ไม่ใช่ช่องว่าง */}
          <div className="mt-3 flex items-center gap-1">
            {(
              [
                ['all', 'รายชื่อผู้สมัครทั้งหมด', items.length],
                ['interested', 'รายชื่อที่สนใจ', interested.length],
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
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <Users className="h-7 w-7 text-muted-foreground/50" />
              </span>
              {/* ข้อความว่างต้องตรงกับแท็บที่เปิดอยู่ — ไม่งั้นแท็บ "ที่สนใจ" จะบอกว่า
                  "ยังไม่มีผู้สมัคร" ทั้งที่มีคนสมัครอยู่ แค่ยังไม่มีใครตอบว่าสนใจ */}
              {tab === 'interested' ? (
                <>
                  <p className="text-sm font-medium text-foreground">ยังไม่มีใครตอบว่าสนใจ</p>
                  <p className="max-w-xs text-xs text-muted-foreground">
                    เมื่อโทรหาผู้สมัคร (ด้วย AI หรือโทรเอง) แล้วได้ผลว่า “สนใจ” ชื่อจะมาอยู่ที่นี่
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">ยังไม่มีผู้สมัครสำหรับงานนี้</p>
                  <p className="max-w-xs text-xs text-muted-foreground">
                    เมื่อมีผู้กรอกใบสมัครผ่านหน้าประกาศงาน รายชื่อจะแสดงที่นี่
                  </p>
                </>
              )}
            </div>
          ) : (
            <ul className="space-y-2.5">
              {visible.map((a) => (
                <li
                  key={a.id}
                  className="rounded-2xl border border-border/70 bg-background/60 p-3.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* บล็อกซ้าย = 2 บรรทัดเสมอ (ชื่อ + ข้อมูลย่อ) ไม่ว่าข้อมูลจะครบแค่ไหน
                        เดิมบรรทัดข้อมูลย่อหายทั้งบรรทัดเมื่อไม่มีค่า และ wrap เป็น 2 บรรทัด
                        เมื่อครบ — การ์ดของแต่ละคนจึงสูงไม่เท่ากัน (เจ้าของทัก 13 ส.ค. 2569) */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{a.full_name}</p>
                      <p
                        title={applicantFactLine(a) || undefined}
                        className="mt-0.5 truncate text-xs leading-4 text-muted-foreground"
                      >
                        {dashIfEmpty(applicantFactLine(a))}
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
                      {/* ผลโทรล่าสุด — ต้องเห็นคู่กับสถานะใบสมัคร ไม่งั้นเปิดแท็บ "ที่สนใจ"
                          แล้วไม่มีอะไรบอกว่าทำไมคนนี้ถึงมาอยู่ในลิสต์
                          ⚠️ โทนสี/ป้ายมาจาก lib กลาง (ห้ามไฟล์หน้าทำ map เอง — มีเทสต์คุม)
                          ค่าที่ไม่ใช่ outcome จริงไม่โชว์ (ข้อมูลเก่าเคยมีค่าแปลกปลอม) */}
                      {isKnownOutcome(a.last_call_outcome) ? (
                        <span className={cn('text-[10px]', TONE[CALL_OUTCOME_TONE[a.last_call_outcome]].chip)}>
                          โทรแล้ว · {CALL_OUTCOME_LABEL[a.last_call_outcome]}
                        </span>
                      ) : null}
                      <span className="text-[11px] text-muted-foreground">{dateLabel(a.created_at)}</span>
                    </div>
                  </div>

                  {/* บล็อกติดต่อ = 3 แถวเสมอ (เบอร์ · ที่อยู่ · แถวชิป) — ระยะห่างมาจาก
                      gap ที่เดียว ไม่ใส่ mt-* ซ้อนอีก ไม่งั้นคำนวณตำแหน่งแต่ละแถวไม่ได้ */}
                  <div className="mt-2 flex flex-col gap-1 text-xs">
                    <a
                      href={`tel:${a.phone}`}
                      className="inline-flex w-fit items-center gap-1.5 font-medium text-primary hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {dashIfEmpty(a.phone)}
                    </a>
                    <span
                      title={applicantAddressLine(a) || undefined}
                      className="flex items-center gap-1.5 text-muted-foreground"
                    >
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{dashIfEmpty(applicantAddressLine(a))}</span>
                    </span>
                    {/* แถวชิปจองที่ไว้เสมอ — เดิม div นี้ยังอยู่แต่สูง 0 พร้อม mt-1 ค้าง
                        กลายเป็นช่องว่างผีที่บางการ์ดมีบางการ์ดไม่มี
                        ⚠️ ตัวตั้งความสูงเป็น "ปุ่มจริงที่มองไม่เห็น" ไม่ใช่ min-h ค่าคงที่ —
                        ของในแถวนี้สูงไม่เท่ากันเอง (ปุ่มเอกสาร 23.3 · ชิป 21.4 · ข้อความ 20.9)
                        ใช้ตัวที่สูงสุดเป็นตัวตั้ง ความสูงจึงเดินตามถ้าวันหลังปุ่มเปลี่ยนขนาด */}
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
                          {downloadingId === a.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Download className="h-3 w-3" />
                          )}
                          เอกสารแนบ
                        </button>
                      ) : null}
                      {!a.referral_source && !a.has_document ? (
                        <span className="text-[11px] text-muted-foreground">ไม่มีข้อมูลช่องทาง/เอกสารแนบ</span>
                      ) : null}
                    </div>
                  </div>

                  {/* ⚠️ ปุ่ม "เลือกสถานะ" ถูกเอาออก (เจ้าของสั่ง 14 ส.ค. 2569): "คำว่าสถานะ
                      ไม่ได้ให้คนเลือก แต่มันจะสอดคล้องกันหลังจากคนเก็บไปโทร" — สถานะมาจาก
                      "ขั้นที่คนทำ" (ผลโทร/เก็บ Lead/จอง) ไม่ใช่กดมั่ว · ป้าย read-only + ชิป
                      "โทรแล้ว · [ผล]" ในหัวการ์ดสื่อสถานะจริงอยู่แล้ว
                      "เก็บไปติดต่อ" ย้ายมาอยู่ **เฉพาะแท็บ "รายชื่อที่สนใจ"** เพราะเจ้าของสั่ง
                      "ให้เก็บหลังจากที่เขาสนใจ" — โทรแล้วสนใจถึงค่อยเก็บไปติดต่อ */}
                  {tab === 'interested' ? (
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

                  {/* หมายเหตุยาวไม่จำกัด = ตัวเดียวที่ความสูงคาดเดาไม่ได้ — เจ้าของเคาะ
                      13 ส.ค. 2569 ให้ "เห็นเต็ม ย้ายไปล่างสุด" ความแปรผันจึงกองอยู่
                      จุดเดียวท้ายการ์ด ไม่ไปดันบรรทัดข้างบนของใครให้เลื่อน */}
                  {a.note ? (
                    <p className="mt-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
                      {a.note}
                    </p>
                  ) : null}
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
