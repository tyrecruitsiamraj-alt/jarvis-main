/**
 * ═══ คนที่เก็บจากจับคู่งาน — แถวในตารางเดียวกับแท็บการติดต่อของงานสรรหา (เจ้าของ 11 พ.ย. 2569 "ทำเลย" · รวมตารางเดียว) ═══
 * แถว = คนของเราที่ฉันเก็บไปโทรเองจากจับคู่งาน · ลงผลแล้วแถวยังอยู่ · ครบ 24 ชม. ไม่ลงผล = "หลุดแล้ว" ไม่หายเงียบ
 * คอลัมน์ตรงกับ `RmTable` แท็บการติดต่อ: เลือก · ผู้สมัคร · ที่อยู่ · หน่วยงาน · สมัคร · โทรล่าสุด · ตัวเลือก
 * ⚠️ ส่ง AI โทร = คืนล็อก (to_ai) แล้วส่งเข้าคิวผ่าน `/api/lumos/dispatch` ทางเดียวกับหน้าจับคู่ · มีหน้ายืนยันก่อนเสมอ
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Bot, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import HoldResultForm from '@/components/matching/HoldResultForm';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { EM_DASH } from '@/lib/displayFallback';
import { formatDateTimeTh } from '@/lib/dateTh';
import { friendlyErrorText } from '@/lib/friendlyError';
import { CALL_OUTCOME_TONE } from '@/lib/callOutcomeTone';
import { CALL_RESULT_LABEL, releaseCallHold } from '@/lib/callHoldsApi';
import { dispatchLumosCalls } from '@/lib/lumosDispatchApi';
import { fetchSelectionContacts, type SelectionContactRow } from '@/lib/selectionContacts';

export const requestNoText = (r: SelectionContactRow) => (r.requestNo || r.jobId).replace(/^siamraj-(?:sql|pre):/u, '');

function hoursLeft(expiresAt: string, now: number): string {
  const ms = Date.parse(expiresAt) - now;
  if (ms <= 0) return 'หมดเวลา';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h} ชม. ${m} นาที` : `${m} นาที`;
}

/** คำค้นแถบบนใช้กับแถวจับคู่งานด้วย — ชื่อ · เบอร์ · หน่วยงาน · เลขใบขอ */
export function selectionRowMatchesKeyword(r: SelectionContactRow, keyword: string): boolean {
  const k = keyword.trim().toLowerCase();
  if (!k) return true;
  return [r.name, r.phone, r.jobLabel, requestNoText(r), r.area].some((v) => (v ?? '').toLowerCase().includes(k));
}

/** โหลดคนที่ฉันเก็บจากจับคู่งาน · ปิด = ไม่โหลด (แท็บอื่น / มุมมองทุกคน) */
export function useSelectionContacts(enabled: boolean, reloadKey: unknown) {
  const [rows, setRows] = useState<SelectionContactRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setError(null);
    fetchSelectionContacts()
      .then((r) => alive && setRows(r))
      .catch((e: unknown) => alive && setError(friendlyErrorText(e, 'โหลดคนจากจับคู่งานไม่สำเร็จ')));
    return () => {
      alive = false;
    };
  }, [enabled, reloadKey, tick]);
  return { rows, error, reload };
}

export const SelectionContactRows: React.FC<{
  rows: SelectionContactRow[];
  onResult: (r: SelectionContactRow) => void;
  onSendAi: (r: SelectionContactRow) => void;
}> = ({ rows, onResult, onSendAi }) => {
  const [now] = useState(() => Date.now());
  return (
    <>
      {rows.map((r) => (
        <tr key={`match-${r.id}`} className={cn('border-t [&>td]:align-middle', DASH.tableRow)} data-testid="match-contact-row">
          <td className="px-1.5 py-2" />
          <td className={cn('sticky left-0 z-10 px-1.5 py-2', DASH.stickyCell)}>
            <span className="block min-w-32 font-medium text-foreground">{r.name || EM_DASH}</span>
            <span className={cn('block whitespace-nowrap text-xs tabular-nums', DASH.cellMuted)}>
              {r.phone || EM_DASH} · {r.age != null ? `${r.age} ปี` : 'อายุ —'} · {r.sex || 'เพศ —'}
            </span>
          </td>
          <td className={cn('px-1.5 py-2', DASH.cell)}>
            <span className="line-clamp-3 min-w-28 break-words">{r.area || EM_DASH}</span>
          </td>
          <td className={cn('px-1.5 py-2', DASH.cell)}>
            <span className="line-clamp-3 block min-w-32 break-words">{r.jobLabel || requestNoText(r)}</span>
            {r.jobLabel ? <span className={cn('block text-xs tabular-nums', DASH.cellMuted)}>{requestNoText(r)}</span> : null}
          </td>
          <td className={cn('px-1.5 py-2 text-xs', DASH.cellMuted)}>
            <span className={cn('mb-0.5 block w-fit whitespace-nowrap', TONE.neutral.chip)}>จับคู่งาน</span>
            <span className="block whitespace-nowrap tabular-nums">เก็บ {formatDateTimeTh(r.heldAt)}</span>
          </td>
          <td className={cn('px-1.5 py-2 text-xs', DASH.cellMuted)}>
            {r.result ? (
              <span className="inline-flex flex-col gap-0.5">
                <span className={cn('font-medium', TONE[CALL_OUTCOME_TONE[r.result]].value)}>{CALL_RESULT_LABEL[r.result]}</span>
                {r.resultAt ? <span className="tabular-nums">{formatDateTimeTh(r.resultAt)}</span> : null}
              </span>
            ) : r.expired ? (
              'หลุดแล้ว · ครบ 24 ชม.'
            ) : (
              <span className="tabular-nums">ถืออีก {hoursLeft(r.expiresAt, now)}</span>
            )}
          </td>
          <td className="px-1.5 py-2 max-lg:sticky max-lg:right-0 max-lg:bg-card">
            <div className="flex items-center justify-end gap-1">
              {r.phone ? (
                <Button asChild variant="ghost" size="iconXs" className="rounded-full text-muted-foreground hover:text-foreground max-sm:h-10 max-sm:w-10">
                  <a href={`tel:${r.phone}`} title="โทร" aria-label={`โทร — ${r.name ?? ''}`}>
                    <Phone aria-hidden />
                  </a>
                </Button>
              ) : null}
              {r.open && r.cardId != null ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="iconXs"
                  className="rounded-full text-muted-foreground hover:text-foreground max-sm:h-10 max-sm:w-10"
                  title="ส่ง AI โทร"
                  aria-label={`ส่ง AI โทร — ${r.name ?? ''}`}
                  onClick={() => onSendAi(r)}
                >
                  <Bot aria-hidden />
                </Button>
              ) : null}
              {r.open ? (
                <Button type="button" variant="outline" size="xs" className="rounded-full max-sm:min-h-9" onClick={() => onResult(r)}>
                  ลงผล
                </Button>
              ) : null}
            </div>
          </td>
        </tr>
      ))}
    </>
  );
};

/** ป๊อปลงผล + ยืนยันส่ง AI ของแถวจับคู่งาน — วางนอกตาราง */
export const SelectionContactDialogs: React.FC<{
  resultFor: SelectionContactRow | null;
  aiFor: SelectionContactRow | null;
  onClose: () => void;
  onDone: (message?: string) => void;
}> = ({ resultFor, aiFor, onClose, onDone }) => {
  const [sending, setSending] = useState(false);
  const sendToAi = async (r: SelectionContactRow) => {
    setSending(true);
    try {
      await releaseCallHold(r.id, 'to_ai');
      const res = await dispatchLumosCalls({ jobId: r.jobId, boardCardIds: [r.cardId as number], irecruitIds: [] });
      onDone(`ส่ง AI โทร ${res.queued.toLocaleString('th-TH')} คน`);
    } catch (e) {
      onDone(friendlyErrorText(e, 'ส่ง AI โทรไม่สำเร็จ'));
    } finally {
      setSending(false);
    }
  };
  return (
    <>
      <Dialog open={resultFor !== null} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>ลงผลโทร · {resultFor?.name || 'ผู้สมัคร'}</DialogTitle>
            <DialogDescription>{resultFor ? resultFor.jobLabel || requestNoText(resultFor) : ''}</DialogDescription>
          </DialogHeader>
          {resultFor ? (
            <HoldResultForm holdId={resultFor.id} onSaved={() => onDone()} onReleased={() => onDone()} onCancel={onClose} />
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={aiFor !== null} onOpenChange={(o) => !o && !sending && onClose()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ส่ง AI โทร {aiFor?.name ?? ''}?</AlertDialogTitle>
            <AlertDialogDescription>คืนคนนี้จากถังโทรของคุณ แล้วส่งเข้าคิว AI โทรตามใบขอ</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              disabled={sending}
              onClick={(e) => {
                e.preventDefault();
                if (aiFor) void sendToAi(aiFor);
              }}
            >
              {sending ? 'กำลังส่ง…' : 'ส่ง AI โทร'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
