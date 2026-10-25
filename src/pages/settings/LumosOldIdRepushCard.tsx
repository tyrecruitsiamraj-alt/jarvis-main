/**
 * ═══ ตั้งค่า › เชื่อมระบบภายนอก — แผนติดตามรหัสเดิมที่ค้างที่ Lumos (เจ้าของ 22 ต.ค. 2569 Choice "ล้างทีเดียว") ═══
 * นับแผนที่เคยส่งซ้ำด้วยรหัสเดิม (ยกเลิกจาก jarvis ไม่ติด) · กดหลังทีม Lumos ยืนยันว่ายกเลิกให้แล้ว ⇒ ส่งกลับด้วยรหัสใหม่ เวลาเดิม
 * 🔴 กดก่อน Lumos ยกเลิก = คนโดนโทร 2 สาย ⇒ ต้องยืนยันก่อนทุกครั้ง · ที่มา `api/_lib/followOldIdRepush.ts`
 * ประวัติยิงยกเลิกดูย้อนหลังได้ + ถามสถานะจาก Lumos ซ้ำได้ (เจ้าของ 25 ต.ค. 2569 "เก็บผลลงฐานด้วย ดูย้อนหลังได้")
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, RefreshCcw } from 'lucide-react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/apiFetch';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');
const WHEN = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
/** สถานะ event ของ Lumos — imported = รับคำสั่งเข้าระบบแล้ว (ไม่ได้แปลว่ายกเลิกแผนให้แล้ว) */
const LUMOS_STATUS: Record<string, string> = {
  pending: 'รอคิว',
  processing: 'กำลังทำ',
  imported: 'รับคำสั่งแล้ว',
  failed: 'ไม่สำเร็จ',
  discarded: 'ไม่รับคำสั่ง',
  unknown: 'ถามไม่ได้',
};
const statusText = (s: string | null | undefined) => (s ? (LUMOS_STATUS[s] ?? s) : '—');

type Counts = { plans: number; calls: number; cancelledPlans?: number };
type RecancelItem = { planRef: string; times: string; outcome: 'sent' | 'skipped_live_phone' | 'failed'; eventStatus?: string | null; error?: string | null };

const RECANCEL_LABEL: Record<RecancelItem['outcome'], string> = { sent: 'ยิงแล้ว', skipped_live_phone: 'ข้าม · เบอร์นี้ยังมีสายรอโทร', failed: 'ยิงไม่สำเร็จ' };
type RunResult = { plans: number; calls: number; pushed: number; failed: Array<{ planRef: string; reason: string }> };
type RecancelRun = {
  id: string;
  at: string;
  byName: string | null;
  items: Array<RecancelItem & { name: string | null }>;
  latestCheck: { checkedAt: string; byName: string | null; statuses: Record<string, { status: string | null; error: string | null }> } | null;
};

const LumosOldIdRepushCard: React.FC = () => {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recancelOpen, setRecancelOpen] = useState(false);
  const [runs, setRuns] = useState<RecancelRun[] | null>(null);
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const r = await apiFetch('/api/follow-oldid-repush?action=history');
      if (!r.ok) throw new Error('โหลดประวัติไม่สำเร็จ');
      const list = ((await r.json()) as { runs: RecancelRun[] }).runs;
      setRuns(list);
      return list;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดประวัติไม่สำเร็จ');
      return null;
    }
  }, []);

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
    void loadHistory();
  }, [load, loadHistory]);

  /** ถามสถานะคำสั่งยกเลิกของครั้งนั้นจาก Lumos อีกรอบ (Lumos ทำแบบ async · ผลจดลงบันทึก) */
  const checkRun = async (id: string) => {
    if (checking) return;
    setChecking(id);
    setError(null);
    try {
      const r = await apiFetch(`/api/follow-oldid-repush?action=status&run=${encodeURIComponent(id)}`, { method: 'POST' });
      if (!r.ok) throw new Error('ถามสถานะไม่สำเร็จ');
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ถามสถานะไม่สำเร็จ');
    } finally {
      setChecking(null);
    }
  };

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

  const recancel = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch('/api/follow-oldid-repush?action=recancel', { method: 'POST' });
      if (!r.ok) throw new Error('ยิงยกเลิกไม่สำเร็จ');
      setRecancelOpen(false);
      const list = await loadHistory();
      setOpenRun(list?.[0]?.id ?? null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ยิงยกเลิกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const plans = counts?.plans ?? 0;
  const cancelledPlans = counts?.cancelledPlans ?? 0;
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
        <p className="text-sm tabular-nums text-foreground">ยกเลิกในระบบแล้ว แต่ Lumos อาจยังโทร {NUM.format(cancelledPlans)} แผน</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={cancelledPlans === 0 || busy}
          onClick={() => setRecancelOpen(true)}
          data-testid="oldid-recancel"
        >
          ยิงยกเลิกที่ Lumos
        </Button>
      </div>
      {/* ประวัติยิงยกเลิกทุกครั้ง (เก็บในบันทึกการใช้งาน) — กดดูรายแผน + ถามสถานะจาก Lumos ซ้ำได้ */}
      <div className="space-y-2" data-testid="oldid-recancel-history">
        <p className="text-sm font-medium text-foreground">ประวัติยิงยกเลิก</p>
        {runs === null ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่เคยยิง</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {runs.map((run) => {
              const sent = run.items.filter((x) => x.outcome === 'sent').length;
              const skipped = run.items.filter((x) => x.outcome === 'skipped_live_phone').length;
              const failed = run.items.filter((x) => x.outcome === 'failed').length;
              const isOpen = openRun === run.id;
              return (
                <li key={run.id} data-testid="oldid-recancel-run">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto w-full justify-between gap-3 whitespace-normal rounded-xl px-3 py-2 text-left font-normal"
                    onClick={() => setOpenRun(isOpen ? null : run.id)}
                    aria-expanded={isOpen}
                  >
                    <span className="text-sm tabular-nums text-foreground">
                      {WHEN.format(new Date(run.at))} · {run.byName ?? '—'}
                      <span className="block text-xs text-muted-foreground">
                        ยิง {NUM.format(sent)} แผน · ข้าม {NUM.format(skipped)} · ไม่สำเร็จ {NUM.format(failed)}
                        {run.latestCheck ? ` · ถามสถานะล่าสุด ${WHEN.format(new Date(run.latestCheck.checkedAt))}` : ''}
                      </span>
                    </span>
                    <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', isOpen && 'rotate-180')} aria-hidden />
                  </Button>
                  {isOpen ? (
                    <div className="space-y-3 px-3 pb-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={sent === 0 || checking !== null}
                        onClick={() => void checkRun(run.id)}
                        data-testid="oldid-recancel-check"
                      >
                        {checking === run.id ? 'กำลังถาม…' : 'ถามสถานะล่าสุดจาก Lumos'}
                      </Button>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">ผู้รับสาย</TableHead>
                              <TableHead className="whitespace-nowrap text-xs">เวลานัดโทร</TableHead>
                              <TableHead className="whitespace-nowrap text-xs">ผล</TableHead>
                              <TableHead className="whitespace-nowrap text-xs">Lumos ตอนยิง</TableHead>
                              <TableHead className="whitespace-nowrap text-xs">Lumos ล่าสุด</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {run.items.map((x) => {
                              const last = run.latestCheck?.statuses[x.planRef];
                              return (
                                <TableRow key={x.planRef}>
                                  <TableCell className="text-sm text-foreground">{x.name ?? x.planRef}</TableCell>
                                  <TableCell className="text-sm tabular-nums">{x.times}</TableCell>
                                  <TableCell
                                    className={cn(
                                      'text-sm',
                                      x.outcome === 'failed' ? TONE.danger.value : x.outcome === 'sent' ? TONE.success.value : 'text-muted-foreground',
                                    )}
                                  >
                                    {RECANCEL_LABEL[x.outcome]}
                                    {x.error ? ` · ${x.error}` : ''}
                                  </TableCell>
                                  <TableCell className="text-sm">{x.outcome === 'sent' ? statusText(x.eventStatus) : '—'}</TableCell>
                                  <TableCell className="text-sm">
                                    {x.outcome === 'sent' ? statusText(last?.status) : '—'}
                                    {last?.error ? <span className={cn('block text-xs', TONE.danger.value)}>{last.error}</span> : null}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
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
      <AlertDialog open={recancelOpen} onOpenChange={(o) => !busy && setRecancelOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยิงยกเลิกที่ Lumos อีกครั้ง {NUM.format(cancelledPlans)} แผน?</AlertDialogTitle>
            <AlertDialogDescription>เบอร์ที่ยังมีสายรอโทรจะข้าม ไม่ยิง</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>ยังก่อน</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void recancel();
              }}
              data-testid="oldid-recancel-confirm"
            >
              ยิงเลย
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default LumosOldIdRepushCard;
