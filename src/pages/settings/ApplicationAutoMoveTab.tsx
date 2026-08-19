import React, { useCallback, useEffect, useState } from 'react';
import { LoaderCircle, PlayCircle, RefreshCw } from 'lucide-react';

import { cn } from '@/lib/utils';
import { fetchAutoMoveStatus, runAutoMoveDryRun, type AutoMoveStatus } from '@/lib/applicationAutoMoveApi';
import {
  autoMoveDetailLine,
  autoMoveModeLabel,
  autoMoveRunSummary,
  autoMoveTopReasons,
} from '@/lib/applicationAutoMoveReport';

/**
 * ตัวย้ายใบสมัครอัตโนมัติ — หน้าที่ตอบคำถามเดียว: **"รอบนี้จะย้ายใครไปไหน"**
 *
 * เจ้าของสั่ง 19 ส.ค. 2569 ให้เริ่มแบบลองดูก่อน แต่ *"ทำให้มันมีบอกหน่อยว่าย้ายใครไปไหน"*
 * ⚠️ ปุ่มบนหน้านี้ **ลองดูอย่างเดียว ไม่ย้ายจริง** — การย้ายจริงมาจาก worker ที่เปิด
 * `APPLICATION_AUTO_MOVE_APPLY` บนเครื่องจริงเท่านั้น
 *
 * ⚠️ ผลรอบล่าสุดอยู่ในหน่วยความจำของ process API — รีสตาร์ตเซิร์ฟเวอร์แล้วจะว่างจนกว่าจะเดินรอบใหม่
 */

const bangkokTime = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' });
};

const ApplicationAutoMoveTab: React.FC = () => {
  const [status, setStatus] = useState<AutoMoveStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [trying, setTrying] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await fetchAutoMoveStatus());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'อ่านสถานะไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onTry = async () => {
    setTrying(true);
    setError('');
    try {
      setStatus(await runAutoMoveDryRun());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ลองเดินรอบไม่สำเร็จ');
    } finally {
      setTrying(false);
    }
  };

  const cfg = status?.config ?? null;
  const run = status?.lastRun ?? null;
  const reasons = run ? autoMoveTopReasons(run.reasons) : [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">ย้ายใบสมัครอัตโนมัติ</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              ใบขอที่คนสมัครไว้ถูกปิด → ย้ายใบสมัครไปใบที่ยังเปิด ตำแหน่งเดียวกัน จังหวัดเดียวกัน
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void reload()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary disabled:opacity-60"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> รีเฟรช
            </button>
            <button
              type="button"
              onClick={() => void onTry()}
              disabled={trying}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              {trying ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PlayCircle className="h-3.5 w-3.5" />
              )}
              ลองดูตอนนี้ (ไม่ย้ายจริง)
            </button>
          </div>
        </div>

        {error ? (
          <p className="mt-3 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        ) : null}

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2 dark:bg-slate-800/50">
            <p className="text-[11px] font-medium text-muted-foreground">ตัวตั้งเวลา</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              {cfg ? autoMoveModeLabel(cfg) : '—'}
            </p>
            {cfg?.enabled ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                เดินทุก {Math.round(cfg.intervalMs / 60_000).toLocaleString('th-TH')} นาที · รอบละไม่เกิน{' '}
                {cfg.limit.toLocaleString('th-TH')} ใบ
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                เปิดที่ตัวแปร <code>APPLICATION_AUTO_MOVE_ENABLED</code> บนเครื่องจริง
              </p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2 dark:bg-slate-800/50">
            <p className="text-[11px] font-medium text-muted-foreground">รอบล่าสุด</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">{autoMoveRunSummary(run)}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {run?.at ? `เมื่อ ${bangkokTime(run.at)} · ใบขอที่ยังเปิด ${run.openJobs.toLocaleString('th-TH')} ใบ` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* ย้ายใครไปไหน */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-foreground">
          {run?.dryRun === false ? 'ย้ายไปแล้ว' : 'รอบนี้จะย้ายใครไปไหน'}
          {run && run.details.length > 0 ? (
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {run.details.length.toLocaleString('th-TH')} ใบ
            </span>
          ) : null}
        </h3>
        {!run ? (
          <p className="mt-2 text-xs text-muted-foreground">
            ยังไม่เคยเดินสักรอบ — กด "ลองดูตอนนี้" เพื่อดูว่ารอบนี้จะย้ายใครบ้าง
          </p>
        ) : run.details.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">ไม่มีใบไหนย้ายได้ในรอบล่าสุด</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {run.details.map((d) => (
              <li key={d.applicationId} className="py-2">
                <p className="text-sm text-foreground">{autoMoveDetailLine(d)}</p>
                <p className="text-[11px] text-muted-foreground">เหตุผล: {d.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ทำไมไม่ย้าย */}
      {reasons.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-foreground">ทำไมใบที่เหลือถึงไม่ย้าย</h3>
          <ul className="mt-2 space-y-1">
            {reasons.map((r) => (
              <li key={r.reason} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-muted-foreground">{r.reason}</span>
                <span className="shrink-0 tabular-nums font-semibold text-foreground">
                  {r.count.toLocaleString('th-TH')} ใบ
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

export default ApplicationAutoMoveTab;
