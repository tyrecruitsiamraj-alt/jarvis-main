/**
 * ═══ ตั้งค่า › เชื่อมระบบภายนอก — แผนติดตามรหัสเดิมที่ค้างที่ Lumos (เจ้าของ 22 ต.ค. 2569 Choice "ล้างทีเดียว") ═══
 * นับแผนที่เคยส่งซ้ำด้วยรหัสเดิม (ยกเลิกจาก jarvis ไม่ติด) · กดหลังทีม Lumos ยืนยันว่ายกเลิกให้แล้ว ⇒ ส่งกลับด้วยรหัสใหม่ เวลาเดิม
 * 🔴 กดก่อน Lumos ยกเลิก = คนโดนโทร 2 สาย ⇒ ต้องยืนยันก่อนทุกครั้ง · ที่มา `api/_lib/followOldIdRepush.ts`
 */
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiFetch } from '@/lib/apiFetch';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');

type Counts = { plans: number; calls: number };
type RunResult = { plans: number; calls: number; pushed: number; failed: Array<{ planRef: string; reason: string }> };

const LumosOldIdRepushCard: React.FC = () => {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await apiFetch('/api/follow-oldid-repush');
      if (!r.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
      setCounts((await r.json()) as Counts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const r = await apiFetch('/api/follow-oldid-repush', { method: 'POST' });
      if (!r.ok) throw new Error('ส่งแผนใหม่ไม่สำเร็จ');
      const out = (await r.json()) as RunResult;
      const parts = [`ส่งใหม่แล้ว ${NUM.format(out.pushed)} จาก ${NUM.format(out.plans)} แผน`];
      if (out.failed.length > 0) parts.push(`ไม่สำเร็จ ${NUM.format(out.failed.length)} แผน`);
      setNotice(parts.join(' · '));
      setConfirmOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ส่งแผนใหม่ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const plans = counts?.plans ?? 0;
  return (
    <Card variant="solid" className="space-y-4 p-5" data-testid="lumos-oldid-repush">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-medium text-foreground">
          <RefreshCcw className="h-5 w-5 text-muted-foreground" aria-hidden />
          Lumos · แผนรหัสเดิม
          <Badge variant={plans > 0 ? 'default' : 'secondary'} data-testid="oldid-plans">
            {NUM.format(plans)} แผน
          </Badge>
        </h3>
        <Button type="button" size="sm" disabled={plans === 0 || busy} onClick={() => setConfirmOpen(true)} data-testid="oldid-repush">
          ส่งแผนใหม่ด้วยรหัสใหม่
        </Button>
      </div>
      <p className="text-sm tabular-nums text-foreground">
        รอส่งใหม่ {NUM.format(plans)} แผน · {NUM.format(counts?.calls ?? 0)} สาย
      </p>
      {error ? <p className={cn('text-sm', TONE.danger.value)}>{error}</p> : null}
      {notice ? <p className="text-sm text-muted-foreground" data-testid="oldid-notice">{notice}</p> : null}

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !busy && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ทีม Lumos ยกเลิกแผนรหัสเดิมแล้วใช่ไหม?</AlertDialogTitle>
            <AlertDialogDescription>ถ้ายังไม่ยกเลิก คนจะโดนโทรซ้ำ 2 สาย</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>ยังก่อน</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void run();
              }}
              data-testid="oldid-confirm"
            >
              ยกเลิกแล้ว ส่งเลย
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default LumosOldIdRepushCard;
