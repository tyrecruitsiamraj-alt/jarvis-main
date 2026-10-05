import React from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DASH, TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { fetchReplaceSyncStatus, runReplaceSyncNow, type ReplaceSyncStatus } from '@/lib/irecruitReplaceSyncApi';
import { friendlyErrorText } from '@/lib/friendlyError';

/**
 * ═══ แถบ "ดึงจาก iRecruit" บนแท็บติดตามส่งคนแทน (2 ต.ค. 2569 · Journey ใหม่ 5 ต.ค. 2569: ดึงทุก 5 นาที · 3 สาย) ═══
 *
 * บรรทัดเดียว: ดึงล่าสุดเมื่อไหร่ ได้อะไรมา · โทรเวลาไหน · ปุ่มดึงตอนนี้ (หัวหน้างานขึ้นไป)
 * ปุ่มแก้เวลาโทรถอดแล้ว (5 ต.ค. 2569) — เวลาโทรตายตัวตาม Journey: คอนเฟิร์ม 16:00 วันก่อน · ก่อน 1 ชม. · ก่อน 15 นาที
 * - ไม่มีประโยคอธิบาย (กติกาหน้าติดตาม) · ว่าง = "ยังไม่เคยดึง" ไม่ใช่หาย · อ่านไม่ได้ = "อ่านสถานะไม่ได้" + ลองใหม่
 * - แถบนี้เป็นของแท็บส่งคนแทนอย่างเดียว — ข้อยกเว้นเดียวของกติกา "สองแท็บเหมือนกัน" เพราะเจ้าของสั่งดึงรายชื่อให้แท็บนี้โดยตรง
 */
const DMY_HM = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const NUM = new Intl.NumberFormat('th-TH');

export default function IrecruitReplaceSyncBar({ canManage, onSynced }: { canManage: boolean; onSynced: () => void }) {
  const [status, setStatus] = React.useState<ReplaceSyncStatus | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [runError, setRunError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      setStatus(await fetchReplaceSyncStatus());
      setLoadError(null);
    } catch (e) {
      setLoadError(friendlyErrorText(e, 'อ่านสภาพการดึงไม่สำเร็จ'));
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const runNow = async () => {
    setBusy(true);
    setRunError(null);
    try {
      const next = await runReplaceSyncNow();
      // 🔴 คำตอบผิดรูป = ล้มเฉพาะแถบ ไม่ใช่จอขาวทั้งแอป (QA 5 ต.ค. 2569: อ่าน `rule.aiFrom` ของ undefined)
      if (!next?.rule || !next.summary) throw new Error('ดึงไม่สำเร็จ');
      setStatus(next);
      if (next.summary.added > 0 || (next.summary.cancelled ?? 0) > 0 || (next.summary.realigned ?? 0) > 0) onSynced();
    } catch (e) {
      setRunError(friendlyErrorText(e, 'ดึงไม่สำเร็จ'));
    } finally {
      setBusy(false);
    }
  };

  const last = status?.lastRun ?? null;
  const problem = runError ?? status?.unavailableReason ?? last?.error ?? loadError ?? (status && !status.tableReady ? 'ฐานยังไม่พร้อม (รอ migrate)' : null);

  return (
    <Card className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-4 py-3 text-sm" data-testid="irecruit-replace-sync">
      <span className="font-medium text-foreground">iRecruit</span>
      <span className={DASH.muted}>
        {!status && !loadError
          ? 'กำลังอ่าน…'
          : !status
            ? 'อ่านสถานะไม่ได้'
            : last
            ? `ดึงล่าสุด ${DMY_HM.format(new Date(last.at))} · เพิ่ม ${NUM.format(last.added)} · มีแล้ว ${NUM.format(last.alreadyIn)}${
                last.noPhone > 0 ? ` · ไม่มีเบอร์ ${NUM.format(last.noPhone)}` : ''
              }${(last.realigned ?? 0) > 0 ? ` · ย้ายเวลา ${NUM.format(last.realigned ?? 0)}` : ''}${
                (last.cancelled ?? 0) > 0 ? ` · ยกเลิก ${NUM.format(last.cancelled ?? 0)}` : ''
              }${last.queued > 0 ? ` · ส่ง AI ${NUM.format(last.queued)}` : ''}`
              : 'ยังไม่เคยดึง'}
      </span>
      {/* แยกเป็นชิ้นสั้น ๆ ไม่มี "·" นำหน้าลอย (QA 5 ต.ค. 2569) */}
      {status ? (
        <>
          <span className={DASH.muted}>
            โทร <span className="text-foreground">{status.ruleText}</span>
          </span>
          <span className={DASH.muted}>{status.enabled ? 'ดึงทุก 5 นาที' : 'ปิดดึงอัตโนมัติอยู่'}</span>
          {status.rule?.aiFrom ? <span className="text-foreground">AI เริ่มโทร {formatYmdDmyBe(status.rule.aiFrom)}</span> : null}
        </>
      ) : null}
      {problem ? <span className={cn('text-xs', TONE.warn.value)}>{problem}</span> : null}
      {!status && loadError ? (
        <Button type="button" size="xs" variant="outline" className="ml-auto" onClick={() => void load()}>
          ลองใหม่
        </Button>
      ) : null}
      {canManage && status ? (
        <span className="ml-auto flex items-center gap-2">
          <Button type="button" size="xs" variant="outline" disabled={busy || status.running || Boolean(status.unavailableReason)} onClick={() => void runNow()}>
            {busy || status.running ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
            {busy || status.running ? 'กำลังดึง…' : 'ดึงตอนนี้'}
          </Button>
        </span>
      ) : null}
    </Card>
  );
}
