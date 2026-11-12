import React from 'react';
import { ExternalLink, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { formatDateTimeTh, formatYmdTh } from '@/lib/dateTh';
import { friendlyErrorText } from '@/lib/friendlyError';
import { getVisiblePageNumbers } from '@/lib/pagination';
import { fetchSoPostGroups } from '@/lib/soPostGroupsApi';
import type { SoPostGroups } from '@/lib/soPostGroups';
import { OverviewCard } from '../RecruitOverviewParts';

/**
 * ═══ 5. โพสต์ลงกลุ่ม Facebook (เจ้าของ 11 พ.ย. 2569 · ข้อ 13 ของ JARVIS_OPTIONS_PROMPT.md ฝั่ง So Scraping) ═══
 * ใครสั่ง · บัญชีไหน · กลุ่มไหน · งานอะไร · วันที่ · ผล · ลิงก์ — ดึงจาก So Scraping ผ่าน `/api/so-post-groups` (key อยู่ฝั่ง server)
 * ช่วง/BU = ค่าที่ภาพรวมเลือกอยู่ · แถวเลข 7 ช่อง = สั่ง + 6 สถานะตามลำดับ `statuses` (ว่าง = 0) · หน้าละ 10 แถว
 * 🔴 สถานะ/เหตุใช้ตามที่ So Scraping ส่งมา ห้ามคิดเอง · ดึงไม่ได้ = การ์ดยังอยู่ บอกเหตุ + ลองใหม่
 */

/** สีป้ายตามรหัสสถานะของ So Scraping (คำบนป้ายยังเป็น `status_label` เสมอ) */
const STATUS_TONE: Record<string, keyof typeof TONE> = { posted: 'success', failed: 'danger', pending_approval: 'warn', unconfirmed: 'warn' };

export default function SoPostGroupsCard({ from, to, bu }: { from: string; to: string; bu: string | null }) {
  const [page, setPage] = React.useState(1);
  const [rev, setRev] = React.useState(0);
  const [state, setState] = React.useState<{ data: SoPostGroups | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });

  // เปลี่ยนช่วง/BU = กลับหน้าแรก
  React.useEffect(() => setPage(1), [from, to, bu]);
  React.useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, error: null, loading: true }));
    fetchSoPostGroups({ from, to, bu, page })
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((e: unknown) => alive && setState({ data: null, error: friendlyErrorText(e, 'ติดต่อ So Scraping ไม่ได้'), loading: false }));
    return () => {
      alive = false;
    };
  }, [from, to, bu, page, rev]);

  const d = state.data;
  const sub = `${formatYmdTh(from)} – ${formatYmdTh(to)} · ${bu ?? 'ทุก BU'}`;
  const cells: Array<{ key: string; label: string; n: number | null }> = d
    ? [{ key: 'total', label: 'สั่ง (กลุ่ม)', n: d.total }, ...d.statuses.map((s) => ({ key: s.key, label: s.label, n: d.counts[s.key] ?? 0 }))]
    : [];

  return (
    <OverviewCard icon={Send} title="5. โพสต์ลงกลุ่ม Facebook" sub={sub}>
      {state.error ? (
        <div className={cn('flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2', TONE.warn.soft)} data-testid="so-post-groups-error">
          <div className="min-w-0">
            <p className={cn('text-sm font-medium', TONE.warn.value)}>ดึงผลโพสต์จาก So Scraping ไม่ได้</p>
            <p className={cn('text-xs', DASH.sub)}>{state.error}</p>
          </div>
          <Button type="button" size="xs" variant="outline" onClick={() => setRev((n) => n + 1)}>
            ลองใหม่
          </Button>
        </div>
      ) : null}

      {/* แถวเลข 7 ช่อง — สั่ง = ผลรวมทุกสถานะ · ระหว่างโหลดโครงเดิม (ไม่กระโดด) */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-7" data-testid="so-post-groups-counts">
        {(cells.length ? cells : Array.from({ length: 7 }, (_, i) => ({ key: `x${i}`, label: '', n: null as number | null }))).map((c) => (
          <div key={c.key} className="min-w-0 bg-card px-3 py-2 first:col-span-2 sm:first:col-span-1">
            <p className="min-h-8 text-xs text-muted-foreground">{c.label}</p>
            <p className={cn('text-xl font-medium tabular-nums', c.n === 0 ? 'text-muted-foreground' : 'text-foreground')}>
              {c.n === null ? '—' : c.n.toLocaleString('th-TH')}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto" data-testid="so-post-groups-table">
        <Table className="min-w-[56rem]">
          <TableHeader>
            <TableRow className={DASH.tableHead}>
              <TableHead className="text-xs">คนสั่ง</TableHead>
              <TableHead className="text-xs">บัญชี</TableHead>
              <TableHead className="text-xs">กลุ่ม</TableHead>
              <TableHead className="text-xs">งาน</TableHead>
              <TableHead className="whitespace-nowrap text-xs">วันที่สั่ง</TableHead>
              <TableHead className="text-xs">สถานะ</TableHead>
              <TableHead className="text-xs">ลิงก์ / เหตุ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!d || d.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className={cn('py-6 text-center text-sm', DASH.sub)}>
                  {state.loading ? 'กำลังโหลด…' : state.error ? 'ดึงข้อมูลไม่ได้' : 'ไม่มีการสั่งโพสต์ในช่วงนี้'}
                </TableCell>
              </TableRow>
            ) : (
              d.rows.map((r, i) => (
                <TableRow key={`${r.requestNo}-${r.fbGroupId}-${i}`} data-testid="so-post-group-row">
                  <TableCell className="whitespace-nowrap text-sm">{r.orderedByName ?? '—'}</TableCell>
                  <TableCell className="text-sm">{r.account ?? '—'}</TableCell>
                  <TableCell className="max-w-56 text-sm">{r.groupName ?? r.fbGroupId ?? '—'}</TableCell>
                  <TableCell className="text-sm">
                    <span className="block whitespace-nowrap tabular-nums">{r.requestNo ?? '—'}</span>
                    {r.position ? <span className={cn('block text-xs', DASH.sub)}>{r.position}</span> : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs tabular-nums">{formatDateTimeTh(r.orderedAt)}</TableCell>
                  <TableCell className="text-xs">
                    <span className={cn('inline-block whitespace-nowrap rounded-full border px-2 py-0.5 font-medium', TONE[STATUS_TONE[r.status] ?? 'neutral'].soft, TONE[STATUS_TONE[r.status] ?? 'neutral'].value)}>
                      {r.statusLabel}
                    </span>
                    {r.postedAt ? <span className={cn('mt-0.5 block whitespace-nowrap tabular-nums', DASH.sub)}>{formatDateTimeTh(r.postedAt)}</span> : null}
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* แบ่งหน้า — ก่อนหน้า / เลขหน้า / ถัดไป · ปุ่มอยู่ที่เดิมเสมอ (ไม่มีหน้า = กดไม่ได้ ไม่ซ่อน) */}
      <div className="flex flex-wrap items-center justify-between gap-2" data-testid="so-post-groups-pager">
        <p className={cn('text-xs tabular-nums', DASH.sub)}>
          {d ? `หน้า ${d.page.toLocaleString('th-TH')} จาก ${d.pages.toLocaleString('th-TH')} · ทั้งหมด ${d.total.toLocaleString('th-TH')} กลุ่ม` : ' '}
        </p>
        <div className="flex items-center gap-1">
          <Button type="button" size="xs" variant="outline" disabled={!d || d.page <= 1 || state.loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            ก่อนหน้า
          </Button>
          {(d ? getVisiblePageNumbers(d.page, d.pages) : []).map((n, i) =>
            n === 'ellipsis' ? (
              <span key={`e${i}`} className={cn('w-7 text-center text-xs', DASH.sub)} aria-hidden>
                …
              </span>
            ) : (
              <Button
                key={n}
                type="button"
                size="iconXs"
                variant={n === d?.page ? 'default' : 'ghost'}
                aria-current={n === d?.page ? 'page' : undefined}
                className="tabular-nums"
                disabled={state.loading}
                onClick={() => setPage(n)}
              >
                {n}
              </Button>
            ),
          )}
          <Button type="button" size="xs" variant="outline" disabled={!d || d.page >= d.pages || state.loading} onClick={() => setPage((p) => p + 1)}>
            ถัดไป
          </Button>
        </div>
      </div>
    </OverviewCard>
  );
}
