import React from 'react';
import { ChevronRight, FileText, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import {
  STUCK_PHASES,
  STUCK_REASON_LABEL,
  STUCK_SCOPE_LABEL,
  recruiterLabelOf,
  sortStuck,
  stuckByPhase,
  stuckByReason,
  stuckPhaseOf,
  stuckSteps,
  stuckWhoLine,
  type StuckPhaseKey,
  type StuckReasonKey,
  type StuckRequest,
} from '@/lib/recruitStuck';
import { OverviewCard } from '../RecruitOverviewParts';
import { GrowBar, GrowStack } from './GrowBar';

const toneOf = (phase: StuckPhaseKey) => STUCK_PHASES.find((p) => p.key === phase)!.tone;

/**
 * ═══ ส่วนที่ 1: ใบขอที่ต้องหา ติดตรงไหน (เจ้าของ 4 พ.ย. 2569 "เอาทำเลย") ═══
 * ยอดรวม → แถบ 4 ช่วง → กล่อง 4 ช่วง (กดกรองเหตุ) → เหตุทีละบรรทัด (กดแล้วขึ้นรายการใบ) → กดใบ = เส้นทางของใบนั้น
 * 🔴 กดได้ทุกเลข ("ไม่เอาเป็นตัวเลขเฉยๆ") · ว่าง = 0 ไม่หาย
 */
export default function StuckPhasesCard({
  rows,
  onOpenRequest,
  listOverride,
  onCloseList,
  title = 'ใบขอที่เหลือหา ติดตรงไหน',
  sub = 'ใบที่ยังเปิดอยู่ทั้งหมด ณ วันนี้ · กดได้ทุกตัวเลข',
  onFocus,
}: {
  /** ใบชุดอื่น (ปิดแล้ว · ยกเลิก · ขอใหม่) = "ไปถึงขั้นไหน" (4 พ.ย. 2569) */
  title?: string;
  sub?: string;
  /** ช่วง/เหตุที่กดอยู่ — ให้ส่วนอื่นของหน้าดูเฉพาะใบชุดนั้น */
  onFocus?: (focus: { phase: StuckPhaseKey | null; reason: StuckReasonKey | null }) => void;
  rows: readonly StuckRequest[];
  /** เปิดใบในกล่องงาน/หน้าใบขอ */
  onOpenRequest?: (r: StuckRequest) => void;
  /** รายการใบที่ส่วนอื่นกดมา (ติดที่ใคร · พื้นที่) — ขึ้นแทนรายการของเหตุ */
  listOverride?: { title: string; rows: StuckRequest[] } | null;
  onCloseList?: () => void;
}) {
  const [phase, setPhase] = React.useState<StuckPhaseKey | null>(null);
  const [reason, setReason] = React.useState<StuckReasonKey | null>(null);
  const [detail, setDetail] = React.useState<string | null>(null);
  React.useEffect(() => {
    onFocus?.({ phase, reason });
  }, [phase, reason, onFocus]);
  const total = rows.length;
  const need = rows.reduce((s, r) => s + r.remaining, 0);
  const byPhase = React.useMemo(() => stuckByPhase(rows), [rows]);
  const byReason = React.useMemo(() => stuckByReason(rows), [rows]);
  const maxReason = Math.max(1, ...Object.values(byReason).map((l) => l.length));

  const list = listOverride ?? (reason ? { title: STUCK_REASON_LABEL[reason], rows: byReason[reason] } : null);
  const detailRow = detail ? rows.find((r) => r.requestNo === detail) ?? null : null;

  return (
    <OverviewCard icon={FileText} title={title} sub={sub}>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-3xl font-medium tabular-nums text-foreground" data-testid="stuck-total">
          {fmt(total)} <span className={cn('text-base font-normal', DASH.sub)}>ใบ</span>
        </span>
        <span className={cn('text-sm tabular-nums', DASH.sub)}>เหลือหา {fmt(need)} อัตรา</span>
      </div>
      <GrowStack parts={STUCK_PHASES.map((p) => ({ label: p.label, tone: p.tone, pct: total ? (byPhase[p.key].length / total) * 100 : 0 }))} />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" data-testid="stuck-phases">
        {STUCK_PHASES.map((p) => (
          <Button
            key={p.key}
            type="button"
            variant="ghost"
            aria-pressed={phase === p.key}
            onClick={() => {
              setPhase((cur) => (cur === p.key ? null : p.key));
              setReason(null);
              onCloseList?.();
            }}
            className={cn('h-auto flex-col items-stretch justify-start gap-0 whitespace-normal rounded-xl border p-3 text-left font-normal', TONE[p.tone].soft, phase === p.key && 'ring-2 ring-ring')}
            data-testid={`stuck-phase-${p.key}`}
          >
            <span className={cn('text-2xl font-medium tabular-nums', TONE[p.tone].num)}>{fmt(byPhase[p.key].length)}</span>
            <span className="text-xs text-foreground">{p.label}</span>
          </Button>
        ))}
      </div>

      <div className="space-y-1" data-testid="stuck-reasons">
        {STUCK_PHASES.filter((p) => !phase || p.key === phase).map((p) => (
          <React.Fragment key={p.key}>
            <p className={cn('pt-2 text-xs', DASH.sub)}>{p.label}</p>
            {p.reasons.map((k) => {
              const l = byReason[k];
              return (
                <Button
                  key={k}
                  type="button"
                  variant="ghost"
                  aria-pressed={reason === k}
                  onClick={() => {
                    setReason((cur) => (cur === k ? null : k));
                    onCloseList?.();
                  }}
                  className={cn('grid h-auto w-full grid-cols-[minmax(0,1fr)_minmax(80px,2fr)_56px] items-center gap-3 whitespace-normal rounded-lg px-2 py-1.5 text-left font-normal', reason === k && 'bg-muted')}
                  data-testid={`stuck-reason-${k}`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-foreground">{STUCK_REASON_LABEL[k]}</span>
                    <span className={cn('block truncate text-xs', DASH.sub)}>{stuckWhoLine(l)}</span>
                  </span>
                  <GrowBar pct={(l.length / maxReason) * 100} tone={p.tone} />
                  <span className={cn('text-right text-sm font-medium tabular-nums', l.length === 0 && DASH.sub)}>{fmt(l.length)}</span>
                </Button>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {list ? (
        <div className="space-y-2 rounded-xl border border-border p-3" data-testid="stuck-list">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {list.title} · {fmt(list.rows.length)} ใบ
            </p>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => {
                setReason(null);
                onCloseList?.();
              }}
            >
              <X aria-hidden />
              ปิด
            </Button>
          </div>
          <div className="max-h-96 overflow-auto rounded-lg border border-border">
            <Table className="min-w-[52rem]">
              <TableHeader>
                <TableRow className={DASH.tableHead}>
                  <TableHead className="text-xs">ใบขอ</TableHead>
                  <TableHead className="text-xs">หน่วยงาน · ตำแหน่ง</TableHead>
                  <TableHead className="text-xs">ติดตรงไหน</TableHead>
                  <TableHead className="text-xs">เจ้าหน้าที่</TableHead>
                  <TableHead className="text-right text-xs">ผ่านมา</TableHead>
                  <TableHead className="text-right text-xs">เหลือหา</TableHead>
                  <TableHead className="text-right text-xs">กรอกมา</TableHead>
                  <TableHead className="text-right text-xs">ยังไม่โทร</TableHead>
                  <TableHead className="text-right text-xs">นัดได้</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className={cn('py-4 text-center text-sm', DASH.sub)}>
                      ไม่มีใบขอ
                    </TableCell>
                  </TableRow>
                ) : null}
                {sortStuck(list.rows).map((r) => {
                  const ph = stuckPhaseOf(r.reason);
                  return (
                    <TableRow key={r.requestNo} className={cn('cursor-pointer', detail === r.requestNo && 'bg-muted/60')} onClick={() => setDetail((cur) => (cur === r.requestNo ? null : r.requestNo))} data-testid="stuck-list-row">
                      <TableCell className="whitespace-nowrap text-sm tabular-nums">
                        {r.requestNo}
                        <span className={cn('block text-xs', DASH.sub)}>{[r.bu, r.state && r.state !== 'open' ? STUCK_SCOPE_LABEL[r.state] : null].filter(Boolean).join(' · ')}</span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.unitName ?? '—'}
                        {r.position ? <span className={cn('block text-xs', DASH.sub)}>{r.position}</span> : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('whitespace-normal font-normal', TONE[toneOf(ph)].outline)}>
                          {STUCK_REASON_LABEL[r.reason]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{recruiterLabelOf(r)}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.ageDays === null ? '—' : `${fmt(r.ageDays)} วัน`}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.remaining)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.signals.counts.apps)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.signals.uncalled)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.signals.counts.appointed)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      {detailRow ? <StuckDetail row={detailRow} onClose={() => setDetail(null)} onOpenRequest={onOpenRequest} /> : null}
    </OverviewCard>
  );
}

/** เส้นทางของใบหนึ่งใบ — ขั้นที่ติดมีกรอบ · ปุ่มเปิดใบ */
function StuckDetail({ row, onClose, onOpenRequest }: { row: StuckRequest; onClose: () => void; onOpenRequest?: (r: StuckRequest) => void }) {
  const steps = stuckSteps(row);
  const ph = stuckPhaseOf(row.reason);
  return (
    <div className="space-y-2 rounded-xl border border-border p-3" data-testid="stuck-detail">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {row.requestNo} · {row.unitName ?? ''}
        </p>
        <div className="flex gap-2">
          {onOpenRequest ? (
            <Button type="button" variant="outline" size="xs" onClick={() => onOpenRequest(row)}>
              เปิดใบขอ
              <ChevronRight aria-hidden />
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="xs" onClick={onClose}>
            <X aria-hidden />
            ปิด
          </Button>
        </div>
      </div>
      <p className={cn('text-xs', DASH.sub)}>
        {[row.position, `เจ้าหน้าที่สรรหา ${recruiterLabelOf(row)}`, row.ageDays === null ? null : `ผ่านมา ${fmt(row.ageDays)} วัน`, `เหลือหา ${fmt(row.remaining)} อัตรา`, `ติดที่ "${STUCK_REASON_LABEL[row.reason]}"`]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <div className="flex flex-wrap items-center gap-1.5" data-testid="stuck-steps">
        {steps.map((s, i) => (
          <React.Fragment key={s.key}>
            {i > 0 ? <ChevronRight className={cn('h-3.5 w-3.5', DASH.sub)} aria-hidden /> : null}
            <div className={cn('flex min-w-20 flex-col rounded-lg border px-2 py-1.5', s.stuck ? cn(TONE[toneOf(ph)].soft, 'ring-2 ring-ring') : 'border-border bg-muted/40')} data-stuck={s.stuck ? '1' : undefined}>
              <span className={cn('text-xs', DASH.sub)}>{s.label}</span>
              <span className="text-base font-medium tabular-nums text-foreground">{typeof s.value === 'number' ? fmt(s.value) : s.value}</span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
