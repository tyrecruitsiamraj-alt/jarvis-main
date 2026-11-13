/**
 * ป๊อป "ทำอะไรไปแล้ว" ของใบขอ (เจ้าของ 13 พ.ย. 2569 "พอกดเข้าไปก็ดูแยกได้ว่าของใบนี้ใครเคยส่งไปบ้าง มีกลุ่มไหนบ้าง
 * เก็บ link มาแบบหน้าภาพรวมตรงโพสต์ลงกลุ่ม Facebook") — แท็บ Autopost (รายกลุ่มจาก So Scraping) · โพสต์เอง (ลิงก์) · Scrap (คำสั่ง)
 * อ่านอย่างเดียว · สีป้ายสถานะตัวเดียวกับการ์ดหน้าภาพรวม (`SO_POST_STATUS_TONE`)
 */
import { useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SO_POST_STATUS_TONE } from '@/components/dashboard-trends/stuck/SoPostGroupsCard';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { formatDateTimeTh } from '@/lib/dateTh';
import { soStatusView, soStuckLine } from '@/lib/soScraping';
import { fetchJobPostActionsDetail, type JobPostActionsDetail } from '@/lib/jobPostActionsApi';
import type { BoardActionTab } from './BoardCardActions';
import { postGroupBuckets } from '@/lib/jobPostActions';

const PAGE = 10;
const th = (n: number) => n.toLocaleString('th-TH');

export default function JobPostActionsDialog({
  job,
  tab,
  onTabChange,
  onClose,
}: {
  job: { id: string; title: string } | null;
  tab: BoardActionTab;
  onTabChange: (t: BoardActionTab) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={job !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{job ? `${job.title} · ทำอะไรไปแล้ว` : 'ทำอะไรไปแล้ว'}</DialogTitle>
        </DialogHeader>
        {job ? <JobPostActionsPanel jobId={job.id} tab={tab} onTabChange={onTabChange} /> : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * เนื้อ "ทำอะไรไปแล้ว" ของใบเดียว — ใช้ทั้งป๊อปบนการ์ดและแท็บของหน้าใบขอ (เจ้าของ 13 พ.ย. 2569 "ย้ายไปเป็นอีกแท็บ …
 * เอาทำอะไรไปแล้วโชว์ด้วย เพื่อจะได้บอกได้ว่ายอดอะไรยังไงบ้าง") · 3 กล่องบนสุด = ยอดสรุป + เป็นตัวสลับแท็บ
 * `reloadKey` เปลี่ยน = โหลดใหม่ (หลังสั่งงานจากฟอร์มข้างบน)
 */
export function JobPostActionsPanel({
  jobId,
  tab,
  onTabChange,
  reloadKey,
}: {
  jobId: string;
  tab: BoardActionTab;
  onTabChange: (t: BoardActionTab) => void;
  reloadKey?: unknown;
}) {
  const [d, setD] = useState<JobPostActionsDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusPick, setStatusPick] = useState<string | null>(null);
  /** โพสต์เองแยก 2 แท็บ (เจ้าของ 13 พ.ย. 2569 "พอกดไปเจอ 2 แท็บมี genlink กับ โพสต์") — Gen link = ยังไม่มีลิงก์โพสต์ · โพสต์ = มีลิงก์โพสต์ */
  const [manualPick, setManualPick] = useState<'gen' | 'posted'>('gen');

  useEffect(() => {
    setD(null);
    setError(null);
    setStatusPick(null);
    setManualPick('gen');
    let alive = true;
    fetchJobPostActionsDetail(jobId)
      .then((v) => alive && setD(v))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'โหลดไม่ได้'));
    return () => {
      alive = false;
    };
  }, [jobId, reloadKey]);
  useEffect(() => setPage(1), [tab, statusPick, manualPick, jobId]);

  const groups = d?.groups;
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of groups?.rows ?? []) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [groups]);
  const groupRows = useMemo(() => (groups?.rows ?? []).filter((r) => !statusPick || r.status === statusPick), [groups, statusPick]);
  const manualAll = useMemo(() => (d?.links ?? []).filter((l) => l.origin === 'manual'), [d]);
  const manualGen = useMemo(() => manualAll.filter((l) => !l.post_url), [manualAll]);
  const manualPosted = useMemo(() => manualAll.filter((l) => l.post_url), [manualAll]);
  const manualLinks = manualPick === 'posted' ? manualPosted : manualGen;
  const scrapOrders = useMemo(() => (d?.orders ?? []).filter((o) => o.request_type === 'scraping'), [d]);
  const list = tab === 'autopost' ? groupRows : tab === 'manual' ? manualLinks : scrapOrders;
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const slice = <T,>(xs: readonly T[]) => xs.slice((page - 1) * PAGE, page * PAGE);

  const latestScrap = scrapOrders[0] ? soStatusView(scrapOrders[0]) : null;
  const b = d ? postGroupBuckets(groups?.rows.length ?? 0, counts) : null;
  /** 3 กล่องสรุป = แท็บ · กดกล่องไหนตารางข้างล่างเป็นของกล่องนั้น */
  const boxes: Array<{ key: BoardActionTab; title: string; right: string; sub: string }> = d
    ? [
        {
          key: 'autopost',
          title: 'Autopost',
          right: d.summary.autopost.orders === 0 ? 'ยังไม่สั่ง' : `สั่ง ${th(d.summary.autopost.orders)} ครั้ง · ${th(groups?.rows.length ?? 0)} กลุ่ม`,
          sub: b ? `เผยแพร่แล้ว ${th(b.posted)} · รอ ${th(b.waiting)} · ไม่สำเร็จ ${th(b.failed)} · คลิก ${th(d.summary.autopost.clicks)} · กรอก ${th(d.summary.autopost.applicants)}` : '',
        },
        {
          key: 'manual',
          title: 'โพสต์เอง',
          right: d.summary.manual.links === 0 ? 'ยังไม่มีลิงก์' : `${th(d.summary.manual.links)} ลิงก์`,
          // โพสต์แล้ว = มีลิงก์โพสต์ · Gen link = ยังไม่มี (13 พ.ย. 2569)
          sub: `โพสต์แล้ว ${th(d.summary.manual.posted)} · Gen link ${th(d.summary.manual.links - d.summary.manual.posted)} · คลิก ${th(d.summary.manual.clicks)} · กรอก ${th(d.summary.manual.applicants)}`,
        },
        {
          key: 'scrap',
          title: 'Scrap',
          right: d.summary.scrap.orders === 0 ? 'ยังไม่สั่ง' : `สั่ง ${th(d.summary.scrap.orders)} ครั้ง`,
          sub: latestScrap ? `ล่าสุด ${latestScrap.label}` : '',
        },
      ]
    : [];

  return (
    <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3" role="tablist" data-testid="job-actions-boxes">
          {boxes.map((x) => (
            <Button
              key={x.key}
              type="button"
              role="tab"
              variant="ghost"
              aria-selected={tab === x.key}
              onClick={() => onTabChange(x.key)}
              className={cn(
                'h-auto flex-col items-stretch gap-1 rounded-xl border px-3 py-2 text-left font-normal',
                tab === x.key ? 'border-primary bg-primary/5 hover:bg-primary/10' : 'border-border bg-card hover:bg-muted/60',
              )}
            >
              <span className="text-sm font-medium text-foreground">{x.title}</span>
              <span className="whitespace-normal text-xs tabular-nums text-foreground">{x.right}</span>
              <span className="min-h-4 whitespace-normal text-xs tabular-nums text-muted-foreground">{x.sub}</span>
            </Button>
          ))}
        </div>

        {error ? <p className={cn('text-sm', TONE.warn.value)}>{error}</p> : !d ? <p className={cn('text-sm', DASH.sub)}>กำลังโหลด…</p> : null}

        {d && tab === 'autopost' ? (
          <div className="space-y-3">
            {groups?.error ? <p className={cn('text-sm', TONE.warn.value)}>ดึงผลจาก So Scraping ไม่ได้: {groups.error}</p> : null}
            {/* ช่องสถานะ — คำ/ลำดับจาก So Scraping · กดกรองตาราง กดซ้ำกลับทั้งหมด (แบบเดียวกับการ์ดหน้าภาพรวม) */}
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-5" data-testid="job-actions-status">
              {[{ key: null as string | null, label: 'สั่งทั้งหมด', n: groups?.rows.length ?? 0 }, ...(groups?.statuses ?? []).map((st) => ({ key: st.key as string | null, label: st.label, n: counts[st.key] ?? 0 }))].map((c) => {
                const active = statusPick === c.key;
                const tone = c.key ? SO_POST_STATUS_TONE[c.key] : undefined;
                return (
                  <Button
                    key={c.key ?? 'all'}
                    type="button"
                    variant="ghost"
                    aria-pressed={active}
                    onClick={() => setStatusPick(c.key && !active ? c.key : null)}
                    className={cn('h-full flex-col items-start justify-between gap-0.5 rounded-none px-3 py-2 text-left font-normal', active ? 'bg-muted hover:bg-muted' : 'bg-card')}
                  >
                    <span className="text-xs text-muted-foreground">{c.label}</span>
                    <span className={cn('text-lg font-medium tabular-nums', c.n > 0 && tone ? TONE[tone].value : 'text-foreground')}>{th(c.n)}</span>
                  </Button>
                );
              })}
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[48rem]">
                <TableHeader>
                  <TableRow className={DASH.tableHead}>
                    <TableHead className="whitespace-nowrap text-xs">วันที่สั่ง</TableHead>
                    <TableHead className="text-xs">คนสั่ง</TableHead>
                    <TableHead className="text-xs">บัญชี</TableHead>
                    <TableHead className="text-xs">กลุ่ม</TableHead>
                    <TableHead className="text-xs">สถานะ</TableHead>
                    <TableHead className="text-xs">ลิงก์ / เหตุ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className={cn('py-6 text-center text-sm', DASH.sub)}>
                        ยังไม่มีการโพสต์ลงกลุ่ม
                      </TableCell>
                    </TableRow>
                  ) : (
                    slice(groupRows).map((r, i) => {
                      const tone = TONE[SO_POST_STATUS_TONE[r.status] ?? 'neutral'];
                      return (
                        <TableRow key={`${r.fbGroupId}-${r.orderedAt}-${i}`} data-testid="job-actions-group-row">
                          <TableCell className="whitespace-nowrap text-xs tabular-nums">{formatDateTimeTh(r.orderedAt)}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{r.orderedByName ?? '—'}</TableCell>
                          <TableCell className="text-sm">{r.account ?? '—'}</TableCell>
                          <TableCell className="max-w-64 text-sm">{r.groupName ?? r.fbGroupId ?? '—'}</TableCell>
                          <TableCell className="text-xs">
                            <span className={cn('inline-block whitespace-nowrap rounded-full border px-2 py-0.5 font-medium', tone.soft, tone.value)}>{r.statusLabel}</span>
                          </TableCell>
                          <TableCell className="max-w-64 text-xs">
                            {r.postLink ? (
                              <Button asChild type="button" size="xs" variant="outline">
                                <a href={r.postLink} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink aria-hidden /> เปิดดูโพสต์
                                </a>
                              </Button>
                            ) : (
                              <span className={DASH.sub}>{r.error ?? '—'}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}

        {d && tab === 'manual' ? (
          <div className="space-y-3">
            {/* 2 แท็บ: Gen link (ยังไม่มีลิงก์โพสต์) · โพสต์ (มีลิงก์โพสต์ กดเปิดดูโพสต์) — สองแท็บรวม = ลิงก์ทั้งหมด */}
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border" role="tablist" data-testid="job-actions-manual-tabs">
              {(
                [
                  { key: 'gen', label: 'Gen link', n: manualGen.length },
                  { key: 'posted', label: 'โพสต์', n: manualPosted.length },
                ] as const
              ).map((c) => (
                <Button
                  key={c.key}
                  type="button"
                  role="tab"
                  variant="ghost"
                  aria-selected={manualPick === c.key}
                  onClick={() => setManualPick(c.key)}
                  className={cn('h-full flex-col items-start gap-0.5 rounded-none px-3 py-2 text-left font-normal', manualPick === c.key ? 'bg-muted hover:bg-muted' : 'bg-card')}
                  data-testid={`job-actions-manual-${c.key}`}
                >
                  <span className={cn('text-xs', manualPick === c.key ? 'font-medium text-foreground' : 'text-muted-foreground')}>{c.label}</span>
                  <span className={cn('text-lg font-medium tabular-nums', c.n > 0 && c.key === 'posted' ? TONE.success.value : 'text-foreground')}>{th(c.n)}</span>
                </Button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[44rem]">
                <TableHeader>
                  <TableRow className={DASH.tableHead}>
                    <TableHead className="whitespace-nowrap text-xs">วันที่สร้าง</TableHead>
                    <TableHead className="text-xs">ช่องทาง / กลุ่ม</TableHead>
                    <TableHead className="text-right text-xs">คลิก</TableHead>
                    <TableHead className="text-right text-xs">กรอก</TableHead>
                    <TableHead className="text-xs">{manualPick === 'posted' ? 'โพสต์' : 'ลิงก์สมัคร'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manualLinks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className={cn('py-6 text-center text-sm', DASH.sub)}>
                        {manualPick === 'posted' ? 'ยังไม่มีกลุ่มที่วางลิงก์โพสต์' : 'ไม่มี Gen link ที่ยังไม่ได้วางลิงก์โพสต์'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    slice(manualLinks).map((l) => (
                      <TableRow key={l.id} data-testid="job-actions-link-row">
                        <TableCell className="whitespace-nowrap text-xs tabular-nums">{formatDateTimeTh(l.created_at)}</TableCell>
                        <TableCell className="max-w-80 text-sm">{l.channel_label ?? '—'}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{th(l.clicks)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{th(l.applicants)}</TableCell>
                        <TableCell className="text-xs" data-testid="job-actions-post-cell">
                          {manualPick === 'posted' && l.post_url ? (
                            <Button asChild type="button" size="xs" variant="outline">
                              <a href={l.post_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink aria-hidden /> เปิดดูโพสต์
                              </a>
                            </Button>
                          ) : (
                            <Button asChild type="button" size="xs" variant="outline">
                              <a href={`/apply/p/${l.code}`} target="_blank" rel="noopener noreferrer">
                                <ExternalLink aria-hidden /> เปิดลิงก์สมัคร
                              </a>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}

        {d && tab === 'scrap' ? (
          <div className="overflow-x-auto">
            <Table className="min-w-[36rem]">
              <TableHeader>
                <TableRow className={DASH.tableHead}>
                  <TableHead className="whitespace-nowrap text-xs">วันที่สั่ง</TableHead>
                  <TableHead className="text-xs">คนสั่ง</TableHead>
                  <TableHead className="text-xs">สถานะ</TableHead>
                  <TableHead className="text-xs">เหตุ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scrapOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className={cn('py-6 text-center text-sm', DASH.sub)}>
                      ยังไม่เคยสั่ง Scrap
                    </TableCell>
                  </TableRow>
                ) : (
                  slice(scrapOrders).map((o, i) => {
                    const v = soStatusView(o);
                    return (
                      <TableRow key={`${o.created_at}-${i}`} data-testid="job-actions-scrap-row">
                        <TableCell className="whitespace-nowrap text-xs tabular-nums">{formatDateTimeTh(o.created_at)}</TableCell>
                        <TableCell className="text-sm">{o.requested_by_name ?? '—'}</TableCell>
                        <TableCell className="text-xs">
                          <span className={cn('inline-block whitespace-nowrap rounded-full border px-2 py-0.5 font-medium', TONE[v.tone].outline)}>{v.label}</span>
                        </TableCell>
                        <TableCell className={cn('text-xs', DASH.sub)}>{soStuckLine(o) ?? '—'}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {d ? (
          <div className="flex items-center justify-between gap-2">
            <p className={cn('text-xs tabular-nums', DASH.sub)}>
              หน้า {th(page)} จาก {th(pages)} · ทั้งหมด {th(list.length)}
            </p>
            <div className="flex items-center gap-1">
              <Button type="button" size="xs" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ก่อนหน้า
              </Button>
              <Button type="button" size="xs" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                ถัดไป
              </Button>
            </div>
          </div>
        ) : null}
    </div>
  );
}
