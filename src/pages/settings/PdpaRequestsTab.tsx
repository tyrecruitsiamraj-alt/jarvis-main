import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { copyText } from '@/lib/copyText';
import { Copy, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Textarea } from '@/components/ui/textarea';
import PdpaRequestForm from '@/components/shared/PdpaRequestForm';
import LoadErrorNotice from '@/components/shared/LoadErrorNotice';
import {
  createPdpaRequestByStaff,
  fetchPdpaPersonData,
  fetchPdpaRequests,
  patchPdpaRequest,
  type PdpaPersonData,
  type PdpaRequestItem,
} from '@/lib/pdpaRequestsApi';
import {
  PDPA_ACTION_LABEL,
  PDPA_REQUEST_KIND_LABEL,
  PDPA_REQUEST_STATUS_LABEL,
  pdpaActions,
  pdpaDaysLeft,
  pdpaDueText,
  pdpaStopsCalls,
  type PdpaAction,
  type PdpaRequestInput,
} from '@/lib/pdpaRequests';
import { localThaiPhone } from '@/lib/followDayReport';
import { formatDateTimeTh } from '@/lib/dateTh';
import { friendlyErrorText } from '@/lib/friendlyError';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

const STATUS_TONE = { received: TONE.warn.value, verified: TONE.info.value, done: TONE.success.value, rejected: 'text-muted-foreground' };

/** ข้อมูลของเบอร์นี้เป็นข้อความ — คัดลอกไปส่งให้เจ้าตัว (คำขอดูข้อมูล) */
function personDataText(req: PdpaRequestItem, d: PdpaPersonData): string {
  const lines: string[] = [`ข้อมูลของเบอร์ ${localThaiPhone(req.phone_e164)} ในระบบสรรหา บริษัท สยามราชธานี`, ''];
  lines.push(`ใบสมัคร ${d.applications.length} ใบ`);
  for (const a of d.applications) {
    lines.push(
      `- ${formatDateTimeTh(a.created_at)} · ${a.full_name} · ${localThaiPhone(a.phone)}` +
        `${a.age ? ` · อายุ ${a.age}` : ''}${a.gender ? ` · ${a.gender}` : ''}${a.address.trim() ? ` · ${a.address.trim()}` : ''}` +
        `${a.line_id ? ` · LINE ${a.line_id}` : ''} · ตำแหน่ง ${a.job_title || '-'}${a.unit_name ? ` (${a.unit_name})` : ''}` +
        `${a.has_document ? ' · มีไฟล์แนบ' : ''}`,
    );
  }
  lines.push('', `สายติดตาม ${d.follows.length} สาย`);
  for (const f of d.follows) {
    lines.push(`- ${formatDateTimeTh(f.scheduled_at)} · ${f.topic}${f.unit_name ? ` · ${f.unit_name}` : ''}${f.cancelled ? ' · ยกเลิก' : ''}`);
  }
  lines.push('', `สายที่ AI โทร ${d.calls.length} สาย`);
  for (const c of d.calls) {
    lines.push(`- ${formatDateTimeTh(c.created_at)}${c.summary ? ` · ${c.summary}` : ''}`);
  }
  return lines.join('\n');
}

/**
 * ═══ ตั้งค่า › คำขอข้อมูลส่วนบุคคล (PDPA) — เจ้าของเลือกทำ 18 ต.ค. 2569 ═══
 * รายการคำขอจากหน้า /privacy-request + ลงแทนเจ้าตัว · โทรกลับยืนยันตัวตน → ดูข้อมูล / ลบข้อมูล / ปิดคำขอ
 * ทุกปุ่มมีคำ (กติกา 15 ต.ค.) · ลบข้อมูลย้อนไม่ได้ ถามยืนยันก่อนเสมอ
 */
const PdpaRequestsTab: React.FC = () => {
  const [items, setItems] = useState<PdpaRequestItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [seq, setSeq] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  /** ปุ่มที่กดค้างไว้รอยืนยัน / รอกรอกหมายเหตุ */
  const [pending, setPending] = useState<{ item: PdpaRequestItem; action: PdpaAction } | null>(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<{ item: PdpaRequestItem; data: PdpaPersonData | null; error: string | null } | null>(null);

  const load = useCallback(() => setSeq((n) => n + 1), []);
  useEffect(() => {
    let alive = true;
    setLoadError(null);
    fetchPdpaRequests()
      .then((rows) => alive && setItems(rows))
      .catch((e) => {
        if (!alive) return;
        setItems(null);
        setLoadError(friendlyErrorText(e, 'โหลดคำขอไม่สำเร็จ'));
      });
    return () => {
      alive = false;
    };
  }, [seq]);

  const counts = useMemo(() => {
    const rows = items ?? [];
    return {
      received: rows.filter((r) => r.status === 'received').length,
      verified: rows.filter((r) => r.status === 'verified').length,
      overdue: rows.filter((r) => (r.status === 'received' || r.status === 'verified') && pdpaDaysLeft(r.due_at) < 0).length,
    };
  }, [items]);

  const addRequest = async (v: PdpaRequestInput) => {
    setAddBusy(true);
    setAddError(null);
    try {
      const res = await createPdpaRequestByStaff(v);
      const stopped = res.stopped ? res.stopped.queue + res.stopped.follow : null;
      toast.success(stopped === null ? 'ลงคำขอแล้ว' : `ลงคำขอแล้ว · หยุดโทรเบอร์นี้แล้ว (ยกเลิก ${stopped} สาย)`);
      setAddOpen(false);
      load();
    } catch (e) {
      setAddError(friendlyErrorText(e, 'ลงคำขอไม่สำเร็จ'));
    } finally {
      setAddBusy(false);
    }
  };

  const openView = async (item: PdpaRequestItem) => {
    setViewing({ item, data: null, error: null });
    try {
      const data = await fetchPdpaPersonData(item.id);
      setViewing({ item, data, error: null });
    } catch (e) {
      setViewing({ item, data: null, error: friendlyErrorText(e, 'โหลดข้อมูลไม่สำเร็จ') });
    }
  };

  const runAction = async () => {
    if (!pending) return;
    const { item, action } = pending;
    if (action === 'reject' && !note.trim()) {
      setNoteError('บอกเหตุผลที่ไม่ดำเนินการ');
      return;
    }
    if (action === 'view') return;
    setBusy(true);
    try {
      const res = await patchPdpaRequest(item.id, action, note.trim() || null);
      if (action === 'erase' && res.erased) {
        toast.success(`ลบแล้ว · ใบสมัคร ${res.erased.applications ?? 0} · สายติดตาม ${res.erased.follows ?? 0} · สาย AI ${res.erased.calls ?? 0}`);
      } else {
        toast.success(action === 'verify' ? 'ยืนยันตัวตนแล้ว' : action === 'close' ? 'ปิดคำขอแล้ว' : 'บันทึกแล้ว');
      }
      setPending(null);
      load();
    } catch (e) {
      toast.error(friendlyErrorText(e, 'ทำไม่สำเร็จ'));
    } finally {
      setBusy(false);
    }
  };

  const press = (item: PdpaRequestItem, action: PdpaAction) => {
    if (action === 'view') {
      void openView(item);
      return;
    }
    setNote('');
    setNoteError(null);
    setPending({ item, action });
  };

  const confirmOpen = pending !== null && (pending.action === 'verify' || pending.action === 'erase');
  const noteOpen = pending !== null && (pending.action === 'close' || pending.action === 'reject');

  return (
    <div className="space-y-4" data-testid="pdpa-requests-tab">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={TONE.warn.value}>
          รอยืนยันตัวตน {items ? counts.received : '—'}
        </Badge>
        <Badge variant="outline" className={TONE.info.value}>
          ยืนยันแล้ว รอทำต่อ {items ? counts.verified : '—'}
        </Badge>
        <Badge variant="outline" className={TONE.danger.value}>
          เลยกำหนด 30 วัน {items ? counts.overdue : '—'}
        </Badge>
        <Button type="button" size="sm" className="ml-auto" onClick={() => setAddOpen(true)}>
          <Plus aria-hidden />
          ลงคำขอแทนเจ้าตัว
        </Button>
      </div>

      {loadError ? <LoadErrorNotice message={loadError} onRetry={load} /> : null}

      <Card className="overflow-x-auto rounded-2xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ผู้ขอ</TableHead>
              <TableHead>เรื่อง</TableHead>
              <TableHead>ข้อมูลในระบบ</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="text-right">ทำต่อ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items === null ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  {loadError ? 'โหลดไม่สำเร็จ' : 'กำลังโหลด…'}
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  ไม่มีคำขอ
                </TableCell>
              </TableRow>
            ) : (
              items.map((r) => {
                const open = r.status === 'received' || r.status === 'verified';
                const overdue = open && pdpaDaysLeft(r.due_at) < 0;
                return (
                  <TableRow key={r.id} data-testid="pdpa-request-row">
                    <TableCell className="min-w-40 text-sm">
                      <span className="font-medium">{r.full_name}</span>
                      <span className="block text-xs tabular-nums text-muted-foreground">{localThaiPhone(r.phone_e164)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDateTimeTh(r.created_at)} · {r.source === 'public' ? 'ยื่นเอง' : `ลงแทนโดย ${r.created_by_name ?? '-'}`}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-36 text-sm">
                      <span className="whitespace-nowrap">{PDPA_REQUEST_KIND_LABEL[r.kind]}</span>
                      {pdpaStopsCalls(r.kind) ? <span className="block text-xs text-muted-foreground">หยุดโทรแล้ว</span> : null}
                      {r.detail ? <span className="block max-w-56 whitespace-pre-wrap break-words text-xs text-muted-foreground">{r.detail}</span> : null}
                    </TableCell>
                    <TableCell className="min-w-32 text-xs tabular-nums">
                      {r.footprint ? (
                        <>
                          <span className="block">ใบสมัคร {r.footprint.applications}</span>
                          <span className="block">ติดตาม {r.footprint.follows}</span>
                          <span className="block">สาย AI {r.footprint.calls}</span>
                        </>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="min-w-32 text-xs">
                      <span className={STATUS_TONE[r.status]}>{PDPA_REQUEST_STATUS_LABEL[r.status]}</span>
                      {open ? <span className={cn('block', overdue ? TONE.danger.value : 'text-muted-foreground')}>{pdpaDueText(r.due_at)}</span> : null}
                      {r.done_note ? <span className="block max-w-56 break-words text-muted-foreground">{r.done_note}</span> : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {pdpaActions(r.kind, r.status).map((a) => (
                          <Button
                            key={a}
                            type="button"
                            size="xs"
                            variant={a === 'erase' ? 'destructive' : a === 'reject' ? 'ghost' : 'outline'}
                            onClick={() => press(r, a)}
                          >
                            {PDPA_ACTION_LABEL[a]}
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* ลงคำขอแทนเจ้าตัว (โทรเข้ามาขอ) */}
      <Dialog open={addOpen} onOpenChange={(o) => (o ? setAddOpen(true) : (setAddOpen(false), setAddError(null)))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>ลงคำขอแทนเจ้าตัว</DialogTitle>
          </DialogHeader>
          <PdpaRequestForm onSubmit={(v) => void addRequest(v)} submitLabel="บันทึกคำขอ" busy={addBusy} error={addError} idPrefix="pdpa-staff" />
        </DialogContent>
      </Dialog>

      {/* ยืนยันตัวตน / ลบข้อมูล — ถามก่อนเสมอ */}
      <AlertDialog open={confirmOpen} onOpenChange={(o) => (o ? undefined : setPending(null))}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">
              {pending?.action === 'erase' ? `ลบข้อมูลของ ${pending.item.full_name}?` : 'ยืนยันตัวตนแล้ว?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {pending?.action === 'erase'
                ? 'ชื่อ เบอร์ ที่อยู่ ไฟล์แนบ และบทสนทนากับ AI ถูกล้างทุกใบ ย้อนไม่ได้ · ข้อมูลใน iRecruit และ ERP ต้องลบที่ระบบนั้นเอง'
                : pending
                  ? `โทรกลับเบอร์ ${localThaiPhone(pending.item.phone_e164)} และคุยกับเจ้าตัวแล้ว`
                  : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className={pending?.action === 'erase' ? TONE.danger.solid : undefined}
              onClick={(e) => {
                e.preventDefault();
                void runAction();
              }}
            >
              {busy ? 'กำลังทำ…' : pending ? PDPA_ACTION_LABEL[pending.action] : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ปิดคำขอ / ไม่ดำเนินการ — มีหมายเหตุ */}
      <Dialog open={noteOpen} onOpenChange={(o) => (o ? undefined : setPending(null))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{pending ? `${PDPA_ACTION_LABEL[pending.action]} · ${pending.item.full_name}` : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <label htmlFor="pdpa-note" className="text-xs font-medium text-muted-foreground">
              {pending?.action === 'reject' ? 'เหตุผล' : 'ทำอะไรไปแล้ว (ไม่บังคับ)'}
            </label>
            <Textarea
              id="pdpa-note"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setNoteError(null);
              }}
              rows={3}
              maxLength={500}
            />
            {noteError ? <p className="text-xs text-destructive">{noteError}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPending(null)}>
              ปิด
            </Button>
            <Button type="button" onClick={() => void runAction()} disabled={busy}>
              {busy ? 'กำลังบันทึก…' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ดูข้อมูล — หลังยืนยันตัวตน · คัดลอกไปส่งให้เจ้าตัว */}
      <Dialog open={viewing !== null} onOpenChange={(o) => (o ? undefined : setViewing(null))}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewing ? `ข้อมูลของ ${viewing.item.full_name}` : ''}</DialogTitle>
          </DialogHeader>
          {viewing?.error ? (
            <LoadErrorNotice message={viewing.error} onRetry={() => void openView(viewing.item)} />
          ) : viewing?.data ? (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border p-3 text-xs" data-testid="pdpa-person-data">
              {personDataText(viewing.item, viewing.data)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setViewing(null)}>
              ปิด
            </Button>
            <Button
              type="button"
              disabled={!viewing?.data}
              onClick={() => {
                if (!viewing?.data) return;
                void copyText(personDataText(viewing.item, viewing.data))
                  .then(() => toast.success('คัดลอกแล้ว'))
                  .catch(() => toast.error('คัดลอกไม่สำเร็จ'));
              }}
            >
              <Copy aria-hidden />
              คัดลอก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PdpaRequestsTab;
