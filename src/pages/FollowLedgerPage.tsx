/**
 * ═══ สมุดบัญชีติดตาม — ทุกรายการเรียงตามเวลา (เจ้าของ 7 ต.ค. 2569) ═══
 *
 * เจ้าของ: *"ลองนึกภาพอะธนาคาร หุ้น ไรเงี้ย · มันต้องละเอียดทุก Activity"* → Choice "แบบสมุดบัญชี" · "หน้ารวมทุกรายการ" ·
 * "บนหน้าหลัก" (ปุ่มบนหน้าหลัก หัวข้อติดตาม → `/?home=ledger` · ปุ่มกลับหน้าหลัก)
 * - หัวหน้า: ยกมา + เพิ่ม − ได้ผล − ยกเลิก = คงเหลือ (บรรทัดบวกลบให้เห็น · ไม่ลงตัว = แดง)
 * - ตาราง: เวลา · รายการ · ชื่อ · แท็บ · ใครทำ · ผล · เข้า/ออก · คงเหลือหลังรายการ (ใหม่สุดก่อน)
 * - กรองแท็บ = คิดยอดใหม่ของแท็บนั้น · กรองรายการ/ค้นชื่อ = ซ่อนบรรทัดเฉย ๆ ยอดไม่เปลี่ยน
 * ยอดคิดที่ `src/lib/followLedger.ts` · ข้อมูลจาก `/api/home-ai-share?ledger=follow`
 * 🔴 shadcn (Card · Tabs · Select · Button · Table · Skeleton) · ค้นหาบนแถบบน (`useHeaderSearch`) · ไม่มีประโยคอธิบายบนจอ
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PeriodPicker from '@/components/shared/PeriodPicker';
import { useHeaderSearch } from '@/hooks/useHeaderSearch';
import { EVEN_TYPE, TONE } from '@/lib/designTokens';
import { FOLLOW_MATRIX_COL_LABEL, FOLLOW_MATRIX_COL_TONE } from '@/lib/followCallMatrix';
import { journeyResultMatrixCol, type FollowJourneyView } from '@/lib/followJourney';
import { buildLedger, ledgerBalances, LEDGER_KIND_LABEL, type FollowLedgerResponse, type LedgerKind } from '@/lib/followLedger';
import { defaultAiShareWindow, followPlanBounds, type AiShareWindow } from '@/lib/homeAiShare';
import { fetchFollowLedger } from '@/lib/homeAiShareApi';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');
const WHEN = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const VIEWS: ReadonlyArray<[FollowJourneyView, string]> = [
  ['all', 'รวม 2 แท็บ'],
  ['main', 'ติดตามคนเริ่มงาน'],
  ['replacement', 'ติดตามส่งคนแทน'],
];
const TEAM_SHORT = { main: 'คนเริ่มงาน', replacement: 'ส่งคนแทน' } as const;

type KindFilter = 'all' | 'balance' | LedgerKind;
const KIND_FILTERS: ReadonlyArray<[KindFilter, string]> = [
  ['all', 'ทุกรายการ'],
  ['balance', 'เฉพาะที่กระทบยอด'],
  ['add', LEDGER_KIND_LABEL.add],
  ['send', LEDGER_KIND_LABEL.send],
  ['result', LEDGER_KIND_LABEL.result],
  ['cancel', LEDGER_KIND_LABEL.cancel],
  ['edit', LEDGER_KIND_LABEL.edit],
  ['reschedule', LEDGER_KIND_LABEL.reschedule],
  ['reopen', LEDGER_KIND_LABEL.reopen],
  ['staffClear', LEDGER_KIND_LABEL.staffClear],
  ['irecruitEdit', LEDGER_KIND_LABEL.irecruitEdit],
];

const PAGE = 50;

const FollowLedgerPage: React.FC = () => {
  const [win, setWin] = useState<AiShareWindow>(() => defaultAiShareWindow());
  const [data, setData] = useState<FollowLedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<FollowJourneyView>('all');
  const [kind, setKind] = useState<KindFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const searchInHeader = useHeaderSearch({ value: search, onChange: setSearch, placeholder: 'ค้นชื่อ / หน่วยงาน / คนทำ' });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchFollowLedger(win)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error && e.message ? e.message : 'โหลดสมุดบัญชีไม่ขึ้น ลองรีเฟรชอีกครั้ง');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [win]);
  useEffect(() => setPage(0), [win, view, kind, search]);

  const current = data && data.from === win.from && data.to === win.to ? data : null;
  const ledger = useMemo(() => {
    if (!current) return null;
    const { start, end } = followPlanBounds(win);
    const calls = view === 'all' ? current.calls : current.calls.filter((c) => c.team === view);
    return buildLedger(calls, current.notes, start, end);
  }, [current, view, win]);

  const shown = useMemo(() => {
    if (!ledger) return [];
    const q = search.trim().toLowerCase();
    return ledger.lines.filter((l) => {
      if (kind === 'balance' ? l.delta === 0 : kind !== 'all' && l.kind !== kind) return false;
      if (!q) return true;
      return [l.call.name, l.call.unit, l.by].some((x) => (x ?? '').toLowerCase().includes(q));
    });
  }, [ledger, kind, search]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const first = page * PAGE;
  const rows = shown.slice(first, first + PAGE);
  const failed = error ?? current?.error ?? null;
  const ok = ledger ? ledgerBalances(ledger) : true;

  const tile = (label: string, n: number | null, sign: string, testid: string, tone?: keyof typeof TONE) => (
    <div className="space-y-1 rounded-xl border border-border/70 px-4 py-3" data-testid={testid}>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {tone ? <span className={cn('h-2 w-2 rounded-full', TONE[tone].dot)} aria-hidden /> : null}
        {label}
      </span>
      <span className="block text-2xl font-light tabular-nums text-foreground">
        {n === null ? <Skeleton className="h-8 w-16" /> : `${sign}${NUM.format(n)}`}
      </span>
    </div>
  );

  return (
    <div className={cn('space-y-6 py-6 md:py-8', EVEN_TYPE)} data-testid="follow-ledger">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/?home=new">
            <ChevronLeft aria-hidden />
            หน้าหลัก
          </Link>
        </Button>
        <h1 className="text-2xl font-light text-foreground">สมุดบัญชีติดตาม</h1>
        <PeriodPicker value={win} onChange={setWin} />
        <Tabs value={view} onValueChange={(v) => setView(v as FollowJourneyView)}>
          <TabsList>
            {VIEWS.map(([k, label]) => (
              <TabsTrigger key={k} value={k}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {failed ? <p className={cn('text-sm', TONE.danger.value)}>{failed}</p> : null}

      <Card variant="glass" className="space-y-4 p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {tile('ยกมา', ledger?.opening ?? null, '', 'ledger-opening')}
          {tile('เพิ่ม', ledger?.added ?? null, '+', 'ledger-added', 'primary')}
          {tile('ได้ผล', ledger?.results ?? null, '−', 'ledger-results', 'success')}
          {tile('ยกเลิก', ledger?.cancelled ?? null, '−', 'ledger-cancelled', 'neutral')}
          {tile('คงเหลือ', ledger?.closing ?? null, '', 'ledger-closing', 'info')}
        </div>
        {ledger ? (
          <p className={cn('text-sm tabular-nums', ok ? 'text-muted-foreground' : TONE.danger.value)} data-testid="ledger-equation">
            {NUM.format(ledger.opening)} + {NUM.format(ledger.added)} − {NUM.format(ledger.results)} − {NUM.format(ledger.cancelled)} ={' '}
            {NUM.format(ledger.opening + ledger.added - ledger.results - ledger.cancelled)}
            {ok ? '' : ` · ไม่ตรงกับคงเหลือ ${NUM.format(ledger.closing)}`}
          </p>
        ) : null}
      </Card>

      <Card variant="glass" className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={kind} onValueChange={(v) => setKind(v as KindFilter)}>
            <SelectTrigger aria-label="เลือกรายการ" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KIND_FILTERS.map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {searchInHeader ? null : (
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นชื่อ / หน่วยงาน / คนทำ" className="w-64" />
          )}
          <span className="text-sm tabular-nums text-muted-foreground">
            {NUM.format(shown.length)} รายการ
          </span>
        </div>

        <div className="overflow-x-auto">
          <Table data-testid="ledger-table">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">เวลา</TableHead>
                <TableHead className="text-xs">รายการ</TableHead>
                <TableHead className="text-xs">ชื่อ</TableHead>
                <TableHead className="text-xs">แท็บ</TableHead>
                <TableHead className="text-xs">ใครทำ</TableHead>
                <TableHead className="text-xs">ผล</TableHead>
                <TableHead className="text-right text-xs">เข้า</TableHead>
                <TableHead className="text-right text-xs">ออก</TableHead>
                <TableHead className="text-right text-xs">คงเหลือ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !ledger ? (
                Array.from({ length: 6 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={9}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                    ไม่มีรายการ
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((l) => {
                  const col = l.result ? journeyResultMatrixCol(l.result) : null;
                  return (
                    <TableRow key={l.key}>
                      <TableCell className="whitespace-nowrap text-xs tabular-nums text-foreground">{WHEN.format(new Date(l.at))}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-foreground">{LEDGER_KIND_LABEL[l.kind]}</TableCell>
                      <TableCell className="text-sm text-foreground">
                        {l.call.name}
                        {l.call.unit ? <span className="block text-xs text-muted-foreground">{l.call.unit}</span> : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{TEAM_SHORT[l.call.team]}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.by ?? '—'}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {col ? (
                          <span className="inline-flex items-center gap-1.5 text-foreground">
                            <span className={cn('inline-block h-2 w-2 rounded-full', TONE[FOLLOW_MATRIX_COL_TONE[col]].dot)} aria-hidden />
                            {l.result === 'reschedule' ? 'ขอเลื่อน' : FOLLOW_MATRIX_COL_LABEL[col]}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-foreground">{l.delta > 0 ? '+1' : ''}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-foreground">{l.delta < 0 ? '−1' : ''}</TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums text-foreground">{NUM.format(l.balance)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {shown.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs tabular-nums text-muted-foreground">
              แสดง {NUM.format(first + 1)}–{NUM.format(first + rows.length)} จาก {NUM.format(shown.length)} รายการ
            </p>
            {pages > 1 ? (
              <div className="flex items-center gap-2">
                <Button type="button" size="xs" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  ก่อนหน้า
                </Button>
                <span className="px-2 text-xs tabular-nums text-muted-foreground">
                  หน้า {NUM.format(page + 1)} / {NUM.format(pages)}
                </span>
                <Button type="button" size="xs" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
                  ถัดไป
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
};

export default FollowLedgerPage;
