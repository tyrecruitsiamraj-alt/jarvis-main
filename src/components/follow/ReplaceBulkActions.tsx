import React, { useMemo, useState } from 'react';
import { Bot, CalendarX } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import type { FollowEntry } from '@/lib/followApi';
import { isReplaceAllAiCandidate, isReplacePastCancelable } from '@/lib/irecruitReplaceSync';
import { cancelPastReplaceCalls, startReplaceAllAi } from '@/lib/irecruitReplaceSyncApi';
import { friendlyErrorText } from '@/lib/friendlyError';

/**
 * ═══ สองปุ่มบนแท็บส่งคนแทน (เจ้าของ 19 ต.ค. 2569) ═══
 * - "สลับเป็น AI" — สายคนโทรที่ยังไม่ถึงเวลา (รวม WL ตั้งแต่ 19 ต.ค.) เป็น AI + ส่งแผนให้ Lumos (Choice "สลับเป็น AI ทั้งหมด เว้น WL")
 * - "ยกเลิกสายเลยเวลา" — สายที่เลยเวลาและไม่มีผล (Choice "ยกเลิก 2,186 สายที่ไม่มีผล" · เว้น AI ที่โทรจริง)
 * ทั้งคู่ยืนยันก่อนเสมอ (กติกา: ปุ่มที่เปลี่ยนสายจริงต้องมีป๊อป) · ปุ่มเห็นเลขเสมอ (0 = กดไม่ได้)
 */
type Ask = 'ai' | 'past' | null;

const ReplaceBulkActions: React.FC<{ items: readonly FollowEntry[]; onDone: () => void }> = ({ items, onDone }) => {
  const [ask, setAsk] = useState<Ask>(null);
  const [busy, setBusy] = useState(false);
  const { aiCount, pastCount } = useMemo(() => {
    const now = new Date();
    return {
      aiCount: items.filter((e) => isReplaceAllAiCandidate(e, now)).length,
      pastCount: items.filter((e) => isReplacePastCancelable(e, now)).length,
    };
  }, [items]);

  const run = async () => {
    const what = ask;
    setBusy(true);
    try {
      if (what === 'ai') {
        await startReplaceAllAi();
        toast.success(`กำลังสลับ ${aiCount.toLocaleString('th-TH')} สายเป็น AI · ส่งแผนให้ Lumos ใช้เวลาสักครู่`);
      } else if (what === 'past') {
        const out = await cancelPastReplaceCalls();
        toast.success(`ยกเลิก ${out.cancelled.toLocaleString('th-TH')} สายแล้ว`);
      }
      setAsk(null);
      onDone();
    } catch (e) {
      toast.error(friendlyErrorText(e, 'ทำไม่สำเร็จ'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" size="xs" disabled={aiCount === 0} onClick={() => setAsk('ai')} data-testid="replace-all-ai">
        <Bot aria-hidden />
        สลับเป็น AI {aiCount.toLocaleString('th-TH')}
      </Button>
      <Button type="button" variant="outline" size="xs" disabled={pastCount === 0} onClick={() => setAsk('past')} data-testid="replace-cancel-past">
        <CalendarX aria-hidden />
        ยกเลิกสายเลยเวลา {pastCount.toLocaleString('th-TH')}
      </Button>
      <AlertDialog open={ask !== null} onOpenChange={(o) => !o && !busy && setAsk(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {ask === 'ai'
                ? `สลับ ${aiCount.toLocaleString('th-TH')} สายเป็น AI โทร`
                : `ยกเลิก ${pastCount.toLocaleString('th-TH')} สายที่เลยเวลา`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {ask === 'ai'
                ? 'สายคนโทรที่ยังไม่ถึงเวลา รวม WL · ไม่รวมสายที่ลงผลแล้ว'
                : 'สายที่เลยเวลาและยังไม่มีผล · สายที่ AI โทรแล้วและสายที่เจ้าหน้าที่ลงผลแล้วยังอยู่'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>ปิด</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void run();
              }}
            >
              {busy ? 'กำลังทำ…' : ask === 'ai' ? 'สลับเป็น AI' : 'ยกเลิกสาย'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ReplaceBulkActions;
