import React from 'react';
import { LoaderCircle, Megaphone, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FieldSelect } from '@/components/shared/FieldSelect';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import type { JobRequest } from '@/types';
import { publicJobTitle } from '@/lib/publicJobTitle';
import { createJobPostingRequest, fetchSoOptions, listLatestJobPostingsForJob, type JobPostingRequest } from '@/lib/jobPostingRequestsApi';
import {
  SO_SCRAPE_STATUS_LABEL,
  SO_SCRAP_REASON,
  defaultScrapeIds,
  soPlatformLabel,
  soScrapMissing,
  soScrapConfirmWarnings,
  soScrapSnapshot,
  soScrapeSelectable,
  soStatusView,
  soWorkersFor,
  type SoOptWorker,
  type SoScrapeAccount,
} from '@/lib/soScraping';
import { AutopostBody } from '@/components/jobs/AutopostDialog';
import SoStartLine from '@/components/jobs/SoStartLine';

/**
 * ═══ So Scraping ใต้การ์ดตัวอย่างในป๊อปประกาศ — สถานะ + ขอ Scrap (เจ้าของ 20 ต.ค. 2569) ═══
 * - สถานะโพสต์/Scrap ล่าสุดที่ So Scraping เขียนกลับ · ไม่รับงาน = เหตุผลจาก notes
 * - ขอ Scrap: ที่นี่ที่เดียว (Choice "ย้ายมาไว้หน้านี้เท่านั้น") · ต้องมีตำแหน่ง/จังหวัด/จำนวนคน · ขาดอะไรบอก
 *   ตำแหน่ง = ชื่อที่โชว์บนประกาศ (`publicJobTitle`) ไม่ใช่ "พนักงาน" ของ ERP
 * - สั่งโพสต์ = ปุ่ม **Autopost บนการ์ดกล่องงาน** (`AutopostDialog`) และปุ่ม Autopost ข้างบรรทัดโพสต์ที่นี่
 *   (เจ้าของ 21 ต.ค. 2569 "ยังไม่ได้สั่ง แล้วจะสั่งยังไง" · Choice "เพิ่มปุ่ม Autopost ในป๊อปนี้") — ฟอร์มเดียวกันฝังแทนที่ (`embedded`) ห้ามซ้อนป๊อป
 * - ยังรอ/กำลังทำ = กดซ้ำไม่ได้ · เสร็จ/ไม่รับงาน = สั่งใหม่ได้
 * - 26 ต.ค. 2569 (เอกสาร options API): เลือกบัญชี JobThai/JobBKK → `scrape_connector_ids` · ติ๊กตัวพร้อมใช้ตัวแรกของแต่ละเว็บไว้ให้
 *   พักชั่วคราว/ปิดใช้งาน = เลือกไม่ได้ · ครบโควต้า = กล่องเตือนในป๊อปเดิมก่อนส่ง (ห้ามซ้อนป๊อป)
 * - เอกสารรอบ 2: เลือกเครื่องที่รับงาน Scrap ได้ → `scrape_worker` (ไม่เลือก = ระบบ So Scraping เลือกเอง) · เครื่องออฟไลน์ = เตือนก่อนส่ง
 */
const AUTO_WORKER = '__auto__';
const NUM = new Intl.NumberFormat('th-TH');
export default function OrderPostButton({ job }: { job: JobRequest; caption?: string | null }) {
  const [latest, setLatest] = React.useState<JobPostingRequest[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [autopost, setAutopost] = React.useState(false);
  const [scrapeAccounts, setScrapeAccounts] = React.useState<SoScrapeAccount[] | null>(null);
  const [scrapeError, setScrapeError] = React.useState<string | null>(null);
  const [scrapeIds, setScrapeIds] = React.useState<string[]>([]);
  const [confirmText, setConfirmText] = React.useState<string | null>(null);
  const [scrapeWorkers, setScrapeWorkers] = React.useState<SoOptWorker[]>([]);
  const [scrapeWorker, setScrapeWorker] = React.useState(AUTO_WORKER);
  /** คำขอ Scrap ที่เพิ่งส่งในรอบนี้ — โชว์ผลเริ่มงานของ So Scraping */
  const [lastScrap, setLastScrap] = React.useState<JobPostingRequest | null>(null);

  React.useEffect(() => {
    let alive = true;
    setScrapeAccounts(null);
    setScrapeError(null);
    fetchSoOptions()
      .then((o) => {
        if (!alive) return;
        setScrapeAccounts(o.scrapeAccounts);
        setScrapeIds(defaultScrapeIds(o.scrapeAccounts));
        setScrapeWorkers(soWorkersFor(o, 'scraper'));
      })
      .catch((e) => alive && setScrapeError(e instanceof Error ? e.message : 'โหลดบัญชี JobThai/JobBKK ไม่ได้'));
    return () => {
      alive = false;
    };
  }, [job.id]);

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

  /** มีรายชื่อบัญชีจาก So Scraping แล้วต้องติ๊กอย่างน้อย 1 (start ของ So Scraping บังคับ) */
  const needScrapeAccount = (scrapeAccounts?.length ?? 0) > 0 && scrapeIds.length === 0;

  const scrap = async (confirmed = false) => {
    if (busy) return;
    const worker = scrapeWorkers.find((w) => w.name === scrapeWorker) ?? null;
    const warnings = soScrapConfirmWarnings((scrapeAccounts ?? []).filter((s) => scrapeIds.includes(s.id)), worker);
    if (!confirmed && warnings.length > 0) {
      setConfirmText(warnings.join(' · '));
      return;
    }
    setConfirmText(null);
    setBusy(true);
    setError(null);
    try {
      const item = await createJobPostingRequest({
        jobId: job.id,
        requestNo: job.request_no,
        reason: SO_SCRAP_REASON,
        requestType: 'scraping',
        jobSnapshot: {
          ...soScrapSnapshot(job, title),
          ...(scrapeIds.length > 0 ? { scrape_connector_ids: scrapeIds } : {}),
          ...(scrapeWorker !== AUTO_WORKER ? { scrape_worker: scrapeWorker } : {}),
        },
      });
      setLatest((prev) => [item, ...(prev ?? []).filter((p) => p.request_type !== 'scraping')]);
      setLastScrap(item);
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
      {scrapeAccounts && scrapeAccounts.length > 0 && !scrapingView?.open ? (
        <ul className="space-y-1.5" data-testid="so-scrape-accounts">
          {scrapeAccounts.map((s) => (
            <li key={s.id} className="flex items-start gap-2">
              <Checkbox
                id={`so-scrape-${job.id}-${s.id}`}
                checked={scrapeIds.includes(s.id)}
                disabled={!soScrapeSelectable(s.status)}
                onCheckedChange={(v) => {
                  setConfirmText(null);
                  setScrapeIds((prev) => (v === true ? [...new Set([...prev, s.id])] : prev.filter((x) => x !== s.id)));
                }}
                className="mt-0.5"
              />
              <Label htmlFor={`so-scrape-${job.id}-${s.id}`} className="space-y-0.5 font-normal">
                <span className="block text-sm text-foreground">
                  {soPlatformLabel(s.platform)} · {s.label}
                </span>
                <span className={cn('block text-xs tabular-nums', soScrapeSelectable(s.status) ? DASH.muted : TONE.danger.value)}>
                  {[
                    SO_SCRAPE_STATUS_LABEL[s.status],
                    `ใช้วันนี้ ${NUM.format(s.usedToday)}${s.cap !== null ? `/${NUM.format(s.cap)}` : ''}`,
                    s.warning,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </Label>
            </li>
          ))}
        </ul>
      ) : null}
      {scrapeWorkers.length > 0 && !scrapingView?.open ? (
        <FieldSelect
          value={scrapeWorker}
          onChange={(v) => {
            setScrapeWorker(v);
            setConfirmText(null);
          }}
          ariaLabel="เครื่องที่ Scrap"
          testId="so-scrape-worker"
          options={[
            { value: AUTO_WORKER, label: 'เครื่อง: ให้ระบบเลือก' },
            ...scrapeWorkers.map((w) => ({
              value: w.name,
              label: `เครื่อง ${w.name} · ${w.online ? 'ออนไลน์' : 'ออฟไลน์'} · งาน Scrap ค้าง ${NUM.format(w.scrapeQueue.running + w.scrapeQueue.queued)}`,
            })),
          ]}
        />
      ) : null}
      {scrapeError ? <p className={cn('text-xs', TONE.danger.value)}>{scrapeError}</p> : null}
      {needScrapeAccount && !scrapingView?.open ? <p className={cn('text-xs', TONE.warn.value)}>เลือกบัญชี JobThai/JobBKK อย่างน้อย 1 บัญชี</p> : null}
      {lastScrap ? <SoStartLine requestId={lastScrap.id} initial={lastScrap.so_start} /> : null}
      {confirmText ? (
        <div role="alert" aria-label="คำเตือนจาก So Scraping" className={cn('space-y-2 rounded-xl border px-3 py-2', TONE.warn.soft)} data-testid="so-scrape-warn">
          <p className="text-sm text-foreground">{confirmText}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => void scrap(true)} disabled={busy} data-testid="so-scrape-warn-confirm">
              ส่งต่อ
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setConfirmText(null)}>
              เลือกบัญชีอื่น
            </Button>
          </div>
        </div>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full"
        disabled={latest === null || Boolean(scrapingView?.open) || scrapMissing.length > 0 || busy || needScrapeAccount}
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
