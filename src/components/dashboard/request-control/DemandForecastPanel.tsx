import React, { useEffect, useMemo, useState } from 'react';
import {
  buildDemandForecast,
  FORECAST_GROUPS,
  FORECAST_GROUP_LABELS,
  THAI_MONTH_SHORT,
  type DemandForecast,
  type MonthForecast,
} from '@/lib/dashboard/request-control/demandForecast';
import { fetchDemandForecast } from '@/lib/dashboard/request-control/demandForecastApi';
import { ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(n: number): string {
  return n.toLocaleString('th-TH');
}

/** ป้ายเดือนปีนี้ เช่น "สค 69" */
function monthLabel(month: number, year: number): string {
  return `${THAI_MONTH_SHORT[month - 1]} ${String(year + 543).slice(-2)}`;
}

/** การ์ดตัวเลขใหญ่ของเดือนนี้ */
function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'blue' | 'plain';
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5',
        tone === 'blue' ? 'border-blue-200 bg-blue-50/70' : 'border-slate-200 bg-slate-50/60',
      )}
    >
      <p className="text-[11px] text-slate-500">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-xl font-bold tabular-nums leading-tight',
          tone === 'blue' ? 'text-blue-700' : 'text-slate-900',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[10px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

/** เซลล์พยากรณ์เดือนอนาคต: เลขหลักบรรทัดบน ช่วงบรรทัดล่าง */
function ForecastCell({ med, min, max }: { med: number; min: number; max: number }) {
  if (med <= 0 && max <= 0) return <span className="text-slate-300">—</span>;
  return (
    <div className="leading-tight">
      <div className="text-sm font-semibold tabular-nums text-slate-900">~{fmt(med)}</div>
      <div className="text-[10px] tabular-nums text-slate-400">
        {fmt(min)}–{fmt(max)}
      </div>
    </div>
  );
}

const DemandForecastPanel: React.FC = () => {
  const [forecast, setForecast] = useState<DemandForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDemandForecast()
      .then((resp) => {
        if (cancelled) return;
        if (resp) setForecast(buildDemandForecast(resp));
        else setError(true);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const current = useMemo(
    () => forecast?.months.find((m) => m.status === 'current') ?? null,
    [forecast],
  );
  const futureMonths = useMemo(
    () => forecast?.months.filter((m) => m.status === 'future') ?? [],
    [forecast],
  );
  const pastMonths = useMemo(
    () => forecast?.months.filter((m) => m.status === 'past') ?? [],
    [forecast],
  );

  const yearsLabel = forecast?.historyYears.length
    ? forecast.historyYears.map((y) => String(y + 543).slice(-2)).join('/')
    : '';

  const renderGroupHead = () => (
    <tr className="border-b border-slate-200 text-slate-500">
      <th className="whitespace-nowrap px-2 py-2 text-left font-medium">เดือน</th>
      <th className="whitespace-nowrap px-2 py-2 text-right font-medium">รวม</th>
      {FORECAST_GROUPS.map((g) => (
        <th key={g} className="whitespace-nowrap px-2 py-2 text-right font-medium">
          {FORECAST_GROUP_LABELS[g]}
        </th>
      ))}
    </tr>
  );

  const renderCurrentMonth = (cur: MonthForecast, f: DemandForecast) => (
    <div className="space-y-2 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
      <p className="text-xs font-semibold text-slate-800">
        เดือนนี้ ({monthLabel(cur.month, f.currentYear)})
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <StatCard label="เข้ามาแล้ว (หักยกเลิก)" value={`${fmt(cur.total.actualNet ?? 0)} อัตรา`} />
        <StatCard
          label="คาดว่าจะเข้ามาอีก"
          value={`~${fmt(cur.total.expectedMoreNet ?? 0)} อัตรา`}
          tone="blue"
          hint={
            (cur.total.actualNet ?? 0) > cur.total.maxNet
              ? 'เข้ามาเกินทุกปีที่ผ่านมาแล้ว — เดือนนี้หนักกว่าปกติ'
              : undefined
          }
        />
        <StatCard
          label={`ปีก่อนๆ เดือนนี้เข้ามา (${yearsLabel})`}
          value={`~${fmt(cur.total.medNet)} อัตรา`}
          hint={`ต่ำสุด ${fmt(cur.total.minNet)} · สูงสุด ${fmt(cur.total.maxNet)}`}
        />
      </div>
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        {FORECAST_GROUPS.map((g) => {
          const cell = cur.groups[g];
          if ((cell.actualNet ?? 0) <= 0 && (cell.expectedMoreNet ?? 0) <= 0) return null;
          return (
            <span
              key={g}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] tabular-nums text-slate-700"
            >
              {FORECAST_GROUP_LABELS[g]}: เข้าแล้ว {fmt(cell.actualNet ?? 0)}
              {(cell.expectedMoreNet ?? 0) > 0 ? ` · คาดอีก ~${fmt(cell.expectedMoreNet ?? 0)}` : ''}
            </span>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-2">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-700">
          <TrendingUp className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            พยากรณ์ใบขอเข้าใหม่ตามประเภท
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            ทุกตัวเลข = อัตรา (คน) หักยกเลิกแล้ว · คาดจากเดือนเดียวกันของ 3 ปีก่อน (ใช้ค่าปีกลาง
            กันปีที่โดดผิดปกติ)
          </p>
        </div>
      </div>

      {loading ? (
        <p className="animate-pulse py-8 text-center text-xs text-slate-500">
          กำลังคำนวณจากประวัติใบขอ 3 ปี…
        </p>
      ) : error || !forecast ? (
        <p className="py-6 text-center text-xs text-slate-500">
          โหลดข้อมูลพยากรณ์ไม่สำเร็จ — ลองรีเฟรชหน้า
        </p>
      ) : (
        <div className="space-y-4">
          {current ? renderCurrentMonth(current, forecast) : null}

          {futureMonths.length > 0 ? (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-800">
                เดือนที่เหลือของปี — คาดว่าจะเข้ามาเดือนละ
              </p>
              <div className="-mx-1 overflow-x-auto">
                <table className="w-full min-w-[38rem] border-collapse text-xs">
                  <thead>{renderGroupHead()}</thead>
                  <tbody>
                    {futureMonths.map((m) => (
                      <tr key={m.month} className="border-b border-slate-100">
                        <td className="whitespace-nowrap px-2 py-2 font-medium text-slate-800">
                          {monthLabel(m.month, forecast.currentYear)}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <ForecastCell
                            med={m.total.medNet}
                            min={m.total.minNet}
                            max={m.total.maxNet}
                          />
                        </td>
                        {FORECAST_GROUPS.map((g) => (
                          <td key={g} className="px-2 py-2 text-right">
                            <ForecastCell
                              med={m.groups[g].medNet}
                              min={m.groups[g].minNet}
                              max={m.groups[g].maxNet}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1.5 px-1 text-[10px] text-slate-400">
                เลขใหญ่ = คาดการณ์ (ค่าปีกลางจาก 3 ปี) · เลขเล็กใต้ = ช่วงต่ำสุด–สูงสุดที่เคยเกิดจริง
              </p>
            </div>
          ) : null}

          {pastMonths.length > 0 ? (
            <div>
              <button
                type="button"
                onClick={() => setShowPast((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
              >
                {showPast ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                ผลจริงเดือนที่ผ่านมา เทียบที่คาดไว้ ({pastMonths.length} เดือน)
              </button>
              {showPast ? (
                <div className="-mx-1 mt-2 overflow-x-auto">
                  <table className="w-full min-w-[38rem] border-collapse text-xs">
                    <thead>{renderGroupHead()}</thead>
                    <tbody>
                      {pastMonths.map((m) => (
                        <tr key={m.month} className="border-b border-slate-100">
                          <td className="whitespace-nowrap px-2 py-2 font-medium text-slate-600">
                            {monthLabel(m.month, forecast.currentYear)}
                          </td>
                          {[m.total, ...FORECAST_GROUPS.map((g) => m.groups[g])].map((cell, i) => (
                            <td key={i} className="px-2 py-2 text-right">
                              <div className="leading-tight">
                                <div className="text-sm font-medium tabular-nums text-slate-700">
                                  {fmt(cell.actualNet ?? 0)}
                                </div>
                                <div className="text-[10px] tabular-nums text-slate-400">
                                  คาดไว้ ~{fmt(cell.medNet)}
                                </div>
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-1.5 px-1 text-[10px] text-slate-400">
                    เลขใหญ่ = เข้ามาจริงปีนี้ · เลขเล็กใต้ = ที่โมเดลคาดไว้ — ใช้เช็คความแม่นของการพยากรณ์
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default DemandForecastPanel;
