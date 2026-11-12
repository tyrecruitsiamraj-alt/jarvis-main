import React from 'react';
import { ChevronDown, ExternalLink, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { formatDateTimeTh, formatYmdTh } from '@/lib/dateTh';
import { friendlyErrorText } from '@/lib/friendlyError';
import { getVisiblePageNumbers } from '@/lib/pagination';
import { fetchSoPostGroups } from '@/lib/soPostGroupsApi';
import type { SoPostGroups, SoPostGroupsFiltered } from '@/lib/soPostGroups';
import { OverviewCard } from '../RecruitOverviewParts';

/**
 * ═══ 5. โพสต์ลงกลุ่ม Facebook (เจ้าของ 11 พ.ย. 2569 · ข้อ 13 ของ JARVIS_OPTIONS_PROMPT.md ฝั่ง So Scraping) ═══
 * ใครสั่ง · บัญชีไหน · กลุ่มไหน · งานอะไร · วันที่ · ผล · ลิงก์ — ดึงจาก So Scraping ผ่าน `/api/so-post-groups` (key อยู่ฝั่ง server)
 * ช่วง/BU = ค่าที่ภาพรวมเลือกอยู่ · หน้าละ 10 แถว · ดึงไม่ได้ = การ์ดยังอยู่ บอกเหตุ + ลองใหม่
 * แถวเลข = สั่งทั้งหมด + ทุกสถานะตามลำดับ `statuses` (ว่าง = 0) · 12 พ.ย. 2569 So Scraping ใช้คำของแท็บ "เนื้อหาของคุณ" ใน Facebook แล้ว
 *   (เผยแพร่แล้ว · รอดำเนินการ · ปฏิเสธแล้ว · ลบออกแล้ว · ไม่สำเร็จ · ไม่ได้โพสต์ · รอคิว) — 🔴 อ่านคำจาก `statuses` เสมอ ห้ามฝังรายการคำใน Jarvis
 * แถวในตาราง: ป้าย = `status_label` · เหตุ = `error` ตรง ๆ · สีป้ายตามรหัส (รหัสที่ไม่รู้จัก = สีกลาง)
 * กดช่องสถานะ (เจ้าของ 12 พ.ย. 2569 "ไม่ได้โพสต์ 909 กดแล้วดูเหตุได้ไหม") = ตารางเหลือสถานะนั้น + เหตุจัดกลุ่มนับ · กดซ้ำ/กดสั่งทั้งหมด = ทุกแถว
 */

/** ไม่ได้โพสต์ 3 แบบ (เครื่อง/บัญชี/ไม่ทราบสาเหตุ) แดงเหมือน "ไม่สำเร็จ" — เจ้าของสั่ง 12 พ.ย. 2569 */
const STATUS_TONE: Record<string, keyof typeof TONE> = {
  posted: 'success',
  pending_approval: 'warn',
  declined: 'danger',
  removed: 'danger',
  failed: 'danger',
  not_tried_machine: 'danger',
  not_tried_account: 'danger',
  not_tried_unknown: 'danger',
};

export default function SoPostGroupsCard({ from, to, bu }: { from: string; to: string; bu: string | null }) {
  const [page, setPage] = React.useState(1);
  const [rev, setRev] = React.useState(0);
  const [statusPick, setStatusPick] = React.useState<string | null>(null);
  /** กองเหตุที่พับไว้ (ค่าเริ่ม = กางทุกกอง) */
  const [folded, setFolded] = React.useState<Set<string>>(() => new Set());
  const [state, setState] = React.useState<{ data: (SoPostGroups & Partial<SoPostGroupsFiltered>) | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });

  // เปลี่ยนช่วง/BU/สถานะที่กด = กลับหน้าแรก
  React.useEffect(() => setPage(1), [from, to, bu, statusPick]);
  React.useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, error: null, loading: true }));
    fetchSoPostGroups({ from, to, bu, page, status: statusPick })
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((e: unknown) => alive && setState({ data: null, error: friendlyErrorText(e, 'ติดต่อ So Scraping ไม่ได้'), loading: false }));
    return () => {
      alive = false;
    };
  }, [from, to, bu, page, rev, statusPick]);

  const d = state.data;
  const sub = `${formatYmdTh(from)} – ${formatYmdTh(to)} · ${bu ?? 'ทุก BU'}`;
  const cells: Array<{ key: string; label: string; n: number | null; tone?: keyof typeof TONE }> = d
    ? [{ key: 'total', label: 'สั่งทั้งหมด', n: d.total }, ...d.statuses.map((st) => ({ key: st.key, label: st.label, n: d.counts[st.key] ?? 0, tone: STATUS_TONE[st.key] }))]
    : [];
  /**
   * สั่ง + 7 สถานะ = 8 ช่อง (มือถือ 2 · กลาง 4 · กว้าง 8 ต่อแถว) · สั่ง + 9 สถานะ = 10 ช่อง แถวละ 5 (So Scraping แยกไม่ได้โพสต์เป็น
   * เครื่อง / บัญชี / ไม่ทราบสาเหตุ · prompt 12 พ.ย. 2569) · จำนวนคี่ = ช่องแรกเต็มแถวบนมือถือ ไม่เหลือช่องว่างเทา
   */
  const n = cells.length || 8;

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

      {/* แถวเลข — สั่งทั้งหมด = ผลรวมทุกสถานะ · ระหว่างโหลดโครงเดิม (ไม่กระโดด) */}
      <div
        className={cn('grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border', n % 5 === 0 ? 'sm:grid-cols-5' : 'sm:grid-cols-4 lg:grid-cols-8', n % 2 === 1 && '[&>*:first-child]:col-span-2 sm:[&>*:first-child]:col-span-1')}
        data-testid="so-post-groups-counts"
      >
        {(cells.length ? cells : Array.from({ length: 8 }, (_, i) => ({ key: `x${i}`, label: '', n: null as number | null, tone: undefined }))).map((c) => {
          const active = c.key === 'total' ? statusPick === null : statusPick === c.key;
          return (
            <Button
              key={c.key}
              type="button"
              variant="ghost"
              disabled={c.n === null}
              aria-pressed={c.n === null ? undefined : active}
              onClick={() => setStatusPick(c.key === 'total' || statusPick === c.key ? null : c.key)}
              className={cn('h-full min-w-0 flex-col items-start justify-between gap-0.5 whitespace-normal rounded-none px-3 py-2 text-left font-normal disabled:opacity-100', active ? 'bg-muted hover:bg-muted' : 'bg-card')}
              data-testid={`so-post-count-${c.key}`}
            >
              <span className={cn('text-xs', active ? 'font-medium text-foreground' : 'text-muted-foreground')}>{c.label}</span>
              <span className={cn('text-xl font-medium tabular-nums', c.n === null || c.n === 0 ? 'text-muted-foreground' : c.tone ? TONE[c.tone].value : 'text-foreground')}>
                {c.n === null ? '—' : c.n.toLocaleString('th-TH')}
              </span>
            </Button>
          );
        })}
      </div>

      {/* เหตุของสถานะที่กด — คำตามที่ So Scraping ส่ง · ไม่มีเหตุ = บอกตรง ๆ */}
      {statusPick && d?.reasons ? (
        <div className="space-y-1 rounded-xl border border-border p-3" data-testid="so-post-groups-reasons">
          <p className="text-sm font-medium text-foreground">
            เหตุที่{d.statuses.find((x) => x.key === statusPick)?.label ?? statusPick} {(d.filteredTotal ?? 0).toLocaleString('th-TH')} กลุ่ม
          </p>
          {d.reasons.length === 0 ? <p className={cn('text-xs', DASH.sub)}>ไม่มีกลุ่มในสถานะนี้</p> : null}
          {/* So Scraping ส่งกองเหตุมาแล้ว = แบ่งกอง กดกองเพื่อพับ/กาง (เจ้าของ 12 พ.ย. 2569 แบบร่าง 3 กอง) · ยังไม่ส่ง = รายการเหตุแบบเดิม */}
          {d.reasonTree && d.reasonTree.length > 0 ? (
            <ul className="divide-y divide-border" data-testid="so-post-groups-reason-tree">
              {d.reasonTree.map((g) => {
                const open = !folded.has(g.key);
                return (
                  <li key={g.key} className="py-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      aria-expanded={open}
                      onClick={() => setFolded((cur) => { const next = new Set(cur); if (next.has(g.key)) next.delete(g.key); else next.add(g.key); return next; })}
                      className="h-auto w-full justify-between gap-3 px-1 py-1 text-sm font-medium text-foreground"
                    >
                      <span className="flex min-w-0 items-center gap-1">
                        <ChevronDown className={cn('shrink-0 transition-transform', !open && '-rotate-90')} aria-hidden />
                        <span className="min-w-0 whitespace-normal text-left">{g.label}</span>
                      </span>
                      <span className="shrink-0 tabular-nums">{g.n.toLocaleString('th-TH')}</span>
                    </Button>
                    {open ? (
                      <ul className="space-y-0.5 pb-1 pl-6">
                        {g.items.map((x) => (
                          <li key={x.error ?? '-'} className={cn('flex items-baseline justify-between gap-3 text-xs', DASH.sub)}>
                            <span className="min-w-0">{x.error ?? 'So Scraping ไม่ได้บอกเหตุ'}</span>
                            <span className="shrink-0 tabular-nums">{x.n.toLocaleString('th-TH')}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
          <ul className="space-y-0.5">
            {d.reasons.map((x) => (
              <li key={x.error ?? '-'} className="flex items-baseline justify-between gap-3 text-sm">
                <span className={cn('min-w-0', x.error ? 'text-foreground' : DASH.sub)}>{x.error ?? 'So Scraping ไม่ได้บอกเหตุ'}</span>
                <span className="shrink-0 font-medium tabular-nums">{x.n.toLocaleString('th-TH')}</span>
              </li>
            ))}
          </ul>
          )}
        </div>
      ) : null}

      <div className="overflow-x-auto" data-testid="so-post-groups-table">
        <Table className="min-w-[56rem]">
          <TableHeader>
            <TableRow className={DASH.tableHead}>
              <TableHead className="whitespace-nowrap text-xs">คนสั่ง</TableHead>
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
          {d ? `หน้า ${d.page.toLocaleString('th-TH')} จาก ${d.pages.toLocaleString('th-TH')} · ${statusPick ? `${d.statuses.find((x) => x.key === statusPick)?.label ?? statusPick} ${(d.filteredTotal ?? 0).toLocaleString('th-TH')}` : `ทั้งหมด ${d.total.toLocaleString('th-TH')}`} กลุ่ม` : ' '}
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
