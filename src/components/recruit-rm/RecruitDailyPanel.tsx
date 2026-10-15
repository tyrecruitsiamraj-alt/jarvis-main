import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { CHART, DASH, TONE, type ToneKey } from '@/lib/designTokens';
import { fetchRecruitOverview } from '@/lib/recruitOverviewApi';
import { friendlyErrorText } from '@/lib/friendlyError';
import {
  RECRUIT_DAILY_KEYS,
  RECRUIT_DAILY_LABEL,
  RECRUIT_DAILY_WINDOW_LABEL,
  addDaysYmd,
  recruitDailyRows,
  recruitDailySummary,
  type RecruitDailyKey,
  type RecruitDailyRow,
  type RecruitDailyWindow,
} from '@/lib/recruitDaily';

/**
 * ═══ ตัวเลขรายวันงานสรรหา — พับได้บนแท็บผู้สมัคร (เจ้าของสั่ง 15 ต.ค. 2569) ═══
 * พับอยู่ = แถวเดียว "วันนี้ กรอกมา N · AI โทรแล้ว N · สนใจ N" · กดกาง = 5 กล่อง (วัน + เฉลี่ยต่อวัน) + กราฟแท่งรายวัน
 * กดแท่ง = ดูวันนั้นในกล่อง · ตัวคิด `src/lib/recruitDaily.ts` · ข้อมูลชุดเดียวกับภาพรวมงานสรรหา (`/api/recruit-overview`)
 */

const TONE_OF: Record<RecruitDailyKey, ToneKey> = {
  names: 'primary',
  aiCalled: 'info',
  saidYes: 'success',
  saidNo: 'danger',
  noPickup: 'warn',
};
const WINDOWS: readonly RecruitDailyWindow[] = ['7d', '30d', 'month'];
const NUM = new Intl.NumberFormat('th-TH');
const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const dayMonth = (ymd: string) => `${Number(ymd.slice(8, 10))} ${MONTHS[Number(ymd.slice(5, 7)) - 1]}`;

/** กราฟซ้อน: สนใจ · ไม่สนใจ · ไม่รับสาย · ที่เหลือของกรอกมา (ยังไม่มีคำตอบ) — ความสูงรวม = กรอกมา */
const chartRowOf = (r: RecruitDailyRow) => ({
  ymd: r.ymd,
  label: String(Number(r.ymd.slice(8, 10))),
  saidYes: r.saidYes,
  saidNo: r.saidNo,
  noPickup: r.noPickup,
  rest: Math.max(0, r.names - r.saidYes - r.saidNo - r.noPickup),
});

const RecruitDailyPanel: React.FC<{ refreshKey?: number }> = ({ refreshKey }) => {
  const [open, setOpen] = useState(false);
  const [win, setWin] = useState<RecruitDailyWindow>('30d');
  const [rows, setRows] = useState<RecruitDailyRow[] | null>(null);
  const [today, setToday] = useState('');
  const [firstDay, setFirstDay] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    const t = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
    const from = addDaysYmd(t, -30);
    fetchRecruitOverview(null, { from, to: t })
      .then((d) => {
        if (!alive) return;
        setToday(d.today);
        setFirstDay(d.firstDay);
        setRows(recruitDailyRows(d.apps ?? [], from, d.today));
        if (d.errors.apps) setError(d.errors.apps);
      })
      .catch((e) => {
        if (alive) setError(friendlyErrorText(e, 'โหลดตัวเลขรายวันไม่ได้'));
      });
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  const sum = useMemo(() => (rows && today ? recruitDailySummary(rows, today, win, firstDay) : null), [rows, today, win, firstDay]);
  const shownDay = picked && rows ? (rows.find((r) => r.ymd === picked) ?? sum?.today) : sum?.today;
  const isToday = !picked || picked === today;

  return (
    <div className="mt-3" data-testid="recruit-daily">
      <Button
        type="button"
        size="xs"
        variant={open ? 'secondary' : 'ghost'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="max-w-full"
      >
        {sum ? (
          <span className="truncate">
            วันนี้ กรอกมา <b className="tabular-nums">{NUM.format(sum.today.names)}</b> · AI โทรแล้ว{' '}
            <b className="tabular-nums">{NUM.format(sum.today.aiCalled)}</b> · สนใจ{' '}
            <b className="tabular-nums">{NUM.format(sum.today.saidYes)}</b>
          </span>
        ) : error ? (
          <span className={TONE.danger.value}>โหลดตัวเลขรายวันไม่ได้</span>
        ) : (
          <span className={DASH.muted}>กำลังโหลดตัวเลขวันนี้…</span>
        )}
        <ChevronDown className={cn('transition-transform', open && 'rotate-180')} aria-hidden />
      </Button>

      {open ? (
        <Card className="mt-2 space-y-3 rounded-2xl p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">
              {shownDay ? (isToday ? `วันนี้ ${dayMonth(shownDay.ymd)}` : dayMonth(shownDay.ymd)) : 'วันนี้'}
              {!isToday ? (
                <Button type="button" size="xs" variant="ghost" className="ml-1" onClick={() => setPicked(null)}>
                  กลับวันนี้
                </Button>
              ) : null}
            </p>
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="เฉลี่ยจากช่วงไหน">
              <span className={cn('text-xs', DASH.muted)}>เฉลี่ยจาก</span>
              {WINDOWS.map((w) => (
                <Button
                  key={w}
                  type="button"
                  size="xs"
                  variant={win === w ? 'default' : 'outline'}
                  aria-pressed={win === w}
                  onClick={() => setWin(w)}
                >
                  {RECRUIT_DAILY_WINDOW_LABEL[w]}
                </Button>
              ))}
            </div>
          </div>

          {error ? (
            <p role="alert" className={cn('text-xs', TONE.danger.value)}>
              {error}
            </p>
          ) : null}

          {/* 5 กล่อง: วันที่เลือก + เฉลี่ยต่อวันของช่วง (ไม่นับวันนี้) */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {RECRUIT_DAILY_KEYS.map((k) => (
              <div key={k} className="rounded-xl border border-border/70 px-3 py-2">
                <p className={cn('text-xs', DASH.muted)}>{RECRUIT_DAILY_LABEL[k]}</p>
                {shownDay ? (
                  <p className={cn('text-2xl font-medium tabular-nums', TONE[TONE_OF[k]].value)}>{NUM.format(shownDay[k])}</p>
                ) : (
                  <Skeleton className="mt-1 h-7 w-12" />
                )}
                <p className={cn('text-xs tabular-nums', DASH.muted)}>
                  เฉลี่ย {sum?.avg ? NUM.format(sum.avg[k]) : '—'}/วัน
                </p>
              </div>
            ))}
          </div>

          {/* กราฟรายวัน — ความสูง = กรอกมา · สีซ้อน = สนใจ/ไม่สนใจ/ไม่รับสาย · กดแท่ง = ดูวันนั้น */}
          <div className={cn('h-52 w-full', DASH.sub)} role="img" aria-label="กรอกมารายวัน">
            {sum ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sum.chart.map(chartRowOf)}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                  onClick={(e) => {
                    const ymd = (e?.activePayload?.[0]?.payload as { ymd?: string } | undefined)?.ymd;
                    if (ymd) setPicked(ymd);
                  }}
                >
                  <CartesianGrid vertical={false} stroke={CHART.gridStroke} strokeOpacity={CHART.gridOpacity} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.axisFill }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} />
                  <YAxis tick={{ fontSize: 11, fill: CHART.axisFill }} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                  <Tooltip
                    contentStyle={CHART.tooltip.contentStyle}
                    labelStyle={CHART.tooltip.labelStyle}
                    itemStyle={CHART.tooltip.itemStyle}
                    labelFormatter={(_, p) => {
                      const ymd = (p?.[0]?.payload as { ymd?: string } | undefined)?.ymd;
                      return ymd ? dayMonth(ymd) : '';
                    }}
                    formatter={(v: number, name: string) => [NUM.format(Number(v)), name]}
                  />
                  <Bar dataKey="saidYes" name="สนใจ" stackId="d" fill={TONE.success.hex} isAnimationActive={false} />
                  <Bar dataKey="saidNo" name="ไม่สนใจ" stackId="d" fill={TONE.danger.hex} isAnimationActive={false} />
                  <Bar dataKey="noPickup" name="ไม่รับสาย" stackId="d" fill={TONE.warn.hex} isAnimationActive={false} />
                  <Bar dataKey="rest" name="ยังไม่มีคำตอบ" stackId="d" fill={TONE.neutral.hex} maxBarSize={24} isAnimationActive={false}>
                    {sum.chart.map((r) => (
                      <Cell key={r.ymd} fillOpacity={r.ymd === (picked ?? today) ? 1 : 0.55} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Skeleton className="h-full w-full" />
            )}
          </div>
          {sum ? (
            <p className={cn('text-xs', DASH.muted)}>
              เฉลี่ยจาก {sum.days} วัน · นับตามวันที่กรอก
            </p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
};

export default RecruitDailyPanel;
