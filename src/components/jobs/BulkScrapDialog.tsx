/**
 * ═══ ป๊อป "Scrap ทั้งหน้า" บนหน้าใบขอ (เจ้าของ 23 พ.ย. 2569) ═══
 * > "หน้าใบขอ ให้ Scraping ทีเดียวได้ทั้งหน้า โดยสามารถระบุได้ว่าจะเอาใบขอละกี่ Resume
 * >  พอเลือกแล้วก็เอาเด้ง Pop up ให้เลือกเหมือนเวลา Scrap ปกติ"
 *
 * ข้อ 1-2-3 เหมือนป๊อป Scrap ของใบเดียว (`OrderPostButton`): บัญชี JobThai/JobBKK · ใบละกี่ Resume · เครื่อง
 * ใบในหน้านี้ = แถวที่ตารางแสดงอยู่ (ตัวกรอง + หน้าที่เปิด) · ใบที่สั่งไม่ได้ขึ้นเหตุผลแล้วข้าม (`bulkScrapRows`)
 * ส่งทีละใบผ่านเส้นเดียวกับปุ่มใบเดียว (`createJobPostingRequest`) ในชื่อคนที่ล็อกอิน · ใบไหนไม่สำเร็จบอกรายใบ ใบอื่นไปต่อ
 */
import React from 'react';
import { LoaderCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FieldSelect } from '@/components/shared/FieldSelect';
import { useOptionalAuthUser } from '@/contexts/AuthContext';
import { actorNameOf } from '@/lib/actorName';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import type { JobRequest } from '@/types';
import { publicJobTitle } from '@/lib/publicJobTitle';
import { jobBoardCardTitle } from '@/lib/unitRequestDisplay';
import { createJobPostingRequest, fetchBoardJobPostings, fetchSoOptions, type JobPostingRequest } from '@/lib/jobPostingRequestsApi';
import {
  SO_SCRAP_REASON,
  soDefaultScrapeAccount,
  soDefaultWorker,
  soPlatformLabel,
  soScrapConfirmWarnings,
  soScrapSnapshot,
  soScrapeChoice,
  soScrapeRemaining,
  soScrapeSelectable,
  soWorkerOfflineText,
  soWorkersFor,
  type SoOptWorker,
  type SoScrapeAccount,
} from '@/lib/soScraping';
import { bulkScrapProblems, bulkScrapRows, defaultPerRequest, parsePerRequest } from '@/lib/bulkScrap';

const AUTO_WORKER = '__auto__';
const NUM = new Intl.NumberFormat('th-TH');

type SendResult = { ok: true } | { ok: false; message: string };

export default function BulkScrapDialog({
  open,
  onOpenChange,
  jobs,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** ใบที่ตารางแสดงอยู่ตอนกดปุ่ม */
  jobs: readonly JobRequest[];
  /** ส่งเสร็จแล้ว (อย่างน้อยหนึ่งใบ) — หน้าแม่โหลดยอด Scrap ใหม่ */
  onSent?: () => void;
}) {
  const actor = actorNameOf(useOptionalAuthUser());
  const [latest, setLatest] = React.useState<JobPostingRequest[] | null>(null);
  const [latestError, setLatestError] = React.useState<string | null>(null);
  const [accounts, setAccounts] = React.useState<SoScrapeAccount[] | null>(null);
  const [accountsError, setAccountsError] = React.useState<string | null>(null);
  const [accountId, setAccountId] = React.useState('');
  const [workers, setWorkers] = React.useState<SoOptWorker[]>([]);
  const [worker, setWorker] = React.useState(AUTO_WORKER);
  const [perText, setPerText] = React.useState('');
  const [confirmText, setConfirmText] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [results, setResults] = React.useState<Record<string, SendResult>>({});
  /** ใบที่เปิดป๊อปมา — ตรึงไว้ ตารางข้างหลังเปลี่ยนหน้า/รีเฟรชระหว่างส่งก็ไม่สลับใบ */
  const [frozen, setFrozen] = React.useState<readonly JobRequest[]>([]);

  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    setFrozen(jobs);
    setResults({});
    setConfirmText(null);
    setLatest(null);
    setLatestError(null);
    setAccounts(null);
    setAccountsError(null);
    setPerText('');
    fetchBoardJobPostings()
      .then((list) => alive && setLatest(list))
      .catch((e) => alive && setLatestError(e instanceof Error ? e.message : 'โหลดสถานะ Scrap ไม่ได้'));
    fetchSoOptions()
      .then((o) => {
        if (!alive) return;
        setAccounts(o.scrapeAccounts);
        setAccountId(soDefaultScrapeAccount(o.scrapeAccounts)?.id ?? '');
        const ws = soWorkersFor(o, 'scraper');
        setWorkers(ws);
        setWorker(soDefaultWorker(ws, 'scrape')?.name ?? AUTO_WORKER);
      })
      .catch((e) => alive && setAccountsError(e instanceof Error ? e.message : 'โหลดบัญชี JobThai/JobBKK ไม่ได้'));
    return () => {
      alive = false;
    };
    // เปิดป๊อปครั้งหนึ่ง = ตรึงใบชุดนั้น · jobs ที่เปลี่ยนระหว่างเปิดไม่ต้องโหลดใหม่
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const rows = React.useMemo(() => (latest ? bulkScrapRows(frozen, latest) : []), [frozen, latest]);
  const ready = rows.filter((r) => r.skip === null);
  const account = accounts?.find((a) => a.id === accountId) ?? null;
  const remaining = account ? soScrapeRemaining(account) : null;

  // ค่าเริ่ม "ใบละกี่ Resume" ตั้งครั้งเดียวเมื่อรู้จำนวนใบกับโควต้าแล้ว — คนสั่งแก้ได้
  React.useEffect(() => {
    if (!open || latest === null || accounts === null || perText !== '') return;
    setPerText(String(defaultPerRequest(remaining, ready.length)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, latest, accounts]);

  const per = parsePerRequest(perText);
  const sentAny = Object.values(results).some((r) => r.ok);
  const problems = bulkScrapProblems({
    ready: ready.length,
    perRequest: per,
    remaining,
    accountMissing: (accounts?.length ?? 0) > 0 && !account,
    accountBlocked: account && !soScrapeSelectable(account.status) ? soScrapeChoice(account).label : null,
  });

  const send = async (confirmed = false) => {
    if (busy || problems.length > 0 || per === null) return;
    const workerRow = workers.find((w) => w.name === worker) ?? null;
    const warnings = soScrapConfirmWarnings(account ? [account] : [], workerRow);
    if (!confirmed && warnings.length > 0) {
      setConfirmText(warnings.join(' · '));
      return;
    }
    setConfirmText(null);
    setBusy(true);
    let okCount = 0;
    for (const { job } of ready) {
      if (results[job.id]?.ok) continue;
      try {
        await createJobPostingRequest({
          jobId: job.id,
          requestNo: job.request_no,
          reason: SO_SCRAP_REASON,
          requestType: 'scraping',
          jobSnapshot: {
            ...soScrapSnapshot(job, publicJobTitle(job)),
            ...(account ? { scrape_connector_ids: [account.id] } : {}),
            scrape_target: per,
            ...(worker !== AUTO_WORKER ? { scrape_worker: worker } : {}),
          },
        });
        okCount += 1;
        setResults((prev) => ({ ...prev, [job.id]: { ok: true } }));
      } catch (e) {
        setResults((prev) => ({ ...prev, [job.id]: { ok: false, message: e instanceof Error ? e.message : 'ขอ Scrap ไม่สำเร็จ' } }));
      }
    }
    setBusy(false);
    if (okCount > 0) onSent?.();
  };

  const loading = latest === null && !latestError;
  const doneAll = ready.length > 0 && ready.every((r) => results[r.job.id]?.ok);

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" data-testid="bulk-scrap-dialog">
        <DialogHeader>
          <DialogTitle>Scrap ทั้งหน้า</DialogTitle>
          <DialogDescription>
            ใบขอหน้านี้ {NUM.format(frozen.length)} ใบ · สั่งได้ {loading ? '…' : NUM.format(ready.length)} ใบ
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section className="space-y-1">
            <p className="text-sm font-medium text-foreground">1 · บัญชี JobThai / JobBKK</p>
            {accounts === null && !accountsError ? <p className={cn('text-xs', DASH.muted)}>กำลังโหลดบัญชี…</p> : null}
            {accountsError ? <p className={cn('text-xs', TONE.danger.value)}>{accountsError}</p> : null}
            {accounts && accounts.length === 0 ? (
              <p className={cn('text-xs', DASH.muted)}>ยังไม่มีบัญชีจาก So Scraping — ระบบเลือกบัญชีให้เองตอนเริ่มงาน</p>
            ) : null}
            {accounts && accounts.length > 0 ? (
              <FieldSelect
                value={accountId}
                onChange={(v) => {
                  setAccountId(v);
                  setConfirmText(null);
                }}
                placeholder="เลือกบัญชี"
                ariaLabel="บัญชี JobThai/JobBKK"
                testId="bulk-scrap-account"
                options={accounts.map((s) => {
                  const c = soScrapeChoice(s);
                  return { value: s.id, label: c.label, disabled: c.disabled, className: TONE[c.tone].value };
                })}
              />
            ) : null}
          </section>

          <section className="space-y-1">
            <Label htmlFor="bulk-scrap-per" className="text-sm font-medium text-foreground">
              2 · ใบละกี่ Resume
            </Label>
            <Input
              id="bulk-scrap-per"
              type="text"
              inputMode="numeric"
              value={perText}
              onChange={(e) => setPerText(e.target.value)}
              className="w-32 tabular-nums"
              data-testid="bulk-scrap-per"
            />
            <p className={cn('text-xs tabular-nums', DASH.muted)} data-testid="bulk-scrap-total">
              {[
                per !== null ? `${NUM.format(ready.length)} ใบ × ${NUM.format(per)} = ${NUM.format(ready.length * per)} คน` : null,
                remaining !== null ? `${soPlatformLabel(account?.platform ?? '')} วันนี้เหลือโควต้า ${NUM.format(remaining)} คน` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </section>

          <section className="space-y-1">
            <p className="text-sm font-medium text-foreground">3 · เครื่อง</p>
            <FieldSelect
              value={worker}
              onChange={(v) => {
                setWorker(v);
                setConfirmText(null);
              }}
              ariaLabel="เครื่องที่ Scrap"
              testId="bulk-scrap-worker"
              options={[
                { value: AUTO_WORKER, label: 'ให้ระบบเลือก' },
                ...workers.map((w) => ({
                  value: w.name,
                  label: `${w.name} · ${w.online ? 'ออนไลน์' : soWorkerOfflineText(w)} · งาน Scrap ค้าง ${NUM.format(w.scrapeQueue.running + w.scrapeQueue.queued)}`,
                  className: w.online ? undefined : TONE.warn.value,
                })),
              ]}
            />
          </section>

          <section className="space-y-1">
            <p className="text-sm font-medium text-foreground">ใบขอหน้านี้</p>
            {latestError ? <p className={cn('text-xs', TONE.danger.value)}>{latestError}</p> : null}
            <div className="overflow-x-auto rounded-xl border">
              <Table data-testid="bulk-scrap-rows">
                <TableHeader>
                  <TableRow>
                    <TableHead>ใบขอ</TableHead>
                    <TableHead className="w-48">สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {frozen.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className={cn('text-center text-sm', DASH.muted)}>
                        ไม่มีใบขอในหน้านี้
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {frozen.map((job) => {
                    const row = rows.find((r) => r.job.id === job.id);
                    const res = results[job.id];
                    return (
                      <TableRow key={job.id} data-testid="bulk-scrap-row">
                        <TableCell className="text-sm">
                          <span className="font-medium text-foreground">{job.request_no || '—'}</span>
                          <span className={cn('block text-xs', DASH.muted)}>{jobBoardCardTitle(job)}</span>
                        </TableCell>
                        <TableCell className="text-xs">
                          {loading ? (
                            <span className={DASH.muted}>กำลังโหลด…</span>
                          ) : res?.ok ? (
                            <Badge variant="outline" className={TONE.success.outline}>
                              ส่งแล้ว
                            </Badge>
                          ) : res && 'message' in res ? (
                            <span className={TONE.danger.value}>ไม่สำเร็จ: {res.message}</span>
                          ) : row?.skip ? (
                            <span className={TONE.warn.value}>ข้าม: {row.skip}</span>
                          ) : (
                            <span className={DASH.sub}>สั่งได้</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </section>

          {!doneAll && problems.length > 0 && !loading ? (
            <ul className={cn('space-y-0.5 text-xs', TONE.warn.value)} data-testid="bulk-scrap-problems">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
          {confirmText ? (
            <div role="alert" aria-label="คำเตือนจาก So Scraping" className={cn('space-y-2 rounded-xl border px-3 py-2', TONE.warn.soft)} data-testid="bulk-scrap-warn">
              <p className="text-sm text-foreground">{confirmText}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => void send(true)} disabled={busy}>
                  ส่งต่อ
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setConfirmText(null)}>
                  เลือกบัญชีอื่น
                </Button>
              </div>
            </div>
          ) : null}
          <p className={cn('text-xs', DASH.sub)}>จะบันทึกในชื่อ {actor}</p>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {sentAny ? 'ปิด' : 'ยกเลิก'}
          </Button>
          <Button type="button" onClick={() => void send()} disabled={loading || busy || doneAll || problems.length > 0} data-testid="bulk-scrap-send">
            {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <Search aria-hidden />}
            {busy ? 'กำลังส่ง…' : doneAll ? 'ส่งครบแล้ว' : sentAny ? 'ส่งใบที่ยังไม่สำเร็จ' : `ขอ Scrap ${NUM.format(ready.length)} ใบ`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
