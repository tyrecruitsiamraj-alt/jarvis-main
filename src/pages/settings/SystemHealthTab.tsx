import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, LoaderCircle, RefreshCw, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { humanAgo, type HealthLevel } from '@/lib/systemHealth';
import {
  fetchSystemHealth,
  runSystemHealthCheck,
  type StaleItem,
  type SystemHealth,
} from '@/lib/systemHealthApi';

/**
 * สถานะระบบ — ที่เดียวที่ตอบได้ว่า "ตอนนี้ระบบทำงานอยู่จริงไหม และอะไรเปิดอยู่บ้าง"
 *
 * 🔴 หน้านี้ **ไม่ใช่ตัวเอกของแผน** — ยามเฝ้า (`systemHealthWorker`) ที่เด้งแจ้งเตือนต่างหาก
 * หน้านี้คือที่ให้ดูรายละเอียดตอนได้รับเตือนแล้ว · ถ้าคิดว่าหน้าเดียวพอ เราจะกลับไปเป็น
 * ระบบที่เงียบตอนตัวเองพังเหมือนเดิม (สวิตช์ปิด 4 วันไม่มีใครรู้ · Lumos หยุดดึงคิว 3 วัน)
 */

const LEVEL_TONE: Record<HealthLevel, { box: string; text: string; Icon: typeof CheckCircle2 }> = {
  ok: {
    box: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-800 dark:text-emerald-200',
    Icon: CheckCircle2,
  },
  warn: {
    box: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-800 dark:text-amber-200',
    Icon: AlertTriangle,
  },
  down: {
    box: 'bg-red-50 dark:bg-red-950/40',
    text: 'text-red-800 dark:text-red-200',
    Icon: XCircle,
  },
};

const SWITCH_TONE: Record<string, string> = {
  on: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
  partial: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
  off: 'bg-secondary text-muted-foreground',
};

/** สีของ "ปล่อยไว้นานแค่ไหน" — เขียว < 2 ชม. · เหลือง 2–6 ชม. · แดงเกินนั้น */
function ageTone(minutes: number, limitMinutes: number): string {
  if (minutes >= limitMinutes * 3) return 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200';
  if (minutes >= limitMinutes) return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200';
  return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200';
}

const SystemHealthTab: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchSystemHealth());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'อ่านสถานะระบบไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    // อัปเดตเองทุก 5 นาที — คนเปิดหน้านี้ค้างไว้ต้องไม่เห็นตัวเลขแช่
    const t = window.setInterval(() => void reload(), 300_000);
    return () => window.clearInterval(t);
  }, [reload]);

  const onCheckNow = async () => {
    setChecking(true);
    setError('');
    try {
      setData(await runSystemHealthCheck());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ตรวจสถานะไม่สำเร็จ');
    } finally {
      setChecking(false);
    }
  };

  const checkedAgo = data?.checkedAt
    ? humanAgo(Math.max(0, Math.floor((Date.now() - new Date(data.checkedAt).getTime()) / 60_000)))
    : 'ยังไม่เคย';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">สถานะระบบ</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            ยามเฝ้าตรวจเองทุก 5 นาที · ตรวจล่าสุด {checkedAgo}
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
            onClick={() => void onCheckNow()}
            disabled={checking}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {checking ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null} ตรวจเดี๋ยวนี้
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {/* ไฟสถานะ */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data?.checks.map((c) => {
          const tone = LEVEL_TONE[c.level];
          const Icon = tone.Icon;
          return (
            <div key={c.key} className={cn('rounded-2xl p-3.5', tone.box)}>
              <div className={cn('mb-1.5 flex items-center gap-1.5 text-xs font-medium', tone.text)}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">{c.label}</span>
              </div>
              <p className={cn('text-xl font-semibold', tone.text)}>{c.value}</p>
              <p className={cn('mt-0.5 text-[11px]', tone.text)}>{c.hint}</p>
            </div>
          );
        })}
        {!data && loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" /> กำลังตรวจ…
          </p>
        ) : null}
      </div>

      {/* สวิตช์ */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm dark:bg-slate-900">
        <h3 className="mb-2 text-sm font-semibold text-foreground">สวิตช์ที่เปิดอยู่</h3>
        <ul className="divide-y divide-border">
          {data?.switches.map((s) => (
            <li key={s.key} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{s.label}</span>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                  SWITCH_TONE[s.state] ?? SWITCH_TONE.off,
                )}
              >
                {s.stateLabel}
              </span>
              <span className="w-full shrink-0 text-[11px] text-muted-foreground sm:w-auto sm:min-w-[13rem] sm:text-right">
                {s.note}
              </span>
            </li>
          ))}
          {data && data.switches.length === 0 ? (
            <li className="py-2.5 text-xs text-muted-foreground">อ่านค่าสวิตช์ไม่ได้</li>
          ) : null}
        </ul>
      </div>

      {/* ของค้าง */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm dark:bg-slate-900">
        <h3 className="mb-2 text-sm font-semibold text-foreground">
          ของค้างที่ยังไม่มีใครรับ
          {data && data.stale.length > 0 ? (
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {data.stale.length.toLocaleString('th-TH')} รายการ
            </span>
          ) : null}
        </h3>
        {!data ? null : data.stale.length === 0 ? (
          <p className="text-xs text-muted-foreground">ไม่มีของค้าง — ทุกอย่างมีคนรับแล้ว</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.stale.map((item: StaleItem, i) => (
              <li key={`${item.kind}:${i}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{item.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{item.subtitle}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                      ageTone(item.ageMinutes, data.confirmedOwnerLimitMinutes),
                    )}
                  >
                    ปล่อยไว้ {humanAgo(item.ageMinutes).replace('ก่อน', '')}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate(item.link)}
                    className="rounded-full border border-border px-3 py-1 text-[11px] font-semibold text-foreground hover:bg-secondary"
                  >
                    เปิดดู
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default SystemHealthTab;
