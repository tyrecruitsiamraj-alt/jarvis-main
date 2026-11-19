/**
 * ═══ งานรายคน (เจ้าของ 18 พ.ย. 2569 "วันนี้ เมื่อวาน วันก่อน ใหม่ทำอะไรไป โพสต์มือเอง Autopost scrap" · Choice ภาพรวม + Filter รายคน) ═══
 * ช่วงวันที่/BU = ของหน้าภาพรวม · ทุกคน = รวมทั้งช่วงต่อคน · เลือกคน = แยกรายวัน + แถวรวม · กดเลข = รายการข้างล่าง
 * ตัวนับ `api/_handlers/staff-activity.ts` · ว่าง = แถว "ไม่มีงานในช่วงนี้" (ตารางไม่หาย)
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { formatYmdTh } from '@/lib/dateTh';
import { pageOf } from '@/lib/recruitAudience';
import { STAFF_ACTIVITY_KINDS, STAFF_ACTIVITY_LABEL, staffActivityTotals, type StaffActivityItem, type StaffActivityKind, type StaffActivityRow } from '@/lib/staffActivity';
import { fetchStaffActivityItems } from '@/lib/staffActivityApi';
import { Pager, fmt } from './V2Parts';

const ALL = '__all__';

export default function StaffActivityPanel({
  from,
  to,
  bu,
  rows,
  error,
  onNames,
  fixedWho,
}: {
  from: string;
  to: string;
  bu: string | null;
  /** งานรายคนของช่วง (หน้าแม่ดึงครั้งเดียว ใช้ร่วมกับการ์ดการสั่งงาน) · null = กำลังโหลด */
  rows: StaffActivityRow[] | null;
  error: string | null;
  /** ลงผลติดต่อ/นัดได้ = เปิดรายชื่อผู้สมัครในแผงข้าง */
  onNames: (title: string, ids: readonly string[]) => void;
  /** เปิดจากชื่อในตารางรายคน = คนเดียว แยกรายวัน ไม่มีช่องเลือกคน (19 พ.ย. 2569 รวมการ์ดงานรายคนเข้าตารางรายคน) */
  fixedWho?: string;
}) {
  const [who, setWho] = React.useState<string | null>(fixedWho ?? null);
  const [pick, setPick] = React.useState<{ user: string; name: string; kind: StaffActivityKind; day: string | null } | null>(null);
  const [items, setItems] = React.useState<StaffActivityItem[] | null>(null);
  const [page, setPage] = React.useState(1);

  React.useEffect(() => setPick(null), [from, to, bu]);

  React.useEffect(() => {
    if (!pick) return setItems(null);
    let alive = true;
    setItems(null);
    setPage(1);
    fetchStaffActivityItems({ from, to, bu, ...pick })
      .then((r) => alive && setItems(r))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [pick, from, to, bu]);

  const people = rows ? staffActivityTotals(rows) : [];
  const mine = who ? (rows ?? []).filter((r) => r.userId === who) : [];
  const whoName = people.find((p) => p.userId === who)?.name ?? null;
  // ทุกคน = แถวละคน (รวมทั้งช่วง) · เลือกคน = แถวละวัน + แถวรวม
  const tableRows: Array<StaffActivityRow & { head: string; isTotal?: boolean }> = who
    ? [
        ...mine.map((r) => ({ ...r, head: formatYmdTh(r.day) })),
        ...(mine.length > 1 ? staffActivityTotals(mine).map((r) => ({ ...r, head: 'รวม', isTotal: true })) : []),
      ]
    : people.map((r) => ({ ...r, head: r.name }));
  const pg = items ? pageOf(items, page, 20) : null;
  const pickTitle = pick ? `${pick.name} · ${STAFF_ACTIVITY_LABEL[pick.kind]}${pick.day ? ` · ${formatYmdTh(pick.day)}` : ''}` : '';

  return (
    <div className="space-y-3" data-testid="v2-staff">
      <span className={cn('block w-56', fixedWho && 'hidden')}>
        <Select value={who ?? ALL} onValueChange={(v) => { setWho(v === ALL ? null : v); setPick(null); }}>
          <SelectTrigger className="h-9 text-sm" aria-label="คน" data-testid="v2-staff-who">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>ทุกคน</SelectItem>
            {people.map((p) => (
              <SelectItem key={p.userId} value={p.userId}>
                {p.name}{p.bu ? ` · ${p.bu}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </span>
      {error ? <p className={cn('text-sm', TONE.danger.value)}>{error}</p> : null}
      {!rows && !error ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-max">
            <TableHeader>
              <TableRow>
                <TableHead>{who ? 'วัน' : 'คน'}</TableHead>
                {STAFF_ACTIVITY_KINDS.map((k) => (
                  <TableHead key={k} className="text-right">
                    {STAFF_ACTIVITY_LABEL[k]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={STAFF_ACTIVITY_KINDS.length + 1} className={DASH.muted}>
                    ไม่มีงานในช่วงนี้
                  </TableCell>
                </TableRow>
              ) : (
                tableRows.map((r) => (
                  <TableRow key={`${r.userId}:${r.day}:${r.isTotal ? 't' : ''}`} className={r.isTotal ? 'bg-muted/40' : undefined}>
                    <TableCell className={cn('whitespace-nowrap', r.isTotal && 'font-medium')}>
                      {r.head}
                      {!who && r.bu ? <span className={cn('ml-1 text-xs', DASH.sub)}>{r.bu}</span> : null}
                    </TableCell>
                    {STAFF_ACTIVITY_KINDS.map((k) => (
                      <TableCell key={k} className="text-right">
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          className="tabular-nums"
                          disabled={!r[k]}
                          onClick={() => setPick({ user: r.userId, name: r.name, kind: k, day: who && !r.isTotal ? r.day : null })}
                        >
                          {fmt(r[k])}
                        </Button>
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
      {pick ? (
        <section className="space-y-2 rounded-xl border border-border bg-muted/20 p-3" data-testid="v2-staff-items">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">{pickTitle}</h3>
            {items && (pick.kind === 'contacts' || pick.kind === 'appts') ? (
              <Button type="button" size="xs" variant="outline" onClick={() => onNames(pickTitle, items.map((i) => i.applicationId ?? '').filter(Boolean))}>
                ดูรายชื่อ
              </Button>
            ) : null}
          </div>
          {!pg ? (
            <Skeleton className="h-20 rounded-lg" />
          ) : (
            <>
              <ul className="divide-y divide-border text-sm">
                {pg.slice.length === 0 ? <li className={cn('py-2', DASH.muted)}>ไม่มีรายการ</li> : null}
                {pg.slice.map((it, i) => (
                  <li key={`${it.day}:${i}`} className="flex flex-wrap items-baseline gap-x-2 py-1.5">
                    <span className={cn('w-20 shrink-0 text-xs tabular-nums', DASH.sub)}>{formatYmdTh(it.day)}</span>
                    <span className="font-medium">{it.title}</span>
                    {it.sub ? <span className={cn('text-xs', DASH.sub)}>{it.sub}</span> : null}
                  </li>
                ))}
              </ul>
              {pg.pages > 1 ? <Pager {...pg} onPage={setPage} /> : null}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
