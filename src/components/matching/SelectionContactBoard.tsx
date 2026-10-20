/**
 * ═══ หน้าการติดต่อของจับคู่งาน — หน้าตาเดียวกับแท็บการติดต่อของงานสรรหา (เจ้าของ 20 ต.ค. 2569 Choice "ทำตามนี้") ═══
 * ชิป ทั้งหมด · ยังไม่โทร · โทรแล้ว · สำเร็จ · ไม่สำเร็จ + ปุ่ม "ส่ง AI โทร" + ตารางเดียว
 * แถว = คนของเราที่ฉันเก็บไปโทรเอง · ลงผลแล้วแถวยังอยู่ (ย้ายไปชิปสำเร็จ/ไม่สำเร็จ) · ครบ 24 ชม. ไม่ลงผล = "หลุดแล้ว" ไม่หายเงียบ
 * ⚠️ ส่ง AI โทร = คืนล็อก (to_ai) แล้วส่งเข้าคิวผ่าน `/api/lumos/dispatch` ทางเดียวกับหน้าจับคู่ · มีหน้ายืนยันก่อนเสมอ
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import FilterChips from '@/components/shared/FilterChips';
import LoadErrorNotice from '@/components/shared/LoadErrorNotice';
import HoldResultForm from '@/components/matching/HoldResultForm';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { formatDateTimeTh } from '@/lib/dateTh';
import { friendlyErrorText } from '@/lib/friendlyError';
import { CALL_OUTCOME_TONE } from '@/lib/callOutcomeTone';
import { CALL_RESULT_LABEL, releaseCallHold } from '@/lib/callHoldsApi';
import { dispatchLumosCalls } from '@/lib/lumosDispatchApi';
import {
  SELECTION_CHIPS,
  fetchSelectionContacts,
  isInSelectionChip,
  type SelectionChip,
  type SelectionContactRow,
} from '@/lib/selectionContacts';

const NUM = new Intl.NumberFormat('th-TH');
const requestNoText = (r: SelectionContactRow) => (r.requestNo || r.jobId).replace(/^siamraj-(?:sql|pre):/u, '');

function hoursLeft(expiresAt: string, now: number): string {
  const ms = Date.parse(expiresAt) - now;
  if (ms <= 0) return 'หมดเวลา';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h} ชม. ${m} นาที` : `${m} นาที`;
}

const SelectionContactBoard: React.FC = () => {
  const [rows, setRows] = useState<SelectionContactRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chip, setChip] = useState<SelectionChip>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [resultFor, setResultFor] = useState<SelectionContactRow | null>(null);
  const [confirmAi, setConfirmAi] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const load = useCallback(() => {
    setError(null);
    fetchSelectionContacts()
      .then(setRows)
      .catch((e: unknown) => setError(friendlyErrorText(e, 'โหลดรายชื่อไม่สำเร็จ')));
  }, []);
  useEffect(load, [load]);

  const counts = useMemo(() => {
    const out = {} as Record<SelectionChip, number>;
    for (const c of SELECTION_CHIPS) out[c.id] = (rows ?? []).filter((r) => isInSelectionChip(r, c.id)).length;
    return out;
  }, [rows]);
  const shown = useMemo(() => (rows ?? []).filter((r) => isInSelectionChip(r, chip)), [rows, chip]);
  // ส่ง AI ได้เฉพาะคนที่ยังถืออยู่และมีการ์ดบอร์ด
  const sendable = (rows ?? []).filter((r) => selected.includes(r.id) && r.open && r.cardId != null);

  const changeChip = (next: SelectionChip) => {
    setChip(next);
    setSelected([]);
    setNotice(null);
  };
  const toggle = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const allOpenIds = shown.filter((r) => r.open).map((r) => r.id);
  const allChecked = allOpenIds.length > 0 && allOpenIds.every((id) => selected.includes(id));

  const sendToAi = async () => {
    setSending(true);
    setNotice(null);
    try {
      const byJob = new Map<string, number[]>();
      for (const r of sendable) {
        await releaseCallHold(r.id, 'to_ai');
        byJob.set(r.jobId, [...(byJob.get(r.jobId) ?? []), r.cardId as number]);
      }
      let queued = 0;
      for (const [jobId, boardCardIds] of byJob) {
        const res = await dispatchLumosCalls({ jobId, boardCardIds, irecruitIds: [] });
        queued += res.queued;
      }
      setNotice(`ส่ง AI โทร ${NUM.format(queued)} คน`);
      setSelected([]);
      load();
    } catch (e) {
      setNotice(friendlyErrorText(e, 'ส่ง AI โทรไม่สำเร็จ'));
    } finally {
      setSending(false);
      setConfirmAi(false);
    }
  };

  return (
    <div className="space-y-4">
      <FilterChips
        ariaLabel="กรองการติดต่อ"
        value={chip}
        onChange={changeChip}
        chips={SELECTION_CHIPS.map((c) => ({ ...c, count: error ? 'unknown' : rows === null ? null : counts[c.id] }))}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={sendable.length === 0} onClick={() => setConfirmAi(true)}>
          ส่ง AI โทร{sendable.length > 0 ? ` (${NUM.format(sendable.length)})` : ''}
        </Button>
      </div>
      {notice ? <p className={cn('rounded-xl border px-3 py-2 text-xs', TONE.info.soft, TONE.info.value)}>{notice}</p> : null}

      {error ? (
        <LoadErrorNotice message={error} onRetry={load} />
      ) : (
        <Card className="overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allChecked}
                      disabled={allOpenIds.length === 0}
                      onCheckedChange={() => setSelected(allChecked ? [] : allOpenIds)}
                      aria-label="เลือกทั้งหมด"
                    />
                  </TableHead>
                  <TableHead>ผู้สมัคร</TableHead>
                  <TableHead>ที่อยู่</TableHead>
                  <TableHead>หน่วยงาน</TableHead>
                  <TableHead>เก็บเมื่อ</TableHead>
                  <TableHead>ผลล่าสุด</TableHead>
                  <TableHead className="text-right">ตัวเลือก</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows === null ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      กำลังโหลด…
                    </TableCell>
                  </TableRow>
                ) : shown.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                      ไม่มีรายชื่อ · เก็บได้จาก{' '}
                      <Link to="/matching/match" className={cn('font-medium underline', TONE.primary.value)}>
                        จับคู่กับงาน
                      </Link>
                    </TableCell>
                  </TableRow>
                ) : (
                  shown.map((r) => (
                    <TableRow key={r.id} className="[&>td]:align-middle">
                      <TableCell>
                        <Checkbox
                          checked={selected.includes(r.id)}
                          disabled={!r.open}
                          onCheckedChange={() => toggle(r.id)}
                          aria-label={`เลือก ${r.name ?? 'ผู้สมัคร'}`}
                        />
                      </TableCell>
                      <TableCell className="min-w-40">
                        <p className="text-sm font-medium text-foreground">{r.name || '—'}</p>
                        <p className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                          {r.phone || '—'} · {r.age != null ? `${r.age} ปี` : 'อายุ —'} · {r.sex || 'เพศ —'}
                        </p>
                      </TableCell>
                      <TableCell className="min-w-32 text-xs text-muted-foreground">{r.area || '—'}</TableCell>
                      <TableCell className="min-w-40">
                        <p className="text-sm text-foreground">{r.jobLabel || requestNoText(r)}</p>
                        {r.jobLabel ? <p className="text-xs tabular-nums text-muted-foreground">{requestNoText(r)}</p> : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                        {formatDateTimeTh(r.heldAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {r.result ? (
                          <span className="space-y-1">
                            <span className={cn('block font-medium', TONE[CALL_OUTCOME_TONE[r.result]].value)}>
                              {CALL_RESULT_LABEL[r.result]}
                            </span>
                            {r.resultAt ? (
                              <span className="block tabular-nums text-muted-foreground">{formatDateTimeTh(r.resultAt)}</span>
                            ) : null}
                          </span>
                        ) : r.expired ? (
                          <span className="text-muted-foreground">หลุดแล้ว · ครบ 24 ชม.</span>
                        ) : (
                          <span className="tabular-nums text-muted-foreground">ถืออีก {hoursLeft(r.expiresAt, now)}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {r.phone ? (
                            <Button asChild variant="outline" size="xs">
                              <a href={`tel:${r.phone}`}>โทร</a>
                            </Button>
                          ) : null}
                          {r.open ? (
                            <Button type="button" size="xs" onClick={() => setResultFor(r)}>
                              ลงผล
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <Dialog open={resultFor !== null} onOpenChange={(o) => !o && setResultFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>ลงผลโทร · {resultFor?.name || 'ผู้สมัคร'}</DialogTitle>
            <DialogDescription>{resultFor ? resultFor.jobLabel || requestNoText(resultFor) : ''}</DialogDescription>
          </DialogHeader>
          {resultFor ? (
            <HoldResultForm
              holdId={resultFor.id}
              onSaved={() => {
                setResultFor(null);
                load();
              }}
              onReleased={() => {
                setResultFor(null);
                load();
              }}
              onCancel={() => setResultFor(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmAi} onOpenChange={(o) => !sending && setConfirmAi(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ส่ง AI โทร {NUM.format(sendable.length)} คน?</AlertDialogTitle>
            <AlertDialogDescription>คืนคนที่เลือกจากถังโทรของคุณ แล้วส่งเข้าคิว AI โทรตามใบขอของแต่ละคน</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              disabled={sending}
              onClick={(e) => {
                e.preventDefault();
                void sendToAi();
              }}
            >
              {sending ? 'กำลังส่ง…' : 'ส่ง AI โทร'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SelectionContactBoard;
