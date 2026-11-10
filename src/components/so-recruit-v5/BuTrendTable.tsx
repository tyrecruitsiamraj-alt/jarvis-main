/**
 * ═══ เทียบ BU ตามเวลา — ตาราง BU × เดือน (กดเดือน = ดูรายวันของเดือนนั้น) ═══
 * เจ้าของ 10 พ.ย. 2569: *"Bu ไหนโดนค่าปรับเยอะ … เทียบรายเดือนว่าแต่ละ BU แนวโน้มเพิ่มขึ้นไหม หรือลดลง หรือเท่าเดิม"* ·
 * Choice "ถ้าฉันกดดูแบบเดือน ก็จะเห็นทุกเดือนเลย พอกดเดือนไหนก็ค่อยให้เห็นเป็นวัน"
 * แท่งเทาสีเดียว ยาวเทียบช่องที่มากสุดทั้งตาราง (เทียบข้าม BU ได้) · เลขอยู่ทุกช่อง · แนวโน้ม = เดือนก่อนเทียบเดือนก่อนหน้า (เดือนที่จบแล้ว)
 * โหลดตอนเปิดแผงเท่านั้น · เปลี่ยนเดือน/BU = คำตอบเก่าที่มาช้าห้ามทับ
 * กราฟเส้นบนสุด เส้นละ BU (เจ้าของ 10 พ.ย. 2569 "พอกดเข้าให้มันโชว์กราฟไง") — ชุดข้อมูลเดียวกับตาราง · กดจุดเดือน = รายวันของเดือนนั้น
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART, chartDayLabel, DASH, TONE, type ToneKey } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import LoadErrorNotice from '@/components/shared/LoadErrorNotice';
import { fetchHomeBuTrend } from '@/lib/homeMoneyApi';
import type { BuTrendCell, BuTrendResponse } from '@/lib/homeBuTrend';
import { trendBuLabel } from '@/lib/trends/bu';
import { friendlyErrorText } from '@/lib/friendlyError';

const NUM = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });
const MONTH = new Intl.DateTimeFormat('th-TH', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const monthLabel = (ym: string) => MONTH.format(new Date(`${ym}-01T00:00:00Z`));

export type BuTrendMetric = 'money' | 'remaining' | 'applicants' | 'follow';
/** สีเส้นตามลำดับ BU — จากโทเค็นที่เดียว (เหมือนกราฟเส้นแท็บภาพรวม) */
const LINE_TONES: ToneKey[] = ['info', 'success', 'warn', 'violet', 'danger', 'teal'];
const valueOf = (c: BuTrendCell | undefined, m: BuTrendMetric) =>
  !c ? 0 : m === 'money' ? c.money : m === 'remaining' ? c.remainingRequests : m === 'applicants' ? (c.applicants ?? 0) : (c.followPeople ?? 0);
/** หัวกราฟ + หน่วย ต่อการ์ด — ผู้สมัคร/ติดตาม (10 พ.ย. 2569 "กดแล้วเป็นกราฟทุกการ์ด") */
const TITLE: Record<BuTrendMetric, string> = {
  money: 'เสียเงินตามสัญญา แยก BU',
  remaining: 'เหลือหา ณ สิ้นช่วง แยก BU',
  applicants: 'ผู้สมัครที่กรอกเข้ามา แยก BU',
  follow: 'คนที่ติดตาม แยก BU',
};
const UNIT: Record<BuTrendMetric, string> = { money: 'บาท', remaining: 'ใบ', applicants: 'คน', follow: 'คน' };

export default function BuTrendTable({ metric, bu }: { metric: BuTrendMetric; bu: string | null }) {
  const [month, setMonth] = useState<string | null>(null);
  const [state, setState] = useState<{ key: string; data: BuTrendResponse | null; error: string | null } | null>(null);
  const [rev, setRev] = useState(0);
  const key = `${metric}|${bu ?? ''}|${month ?? ''}`;
  useEffect(() => {
    let alive = true;
    setState({ key, data: null, error: null });
    fetchHomeBuTrend({ bu, month, metric: metric === 'applicants' || metric === 'follow' ? metric : undefined })
      .then((d) => alive && setState({ key, data: d, error: null }))
      .catch((e: unknown) => alive && setState({ key, data: null, error: friendlyErrorText(e, 'โหลดกราฟเทียบ BU ไม่ขึ้น') }));
    return () => {
      alive = false;
    };
  }, [key, bu, month, metric, rev]);
  const data = state?.key === key ? state.data : null;
  /** เปิดมาเห็นเดือน/วันล่าสุด + แนวโน้ม (ขวาสุด) ก่อน — ย้อนดูเก่าเลื่อนซ้าย */
  const scroller = useRef<HTMLDivElement>(null);
  // แผงเลื่อนเข้ามาอยู่ (ขนาดยังไม่นิ่ง) — เลื่อนหลังจอวางเสร็จ และซ้ำเมื่อกล่องเปลี่ยนขนาด
  useEffect(() => {
    const el = scroller.current;
    if (!el || !data) return;
    const toEnd = () => {
      el.scrollLeft = el.scrollWidth;
    };
    const raf = requestAnimationFrame(toEnd);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(toEnd);
    ro?.observe(el);
    const stop = () => ro?.disconnect();
    // คนเลื่อนเองแล้ว = หยุดดึงกลับขวา
    el.addEventListener('pointerdown', stop, { once: true });
    el.addEventListener('wheel', stop, { once: true });
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      el.removeEventListener('pointerdown', stop);
      el.removeEventListener('wheel', stop);
    };
  }, [data]);
  const max = useMemo(() => Math.max(1, ...(data?.points ?? []).flatMap((p) => Object.values(p.byBu).map((c) => valueOf(c, metric)))), [data, metric]);
  /** แนวโน้มรายเดือน: เดือนที่จบแล้วล่าสุดเทียบเดือนก่อนหน้า (ห้ามเอาเดือนนี้ที่ยังไม่จบมาเทียบ) */
  const trendOf = (b: string): string => {
    if (!data || data.granularity !== 'month' || data.points.length < 3) return '—';
    const pts = data.points.slice(0, -1);
    const a = valueOf(pts[pts.length - 2].byBu[b], metric);
    const z = valueOf(pts[pts.length - 1].byBu[b], metric);
    if (a === z) return 'เท่าเดิม';
    return z > a ? `เพิ่มขึ้น ${NUM.format(z - a)}` : `ลดลง ${NUM.format(a - z)}`;
  };
  const unit = UNIT[metric];
  const buName = (b: string) => (b === 'ไม่ระบุ BU' ? b : trendBuLabel(b));
  const lineData = useMemo(
    () =>
      (data?.points ?? []).map((p) => ({
        key: p.key,
        label: data?.granularity === 'month' ? monthLabel(p.key) : String(Number(p.key.slice(8))),
        ...Object.fromEntries((data?.bus ?? []).map((b) => [b, valueOf(p.byBu[b], metric)])),
      })),
    [data, metric],
  );
  /** เดือนสุดท้าย = เดือนนี้ยังไม่จบ — กล่องตัวเลขบอก (เลขเงินเดือนนี้ยังน้อยกว่าเดือนเต็ม) */
  // ตัดสินจากรูปคีย์ ไม่ใช่โหมดตอนนี้ — กล่องตัวเลขค้างจากโหมดรายวันตอนกดกลับรายเดือนเคยทำหน้าล่ม (Invalid time value)
  const pointLabel = (k: string) => {
    if (!/^\d{4}-\d{2}$/.test(k)) return chartDayLabel(k);
    const last = data?.granularity === 'month' ? data.points[data.points.length - 1]?.key : null;
    return k === last ? `${monthLabel(k)} (ยังไม่จบเดือน)` : monthLabel(k);
  };

  return (
    <div className="space-y-2" data-testid={`bu-trend-${metric}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          {TITLE[metric]} · {month ? `รายวัน ${monthLabel(month)}` : 'รายเดือน'} ({unit})
        </p>
        {month ? (
          <Button type="button" variant="outline" size="xs" onClick={() => setMonth(null)} data-testid="bu-trend-back">
            ‹ กลับรายเดือน
          </Button>
        ) : null}
      </div>
      {state?.error ? (
        <LoadErrorNotice message={state.error} onRetry={() => setRev((n) => n + 1)} />
      ) : !data ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (
        <>
        <div className={cn('h-56', DASH.sub)} data-testid={`bu-trend-chart-${metric}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={lineData}
              margin={{ top: 8, right: 12, bottom: 0, left: metric === 'money' ? 8 : -12 }}
              className={data.granularity === 'month' ? 'cursor-pointer' : undefined}
              onClick={(e: { activePayload?: Array<{ payload?: { key?: string } }> } | null) => {
                const k = e?.activePayload?.[0]?.payload?.key;
                if (data.granularity === 'month' && k) setMonth(k);
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.gridStroke} strokeOpacity={CHART.gridOpacity} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.axisFill }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: CHART.axisFill }} tickFormatter={(v: number) => NUM.format(v)} />
              <Tooltip
                {...CHART.tooltip}
                cursor={CHART.cursorLine}
                labelFormatter={(_l, p) => pointLabel(String((p?.[0]?.payload as { key?: string } | undefined)?.key ?? ''))}
                formatter={(value: number, name: string) => [`${NUM.format(Number(value))} ${unit}`, buName(name)]}
              />
              {data.bus.map((b, i) => (
                <Line
                  key={b}
                  type="monotone"
                  dataKey={b}
                  name={b}
                  stroke={TONE[LINE_TONES[i % LINE_TONES.length]].hex}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={CHART.activeDot}
                  animationDuration={CHART.animationDuration}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {data.bus.map((b, i) => (
            <span key={b} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: TONE[LINE_TONES[i % LINE_TONES.length]].hex }} aria-hidden />
              {buName(b)}
            </span>
          ))}
          {data.granularity === 'month' ? <span>· กดเดือนเพื่อดูรายวัน</span> : null}
        </div>
        {/* มือถือเหลือแค่กราฟ (เจ้าของ 10 พ.ย. 2569 "ซ่อนตารางบนมือถือ") — จอแคบเห็นแค่ 2 เดือน · ตัวเลขรายเดือนกดจุดบนกราฟดูได้ */}
        <div ref={scroller} className="hidden max-w-full overflow-x-auto rounded-xl border border-border sm:block" data-testid={`bu-trend-table-${metric}`}>
          <table className="w-full text-xs tabular-nums">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="sticky left-0 bg-card px-2 py-2 text-left font-normal">BU</th>
                {data.points.map((p) => (
                  <th key={p.key} className="px-1 py-1 text-right font-normal">
                    {data.granularity === 'month' ? (
                      <Button type="button" variant="ghost" size="xs" className="h-7 px-1.5" onClick={() => setMonth(p.key)} aria-label={`ดูรายวัน ${monthLabel(p.key)}`}>
                        {monthLabel(p.key)} ›
                      </Button>
                    ) : (
                      <span className="px-1">{Number(p.key.slice(8))}</span>
                    )}
                  </th>
                ))}
                {data.granularity === 'month' ? <th className="px-2 py-2 text-right font-normal">แนวโน้ม</th> : null}
              </tr>
            </thead>
            <tbody>
              {data.bus.length === 0 ? (
                <tr>
                  <td colSpan={data.points.length + 2} className="px-2 py-4 text-center text-muted-foreground">
                    ไม่มีข้อมูลในช่วงนี้
                  </td>
                </tr>
              ) : null}
              {data.bus.map((b) => (
                <tr key={b} className="border-b border-border last:border-b-0">
                  <td className="sticky left-0 whitespace-nowrap bg-card px-2 py-2 text-foreground">{buName(b)}</td>
                  {data.points.map((p) => {
                    const v = valueOf(p.byBu[b], metric);
                    return (
                      <td key={p.key} className="min-w-14 px-1 py-2 text-right align-bottom">
                        <span className="mb-1 ml-auto block h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                          <span className="ml-auto block h-full rounded-full bg-foreground/40" style={{ width: `${(v / max) * 100}%` }} />
                        </span>
                        {NUM.format(v)}
                      </td>
                    );
                  })}
                  {data.granularity === 'month' ? <td className="whitespace-nowrap px-2 py-2 text-right text-foreground">{trendOf(b)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
