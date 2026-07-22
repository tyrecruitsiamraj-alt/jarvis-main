import React, { useEffect, useMemo, useState } from 'react';
import {
  buildDemandForecast,
  FORECAST_GROUPS,
  FORECAST_GROUP_LABELS,
  THAI_MONTH_SHORT,
  type DemandForecast,
  type ForecastGroup,
  type GroupMonthForecast,
  type MonthForecast,
} from '@/lib/dashboard/request-control/demandForecast';
import { fetchDemandForecast } from '@/lib/dashboard/request-control/demandForecastApi';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(n: number): string {
  return n.toLocaleString('th-TH');
}

/** ป้ายเดือนปีนี้ เช่น "สค 69" */
function monthLabel(month: number, year: number): string {
  return `${THAI_MONTH_SHORT[month - 1]} ${String(year + 543).slice(-2)}`;
}

type GroupTab = 'total' | ForecastGroup;

const TABS: { key: GroupTab; label: string }[] = [
  { key: 'total', label: 'รวมทุกประเภท' },
  ...FORECAST_GROUPS.map((g) => ({ key: g as GroupTab, label: FORECAST_GROUP_LABELS[g] })),
];

function cellOf(m: MonthForecast, tab: GroupTab): GroupMonthForecast {
  return tab === 'total' ? m.total : m.groups[tab];
}

const Dash = () => <span className="text-slate-300">—</span>;

const DemandForecastPanel: React.FC = () => {
  const [forecast, setForecast] = useState<DemandForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<GroupTab>('total');

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

  const yearsLabel = useMemo(() => {
    if (!forecast?.historyYears.length) return '';
    return forecast.historyYears.map((y) => String(y + 543).slice(-2)).join('/');
  }, [forecast]);

  const summary = useMemo(() => {
    if (!forecast) return null;
    const cur = forecast.months.find((m) => m.status === 'current');
    if (!cur) return null;
    const c = cellOf(cur, tab);
    const label = tab === 'total' ? 'รวมทุกประเภท' : FORECAST_GROUP_LABELS[tab];
    const more = c.expectedMoreNet ?? 0;
    const moreMax = c.expectedMoreMaxNet ?? 0;
    const moreText =
      moreMax > more ? `~${fmt(more)} (อาจถึง ${fmt(moreMax)})` : `~${fmt(more)}`;
    return (
      `${monthLabel(cur.month, forecast.currentYear)} (${label}): ` +
      `คาดว่าจะเข้ามา ~${fmt(c.medNet)} (ต่ำสุด ${fmt(c.minNet)} · สูงสุด ${fmt(c.maxNet)}) · ` +
      `เข้ามาแล้ว ${fmt(c.actualNet ?? 0)} · คาดว่าจะเข้ามาอีก ${moreText}`
    );
  }, [forecast, tab]);

  /** หมายเหตุปีพีคของแท็บที่เลือก — โชว์ใต้ตาราง */
  const spikeNotes = useMemo(() => {
    if (!forecast) return [];
    return forecast.months
      .map((m) => {
        const note = cellOf(m, tab).spikeNote;
        return note ? `${monthLabel(m.month, forecast.currentYear)}: ${note}` : null;
      })
      .filter((n): n is string => n !== null);
  }, [forecast, tab]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-2">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-700">
          <TrendingUp className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">พยากรณ์ใบขอเข้าใหม่ตามประเภท</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            หน่วย: อัตรา (คน) หักยกเลิกแล้ว · คาดจากเดือนเดียวกันของปี {yearsLabel || 'ย้อนหลัง'}
            {' '}(ใช้ค่าปีกลาง กันปีโดดผิดปกติ · ต่ำสุด–สูงสุด = ที่เคยเกิดจริง)
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
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  tab === t.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {summary ? (
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2">
              <p className="text-xs font-medium text-slate-800">{summary}</p>
            </div>
          ) : null}

          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[38rem] border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="whitespace-nowrap px-2 py-2 text-left font-medium">เดือน</th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-medium">
                    คาดว่าจะเข้ามา
                  </th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-medium">ต่ำสุด</th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-medium">สูงสุด</th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-medium">เข้ามาแล้ว</th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-medium">
                    คาดว่าจะเข้ามาอีก
                  </th>
                </tr>
              </thead>
              <tbody>
                {forecast.months.map((m) => {
                  const c = cellOf(m, tab);
                  const isCurrent = m.status === 'current';
                  const isPast = m.status === 'past';
                  const expectedMore = isCurrent
                    ? (c.expectedMoreNet ?? 0)
                    : m.status === 'future'
                      ? c.medNet
                      : null;
                  return (
                    <tr
                      key={m.month}
                      className={cn(
                        'border-b border-slate-100',
                        isCurrent && 'bg-blue-50/60',
                        isPast && 'text-slate-400',
                      )}
                    >
                      <td className="whitespace-nowrap px-2 py-2 font-medium">
                        <span className={isPast ? '' : 'text-slate-800'}>
                          {monthLabel(m.month, forecast.currentYear)}
                        </span>
                        {isCurrent ? (
                          <span className="ml-1.5 rounded bg-blue-600/10 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700">
                            เดือนนี้
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        <span className={cn('font-semibold', !isPast && 'text-slate-900')}>
                          ~{fmt(c.medNet)}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt(c.minNet)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {fmt(c.maxNet)}
                        {c.spikeNote ? (
                          <span className="ml-0.5 text-amber-600" title={c.spikeNote}>
                            *
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {c.actualNet == null ? (
                          <Dash />
                        ) : (
                          <span className={cn('font-semibold', !isPast && 'text-slate-900')}>
                            {fmt(c.actualNet)}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {expectedMore == null ? (
                          <Dash />
                        ) : (
                          <span className="whitespace-nowrap">
                            <span
                              className={cn(
                                'font-semibold',
                                isCurrent ? 'text-blue-700' : 'text-slate-700',
                              )}
                            >
                              ~{fmt(expectedMore)}
                            </span>
                            {isCurrent && (c.expectedMoreMaxNet ?? 0) > expectedMore ? (
                              <span className="ml-1 text-[10px] text-slate-500">
                                อาจถึง {fmt(c.expectedMoreMaxNet ?? 0)}
                              </span>
                            ) : null}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {spikeNotes.length > 0 ? (
            <div className="space-y-0.5 px-1">
              {spikeNotes.map((n) => (
                <p key={n} className="text-[10px] text-amber-700">
                  * {n}
                </p>
              ))}
            </div>
          ) : null}

          <p className="px-1 text-[10px] text-slate-400">
            เดือนที่ผ่านแล้ว (จาง) = ดูย้อนว่าจริงเทียบคาดเป็นยังไง · เดือนหน้าเป็นต้นไป ยังไม่มี
            &quot;เข้ามาแล้ว&quot; จึงคาดว่าจะเข้ามาอีกเต็มจำนวน
          </p>

          {forecast.topResignationUnits.length > 0 ? (
            <div className="rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2.5">
              <p className="text-xs font-semibold text-slate-800">
                หน่วยงานที่มีแนวโน้มลาออก (จากใบขอลาออก 12 เดือนล่าสุด)
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {forecast.topResignationUnits.map((u) => (
                  <span
                    key={u.unitName}
                    className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] tabular-nums text-slate-700"
                    title={`${u.requests.toLocaleString('th-TH')} ใบขอ · เกิดขึ้นใน ${u.monthsActive} เดือน`}
                  >
                    {u.unitName}
                    <span className="ml-1 font-semibold text-amber-800">{fmt(u.positions)} อัตรา</span>
                    <span className="ml-1 text-slate-400">/{u.monthsActive} เดือน</span>
                  </span>
                ))}
              </div>
              <p className="mt-1.5 text-[10px] text-slate-500">
                หน่วยงานที่ติดอันดับซ้ำหลายเดือน = ลาออกเป็นประจำ ควรเตรียมคนสำรอง/หาสาเหตุที่หน้างาน
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default DemandForecastPanel;
