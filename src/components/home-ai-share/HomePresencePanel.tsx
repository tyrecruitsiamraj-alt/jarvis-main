/**
 * ═══ ใครอยู่ในระบบ — ท้ายหน้าหลัก (เจ้าของสั่ง 30 ก.ย. 2569) ═══
 *
 * เจ้าของ: *"หน้านี้ด้านล่างเพิ่ม ใครกำลัง Online ใคร offline ใครยังไม่เข้าระบบ เข้าระบบล่าสุดวันไหน"*
 * รอบ 5: *"แยก BU ให้หน่อย กดแล้วแยก BU"* · รอบ 6: *"ทำแบบซ่อนไว้ ถ้ากดค่อยกางออกมา แล้ว BU ก็ทำเป็น Dropdown"*
 * - **ปิดไว้เป็นค่าตั้งต้น** เหลือแถบหัว (ชื่อ · Online กี่คนจากทั้งหมด · ลูกศร) · กดตรงไหนของแถบก็กาง/ซ่อน
 * - กางแล้ว: dropdown BU (ทุก BU + BU ที่มีคน บอก Online x จาก y) · ปุ่มกรองสถานะ 4 อัน · ตาราง หน้าละ 10 คน
 * - เลือก BU แล้วทั้งรายชื่อและปุ่มสถานะเหลือแค่ BU นั้น
 * - หัวหน้ากับผู้ดูแลเห็นชื่อ · คนอื่นเห็นแค่ยอด (แยก BU ได้เหมือนกัน เพราะเป็นยอด ไม่ใช่ชื่อ)
 * - ดึงใหม่เองทุก 1 นาทีแม้ตอนปิดอยู่ (ตัวเลขบนแถบหัวต้องเป็นของตอนนี้)
 * นิยามอยู่ `src/lib/homePresence.ts`
 */
import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toneOfBu } from '@/components/team-online/teamOnlineTones';
import { EVEN_TYPE, TONE } from '@/lib/designTokens';
import { metricHelp, type MetricKey } from '@/lib/metricDictionary';
import {
  PRESENCE_LABEL,
  PRESENCE_NO_BU_LABEL,
  PRESENCE_STATUSES,
  PRESENCE_TONE,
  activeAgoText,
  lastLoginText,
  type HomePresenceResponse,
  type PresenceCounts,
  type PresenceStatus,
} from '@/lib/homePresence';
import { fetchHomePresence } from '@/lib/homePresenceApi';
import { trendBuLabel } from '@/lib/trends/bu';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');
const TIME = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
const PAGE = 10;
const REFRESH_MS = 60_000;

type Filter = 'all' | PresenceStatus;
/** 'all' = ทุก BU · '' = ไม่ระบุ BU · อื่น ๆ = รหัส BU ชุดแผนก */
type BuFilter = 'all' | string;

/** ค่าในตัวเลือกของ dropdown — Radix ห้ามค่าว่าง ⇒ "ไม่ระบุ BU" ต้องมีชื่อแทน */
const OPT_ALL = '__all__';
const OPT_NO_BU = '__none__';
const toOption = (b: BuFilter) => (b === 'all' ? OPT_ALL : b === '' ? OPT_NO_BU : b);
const fromOption = (v: string): BuFilter => (v === OPT_ALL ? 'all' : v === OPT_NO_BU ? '' : v);

const HELP: Record<PresenceStatus, MetricKey> = {
  online: 'presence.online',
  offline: 'presence.offline',
  never: 'presence.never',
};

const buName = (bu: string) => (bu ? bu : PRESENCE_NO_BU_LABEL);
const onlineOf = (c: PresenceCounts) => `Online ${NUM.format(c.online)} จาก ${NUM.format(c.total)}`;

const HomePresencePanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<HomePresenceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [bu, setBu] = useState<BuFilter>('all');
  const [page, setPage] = useState(0);

  useEffect(() => {
    let alive = true;
    const pull = () =>
      fetchHomePresence()
        .then((d) => {
          if (!alive) return;
          setData(d);
          setError(null);
        })
        .catch((e: unknown) => {
          if (alive) setError(e instanceof Error && e.message ? e.message : 'โหลดรายชื่อไม่ขึ้น ลองรีเฟรชอีกครั้ง');
        });
    void pull();
    const timer = window.setInterval(() => void pull(), REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const now = data ? new Date(data.generated_at) : new Date();
  const byBu = data?.by_bu ?? [];
  // BU ที่เลือกไว้หายไปจากรอบดึงใหม่ (คนย้าย/ปิดบัญชี) = กลับไปทุก BU ไม่ค้างหน้าว่าง
  const buNow: BuFilter = bu === 'all' || byBu.some((b) => b.bu === bu) ? bu : 'all';
  const counts: PresenceCounts | null =
    buNow === 'all' ? (data?.counts ?? null) : (byBu.find((b) => b.bu === buNow)?.counts ?? null);
  const people = data?.people ?? null;
  const inBu = people ? (buNow === 'all' ? people : people.filter((p) => (p.bu || '') === buNow)) : [];
  const list = filter === 'all' ? inBu : inBu.filter((p) => p.status === filter);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const rows = list.slice(cur * PAGE, cur * PAGE + PAGE);
  const choose = (f: Filter) => {
    setFilter(f);
    setPage(0);
  };
  const chooseBu = (v: string) => {
    setBu(fromOption(v));
    setPage(0);
  };
  const countOf = (f: Filter) => (counts ? (f === 'all' ? counts.total : counts[f]) : 0);
  const chipLabel = (f: Filter) => `${f === 'all' ? 'ทั้งหมด' : PRESENCE_LABEL[f]} ${NUM.format(countOf(f))}`;
  // บัญชีที่ถูกล็อกแผนกเห็นแค่ BU เดียวอยู่แล้ว ⇒ ไม่ต้องมีตัวเลือก BU
  const showBuPicker = byBu.length > 1;
  const headline = data?.counts && !data.error ? onlineOf(data.counts) : null;

  return (
    <Card variant="glass" className="p-5 sm:p-6">
      <Collapsible open={open} onOpenChange={setOpen}>
        <h2 className="-mx-2">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="h-auto w-full justify-between gap-3 rounded-xl px-2 py-2 text-base font-medium text-foreground"
            >
              <span>ใครอยู่ในระบบ</span>
              <span className="inline-flex items-center gap-3">
                {headline ? <span className="text-xs font-normal text-muted-foreground tabular-nums">{headline}</span> : null}
                <ChevronDown className={cn('text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
              </span>
            </Button>
          </CollapsibleTrigger>
        </h2>

        <CollapsibleContent className="space-y-4 pt-4">
          {!data && !error ? (
            <div className="space-y-2" aria-label="กำลังโหลดรายชื่อ">
              <Skeleton className="h-9 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
          ) : error && !data ? (
            <p className={cn('text-sm', TONE.danger.value)}>{error}</p>
          ) : data?.error ? (
            <p className={cn('text-sm', TONE.danger.value)}>{data.error}</p>
          ) : counts && data?.counts ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {showBuPicker ? (
                  <Select value={toOption(buNow)} onValueChange={chooseBu}>
                    {/* `!` = ชนะ `.jarvis-soft-field` ของ SelectTrigger (อยู่ชั้น utilities หลัง Tailwind) */}
                    <SelectTrigger aria-label="เลือก BU" className="h-9 min-w-40 gap-2 !w-auto !rounded-full">
                      <SelectValue>{buNow === 'all' ? 'ทุก BU' : buName(buNow)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className={cn('rounded-xl', EVEN_TYPE)}>
                      <SelectItem value={OPT_ALL} className="py-2">
                        <span className="flex w-60 items-center justify-between gap-4">
                          <span>ทุก BU</span>
                          <span className="text-xs text-muted-foreground tabular-nums">{onlineOf(data.counts)}</span>
                        </span>
                      </SelectItem>
                      {byBu.map((b) => (
                        <SelectItem key={toOption(b.bu)} value={toOption(b.bu)} className="py-2">
                          <span className="flex w-60 items-center justify-between gap-4" title={b.bu ? trendBuLabel(b.bu) : undefined}>
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className={cn('inline-block h-2 w-2 rounded-full bg-current', TONE[b.bu ? toneOfBu(b.bu) : 'neutral'].value)}
                                aria-hidden
                              />
                              {buName(b.bu)}
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums">{onlineOf(b.counts)}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}

                <div className="flex flex-wrap gap-1.5" role="group" aria-label="กรองรายชื่อ">
                  {(['all', ...PRESENCE_STATUSES] as Filter[]).map((f) =>
                    people ? (
                      <Button
                        key={f}
                        type="button"
                        size="xs"
                        variant={filter === f ? 'default' : 'outline'}
                        aria-pressed={filter === f}
                        title={f === 'all' ? undefined : metricHelp(HELP[f])}
                        onClick={() => choose(f)}
                      >
                        {f !== 'all' ? (
                          <span className={cn('inline-block h-2 w-2 rounded-full', TONE[PRESENCE_TONE[f]].dot)} aria-hidden />
                        ) : null}
                        {chipLabel(f)}
                      </Button>
                    ) : (
                      <span
                        key={f}
                        className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border px-2.5 text-xs text-foreground"
                        title={f === 'all' ? undefined : metricHelp(HELP[f])}
                      >
                        {f !== 'all' ? (
                          <span className={cn('inline-block h-2 w-2 rounded-full', TONE[PRESENCE_TONE[f]].dot)} aria-hidden />
                        ) : null}
                        {chipLabel(f)}
                      </span>
                    ),
                  )}
                </div>

                <span className="ml-auto text-xs text-muted-foreground tabular-nums">อัปเดต {TIME.format(new Date(data.generated_at))}</span>
              </div>

              {people ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">ชื่อ</TableHead>
                        <TableHead className="text-xs">BU</TableHead>
                        <TableHead className="text-xs">สถานะ</TableHead>
                        <TableHead className="text-xs" title={metricHelp('presence.lastLogin')}>
                          เข้าระบบล่าสุด
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((p) => {
                        const ago = p.status === 'online' ? activeAgoText(p.lastActiveAt, now) : null;
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="text-sm text-foreground">{p.name}</TableCell>
                            <TableCell className="text-xs">
                              {/* รหัสสั้นพอให้แถวไม่แตก · ชื่อเต็มของ BU ขึ้นตอนจี้ */}
                              <span
                                className="inline-flex items-center gap-1.5 whitespace-nowrap text-foreground"
                                title={p.bu ? trendBuLabel(p.bu) : undefined}
                              >
                                <span
                                  className={cn('inline-block h-2 w-2 rounded-full bg-current', TONE[p.bu ? toneOfBu(p.bu) : 'neutral'].value)}
                                  aria-hidden
                                />
                                {p.bu || 'ไม่ระบุ'}
                              </span>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs">
                              <span className="inline-flex items-center gap-1.5">
                                <span className={cn('inline-block h-2 w-2 rounded-full', TONE[PRESENCE_TONE[p.status]].dot)} aria-hidden />
                                <span className={p.status === 'never' ? TONE.danger.value : 'text-foreground'}>
                                  {PRESENCE_LABEL[p.status]}
                                </span>
                                {ago ? <span className="text-muted-foreground">ใช้งาน {ago}</span> : null}
                              </span>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs tabular-nums text-foreground">
                              {lastLoginText(p.lastLoginAt, now)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {list.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">ไม่มีใครในกลุ่มนี้</p> : null}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {list.length === 0
                        ? ''
                        : `แสดง ${NUM.format(cur * PAGE + 1)}–${NUM.format(Math.min(list.length, cur * PAGE + PAGE))} จาก ${NUM.format(list.length)} คน`}
                    </p>
                    {pages > 1 ? (
                      <Pagination className="mx-0 w-auto justify-end">
                        <PaginationContent>
                          <PaginationItem>
                            <Button type="button" size="xs" variant="outline" disabled={cur === 0} onClick={() => setPage(cur - 1)}>
                              ก่อนหน้า
                            </Button>
                          </PaginationItem>
                          <PaginationItem>
                            <span className="px-2 text-xs tabular-nums text-muted-foreground">
                              หน้า {NUM.format(cur + 1)} / {NUM.format(pages)}
                            </span>
                          </PaginationItem>
                          <PaginationItem>
                            <Button type="button" size="xs" variant="outline" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>
                              ถัดไป
                            </Button>
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">รายชื่อเปิดให้หัวหน้ากับผู้ดูแลเห็น</p>
              )}
            </>
          ) : null}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default HomePresencePanel;
