/**
 * ═══ เทียบ BU ตามเวลา — ตาราง BU × เดือน (กดเดือน = ดูรายวันของเดือนนั้น) ═══
 * เจ้าของ 10 พ.ย. 2569: *"Bu ไหนโดนค่าปรับเยอะ … เทียบรายเดือนว่าแต่ละ BU แนวโน้มเพิ่มขึ้นไหม หรือลดลง หรือเท่าเดิม"* ·
 * Choice "ถ้าฉันกดดูแบบเดือน ก็จะเห็นทุกเดือนเลย พอกดเดือนไหนก็ค่อยให้เห็นเป็นวัน"
 * แท่งเทาสีเดียว ยาวเทียบช่องที่มากสุดทั้งตาราง (เทียบข้าม BU ได้) · เลขอยู่ทุกช่อง · แนวโน้ม = เดือนก่อนเทียบเดือนก่อนหน้า (เดือนที่จบแล้ว)
 * โหลดตอนเปิดแผงเท่านั้น · เปลี่ยนเดือน/BU = คำตอบเก่าที่มาช้าห้ามทับ
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import LoadErrorNotice from '@/components/shared/LoadErrorNotice';
import { fetchHomeBuTrend } from '@/lib/homeMoneyApi';
import type { BuTrendCell, BuTrendResponse } from '@/lib/homeBuTrend';
import { trendBuLabel } from '@/lib/trends/bu';
import { friendlyErrorText } from '@/lib/friendlyError';

const NUM = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });
const MONTH = new Intl.DateTimeFormat('th-TH', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const monthLabel = (ym: string) => MONTH.format(new Date(`${ym}-01T00:00:00Z`));

export type BuTrendMetric = 'money' | 'remaining';
const valueOf = (c: BuTrendCell | undefined, m: BuTrendMetric) => (c ? (m === 'money' ? c.money : c.remainingRequests) : 0);

export default function BuTrendTable({ metric, bu }: { metric: BuTrendMetric; bu: string | null }) {
  const [month, setMonth] = useState<string | null>(null);
  const [state, setState] = useState<{ key: string; data: BuTrendResponse | null; error: string | null } | null>(null);
  const [rev, setRev] = useState(0);
  const key = `${bu ?? ''}|${month ?? ''}`;
  useEffect(() => {
    let alive = true;
    setState({ key, data: null, error: null });
    fetchHomeBuTrend({ bu, month })
      .then((d) => alive && setState({ key, data: d, error: null }))
      .catch((e: unknown) => alive && setState({ key, data: null, error: friendlyErrorText(e, 'โหลดกราฟเทียบ BU ไม่ขึ้น') }));
    return () => {
      alive = false;
    };
  }, [key, bu, month, rev]);
  const data = state?.key === key ? state.data : null;
  /** เปิดมาเห็นเดือน/วันล่าสุด + แนวโน้ม (ขวาสุด) ก่อน — ย้อนดูเก่าเลื่อนซ้าย */
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el && data) el.scrollLeft = el.scrollWidth;
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
  const unit = metric === 'money' ? 'บาท' : 'ใบ';

  return (
    <div className="space-y-2" data-testid={`bu-trend-${metric}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          {metric === 'money' ? 'เสียเงินตามสัญญา แยก BU' : 'เหลือหา ณ สิ้นช่วง แยก BU'} · {month ? `รายวัน ${monthLabel(month)}` : 'รายเดือน'} ({unit})
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
        <div ref={scroller} className="max-w-full overflow-x-auto rounded-xl border border-border">
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
                  <td className="sticky left-0 whitespace-nowrap bg-card px-2 py-2 text-foreground">{b === 'ไม่ระบุ BU' ? b : trendBuLabel(b)}</td>
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
      )}
    </div>
  );
}
