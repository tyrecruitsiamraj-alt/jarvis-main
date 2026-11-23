/**
 * แผงไล่ 12 เดือน → รายวัน → BU → เหตุผล ของกล่องหน้าหลัก (เจ้าของ 22 พ.ย. 2569)
 * > "กดไปที่กล่องอย่าพึ่งโชว์ข้อมูลแต่แยกเป็นเดือนก่อน … กดเดือนไหนก็แยกเป็นวัน ที่ในแท่ง 100% บอกว่า Bu ละกี่ %
 * >  … กด Bu ไหนก็เห็นว่าเหตุผลยังไง … ต้องบอกยอดรวมแล้วบอก % ด้วย"
 *
 * แท่ง = 100% แบ่งสีตาม BU · เลขบนแท่ง = ยอดรวม · ตาราง BU ใต้กราฟ = ยอด + % ของขอบเขตที่เลือก (12 เดือน / เดือน / วัน)
 * กด BU (หรือ "ทุก BU") = เหตุผลของ BU นั้นในขอบเขตเดียวกัน ยอด + % · ทางกลับ = แถบทางเดินบนสุด
 * ข้อมูลชุดเดียวทุกกล่อง (`/api/home-drill` · จำไว้ 2 นาที) ตัวนับอยู่ `src/lib/homeDrill.ts`
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { buDot } from '@/components/dashboard-trends/v2/V2Parts';
import { TONE, type ToneKey } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import { trendBuLabel } from '@/lib/trends/bu';
import { fetchHomeDrill } from '@/lib/homeDrillApi';
import { requestPathOfJobId } from '@/lib/jobNavigation';
import {
  drillBuShares,
  drillDayBars,
  drillIds,
  drillLabeledIds,
  drillSetOf,
  drillMonthBars,
  drillReasonRows,
  monthLabel,
  pctOf,
  type DrillBar,
  type DrillBoxKey,
  type DrillPayload,
  type DrillReasonRow,
  type DrillScope,
} from '@/lib/homeDrill';

const NUM = new Intl.NumberFormat('th-TH');
const buName = (bu: string) => (bu ? trendBuLabel(bu) : 'ไม่ระบุ BU');
const buShort = (bu: string) => bu || 'ไม่ระบุ';
const dayLabel = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${d} ${monthLabel(`${y}-${String(m).padStart(2, '0')}`)} ${y + 543}`;
};

function Bars({ bars, selected, onPick, dense }: { bars: DrillBar[]; selected: string | null; onPick: (key: string) => void; dense?: boolean }) {
  return (
    <div className="overflow-x-auto pb-1">
      <div className={cn('flex items-end gap-1.5', dense ? 'min-w-[38rem]' : 'min-w-[22rem]')} data-testid="drill-bars">
        {bars.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => onPick(b.key)}
            className={cn('group flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg p-0.5 transition-colors hover:bg-muted', selected === b.key && 'bg-muted')}
            aria-label={`${b.label} ${NUM.format(b.total)}`}
            aria-pressed={selected === b.key}
            data-testid={`drill-bar-${b.key}`}
          >
            <span className="text-xs font-medium tabular-nums text-foreground">{NUM.format(b.total)}</span>
            <span
              className={cn(
                'flex h-40 w-full flex-col-reverse overflow-hidden rounded-md bg-muted',
                selected === b.key ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : 'group-hover:ring-1 group-hover:ring-border',
              )}
            >
              {b.byBu.map((s) => {
                const pct = pctOf(s.n, b.total);
                return (
                  <span
                    key={s.bu}
                    className={cn('flex w-full items-center justify-center text-xs text-white', buDot(s.bu))}
                    style={{ height: `${(s.n / b.total) * 100}%` }}
                    title={`${buName(s.bu)} ${NUM.format(s.n)} (${pct}%)`}
                  >
                    {!dense && pct >= 15 ? `${pct}%` : null}
                  </span>
                );
              })}
            </span>
            <span className="text-xs text-muted-foreground">{b.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ReasonList({ rows, total, unit }: { rows: DrillReasonRow[]; total: number; unit: string }) {
  const groups = useMemo(() => {
    const out: Array<{ title: string | null; rows: DrillReasonRow[] }> = [];
    for (const r of rows) {
      const g = r.group ?? null;
      const last = out[out.length - 1];
      if (last && last.title === g) last.rows.push(r);
      else out.push({ title: g, rows: [r] });
    }
    return out;
  }, [rows]);
  return (
    <div className="space-y-3" data-testid="drill-reasons">
      {groups.map((g, gi) => {
        const sub = g.rows.reduce((s, r) => s + r.n, 0);
        return (
          <div key={`${g.title}-${gi}`} className="space-y-1.5">
            {g.title ? (
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-foreground">{g.title}</span>
                <span className="tabular-nums text-muted-foreground">
                  {NUM.format(sub)} {unit} · {pctOf(sub, total)}%
                </span>
              </div>
            ) : null}
            <ul className="space-y-1.5">
              {g.rows.map((r) => (
                <li key={r.key} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', TONE[r.tone as ToneKey]?.dot ?? TONE.neutral.dot)} aria-hidden />
                      <span className="truncate text-foreground">{r.label}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-foreground">
                      {NUM.format(r.n)} <span className="text-muted-foreground">· {r.pct}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className={cn('h-full rounded-full', TONE[r.tone as ToneKey]?.dot ?? TONE.neutral.dot)} style={{ width: `${r.pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export default function TimeDrillSheet({
  box,
  bu,
  onClose,
  onNames,
  summary,
  go,
  contentStyle,
}: {
  /** กล่องที่เปิด · null = ปิด */
  box: DrillBoxKey | null;
  /** ตัวกรอง BU ของหน้า (null = ทุก BU ในสิทธิ์) */
  bu: string | null;
  onClose: () => void;
  onNames: (title: string, ids: readonly string[]) => void;
  /** สรุปแบบเดิมของช่วงที่เลือกบนหน้า (แยกเจ้าหน้าที่ · ช่องทาง ฯลฯ) */
  summary?: { label: string; onOpen: () => void } | null;
  go?: { label: string; to: string } | null;
  contentStyle?: React.CSSProperties;
}) {
  const navigate = useNavigate();
  const [payload, setPayload] = useState<DrillPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<DrillScope>({});
  /** กล่องใบขอ: รายการใบที่กด "ดูรายการใบ" (เปลี่ยนขอบเขต = ปิดรายการ) */
  const [requestList, setRequestList] = useState<Array<{ id: string; label: string }> | null>(null);
  const isRequestSet = box ? drillSetOf(box) === 'requests' : false;

  useEffect(() => {
    setScope({});
  }, [box]);
  useEffect(() => {
    setRequestList(null);
  }, [box, scope.month, scope.day, scope.bu]);
  useEffect(() => {
    if (!box) return;
    let alive = true;
    setError(null);
    // ชุดข้อมูลตามกล่อง: ใบสมัคร หรือใบขอ — สลับกล่องคนละชุดต้องไม่โชว์ชุดเก่าค้าง
    setPayload(null);
    fetchHomeDrill(bu, drillSetOf(box))
      .then((p) => alive && setPayload(p))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'โหลดข้อมูล 12 เดือนไม่ขึ้น'));
    return () => {
      alive = false;
    };
  }, [box, bu]);

  const def = payload && box ? payload.boxes.find((b) => b.key === box) ?? null : null;
  const unit = def?.unit ?? '';
  const months = useMemo(() => (payload && box ? drillMonthBars(payload, box) : []), [payload, box]);
  const days = useMemo(() => (payload && box && scope.month ? drillDayBars(payload, box, scope.month) : []), [payload, box, scope.month]);
  const timeScope: DrillScope = { month: scope.month ?? null, day: scope.day ?? null };
  const shares = useMemo(() => (payload && box ? drillBuShares(payload, box, timeScope) : { total: 0, rows: [] }), [payload, box, scope.month, scope.day]); // eslint-disable-line react-hooks/exhaustive-deps
  const showReasons = scope.bu !== undefined;
  const reasons = useMemo(
    () => (payload && box && showReasons ? drillReasonRows(payload, box, { ...timeScope, bu: scope.bu ?? null }) : null),
    [payload, box, scope.month, scope.day, scope.bu, showReasons], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const periodText = scope.day ? dayLabel(scope.day) : scope.month ? monthLabel(scope.month, true) : '12 เดือนล่าสุด';
  const total12 = months.reduce((s, b) => s + b.total, 0);
  const scopeTotal = showReasons ? reasons?.total ?? 0 : shares.total;

  const crumbs: Array<{ label: string; onClick?: () => void }> = [{ label: '12 เดือน', onClick: scope.month || scope.bu !== undefined ? () => setScope({}) : undefined }];
  if (scope.month) crumbs.push({ label: monthLabel(scope.month, true), onClick: scope.day || scope.bu !== undefined ? () => setScope({ month: scope.month }) : undefined });
  if (scope.day) crumbs.push({ label: dayLabel(scope.day).replace(/ \d{4}$/, ''), onClick: scope.bu !== undefined ? () => setScope({ month: scope.month, day: scope.day }) : undefined });
  if (scope.bu !== undefined) crumbs.push({ label: scope.bu === null ? 'ทุก BU' : buShort(scope.bu) });

  const namesTitle = [def?.title, periodText, scope.bu === undefined ? null : scope.bu === null ? 'ทุก BU' : buShort(scope.bu)].filter(Boolean).join(' · ');

  return (
    <Sheet open={box !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full space-y-4 overflow-y-auto sm:max-w-3xl" style={contentStyle} data-testid="drill-sheet" onFocusOutside={(e) => e.preventDefault()}>
        <SheetHeader className="space-y-1 text-left">
          <SheetTitle>{def?.title ?? 'กำลังโหลด…'}</SheetTitle>
          <SheetDescription className="tabular-nums">
            {payload ? `${periodText}${bu ? ` · ${buShort(bu)}` : ''} · ${NUM.format(scopeTotal)} ${unit}` : error ? '' : 'กำลังโหลด 12 เดือน…'}
          </SheetDescription>
        </SheetHeader>

        <Breadcrumb>
          <BreadcrumbList>
            {crumbs.map((c, i) => (
              <React.Fragment key={`${c.label}-${i}`}>
                {i > 0 ? <BreadcrumbSeparator /> : null}
                <BreadcrumbItem>
                  {c.onClick ? (
                    <Button type="button" variant="outline" size="xs" onClick={c.onClick} data-testid={`drill-crumb-${i}`}>
                      {c.label}
                    </Button>
                  ) : (
                    <BreadcrumbPage className="text-sm">{c.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>

        {error ? (
          <p className={cn('text-sm', TONE.danger.value)} role="alert">
            {error}
          </p>
        ) : !payload ? (
          <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">กำลังโหลด 12 เดือน…</div>
        ) : (
          <>
            <section className="space-y-2 rounded-xl border border-border p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{scope.month ? `รายวัน · ${monthLabel(scope.month, true)}` : 'รายเดือน'}</p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {scope.month ? `${monthLabel(scope.month, true)} ${NUM.format(days.reduce((s, b) => s + b.total, 0))} ${unit}` : `12 เดือน ${NUM.format(total12)} ${unit}`}
                </p>
              </div>
              {scope.month ? (
                <Bars bars={days} dense selected={scope.day ?? null} onPick={(d) => setScope({ month: scope.month, day: scope.day === d ? undefined : d })} />
              ) : (
                <Bars bars={months} selected={null} onPick={(m) => setScope({ month: m })} />
              )}
            </section>

            <section className="space-y-2" data-testid="drill-bu">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-foreground">แยก BU · {periodText}</p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  รวม {NUM.format(shares.total)} {unit}
                </p>
              </div>
              <div className="divide-y divide-border rounded-xl border border-border">
                <Button
                  type="button"
                  variant="ghost"
                  className={cn('h-auto w-full justify-between rounded-none px-3 py-2', scope.bu === null && 'bg-muted')}
                  onClick={() => setScope({ ...timeScope, bu: null })}
                  data-testid="drill-bu-all"
                >
                  <span className="text-sm text-foreground">ทุก BU</span>
                  <span className="text-sm tabular-nums text-foreground">
                    {NUM.format(shares.total)} <span className="text-muted-foreground">· 100%</span>
                  </span>
                </Button>
                {shares.rows.map((r) => (
                  <Button
                    key={r.bu}
                    type="button"
                    variant="ghost"
                    className={cn('h-auto w-full flex-col items-stretch gap-1.5 rounded-none px-3 py-2', scope.bu === r.bu && 'bg-muted')}
                    onClick={() => setScope({ ...timeScope, bu: r.bu })}
                    data-testid={`drill-bu-${r.bu || 'none'}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', buDot(r.bu))} aria-hidden />
                        <span className="truncate text-sm text-foreground">{buName(r.bu)}</span>
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-foreground">
                        {NUM.format(r.n)} <span className="text-muted-foreground">· {r.pct}%</span>
                      </span>
                    </span>
                    <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <span className={cn('block h-full rounded-full', buDot(r.bu))} style={{ width: `${r.pct}%` }} />
                    </span>
                  </Button>
                ))}
                {shares.rows.length === 0 ? <p className="px-3 py-2 text-sm text-muted-foreground">ไม่มี{unit}ในช่วงนี้</p> : null}
              </div>
            </section>

            {reasons ? (
              <section className="space-y-2 rounded-xl border border-border p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    เหตุผล · {scope.bu === null ? 'ทุก BU' : buName(scope.bu ?? '')}
                  </p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    รวม {NUM.format(reasons.total)} {unit}
                    {scope.bu !== null && shares.total ? ` · ${pctOf(reasons.total, shares.total)}% ของทุก BU` : ''}
                  </p>
                </div>
                <ReasonList rows={reasons.rows} total={reasons.total} unit={unit} />
              </section>
            ) : (
              <p className="text-xs text-muted-foreground">กด BU เพื่อดูเหตุผล</p>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                disabled={scopeTotal === 0}
                onClick={() => {
                  if (!box || !payload) return;
                  const sc = { ...timeScope, bu: scope.bu ?? null };
                  // กล่องใบขอ = รายการใบ (เปิดหน้าใบขอได้) · กล่องผู้สมัคร = รายชื่อเดิม
                  if (isRequestSet) setRequestList(drillLabeledIds(payload, box, sc));
                  else onNames(namesTitle, drillIds(payload, box, sc));
                }}
                data-testid="drill-names"
              >
                {isRequestSet ? 'ดูรายการใบ' : 'ดูรายชื่อ'} {NUM.format(scopeTotal)} {unit}
              </Button>
              {summary ? (
                <Button type="button" variant="outline" onClick={summary.onOpen} data-testid="drill-summary">
                  {summary.label}
                </Button>
              ) : null}
            </div>
            {requestList ? (
              <section className="space-y-2" data-testid="drill-request-list">
                <p className="text-sm font-medium text-foreground">
                  {namesTitle} · {NUM.format(requestList.length)} ใบ
                </p>
                <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                  {requestList.map((r) => (
                    <li key={r.id}>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto w-full justify-start whitespace-normal rounded-none px-3 py-2 text-left text-sm font-normal"
                        onClick={() => navigate(requestPathOfJobId(r.id))}
                      >
                        {r.label}
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {go ? (
              <Button type="button" className="w-full" onClick={() => navigate(go.to)} data-testid="drill-go">
                ไปหน้าเต็ม · {go.label}
              </Button>
            ) : null}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
