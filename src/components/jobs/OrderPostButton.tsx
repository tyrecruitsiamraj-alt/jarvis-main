import React from 'react';
import { ChevronDown, LoaderCircle, Megaphone, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldSelect } from '@/components/shared/FieldSelect';
import { JobApplyLinks } from '@/components/jobs/ApplyLinksPanel';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import type { JobRequest } from '@/types';
import { publicJobTitle } from '@/lib/publicJobTitle';
import { createJobPostingRequest, fetchSoOptions, fetchSoRunMessage, listLatestJobPostingsForJob, type JobPostingRequest } from '@/lib/jobPostingRequestsApi';
import {
  SO_SCRAP_REASON,
  jobQtyOf,
  soDefaultScrapeAccount,
  soDefaultWorker,
  soPlatformLabel,
  soRejectReason,
  soScrapMissing,
  soScrapConfirmWarnings,
  soScrapSnapshot,
  soScrapeChoice,
  soScrapeRemaining,
  soScrapeSelectable,
  soStatusView,
  soWorkerOfflineText,
  soWorkersFor,
  type SoOptWorker,
  type SoScrapeAccount,
} from '@/lib/soScraping';
import { AutopostBody } from '@/components/jobs/AutopostDialog';
import SoStartLine from '@/components/jobs/SoStartLine';
import SoStuckPanel from '@/components/jobs/SoStuckPanel';

/**
 * ═══ ฟอร์มสั่ง So Scraping — เลือกว่าจะ Autopost หรือ Scrap แล้วไล่ข้อ 1-2-3 (เจ้าของ 3 พ.ย. 2569) ═══
 * > *"เอา Autopost กับ Scrap มาทำเป็น Dropdown … ทุกอย่างอย่าลืมว่าสั่งจากคนทำไม่เป็นนะ มีอะไรให้เลือกก็เลือกหมด บัญชีด้วย"*
 * Choice: หน้าเดียว เรียงข้อ 1-2-3 เลือกไว้ให้หมด · Scrap เลือกบัญชีแบบเดียวกับ Autopost (อนาคตมีหลายบัญชี) ·
 * จำนวนคนที่ Scrap = ช่องตัวเลข ค่าเริ่ม "เหลือหา" ของใบขอ เพดาน = โควต้าที่เว็บนั้นเหลือวันนี้ (So Scraping ต้องรับ `scrape_target` · เอกสารที่ส่งให้ 3 พ.ย.)
 *
 * ใช้ 3 ที่ด้วยตัวเดียวกัน: หน้ารายละเอียดใบขอ · ป๊อปประกาศ (งานสรรหา) · ป๊อปจากปุ่มบนการ์ดกล่องงาน (`AutopostDialog`)
 * - สถานะโพสต์/Scrap ล่าสุดที่ So Scraping เขียนกลับ · ไม่สำเร็จ = เหตุผลจาก notes · กำลังทำ = กดซ้ำไม่ได้ · ค้าง = ส่งอีกครั้ง/ยกเลิกแล้วสั่งใหม่ · เสร็จ/ไม่สำเร็จ = สั่งใหม่ได้
 * - Autopost: ข้อ 1 บัญชี · 2 กลุ่ม · 3 เครื่อง · ข้อความ (`AutopostBody` ฝัง ห้ามซ้อนป๊อป) · กลุ่มละ 1 ลิงก์ (แยกว่ากลุ่มไหนได้คนเยอะ)
 * - Scrap: ข้อ 1 บัญชี JobThai/JobBKK (ตั้งต้น = พร้อมใช้ที่เหลือโควต้ามากสุด) · 2 จำนวนคน · 3 เครื่อง (ตั้งต้น = ที่ So Scraping แนะนำ)
 *   ตำแหน่ง = ชื่อที่โชว์บนประกาศ (`publicJobTitle`) ไม่ใช่ "พนักงาน" ของ ERP · ขาดตำแหน่ง/จังหวัด/จำนวนคน = สั่งไม่ได้ บอกว่าขาดอะไร
 */
const AUTO_WORKER = '__auto__';
const NUM = new Intl.NumberFormat('th-TH');
type OrderKind = 'autopost' | 'scrap' | 'genlink';
const KIND_OPTIONS: Array<{ value: OrderKind; label: string }> = [
  { value: 'autopost', label: 'Autopost — โพสต์ลงกลุ่ม Facebook' },
  { value: 'scrap', label: 'Scrap — ดึงผู้สมัครจาก JobThai / JobBKK' },
];
/** ตัวเลือกที่ 3 — หน้ารายละเอียดใบขอ (เจ้าของ 4 พ.ย. 2569 "เอารวมกันสิ่" · ลิงก์สมัครเดิมเป็นกล่องแยก) */
const GEN_LINK_OPTION = { value: 'genlink' as const, label: 'Gen link — ลิงก์สมัครเอาไปโพสต์เอง' };

export default function OrderPostButton({
  job,
  onCaptionSaved,
  defaultKind = 'autopost',
  onSent,
  withGenLink = false,
  onLinksChanged,
}: {
  job: JobRequest;
  caption?: string | null;
  /** ข้อความ Autopost ที่แก้ถูกบันทึกแล้ว — หน้าแม่เอาไปแปะการ์ดตัวอย่าง (28 ต.ค. 2569) */
  onCaptionSaved?: (text: string | null) => void;
  /** เปิดมาที่ข้อไหนก่อน (ปุ่มบนการ์ด = Autopost) */
  defaultKind?: OrderKind;
  /** ส่งใบสั่งแล้ว (โพสต์หรือ Scrap) — หน้าแม่โหลดป้ายสถานะใหม่ */
  onSent?: (item: JobPostingRequest) => void;
  /** มีตัวเลือก Gen link ในช่อง "สั่งอะไร" (หน้ารายละเอียดใบขอ + ป๊อปประกาศ) */
  withGenLink?: boolean;
  /** Gen link / แก้ลิงก์แล้ว — หน้าแม่โหลดลิงก์ใหม่ (ป๊อปประกาศเอาลิงก์ไปต่อท้ายข้อความโพสต์) */
  onLinksChanged?: () => void;
}) {
  const [kind, setKind] = React.useState<OrderKind>(defaultKind);
  const [latest, setLatest] = React.useState<JobPostingRequest[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [scrapeAccounts, setScrapeAccounts] = React.useState<SoScrapeAccount[] | null>(null);
  const [scrapeError, setScrapeError] = React.useState<string | null>(null);
  const [scrapeId, setScrapeId] = React.useState('');
  const [confirmText, setConfirmText] = React.useState<string | null>(null);
  const [scrapeWorkers, setScrapeWorkers] = React.useState<SoOptWorker[]>([]);
  const [scrapeWorker, setScrapeWorker] = React.useState(AUTO_WORKER);
  /** จำนวนคนที่จะ Scrap — ค่าเริ่ม = เหลือหาของใบขอ · คนสั่งแก้ได้ */
  const [targetText, setTargetText] = React.useState(() => (jobQtyOf(job) !== null ? String(jobQtyOf(job)) : ''));
  /** คำขอ Scrap ที่เพิ่งส่งในรอบนี้ — โชว์ผลเริ่มงานของ So Scraping */
  const [lastScrap, setLastScrap] = React.useState<JobPostingRequest | null>(null);
  /** ข้อความรอบล่าสุดของงานโพสต์จาก So Scraping เช่น "ข้าม 3 กลุ่มที่เพิ่งลง" (สเปค 6.4 "หน้าใบงานก็เห็น") */
  const [runMessage, setRunMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    setRunMessage(null);
    const requestNo = (job.request_no ?? '').trim();
    if (requestNo) void fetchSoRunMessage(requestNo).then((m) => alive && setRunMessage(m));
    return () => {
      alive = false;
    };
  }, [job.request_no]);

  React.useEffect(() => {
    let alive = true;
    setScrapeAccounts(null);
    setScrapeError(null);
    fetchSoOptions(job.request_no)
      .then((o) => {
        if (!alive) return;
        setScrapeAccounts(o.scrapeAccounts);
        // เลือกไว้ให้หมด (เจ้าของ 3 พ.ย. 2569): บัญชีพร้อมใช้ที่เหลือโควต้ามากสุด · เครื่องที่ So Scraping แนะนำ
        setScrapeId(soDefaultScrapeAccount(o.scrapeAccounts)?.id ?? '');
        const ws = soWorkersFor(o, 'scraper');
        setScrapeWorkers(ws);
        setScrapeWorker(soDefaultWorker(ws, 'scrape')?.name ?? AUTO_WORKER);
      })
      .catch((e) => alive && setScrapeError(e instanceof Error ? e.message : 'โหลดบัญชี JobThai/JobBKK ไม่ได้'));
    return () => {
      alive = false;
    };
  }, [job.id, job.request_no]);

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
  const scrapeAccount = scrapeAccounts?.find((s) => s.id === scrapeId) ?? null;
  /** เพดานจำนวน = โควต้าที่เว็บนั้นเหลือวันนี้ (So Scraping ส่ง `platform_cap`/`platform_used_today`) · ไม่รู้ = ไม่จำกัด */
  const scrapeMax = scrapeAccount ? soScrapeRemaining(scrapeAccount) : null;
  const target = /^\d+$/.test(targetText.trim()) ? Number(targetText.trim()) : null;

  /** สิ่งที่ยังสั่ง Scrap ไม่ได้ — บอกครบ ไม่ใช่ปุ่มเทาเฉย ๆ */
  const scrapProblems = [
    ...scrapMissing.map((m) => `ใบขอขาด${m}`),
    ...((scrapeAccounts?.length ?? 0) > 0 && !scrapeAccount ? ['เลือกบัญชี JobThai/JobBKK'] : []),
    ...(scrapeAccount && !soScrapeSelectable(scrapeAccount.status) ? [soScrapeChoice(scrapeAccount).label] : []),
    ...(target === null || target < 1 ? ['ใส่จำนวนคนที่ต้องการ (ตัวเลข 1 ขึ้นไป)'] : []),
    ...(target !== null && scrapeMax !== null && target > scrapeMax ? [`เว็บนี้วันนี้เหลือโควต้า ${NUM.format(scrapeMax)} คน — ลดจำนวน หรือเลือกเว็บอื่น`] : []),
  ];

  const scrap = async (confirmed = false) => {
    if (busy || scrapProblems.length > 0 || target === null) return;
    const worker = scrapeWorkers.find((w) => w.name === scrapeWorker) ?? null;
    const warnings = soScrapConfirmWarnings(scrapeAccount ? [scrapeAccount] : [], worker);
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
          ...(scrapeAccount ? { scrape_connector_ids: [scrapeAccount.id] } : {}),
          // จำนวนคนที่คนสั่งต้องการ — So Scraping ใช้เป็น target_count (เอกสารขอเพิ่ม 3 พ.ย. 2569) · ยังไม่รับ = เขาใช้เหลือหาของใบเอง
          scrape_target: target,
          ...(scrapeWorker !== AUTO_WORKER ? { scrape_worker: scrapeWorker } : {}),
        },
      });
      setLatest((prev) => [item, ...(prev ?? []).filter((p) => p.request_type !== 'scraping')]);
      setLastScrap(item);
      onSent?.(item);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ขอ Scrap ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const statusRow = (label: string, req: JobPostingRequest | null, view: ReturnType<typeof soStatusView> | null, testId: string) => (
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
      </div>
      {req?.status === 'rejected' && soRejectReason(req.notes) ? (
        <p className={cn('text-xs', TONE.danger.value)}>เหตุผล: {soRejectReason(req.notes)}</p>
      ) : null}
    </div>
  );

  const scrapOpen = Boolean(scrapingView?.open);

  return (
    <div className="space-y-3 rounded-xl border border-border/70 p-3" data-testid="order-post">
      <div className="space-y-2">
        {statusRow('โพสต์', content, contentView, 'so-status-content')}
        {runMessage ? (
          <p className={cn('text-xs', TONE.warn.value)} data-testid="so-run-message">
            {runMessage}
          </p>
        ) : null}
        {statusRow('Scrap', scraping, scrapingView, 'so-status-scraping')}
        {loadError ? <p className={cn('text-xs', TONE.danger.value)}>{loadError}</p> : null}
      </div>

      <div className="space-y-1">
        <Label htmlFor={`so-order-kind-${job.id}`} className="text-sm font-medium">
          สั่งอะไร
        </Label>
        <FieldSelect
          id={`so-order-kind-${job.id}`}
          value={kind}
          onChange={(v) => {
            setKind(v as OrderKind);
            setError(null);
            setConfirmText(null);
          }}
          ariaLabel="สั่งอะไร"
          testId="so-order-kind"
          options={withGenLink ? [...KIND_OPTIONS, GEN_LINK_OPTION] : KIND_OPTIONS}
        />
      </div>

      {kind === 'autopost' ? (
        <div className="rounded-xl border border-border/70 p-3" data-testid="so-order-autopost">
          <AutopostBody
            embedded
            job={job}
            onCaptionSaved={onCaptionSaved}
            onSent={(item) => {
              setLatest((prev) => [item, ...(prev ?? []).filter((p) => p.request_type !== 'content')]);
              onSent?.(item);
            }}
            onClose={() => setKind('autopost')}
            onOrderChanged={(item) => setLatest((prev) => [item, ...(prev ?? []).filter((p) => p.request_type !== 'content')])}
          />
        </div>
      ) : kind === 'genlink' ? (
        <div className="space-y-2 rounded-xl border border-border/70 p-3" data-testid="so-order-genlink">
          {/* ฟอร์ม Gen link พับไว้ กดกางค่อยใช้ (เจ้าของ 4 พ.ย. 2569 "ย่อไว้กดกางออกค่อยให้ทำงานได้") */}
          <JobApplyLinks job={job} onChanged={onLinksChanged} />
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-border/70 p-3" data-testid="so-order-scrap-form">
          {/* ค้าง = บอกเหตุ + ส่งอีกครั้ง / ยกเลิกแล้วสั่งใหม่ · กำลังทำ = รอ (เจ้าของ 4 พ.ย. 2569 ฉบับ 9) */}
          {scraping?.status === 'pending' ? (
            <SoStuckPanel
              order={scraping}
              onCancelled={(item) => setLatest((prev) => [item, ...(prev ?? []).filter((p) => p.request_type !== 'scraping')])}
            />
          ) : scrapOpen ? (
            <p className={cn('rounded-xl border px-3 py-2 text-sm', TONE.warn.soft)} data-testid="so-scrap-open-order">
              So Scraping กำลัง Scrap ใบนี้อยู่ — รอให้เสร็จก่อนถึงสั่งใหม่ได้
            </p>
          ) : null}

          <section className="space-y-1">
            <p className="text-sm font-medium text-foreground">1 · บัญชี JobThai / JobBKK</p>
            {scrapeAccounts === null && !scrapeError ? <p className={cn('text-xs', DASH.muted)}>กำลังโหลดบัญชี…</p> : null}
            {scrapeError ? <p className={cn('text-xs', TONE.danger.value)}>{scrapeError}</p> : null}
            {scrapeAccounts && scrapeAccounts.length === 0 ? (
              <p className={cn('text-xs', DASH.muted)}>ยังไม่มีบัญชีจาก So Scraping — ระบบเลือกบัญชีให้เองตอนเริ่มงาน</p>
            ) : null}
            {scrapeAccounts && scrapeAccounts.length > 0 ? (
              <FieldSelect
                value={scrapeId}
                onChange={(v) => {
                  setScrapeId(v);
                  setConfirmText(null);
                }}
                placeholder="เลือกบัญชี"
                ariaLabel="บัญชี JobThai/JobBKK"
                testId="so-scrape-account"
                options={scrapeAccounts.map((s) => {
                  // คำสถานะ + สี (แบบเดียวกับบัญชี Facebook) · พักชั่วคราว/ปิดใช้งาน = เลือกไม่ได้
                  const c = soScrapeChoice(s);
                  return { value: s.id, label: c.label, disabled: c.disabled, className: TONE[c.tone].value };
                })}
              />
            ) : null}
          </section>

          <section className="space-y-1">
            <Label htmlFor={`so-scrape-target-${job.id}`} className="text-sm font-medium text-foreground">
              2 · จำนวนคนที่ต้องการ
            </Label>
            <Input
              id={`so-scrape-target-${job.id}`}
              type="text"
              inputMode="numeric"
              value={targetText}
              onChange={(e) => setTargetText(e.target.value)}
              className="w-32 tabular-nums"
              data-testid="so-scrape-target"
            />
            <p className={cn('text-xs', DASH.muted)}>
              {[
                jobQtyOf(job) !== null ? `ใบขอนี้เหลือหา ${NUM.format(jobQtyOf(job)!)} อัตรา` : 'ใบขอนี้ไม่ระบุจำนวน',
                scrapeMax !== null ? `${soPlatformLabel(scrapeAccount?.platform ?? '')} วันนี้เหลือโควต้า ${NUM.format(scrapeMax)} คน` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </section>

          <section className="space-y-1">
            <p className="text-sm font-medium text-foreground">3 · เครื่อง</p>
            <FieldSelect
              value={scrapeWorker}
              onChange={(v) => {
                setScrapeWorker(v);
                setConfirmText(null);
              }}
              ariaLabel="เครื่องที่ Scrap"
              testId="so-scrape-worker"
              options={[
                { value: AUTO_WORKER, label: 'ให้ระบบเลือก' },
                ...scrapeWorkers.map((w) => ({
                  value: w.name,
                  label: `${w.name} · ${w.online ? 'ออนไลน์' : soWorkerOfflineText(w)} · งาน Scrap ค้าง ${NUM.format(w.scrapeQueue.running + w.scrapeQueue.queued)}`,
                  className: w.online ? undefined : TONE.warn.value,
                })),
              ]}
            />
          </section>

          {lastScrap ? <SoStartLine requestId={lastScrap.id} initial={lastScrap.so_start} /> : null}
          {!scrapOpen && scrapProblems.length > 0 ? (
            <ul className={cn('space-y-0.5 text-xs', TONE.warn.value)} data-testid="so-scrap-problems">
              {scrapProblems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
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
          {error ? (
            <p role="alert" className={cn('text-xs', TONE.danger.value)}>
              {error}
            </p>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={latest === null || scrapOpen || scrapProblems.length > 0 || busy}
            onClick={() => void scrap()}
            data-testid="so-order-scrap"
          >
            {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <Search aria-hidden />}
            {busy ? 'กำลังส่ง…' : scraping?.status === 'rejected' || scraping?.status === 'cancelled' ? 'สั่งใหม่' : 'ขอ Scrap'}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * กล่องสั่งงานแบบพับ — ตอนเปิดเห็นแค่หัวกล่อง กดแล้วค่อยกางให้เลือกว่าจะทำอะไร
 * (เจ้าของ 4 พ.ย. 2569 หน้าใบขอ "ย่อไว้ พอกดค่อยกางออกมาแล้วค่อยเลือก" → ป๊อปประกาศ "ทำเหมือนกับตรงหน้าใบขอ")
 * พับอยู่ = ยังไม่โหลดบัญชี/กลุ่มของ So Scraping · ป๊อปจากปุ่ม Autopost บนการ์ดไม่พับ (กดมาเพื่อสั่งอยู่แล้ว)
 */
export function OrderPostFold({ className, ...props }: React.ComponentProps<typeof OrderPostButton> & { className?: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className={cn('space-y-3', className)} data-testid="order-post-fold">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-9 w-full items-center gap-1.5 text-left text-sm font-medium"
        data-testid="order-post-toggle"
      >
        <Megaphone className={cn('h-4 w-4', TONE.primary.value)} aria-hidden />
        {props.withGenLink ? 'Autopost / Scrap / Gen link' : 'Autopost / Scrap'}
        <ChevronDown className={cn('ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open ? <OrderPostButton {...props} /> : null}
    </div>
  );
}
