import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

import { TONE, type ToneKey } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import {
  EMPTY_RECRUIT_FUNNEL,
  RECRUIT_FUNNEL_STEP_LABEL,
  RECRUIT_FUNNEL_TILES,
  funnelPercent,
  type RecruitFunnelCounts,
  type RecruitFunnelTile,
} from '@/lib/recruitFunnel';
import { fetchRecruitFunnel } from '@/lib/recruitFunnelApi';

/** ความหมายสีของแต่ละช่อง — เขียว=จบดี · แดง=จบไม่ดี · เหลือง=ยังไม่จบ (ทิศเดียวกับ callOutcomeTone) */
const TILE_TONE: Record<RecruitFunnelTile['key'], ToneKey> = {
  registered: 'primary',
  called: 'info',
  contactSuccess: 'success',
  noAnswer: 'warn',
  unreachable: 'danger',
  contactFailedOther: 'neutral',
  appointmentSuccess: 'success',
  appointmentFailed: 'danger',
  showedUp: 'success',
  noShow: 'danger',
  followPending: 'warn',
};

const STEPS: RecruitFunnelTile['step'][] = ['intake', 'contact', 'appointment', 'follow'];

/**
 * แผงคุมงานสรรหา — 9 ตัวเลขที่เจ้าของขอ 11 ส.ค. 2569
 *
 * ⚠️ **ตัวเลขมาจาก iRecruit อ่านอย่างเดียว** เพราะงาน RM จริงยังทำอยู่บนระบบเดิม
 * บอกที่มาไว้บนแผงตรง ๆ จะได้ไม่มีใครเข้าใจว่าเป็นยอดของใบสมัครฝั่งเรา
 *
 * ⚠️ อ่านไม่ได้ = ขึ้นข้อความว่าอ่านไม่ได้ **ไม่โชว์ 0** — "0 คนกรอกมา" กับ
 * "ต่อฐานไม่ติด" คนละเรื่องกันคนละขั้ว (กติกาข้อ 9 ของโปรเจกต์)
 */
const RecruitFunnelPanel: React.FC = () => {
  const [data, setData] = useState<(RecruitFunnelCounts & { leads: number }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchRecruitFunnel()
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setData(null);
        setError(e instanceof Error ? e.message : 'โหลดยอดสรุปไม่สำเร็จ');
        setLoading(false);
      });
  };

  useEffect(load, []);

  const counts = data ?? EMPTY_RECRUIT_FUNNEL;

  return (
    <section className="rounded-[1.5rem] border border-border/70 bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">ภาพรวมงานสรรหา</h2>
          <p className="text-[11px] text-muted-foreground">
            ยอดจากระบบเดิม (iRecruit) · อ่านอย่างเดียว
            {data ? ` · นับหัวคน เอาผลล่าสุดของแต่ละคน · ในนั้นเป็น Lead ${data.leads.toLocaleString('th-TH')} ราย` : null}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          รีเฟรช
        </button>
      </div>

      {loading && !data ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> กำลังอ่านยอดจากระบบเดิม…
        </p>
      ) : error ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          อ่านยอดจากระบบเดิมไม่ได้ — {error}
          <br />
          <span className="text-[11px]">
            ยังไม่แสดงตัวเลข เพราะ &ldquo;อ่านไม่ได้&rdquo; กับ &ldquo;ไม่มีเลย&rdquo; ไม่ใช่เรื่องเดียวกัน
          </span>
        </p>
      ) : (
        <div className="space-y-3">
          {STEPS.map((step) => {
            const tiles = RECRUIT_FUNNEL_TILES.filter((t) => t.step === step);
            return (
              <div key={step}>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#b08d4f] dark:text-[#cfae72]">
                  {RECRUIT_FUNNEL_STEP_LABEL[step]}
                </p>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                  {tiles.map((t) => {
                    const tone = TONE[TILE_TONE[t.key]];
                    const value = counts[t.key];
                    const pct = t.ofKey ? funnelPercent(value, counts[t.ofKey]) : null;
                    return (
                      <div key={t.key} className={cn('rounded-2xl px-3 py-2.5', tone.tile)}>
                        <p className="truncate text-[11px] font-medium text-slate-600 dark:text-slate-300">
                          {t.label}
                        </p>
                        <p className={cn('mt-0.5 text-xl font-bold tabular-nums', tone.num)}>
                          {value.toLocaleString('th-TH')}
                        </p>
                        {/* แถบสัดส่วน — ไม่มีตัวหารก็ไม่ขึ้นแถบ ไม่ใช่แถบศูนย์ */}
                        {pct != null ? (
                          <>
                            {/* เนื้อแถบใช้ `tone.dot` ตามแพตเทิร์นเดียวกับ DashboardKpiCard —
                                `tone.bar` เป็นเส้นขอบบน (border-t) เอามาทำเนื้อแถบไม่ได้ */}
                            <div
                              className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10"
                              aria-hidden
                            >
                              <span
                                className={cn('block h-full rounded-full', tone.dot)}
                                style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                              />
                            </div>
                            <p className="mt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                              {pct.toLocaleString('th-TH')}% ของ{' '}
                              {RECRUIT_FUNNEL_TILES.find((x) => x.key === t.ofKey)?.label}
                            </p>
                          </>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default RecruitFunnelPanel;
