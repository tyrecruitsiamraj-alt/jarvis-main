import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import TimeSelect24 from '@/components/shared/TimeSelect24';
import { ChoiceDropdown } from '@/components/shared/ChoiceDropdown';
import { leadText, type ReplaceTiming } from '@/lib/irecruitReplaceSync';
import { setReplaceTiming } from '@/lib/irecruitReplaceSyncApi';
import { friendlyErrorText } from '@/lib/friendlyError';
import { toast } from 'sonner';

const LEAD_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180].map((n) => ({ value: String(n), label: leadText(n) }));

/**
 * ═══ ตั้งเวลาโทรของแท็บส่งคนแทน (เจ้าของ 7 ต.ค. 2569) ═══
 * *"ขอหน้าตั้งเวลาในการโทร ทีตอนนี้มันตั้งไว้ว่าเป็น 16.00 แต่ถ้าจะปรับ ต้องปรับผ่าน ui"*
 * สาย 1 คอนเฟิร์มกี่โมง (วันก่อนเข้างาน) · สาย 2 / สาย 3 ก่อนเข้างานกี่นาที — หัวหน้างานขึ้นไป (server กันอีกชั้น)
 * บันทึกแล้วรอบดึงย้ายสายของ iRecruit ที่ยังไม่ถึงเวลาตามเอง (แถวที่เจ้าหน้าที่แก้เองไม่ทับ)
 */
const ReplaceTimingDialog: React.FC<{ timing: ReplaceTiming; onSaved: (t: ReplaceTiming) => void }> = ({ timing, onSaved }) => {
  const [open, setOpen] = useState(false);
  const [confirmTime, setConfirmTime] = useState(timing.confirmTime);
  const [lead2, setLead2] = useState(String(timing.leadMinutes[0]));
  const [lead3, setLead3] = useState(String(timing.leadMinutes[1]));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setConfirmTime(timing.confirmTime);
    setLead2(String(timing.leadMinutes[0]));
    setLead3(String(timing.leadMinutes[1]));
    setError(null);
  }, [open, timing]);

  const save = async () => {
    if (Number(lead2) <= Number(lead3)) {
      setError('สาย 2 ต้องโทรก่อนสาย 3');
      return;
    }
    setBusy(true);
    try {
      const st = await setReplaceTiming({ confirmTime, leadMinutes: [Number(lead2), Number(lead3)] });
      onSaved({ confirmTime: st.rule.confirmTime, leadMinutes: st.rule.leadMinutes });
      toast.success('บันทึกเวลาโทรแล้ว');
      setOpen(false);
    } catch (e) {
      setError(friendlyErrorText(e, 'บันทึกไม่สำเร็จ'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" size="xs" onClick={() => setOpen(true)} data-testid="replace-timing-open">
        <Clock aria-hidden />
        เวลาโทร
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>เวลาโทรส่งคนแทน</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">สายที่ 1 · คอนเฟิร์ม (วันก่อนเข้างาน)</span>
              <TimeSelect24 value={confirmTime} onChange={setConfirmTime} label="เวลาคอนเฟิร์ม" className="min-h-[46px]" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">สายที่ 2 · ก่อนเข้างาน</span>
              <ChoiceDropdown<string> value={lead2} options={LEAD_OPTIONS} onChange={setLead2} ariaLabel="สายที่ 2 ก่อนเข้างาน" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">สายที่ 3 · ก่อนเข้างาน</span>
              <ChoiceDropdown<string> value={lead3} options={LEAD_OPTIONS} onChange={setLead3} ariaLabel="สายที่ 3 ก่อนเข้างาน" />
            </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              ปิด
            </Button>
            <Button type="button" onClick={() => void save()} disabled={busy}>
              {busy ? 'กำลังบันทึก…' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReplaceTimingDialog;
