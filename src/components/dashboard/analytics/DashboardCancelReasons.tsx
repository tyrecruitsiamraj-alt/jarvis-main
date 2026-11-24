import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import {
  CANCEL_GROUP_LABEL,
  CANCEL_GROUP_ORDER,
  cancelReasonEquation,
  pickableCancelReasons,
  type CancelReasonBreakdown,
  type CancelReasonGroup,
  type CancelReasonMaster,
  type EffectiveCancelReason,
} from '@/lib/requestCancelReason';
import { tagCancelReason } from '@/lib/requestCancelReasonsApi';

/**
 * ═══ ยกเลิกเพราะอะไร — ส่วนบนแผงใบขอตอนกดเลขยกเลิกบน Dashboard (เจ้าของ 24 พ.ย. 2569) ═══
 * สมการคงเดิม (ยังนับในยกเลิก) · แยก ได้คนแล้ว / ยกเลิกจริง / ไม่ได้กรอกเหตุผล + รายเหตุผล · กดแล้วรายการใบข้างล่างกรองตาม
 * ตัวคิด `requestCancelReason.ts` · ผลรวมทุกกลุ่ม = เลขบนกล่องยกเลิก
 */
const NUM = new Intl.NumberFormat('th-TH');
export const CANCEL_GROUP_TONE: Record<CancelReasonGroup, ToneKey> = { got_person: 'teal', cancelled: 'neutral', none: 'neutral' };

export function CancelReasonSummary({
  breakdown,
  group,
  reason,
  onGroup,
  onReason,
  error,
}: {
  breakdown: CancelReasonBreakdown;
  group: CancelReasonGroup | null;
  reason: string | null;
  onGroup: (g: CancelReasonGroup | null) => void;
  onReason: (label: string | null) => void;
  /** โหลดเหตุผลที่ทีมใส่ไม่ได้ — ยังแยกด้วยเหตุผลจาก ERP ได้ */
  error?: string;
}) {
  return (
    <div className="space-y-2" data-testid="dashboard-cancel-reasons">
      <p className="text-sm font-medium">ยกเลิกเพราะอะไร</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {CANCEL_GROUP_ORDER.map((g) => {
          const tone = TONE[CANCEL_GROUP_TONE[g]];
          const v = breakdown.groups[g];
          return (
            <Button
              key={g}
              type="button"
              variant="ghost"
              aria-pressed={group === g}
              onClick={() => {
                onGroup(group === g ? null : g);
                onReason(null);
              }}
              className={cn('h-auto flex-col items-start gap-1 whitespace-normal rounded-xl border px-3 py-2 text-left font-normal', tone.soft, tone.softHover, group === g && 'ring-2 ring-ring')}
              data-testid={`dashboard-cancel-group-${g}`}
            >
              <span className={cn('flex items-center gap-1.5 text-xs font-medium', tone.value)}>
                <span className={cn('h-2 w-2 shrink-0 rounded-full', tone.dot)} aria-hidden />
                {CANCEL_GROUP_LABEL[g]}
              </span>
              <span className={cn('text-[11px]', DASH.muted)}>
                <span className={cn('text-base font-medium tabular-nums', tone.num)}>{NUM.format(v.positions)}</span> อัตรา · {NUM.format(v.requests)} ใบ
              </span>
            </Button>
          );
        })}
      </div>
      <p className={cn('min-h-4 text-[11px] tabular-nums', DASH.muted)} data-testid="dashboard-cancel-equation">
        {cancelReasonEquation(breakdown)}
        {error ? ` · ${error}` : ''}
      </p>
      <div className="max-h-60 overflow-auto rounded-xl border border-border">
        <Table className="min-w-[28rem]">
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow className={DASH.tableHead}>
              <TableHead className="text-xs">เหตุผล</TableHead>
              <TableHead className="text-xs">กลุ่ม</TableHead>
              <TableHead className="text-right text-xs">อัตรา</TableHead>
              <TableHead className="text-right text-xs">ใบ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {breakdown.reasons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className={cn('py-4 text-center text-sm', DASH.muted)}>
                  ไม่มีใบขอ
                </TableCell>
              </TableRow>
            ) : null}
            {breakdown.reasons.map((r) => {
              const on = reason === r.label && group === r.group;
              return (
                <TableRow key={`${r.group}|${r.label}`} className={cn(on && 'bg-muted')} data-testid="dashboard-cancel-reason-row">
                  <TableCell className="text-sm">
                    <Button
                      type="button"
                      variant="link"
                      size="xs"
                      aria-pressed={on}
                      className="h-auto whitespace-normal p-0 text-left"
                      onClick={() => {
                        onGroup(on ? null : r.group);
                        onReason(on ? null : r.label);
                      }}
                    >
                      {r.label}
                    </Button>
                  </TableCell>
                  <TableCell className={cn('whitespace-nowrap text-sm', TONE[CANCEL_GROUP_TONE[r.group]].value)}>{CANCEL_GROUP_LABEL[r.group]}</TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">{NUM.format(r.positions)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{NUM.format(r.requests)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** ช่องเหตุผลในรายการใบ + ปุ่มใส่เหตุผล (ใบที่ ERP ไม่มีเหตุผล หรือเป็น "ยกเลิกโดย-สยามราช") */
export function CancelReasonCell({
  requestNo,
  displayNo,
  reason,
  masters,
  onSaved,
}: {
  /** เลขที่ใบขอดิบของ ERP · null = ใส่ไม่ได้ */
  requestNo: string | null;
  displayNo: string;
  reason: EffectiveCancelReason;
  masters: readonly CancelReasonMaster[];
  onSaved: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const options = pickableCancelReasons(masters);
  const source = reason.source === 'erp' ? 'ERP' : reason.source === 'team' ? (reason.byName ? `ใส่โดย ${reason.byName}` : 'ทีมใส่') : null;

  const save = async (reasonId: number | null) => {
    if (!requestNo) return;
    setBusy(true);
    setErr('');
    try {
      await tagCancelReason(requestNo, reasonId);
      await onSaved();
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'บันทึกเหตุผลไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-w-44 items-start justify-between gap-2">
      <div className="min-w-0">
        <p className={cn('text-sm', reason.source === 'none' && DASH.muted)}>{reason.label}</p>
        {source ? <p className={cn('text-[11px]', DASH.muted)}>{source}</p> : null}
      </div>
      {reason.taggable && requestNo ? (
        <Popover
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (o) {
              setPick(reason.reasonId != null ? String(reason.reasonId) : '');
              setErr('');
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="xs" className="shrink-0" data-testid="dashboard-cancel-reason-edit">
              {reason.source === 'team' ? 'เปลี่ยน' : 'ใส่เหตุผล'}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 space-y-3" data-testid="dashboard-cancel-reason-picker">
            <p className="text-sm font-medium">เหตุผลที่ยกเลิก · {displayNo}</p>
            {options.length === 0 ? (
              <p className={cn('text-sm', DASH.muted)}>ยังไม่มีเหตุผลให้เลือก</p>
            ) : (
              <RadioGroup value={pick} onValueChange={setPick} className="max-h-64 gap-3 overflow-auto">
                {(['got_person', 'cancelled'] as const).map((g) => {
                  const items = options.filter((o) => (o.gotPerson ? 'got_person' : 'cancelled') === g);
                  if (items.length === 0) return null;
                  return (
                    <div key={g} className="space-y-1.5">
                      <p className={cn('text-[11px] font-medium', TONE[CANCEL_GROUP_TONE[g]].value)}>{CANCEL_GROUP_LABEL[g]}</p>
                      {items.map((o) => (
                        <div key={o.id} className="flex items-center gap-2">
                          <RadioGroupItem value={String(o.id)} id={`cancel-reason-${requestNo}-${o.id}`} />
                          <Label htmlFor={`cancel-reason-${requestNo}-${o.id}`} className="text-sm font-normal">
                            {o.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </RadioGroup>
            )}
            <p className="min-h-4 text-[11px] text-destructive" role="status">
              {err}
            </p>
            <div className="flex items-center justify-between gap-2">
              {reason.source === 'team' ? (
                <Button type="button" variant="ghost" size="xs" disabled={busy} onClick={() => void save(null)}>
                  ล้างเหตุผล
                </Button>
              ) : (
                <span />
              )}
              <Button
                type="button"
                size="xs"
                disabled={busy || !pick || pick === String(reason.reasonId ?? '')}
                onClick={() => void save(Number(pick))}
                data-testid="dashboard-cancel-reason-save"
              >
                บันทึก
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
