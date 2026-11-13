import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Hand } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { formatYmdTh } from '@/lib/dateTh';
import { friendlyErrorText } from '@/lib/friendlyError';
import { requestNoOf } from '@/lib/jobKeyIndex';
import { requestPathOfJobId } from '@/lib/jobNavigation';
import { fetchManualPostDays } from '@/lib/jobPostActionsApi';
import type { ManualPostDays } from '@/lib/jobPostActions';
import { OverviewCard } from '../RecruitOverviewParts';

/**
 * ═══ 6. โพสต์เอง รายวัน (เจ้าของ 13 พ.ย. 2569 "อยากดูจำนวนรวมของแต่ละวัน ว่าโพสต์งานไหนไปบ้างจากโพสต์มือ") ═══
 * ตัวนับอยู่ `manualPostDays` (ตัวตัดสินโพสต์เอง/Autopost ตัวเดียวกับการ์ดหน้าโพสต์ประกาศ) · ช่วง/BU ตามภาพรวม
 * ทุกวันในช่วงขึ้นเสมอ (ไม่มีโพสต์ = 0) · แถวรวม = ผลบวกทุกวัน · กดวัน = ใบขอของวันนั้น กดใบ = เปิดใบขอ · กดซ้ำ = ปิด
 */
const th = (n: number) => n.toLocaleString('th-TH');
/** ป้ายลิงก์เต็ม "Facebook · Facebook Group · ชื่อกลุ่ม" → ชื่อท้ายสุด (ชื่อกลุ่ม/ช่องทาง) */
const placeName = (label: string) => label.split('·').map((p) => p.trim()).filter(Boolean).pop() ?? label;

export default function ManualPostDaysCard({ from, to, bu }: { from: string; to: string; bu: string | null }) {
  const navigate = useNavigate();
  const [rev, setRev] = React.useState(0);
  const [pick, setPick] = React.useState<string | null>(null);
  const [state, setState] = React.useState<{ data: ManualPostDays | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });

  React.useEffect(() => setPick(null), [from, to, bu]);
  React.useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, error: null, loading: true }));
    fetchManualPostDays({ from, to, bu })
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((e: unknown) => alive && setState({ data: null, error: friendlyErrorText(e, 'อ่านยอดโพสต์เองไม่ได้'), loading: false }));
    return () => {
      alive = false;
    };
  }, [from, to, bu, rev]);

  const d = state.data;
  const picked = pick && d ? (d.days.find((x) => x.day === pick) ?? null) : null;
  const cells: Array<{ key: string; label: string; n: number | null; tone?: keyof typeof TONE }> = [
    { key: 'jobs', label: 'ใบขอ', n: d ? d.total.jobs : null },
    { key: 'places', label: 'กลุ่ม/ช่องทาง', n: d ? d.total.places : null },
    { key: 'clicks', label: 'คลิก', n: d ? d.total.clicks : null },
    { key: 'applicants', label: 'กรอก', n: d ? d.total.applicants : null, tone: 'success' },
  ];

  return (
    <OverviewCard icon={Hand} title="6. โพสต์เอง" sub={`${formatYmdTh(from)} – ${formatYmdTh(to)} · ${bu ?? 'ทุก BU'}`}>
      {state.error ? (
        <div className={cn('flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2', TONE.warn.soft)} data-testid="manual-post-days-error">
          <p className={cn('text-sm font-medium', TONE.warn.value)}>{state.error}</p>
          <Button type="button" size="xs" variant="outline" onClick={() => setRev((n) => n + 1)}>
            ลองใหม่
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4" data-testid="manual-post-days-total">
        {cells.map((c) => (
          <div key={c.key} className="flex min-w-0 flex-col gap-0.5 bg-card px-3 py-2">
            <span className="text-xs text-muted-foreground">{c.label}</span>
            <span className={cn('text-xl font-medium tabular-nums', c.n === null || c.n === 0 ? 'text-muted-foreground' : c.tone ? TONE[c.tone].value : 'text-foreground')}>
              {c.n === null ? '—' : th(c.n)}
            </span>
          </div>
        ))}
      </div>

      <div className="max-h-96 overflow-auto rounded-xl border border-border" data-testid="manual-post-days-table">
        <Table>
          <TableHeader>
            <TableRow className={DASH.tableHead}>
              <TableHead className="text-xs">วันที่</TableHead>
              <TableHead className="text-right text-xs">ใบขอ</TableHead>
              <TableHead className="text-right text-xs">กลุ่ม/ช่องทาง</TableHead>
              <TableHead className="text-right text-xs">คลิก</TableHead>
              <TableHead className="text-right text-xs">กรอก</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!d ? (
              <TableRow>
                <TableCell colSpan={5} className={cn('py-6 text-center text-sm', DASH.sub)}>
                  {state.loading ? 'กำลังโหลด…' : 'อ่านไม่ได้'}
                </TableCell>
              </TableRow>
            ) : (
              d.days.map((x) => {
                const active = pick === x.day;
                return (
                  <TableRow key={x.day} className={cn(active && 'bg-muted hover:bg-muted')} data-testid="manual-post-day-row">
                    <TableCell className="text-sm">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        disabled={x.jobs === 0}
                        aria-pressed={x.jobs === 0 ? undefined : active}
                        onClick={() => setPick(active ? null : x.day)}
                        className="h-auto px-1 py-0.5 font-normal tabular-nums disabled:opacity-100"
                      >
                        {formatYmdTh(x.day)}
                      </Button>
                    </TableCell>
                    {[x.jobs, x.places, x.clicks, x.applicants].map((n, i) => (
                      <TableCell key={i} className={cn('text-right text-sm tabular-nums', n === 0 ? 'text-muted-foreground' : 'text-foreground')}>
                        {th(n)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {picked ? (
        <div className="space-y-2 rounded-xl border border-border p-3" data-testid="manual-post-day-list">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">
              {formatYmdTh(picked.day)} · {th(picked.jobs)} ใบขอ · {th(picked.places)} กลุ่ม/ช่องทาง
            </p>
            <Button type="button" size="xs" variant="outline" onClick={() => setPick(null)}>
              ปิด
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[44rem]">
              <TableHeader>
                <TableRow className={DASH.tableHead}>
                  <TableHead className="text-xs">ใบขอ</TableHead>
                  <TableHead className="text-xs">คนโพสต์</TableHead>
                  <TableHead className="text-xs">กลุ่ม/ช่องทาง</TableHead>
                  <TableHead className="text-right text-xs">คลิก</TableHead>
                  <TableHead className="text-right text-xs">กรอก</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {picked.list.map((j) => (
                  <TableRow key={j.jobId} data-testid="manual-post-day-job">
                    <TableCell className="max-w-64 text-sm">
                      <Button type="button" variant="link" size="xs" className="h-auto p-0 tabular-nums" onClick={() => navigate(requestPathOfJobId(j.jobId))}>
                        {requestNoOf(j.jobId)}
                      </Button>
                      {j.title ? <span className={cn('block line-clamp-2 text-xs', DASH.sub)}>{j.title}</span> : null}
                    </TableCell>
                    <TableCell className="text-sm">{j.by.length ? j.by.join(', ') : '—'}</TableCell>
                    <TableCell className="max-w-72 text-sm">
                      <span className="tabular-nums">{th(j.places.length)}</span>
                      <span className={cn('block line-clamp-2 text-xs', DASH.sub)}>{[...new Set(j.places.map(placeName))].join(' · ')}</span>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{th(j.clicks)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{th(j.applicants)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </OverviewCard>
  );
}
