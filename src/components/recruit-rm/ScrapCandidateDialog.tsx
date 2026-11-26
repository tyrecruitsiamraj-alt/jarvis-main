import { Bot, PhoneCall, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { bkkWhen } from '@/lib/bkkWhen';
import { SO_STATUS_LABEL, type SoStatus } from '@/lib/soScraping';
import { SCRAP_RESULT_LABEL, scrapChannelLabel, type ScrapOrderView } from '@/lib/scrapCandidates';
import { scrapVirtualStatus, type ScrapWorkRow } from '@/lib/scrapApplicants';

/**
 * ═══ รายละเอียดคนจาก Scrap ที่ยังไม่มีใบสมัคร (เจ้าของ 26 พ.ย. 2569 "กดดูรายละเอียดได้ไปเลย") ═══
 * หน้าตาเดียวกับป๊อป "รายละเอียดผู้สมัคร" (`ApplicantContactDialog` โหมด profile · เจ้าของ "ทำไม 2 element หน้าตาไม่เหมือนกัน")
 * หัวป๊อป · ตารางสามคอลัมน์ ป้ายเล็กด้านบน ค่าอยู่ใต้ป้าย · อ่านอย่างเดียว — เปิดดูไม่สร้างใบสมัคร
 */
const EM_DASH = '—';
const orderStatus = (s: string) => SO_STATUS_LABEL[s as SoStatus] ?? s;

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('min-w-0 space-y-1', className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="break-words text-sm text-foreground">{children}</div>
    </div>
  );
}
const show = (v: string | number | null | undefined) => (v === null || v === undefined || String(v).trim() === '' ? EM_DASH : String(v));

export default function ScrapCandidateDialog({
  row,
  orders,
  recruiterName,
  onClose,
  onSendAi,
  onKeep,
}: {
  row: ScrapWorkRow | null;
  orders: readonly ScrapOrderView[];
  /** ข้อมูลผู้สรรหา = เจ้าหน้าที่สรรหาของใบขอ (ชื่อเดียวกับคอลัมน์ "เจ้าของงาน") */
  recruiterName?: string | null;
  onClose: () => void;
  onSendAi: () => void;
  onKeep: () => void;
}) {
  const s = row?.scrap ?? null;
  const a = row?.app;
  const ready = row?.view === 'ready';
  const blockedTitle = row && !ready ? scrapVirtualStatus(row).title : null;
  const gender = a?.gender === 'male' ? 'ชาย' : a?.gender === 'female' ? 'หญิง' : null;
  return (
    <Dialog open={Boolean(row)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto max-sm:top-4 max-sm:translate-y-0" data-testid="scrap-candidate-dialog">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 text-left">
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', TONE.primary.soft, TONE.primary.value)}>
            <UserRound className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <DialogTitle className="text-sm font-medium text-foreground">รายละเอียดผู้สมัคร</DialogTitle>
            <DialogDescription className="sr-only">{a?.full_name ?? ''}</DialogDescription>
          </div>
        </DialogHeader>
        {a ? (
          <div className="space-y-6">
            <section className="space-y-4">
              <p className="text-sm font-medium text-foreground">ข้อมูลผู้สมัคร</p>
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
                <Field label="ชื่อ">{show(a.first_name ?? a.full_name)}</Field>
                <Field label="นามสกุล">{show(a.last_name)}</Field>
                <Field label="เพศ">{show(gender)}</Field>
                <Field label="อายุ">{a.age ? `${a.age} ปี` : EM_DASH}</Field>
                <Field label="เบอร์โทรติดต่อ">{show(a.phone)}</Field>
                <Field label="จังหวัดที่อยู่อาศัย">{show(a.province)}</Field>
                <Field label="ตำแหน่งงาน" className="sm:col-span-2">
                  {show([s?.request_no, a.job_title, a.unit_name].filter(Boolean).join(' · '))}
                </Field>
                <Field label="ช่องทาง">{show(scrapChannelLabel(s?.platform ?? null))}</Field>
                <Field label="ข้อมูลผู้สรรหา">{show(recruiterName)}</Field>
                <Field label="คนนำเข้า">{show(s?.ordered_by)}</Field>
                <Field label="วันที่เจอ">{show(bkkWhen(s?.found_at))}</Field>
              </div>
            </section>
            <section className="space-y-3 border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground">ผลประเมินจาก So Scraping</p>
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
                <Field label="ผลประเมิน">{s ? SCRAP_RESULT_LABEL[s.result] : EM_DASH}</Field>
                <Field label="คะแนน">{typeof s?.score === 'number' ? s.score.toLocaleString('th-TH') : EM_DASH}</Field>
                <Field label="ประวัติโทร">ยังไม่มี</Field>
                {s && s.reasons.length > 0 ? (
                  <Field label="เหตุผล" className="sm:col-span-3">
                    <ul className="list-disc space-y-0.5 pl-5" data-testid="scrap-candidate-reasons">
                      {s.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </Field>
                ) : null}
              </div>
            </section>
            <section className="space-y-3 border-t border-border pt-4" data-testid="scrap-candidate-orders">
              <p className="text-sm font-medium text-foreground">สั่ง Scrap ใบนี้ {orders.length.toLocaleString('th-TH')} ครั้ง</p>
              {orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">ไม่พบคำสั่ง Scrap ของใบนี้</p>
              ) : (
                <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
                  {orders.map((o) => (
                    <Field key={`${o.created_at}-${o.by ?? ''}`} label={`${bkkWhen(o.created_at) ?? ''} · ${orderStatus(o.status)}`}>
                      {show(o.by)}
                    </Field>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-2">
          {blockedTitle ? <span className="mr-auto self-center text-xs text-muted-foreground">{blockedTitle}</span> : null}
          <Button type="button" variant="outline" size="sm" disabled={!ready} onClick={onKeep}>
            <PhoneCall aria-hidden /> เก็บไปโทรเอง
          </Button>
          <Button type="button" size="sm" disabled={!ready} onClick={onSendAi}>
            <Bot aria-hidden /> ส่ง AI โทร
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
