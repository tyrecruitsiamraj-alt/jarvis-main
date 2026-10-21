import React from 'react';
import { LoaderCircle, Megaphone, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import type { JobRequest } from '@/types';
import { publicJobTitle } from '@/lib/publicJobTitle';
import { createJobPostingRequest, listLatestJobPostingsForJob, type JobPostingRequest } from '@/lib/jobPostingRequestsApi';
import { SO_SCRAP_REASON, soScrapMissing, soScrapSnapshot, soStatusView } from '@/lib/soScraping';
import { AutopostBody } from '@/components/jobs/AutopostDialog';

/**
 * ═══ So Scraping ใต้การ์ดตัวอย่างในป๊อปประกาศ — สถานะ + ขอ Scrap (เจ้าของ 20 ต.ค. 2569) ═══
 * - สถานะโพสต์/Scrap ล่าสุดที่ So Scraping เขียนกลับ · ไม่รับงาน = เหตุผลจาก notes
 * - ขอ Scrap: ที่นี่ที่เดียว (Choice "ย้ายมาไว้หน้านี้เท่านั้น") · ต้องมีตำแหน่ง/จังหวัด/จำนวนคน · ขาดอะไรบอก
 *   ตำแหน่ง = ชื่อที่โชว์บนประกาศ (`publicJobTitle`) ไม่ใช่ "พนักงาน" ของ ERP
 * - สั่งโพสต์ = ปุ่ม **Autopost บนการ์ดกล่องงาน** (`AutopostDialog`) และปุ่ม Autopost ข้างบรรทัดโพสต์ที่นี่
 *   (เจ้าของ 21 ต.ค. 2569 "ยังไม่ได้สั่ง แล้วจะสั่งยังไง" · Choice "เพิ่มปุ่ม Autopost ในป๊อปนี้") — ฟอร์มเดียวกันฝังแทนที่ (`embedded`) ห้ามซ้อนป๊อป
 * - ยังรอ/กำลังทำ = กดซ้ำไม่ได้ · เสร็จ/ไม่รับงาน = สั่งใหม่ได้
 */
export default function OrderPostButton({ job }: { job: JobRequest; caption?: string | null }) {
  const [latest, setLatest] = React.useState<JobPostingRequest[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [autopost, setAutopost] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    setLatest(null);
    setLoadError(null);
    listLatestJobPostingsForJob(job.id)
      .then((list) => alive && setLatest(list))
      .catch((e) => alive && setLoadError(e instanceof Error ? e.message : 'โหลดสถานะไม่ได้'));
    return () => {
      alive = false;
    };
  }, [job.id]);

  const content = latest?.find((p) => p.request_type === 'content') ?? null;
  const scraping = latest?.find((p) => p.request_type === 'scraping') ?? null;
  const contentView = content ? soStatusView(content) : null;
  const scrapingView = scraping ? soStatusView(scraping) : null;
  const title = publicJobTitle(job);
  const scrapMissing = soScrapMissing(job, title);

  const scrap = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const item = await createJobPostingRequest({
        jobId: job.id,
        requestNo: job.request_no,
        reason: SO_SCRAP_REASON,
        requestType: 'scraping',
        jobSnapshot: soScrapSnapshot(job, title),
      });
      setLatest((prev) => [item, ...(prev ?? []).filter((p) => p.request_type !== 'scraping')]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ขอ Scrap ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const statusRow = (
    label: string,
    req: JobPostingRequest | null,
    view: ReturnType<typeof soStatusView> | null,
    testId: string,
    action?: React.ReactNode,
  ) => (
    <div className="space-y-1" data-testid={testId}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-foreground">{label}</span>
        {latest === null && !loadError ? (
          <span className={cn('text-xs', DASH.muted)}>กำลังโหลด…</span>
        ) : view ? (
          <Badge variant="outline" className={cn('font-medium', TONE[view.tone].outline)}>
            {view.label}
          </Badge>
        ) : (
          <span className={cn('text-xs', DASH.muted)}>ยังไม่ได้สั่ง</span>
        )}
        {action ? <span className="ml-auto">{action}</span> : null}
      </div>
      {req?.status === 'rejected' && req.notes?.trim() ? (
        <p className={cn('text-xs', TONE.danger.value)}>เหตุผล: {req.notes.trim()}</p>
      ) : null}
    </div>
  );

  if (autopost) {
    return (
      <div className="rounded-xl border border-border/70 p-3" data-testid="order-post">
        <AutopostBody
          embedded
          job={job}
          onSent={(item) => setLatest((prev) => [item, ...(prev ?? []).filter((p) => p.request_type !== 'content')])}
          onClose={() => setAutopost(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/70 p-3" data-testid="order-post">
      <div className="space-y-2">
        {statusRow(
          'โพสต์',
          content,
          contentView,
          'so-status-content',
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={latest === null || Boolean(contentView?.open)}
            onClick={() => setAutopost(true)}
            data-testid="so-order-autopost"
          >
            <Megaphone aria-hidden /> Autopost
          </Button>,
        )}
        {statusRow('Scrap', scraping, scrapingView, 'so-status-scraping')}
        {loadError ? <p className={cn('text-xs', TONE.danger.value)}>{loadError}</p> : null}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full"
        disabled={latest === null || Boolean(scrapingView?.open) || scrapMissing.length > 0 || busy}
        onClick={() => void scrap()}
        data-testid="so-order-scrap"
      >
        {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <Search aria-hidden />}
        {busy ? 'กำลังส่ง…' : 'ขอ Scrap'}
      </Button>
      {scrapMissing.length > 0 && !scrapingView?.open ? (
        <p className={cn('text-xs', TONE.warn.value)} data-testid="so-scrap-missing">
          ขอ Scrap ไม่ได้ ขาด{scrapMissing.join(' · ')}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className={cn('text-xs', TONE.danger.value)}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
