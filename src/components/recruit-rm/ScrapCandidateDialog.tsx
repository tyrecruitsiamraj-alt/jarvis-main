import { Bot, PhoneCall } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { bkkWhen } from '@/lib/bkkWhen';
import { SO_STATUS_LABEL, type SoStatus } from '@/lib/soScraping';
import { SCRAP_RESULT_LABEL, scrapChannelLabel, type ScrapOrderView } from '@/lib/scrapCandidates';
import { scrapVirtualStatus, type ScrapWorkRow } from '@/lib/scrapApplicants';

/**
 * ═══ รายละเอียดคนจาก Scrap ที่ยังไม่มีใบสมัคร (เจ้าของ 26 พ.ย. 2569 "ทำไมกดดูประวัติไม่ได้ แล้วจะรู้ได้ไงใครเอาเข้ารายชื่อพวกนี้มา"
 * · Choice "กดดูรายละเอียดได้ไปเลย") ═══
 * อ่านอย่างเดียว — เปิดดูไม่สร้างใบสมัคร (ใบสร้างตอนกด "ส่ง AI โทร" / "เก็บไปโทรเอง" ตามเดิม) · ข้อมูลจาก So Scraping + คำสั่ง Scrap ของใบขอ
 */
const orderStatus = (s: string) => SO_STATUS_LABEL[s as SoStatus] ?? s;

function Line({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-foreground">{value?.trim() ? value : '—'}</span>
    </div>
  );
}

export default function ScrapCandidateDialog({
  row,
  orders,
  onClose,
  onSendAi,
  onKeep,
}: {
  row: ScrapWorkRow | null;
  orders: readonly ScrapOrderView[];
  onClose: () => void;
  onSendAi: () => void;
  onKeep: () => void;
}) {
  const s = row?.scrap ?? null;
  const app = row?.app;
  const ready = row?.view === 'ready';
  const blockedTitle = row && !ready ? scrapVirtualStatus(row).title : null;
  return (
    <Dialog open={Boolean(row)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg" data-testid="scrap-candidate-dialog">
        <DialogHeader>
          <DialogTitle>{app?.full_name ?? ''}</DialogTitle>
        </DialogHeader>
        {app ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Line label="เบอร์โทร" value={app.phone} />
              <Line label="อายุ · เพศ" value={[app.age ? `${app.age} ปี` : null, app.gender === 'male' ? 'ชาย' : app.gender === 'female' ? 'หญิง' : null].filter(Boolean).join(' · ')} />
              <Line label="จังหวัด" value={app.province} />
              <Line label="ใบขอ" value={[s?.request_no, app.job_title, app.unit_name].filter(Boolean).join(' · ')} />
              <Line label="คนนำเข้า" value={s?.ordered_by ?? null} />
            </div>
            <div className="space-y-1.5 border-t border-border pt-3">
              <Line label="เจอที่" value={[scrapChannelLabel(s?.platform ?? null), bkkWhen(s?.found_at)].filter(Boolean).join(' · ')} />
              <Line
                label="ผลประเมิน"
                value={s ? [SCRAP_RESULT_LABEL[s.result], typeof s.score === 'number' ? `${s.score} คะแนน` : null].filter(Boolean).join(' · ') : null}
              />
              {s && s.reasons.length > 0 ? (
                <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground" data-testid="scrap-candidate-reasons">
                  {s.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="space-y-1.5 border-t border-border pt-3" data-testid="scrap-candidate-orders">
              <p className="text-sm font-medium text-foreground">สั่ง Scrap ใบนี้ {orders.length.toLocaleString('th-TH')} ครั้ง</p>
              {orders.length === 0 ? (
                <p className="text-xs text-muted-foreground">ไม่พบคำสั่ง Scrap ของใบนี้</p>
              ) : (
                <ul className="space-y-1">
                  {orders.map((o) => (
                    <li key={`${o.created_at}-${o.by ?? ''}`} className="flex justify-between gap-3 text-xs">
                      <span className="text-foreground">{o.by ?? '—'}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {bkkWhen(o.created_at)} · {orderStatus(o.status)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="border-t border-border pt-3 text-xs text-muted-foreground">ยังไม่มีประวัติโทร</p>
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
