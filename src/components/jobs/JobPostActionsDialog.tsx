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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SO_POST_STATUS_TONE } from '@/components/dashboard-trends/stuck/SoPostGroupsCard';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { formatDateTimeTh } from '@/lib/dateTh';
import { soStatusView, soStuckLine } from '@/lib/soScraping';
import { fetchJobPostActionsDetail, type JobPostActionsDetail } from '@/lib/jobPostActionsApi';
import type { BoardActionTab } from './BoardCardActions';

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
  const [d, setD] = useState<JobPostActionsDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusPick, setStatusPick] = useState<string | null>(null);

  useEffect(() => {
    setD(null);
    setError(null);
    setStatusPick(null);
    if (!job) return;
    let alive = true;
    fetchJobPostActionsDetail(job.id)
      .then((v) => alive && setD(v))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'โหลดไม่ได้'));
    return () => {
      alive = false;
    };
  }, [job]);
  useEffect(() => setPage(1), [tab, statusPick, job]);

  const groups = d?.groups;
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of groups?.rows ?? []) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [groups]);
  const groupRows = useMemo(() => (groups?.rows ?? []).filter((r) => !statusPick || r.status === statusPick), [groups, statusPick]);
  const manualLinks = useMemo(() => (d?.links ?? []).filter((l) => l.origin === 'manual'), [d]);
  const scrapOrders = useMemo(() => (d?.orders ?? []).filter((o) => o.request_type === 'scraping'), [d]);
  const list = tab === 'autopost' ? groupRows : tab === 'manual' ? manualLinks : scrapOrders;
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const slice = <T,>(xs: readonly T[]) => xs.slice((page - 1) * PAGE, page * PAGE);

  return (
    <Dialog open={job !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{job ? `${job.title} · ทำอะไรไปแล้ว` : 'ทำอะไรไปแล้ว'}</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => onTabChange(v as BoardActionTab)}>
          <TabsList>
            <TabsTrigger value="autopost">Autopost{d ? ` ${th(groups?.rows.length ?? 0)} กลุ่ม` : ''}</TabsTrigger>
            <TabsTrigger value="manual">โพสต์เอง{d ? ` ${th(manualLinks.length)} ลิงก์` : ''}</TabsTrigger>
            <TabsTrigger value="scrap">Scrap{d ? ` ${th(scrapOrders.length)}` : ''}</TabsTrigger>
          </TabsList>
        </Tabs>

        {error ? <p className={cn('text-sm', TONE.warn.value)}>{error}</p> : !d ? <p className={cn('text-sm', DASH.sub)}>กำลังโหลด…</p> : null}

        {d && tab === 'autopost' ? (
          <div className="space-y-3">
            <p className={cn('text-xs tabular-nums', DASH.sub)}>
              สั่ง {th(d.summary.autopost.orders)} ครั้ง · คลิกลิงก์ {th(d.summary.autopost.clicks)} · กรอก {th(d.summary.autopost.applicants)}
            </p>
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
            <p className={cn('text-xs tabular-nums', DASH.sub)}>
              {th(d.summary.manual.links)} ลิงก์ · คลิก {th(d.summary.manual.clicks)} · กรอก {th(d.summary.manual.applicants)}
            </p>
            <div className="overflow-x-auto">
              <Table className="min-w-[40rem]">
                <TableHeader>
                  <TableRow className={DASH.tableHead}>
                    <TableHead className="whitespace-nowrap text-xs">วันที่สร้าง</TableHead>
                    <TableHead className="text-xs">ช่องทาง / กลุ่ม</TableHead>
                    <TableHead className="text-right text-xs">คลิก</TableHead>
                    <TableHead className="text-right text-xs">กรอก</TableHead>
                    <TableHead className="text-xs">ลิงก์</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manualLinks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className={cn('py-6 text-center text-sm', DASH.sub)}>
                        ยังไม่มีลิงก์โพสต์เอง
                      </TableCell>
                    </TableRow>
                  ) : (
                    slice(manualLinks).map((l) => (
                      <TableRow key={l.id} data-testid="job-actions-link-row">
                        <TableCell className="whitespace-nowrap text-xs tabular-nums">{formatDateTimeTh(l.created_at)}</TableCell>
                        <TableCell className="max-w-80 text-sm">{l.channel_label ?? '—'}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{th(l.clicks)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{th(l.applicants)}</TableCell>
                        <TableCell className="text-xs">
                          <Button asChild type="button" size="xs" variant="outline">
                            <a href={`/apply/p/${l.code}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink aria-hidden /> เปิดลิงก์
                            </a>
                          </Button>
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
      </DialogContent>
    </Dialog>
  );
}
