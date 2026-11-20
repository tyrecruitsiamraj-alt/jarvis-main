/**
 * ═══ แท็บงานรายคน (เจ้าของ 20 พ.ย. 2569 "ถ้าฉันอยากรู้แค่ เจมส์ทำไรไปบ้างวันนี้ เมื่อวาน วันนี้กะเมื่อวานเจมส์ทำไรเยอะกว่า …
 * มันตอบภาพใหญ่ได้ แต่เจาะลึกๆแบบ Micro ไม่ได้" · "ถ้าบอกว่าทำอะไร แล้วทำไปช่องทางไหน ทำไมไม่คิดต่อยอดให้เลย" ·
 * "ทำไว้อีกแท็บของ หน้าภาพรวม") ═══
 * อ่านบนลงล่าง: 7 วัน → ทำอะไร · ช่องทางไหน (วันที่ดู เทียบวันก่อน) → ได้อะไรกลับมา → ทำกับใบไหน → รายการเรียงตามเวลา
 * วันที่ดู = วันสุดท้ายของช่วงบนหัวหน้า (กดแท่ง 7 วัน = เปลี่ยนเฉพาะแท็บนี้) · ตัวนับ `api/_handlers/staff-activity.ts` (`person=1`)
 * ว่าง = 0 ทุกช่อง ตารางไม่หาย · แถวย่อยจองบรรทัดไว้ทุกชนิดงาน เปลี่ยนคน/วันแล้วตารางไม่ขยับ
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { shortTime } from '@/lib/dateTh';
import { pageOf } from '@/lib/recruitAudience';
import { monthWindowLabel } from '@/lib/recruitStuck';
import {
  STAFF_PERSON_KINDS,
  defaultStaffPerson,
  emptyStaffPersonDay,
  staffPersonOptions,
  staffWorkTotal,
  ymdAddDays,
  type StaffActivityItem,
  type StaffActivityKind,
  type StaffActivityRow,
  type StaffPersonDay,
  type StaffPersonJob,
  type StaffPersonSub,
} from '@/lib/staffActivity';
import { fetchStaffActivityItems, fetchStaffPersonDay } from '@/lib/staffActivityApi';
import TrendDelta from '../stuck/TrendDelta';
import { Pager, fmt } from './V2Parts';

const dayShort = (d: string) => monthWindowLabel({ month: d.slice(0, 7), from: d, to: d });
/** งาน 4 ชนิดที่ผูกกับใบขอ (คอลัมน์ของตารางใบ) */
const JOB_KINDS: ReadonlyArray<{ key: 'autopost' | 'scrap' | 'links' | 'manualPosted'; label: string }> = [
  { key: 'autopost', label: 'Autopost' },
  { key: 'scrap', label: 'Scrap' },
  { key: 'links', label: 'Gen link' },
  { key: 'manualPosted', label: 'โพสต์แล้ว' },
];
/** แถวย่อย — ช่องทาง/ผล + จำนวน · Autopost = บัญชี + จำนวนกลุ่ม (บอกจำนวนใบเมื่อเกิน 1) */
const subText = (kind: StaffActivityKind, c: StaffPersonSub) => (kind === 'autopost' ? `${c.label}${c.n > 1 ? ` (${fmt(c.n)} ใบ)` : ''}` : `${c.label} ${fmt(c.n)}`);
const jobTotal = (jobs: readonly StaffPersonJob[], k: keyof Omit<StaffPersonJob, 'jobId' | 'label'>) => jobs.reduce((n, j) => n + j[k], 0);

export default function StaffPersonPanel({
  rows,
  error,
  anchor,
  bu,
  who,
  onWho,
  onOpenRequest,
  onNames,
}: {
  /** งานรายคนของช่วงบนหัวหน้า (หน้าแม่ดึงอยู่แล้ว) — รายชื่อคน + คนเริ่มต้น · null = กำลังโหลด */
  rows: StaffActivityRow[] | null;
  error: string | null;
  /** วันสุดท้ายของช่วงบนหัวหน้า (ไม่เกินวันนี้) */
  anchor: string;
  bu: string | null;
  /** คนที่เลือก (กดชื่อจากตารางรายคนของแท็บภาพรวม) · null = คนที่งานมากสุดของวันที่ดู */
  who: string | null;
  onWho: (userId: string) => void;
  onOpenRequest: (jobId: string) => void;
  onNames: (title: string, ids: readonly string[]) => void;
}) {
  const from = ymdAddDays(anchor, -6);
  const [day, setDay] = React.useState(anchor);
  React.useEffect(() => setDay(anchor), [anchor]);

  const options = React.useMemo(() => (rows ? staffPersonOptions(rows) : []), [rows]);
  const person = who && options.some((o) => o.value === who) ? who : rows ? defaultStaffPerson(rows, anchor) : null;
  const personName = options.find((o) => o.value === person)?.label ?? '';

  const [loaded, setLoaded] = React.useState<{ key: string; data: StaffPersonDay | null; error: string | null } | null>(null);
  const key = `${person ?? ''}|${day}|${from}|${anchor}|${bu ?? ''}`;
  React.useEffect(() => {
    if (!person) return;
    let alive = true;
    fetchStaffPersonDay({ from, to: anchor, day, user: person, bu })
      .then((d) => alive && setLoaded({ key, data: d, error: null }))
      .catch((e: unknown) => alive && setLoaded({ key, data: null, error: e instanceof Error ? e.message : 'อ่านงานรายคนไม่ได้' }));
    return () => {
      alive = false;
    };
  }, [key, person, day, from, anchor, bu]);
  // ระหว่างโหลดคน/วันใหม่ ค้างของเดิมไว้ (จาง) ตารางไม่กระพริบ · ไม่มีคนให้เลือก = ทุกช่อง 0
  const empty = React.useMemo(() => emptyStaffPersonDay(from, anchor, day), [from, anchor, day]);
  const data = person ? (loaded?.data ?? null) : empty;
  const stale = Boolean(person) && loaded?.key !== key;

  const [pick, setPick] = React.useState<{ kind: StaffActivityKind; jobId: string | null; jobLabel: string | null } | null>(null);
  const [items, setItems] = React.useState<StaffActivityItem[] | null>(null);
  const [itemPage, setItemPage] = React.useState(1);
  const [jobPage, setJobPage] = React.useState(1);
  React.useEffect(() => {
    setPick(null);
    setJobPage(1);
  }, [person, day, anchor, bu]);
  const pickKind = pick?.kind ?? null;
  React.useEffect(() => {
    if (!pickKind || !person) return setItems(null);
    let alive = true;
    setItems(null);
    fetchStaffActivityItems({ from: day, to: day, bu, user: person, kind: pickKind, day })
      .then((r) => alive && setItems(r))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [pickKind, person, day, bu]);
  React.useEffect(() => setItemPage(1), [pick]);

  const shown = pick && items ? items.filter((it) => !pick.jobId || it.jobId === pick.jobId).sort((a, b) => (b.at ?? '').localeCompare(a.at ?? '')) : null;
  const itemPg = shown ? pageOf(shown, itemPage, 20) : null;
  const kindLabel = (k: StaffActivityKind) => STAFF_PERSON_KINDS.find((x) => x.key === k)?.label ?? k;
  const pickTitle = pick ? [personName, kindLabel(pick.kind), dayShort(day), pick.jobLabel].filter(Boolean).join(' · ') : '';

  const weekMax = Math.max(1, ...(data?.week ?? []).map(staffWorkTotal));
  const jobPg = pageOf(data?.jobs ?? [], jobPage, 10);
  const numberCell = (n: number, onClick: (() => void) | null, bold = false) => (
    <TableCell className="text-right">
      {onClick && n > 0 ? (
        <Button type="button" size="xs" variant="ghost" className={cn('tabular-nums', bold && 'font-medium')} onClick={onClick}>
          {fmt(n)}
        </Button>
      ) : (
        <span className={cn('px-2 tabular-nums', bold && 'font-medium', n === 0 && DASH.muted)}>{fmt(n)}</span>
      )}
    </TableCell>
  );

  return (
    <section className="min-w-0 space-y-5" data-testid="staff-person">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="border-l-4 border-primary pl-3 text-lg font-medium text-foreground">งานรายคน</h2>
        <span className="block w-64">
          <Select value={person ?? ''} onValueChange={onWho} disabled={options.length === 0}>
            <SelectTrigger className="h-9 text-sm" aria-label="คน" data-testid="staff-person-who">
              <SelectValue placeholder="ไม่มีงานในช่วงนี้" />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </span>
        <span className={cn('text-xs', DASH.sub)} data-testid="staff-person-caption">
          {dayShort(day)} เทียบ {dayShort(ymdAddDays(day, -1))}
        </span>
      </div>
      {error || loaded?.error ? <p className={cn('text-sm', TONE.danger.value)}>{error ?? loaded?.error}</p> : null}

      {!data ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <div className={cn('space-y-5', stale && 'opacity-60')}>
          {/* 7 วัน — กดแท่ง = ดูวันนั้น เทียบวันก่อนหน้า */}
          <div className="space-y-1.5">
            <h3 className="text-sm font-medium">7 วัน</h3>
            <div className="overflow-x-auto">
              <div className="flex h-32 gap-1 border-b sm:gap-2" data-testid="staff-person-week">
                {data.week.map((w) => {
                  const n = staffWorkTotal(w);
                  return (
                    <button
                      key={w.day}
                      type="button"
                      onClick={() => setDay(w.day)}
                      aria-pressed={w.day === day}
                      title={`${dayShort(w.day)} · ${fmt(n)} งาน`}
                      data-testid={`staff-person-day-${w.day}`}
                      className="flex min-w-9 flex-1 flex-col items-center justify-end gap-1"
                    >
                      <span className={cn('rounded-full border bg-background px-2 text-xs tabular-nums', w.day === day && 'font-medium')}>{fmt(n)}</span>
                      <span
                        className={cn('w-8 rounded-t-lg', w.day !== day && 'opacity-40')}
                        style={{ height: `${(n / weekMax) * 70}%`, minHeight: 2, background: TONE.primary.hex }}
                      />
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-1 pt-1 sm:gap-2">
                {data.week.map((w) => (
                  <span key={w.day} className={cn('min-w-9 flex-1 text-center text-xs', w.day === day ? 'font-medium' : DASH.sub)}>
                    {dayShort(w.day)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ทำอะไร · ช่องทางไหน */}
          <div className="space-y-1.5">
            <h3 className="text-sm font-medium">ทำอะไร · ช่องทางไหน</h3>
            <div className="overflow-x-auto">
              <Table className="min-w-[32rem] table-fixed" data-testid="staff-person-work">
                <TableHeader>
                  <TableRow>
                    <TableHead />
                    <TableHead className="w-24 text-right">{dayShort(data.day)}</TableHead>
                    <TableHead className="w-24 text-right">{dayShort(data.prevDay)}</TableHead>
                    <TableHead className="w-36 text-right">เทียบวันก่อน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-muted/40" data-testid="staff-person-row-total">
                    <TableCell className="font-medium">งานทั้งหมด</TableCell>
                    {numberCell(staffWorkTotal(data.cur), null, true)}
                    {numberCell(staffWorkTotal(data.prev), null)}
                    <TableCell className="text-right">
                      <TrendDelta cur={staffWorkTotal(data.cur)} prev={staffWorkTotal(data.prev)} zeroAsUp />
                    </TableCell>
                  </TableRow>
                  {STAFF_PERSON_KINDS.map((k) => (
                    <TableRow key={k.key} data-testid={`staff-person-row-${k.key}`}>
                      <TableCell>
                        <span className="block">{k.label}</span>
                        {/* ช่องทาง/ผล บรรทัดเดียว จองที่ไว้เสมอ */}
                        <span className={cn('block min-h-4 break-words text-xs', DASH.sub)}>
                          {data.channels[k.key].length ? data.channels[k.key].map((c) => subText(k.key, c)).join(' · ') : ' '}
                        </span>
                      </TableCell>
                      {numberCell(data.cur[k.key], () => setPick({ kind: k.key, jobId: null, jobLabel: null }))}
                      {numberCell(data.prev[k.key], null)}
                      <TableCell className="text-right align-top">
                        <TrendDelta cur={data.cur[k.key]} prev={data.prev[k.key]} zeroAsUp />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* ได้อะไรกลับมา — ลิงก์ที่คนนี้รับผิดชอบ */}
          <div className="space-y-1.5">
            <h3 className="text-sm font-medium">
              ได้อะไรกลับมา <span className={cn('text-xs font-normal', DASH.sub)}>ลิงก์ที่คนนี้รับผิดชอบ</span>
            </h3>
            <div className="overflow-x-auto">
              <Table className="min-w-[32rem] table-fixed" data-testid="staff-person-results">
                <TableBody>
                  {(
                    [
                      ['คลิก', data.results.clicks, data.results.clicksPrev],
                      ['กรอกใบสมัคร', data.results.applicants, data.results.applicantsPrev],
                    ] as const
                  ).map(([label, cur, prev]) => (
                    <TableRow key={label}>
                      <TableCell>{label}</TableCell>
                      <TableCell className="w-24 text-right tabular-nums">{fmt(cur)}</TableCell>
                      <TableCell className={cn('w-24 text-right tabular-nums', DASH.sub)}>{fmt(prev)}</TableCell>
                      <TableCell className="w-36 text-right">
                        <TrendDelta cur={cur} prev={prev} zeroAsUp />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* ทำกับใบไหน — ทุกคอลัมน์รวมเท่าแถวแม่ข้างบน */}
          <div className="space-y-1.5">
            <h3 className="text-sm font-medium">
              ทำกับใบไหน <span className={cn('text-xs font-normal', DASH.sub)}>{dayShort(data.day)}</span>
            </h3>
            <div className="overflow-x-auto">
              <Table className="min-w-[44rem] table-fixed" data-testid="staff-person-jobs">
                <TableHeader>
                  <TableRow>
                    <TableHead>ใบขอ</TableHead>
                    {JOB_KINDS.map((k) => (
                      <TableHead key={k.key} className="w-24 text-right">
                        {k.label}
                      </TableHead>
                    ))}
                    <TableHead className="w-20 text-right">คลิก</TableHead>
                    <TableHead className="w-20 text-right">กรอก</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.jobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={JOB_KINDS.length + 3} className={DASH.muted}>
                        ไม่มีงานในวันนี้
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {jobPg.slice.map((j) => (
                    <TableRow key={j.jobId} data-testid="staff-person-job">
                      <TableCell className="break-words">
                        {j.jobId.startsWith('standalone:') || j.jobId === '—' ? (
                          j.label
                        ) : (
                          <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => onOpenRequest(j.jobId)}>
                            {j.label}
                          </Button>
                        )}
                      </TableCell>
                      {JOB_KINDS.map((k) => (
                        <React.Fragment key={k.key}>{numberCell(j[k.key], () => setPick({ kind: k.key, jobId: j.jobId, jobLabel: j.label }))}</React.Fragment>
                      ))}
                      {numberCell(j.clicks, null)}
                      {numberCell(j.applicants, null)}
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/40" data-testid="staff-person-jobs-total">
                    <TableCell className="font-medium">รวม {fmt(data.jobs.length)} ใบ</TableCell>
                    {JOB_KINDS.map((k) => (
                      <React.Fragment key={k.key}>{numberCell(jobTotal(data.jobs, k.key), null, true)}</React.Fragment>
                    ))}
                    {numberCell(jobTotal(data.jobs, 'clicks'), null, true)}
                    {numberCell(jobTotal(data.jobs, 'applicants'), null, true)}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            {jobPg.pages > 1 ? <Pager {...jobPg} onPage={setJobPage} testId="staff-person-jobs-pager" /> : null}
          </div>

          {/* รายการที่ทำ เรียงตามเวลา (ล่าสุดก่อน) — กดเลขงานข้างบน */}
          {pick ? (
            <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3" data-testid="staff-person-items">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium">{pickTitle}</h3>
                <div className="flex items-center gap-2">
                  {shown && (pick.kind === 'contacts' || pick.kind === 'appts') ? (
                    <Button type="button" size="xs" variant="outline" onClick={() => onNames(pickTitle, shown.map((i) => i.applicationId ?? '').filter(Boolean))}>
                      ดูรายชื่อ
                    </Button>
                  ) : null}
                  <Button type="button" size="xs" variant="ghost" onClick={() => setPick(null)}>
                    ปิด
                  </Button>
                </div>
              </div>
              {!itemPg ? (
                <Skeleton className="h-20 rounded-lg" />
              ) : (
                <>
                  <ul className="divide-y divide-border text-sm">
                    {itemPg.slice.length === 0 ? <li className={cn('py-2', DASH.muted)}>ไม่มีรายการ</li> : null}
                    {itemPg.slice.map((it, i) => (
                      <li key={`${it.at ?? it.day}:${i}`} className="flex flex-wrap items-baseline gap-x-2 py-1.5">
                        <span className={cn('w-14 shrink-0 text-xs tabular-nums', DASH.sub)}>{it.at ? shortTime(it.at) : '—'}</span>
                        <span className="font-medium">{it.title}</span>
                        {it.sub ? <span className={cn('min-w-0 break-words text-xs', DASH.sub)}>{it.sub}</span> : null}
                      </li>
                    ))}
                  </ul>
                  {itemPg.pages > 1 ? <Pager {...itemPg} onPage={setItemPage} /> : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
