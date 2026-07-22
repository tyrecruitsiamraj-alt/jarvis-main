import React, { useEffect, useMemo, useState } from 'react';
import {
  buildDemandForecast,
  FORECAST_GROUPS,
  FORECAST_GROUP_LABELS,
  THAI_MONTH_SHORT,
  type DemandForecast,
  type GroupMonthForecast,
  type MonthForecast,
} from '@/lib/dashboard/request-control/demandForecast';
import { fetchDemandForecast } from '@/lib/dashboard/request-control/demandForecastApi';
import { TrendingUp } from 'lucide-react';

function fmt(n: number): string {
  return n.toLocaleString('th-TH');
}

/** เซลล์ต่อกลุ่มต่อเดือน — เนื้อหาตามสถานะเดือน */
function GroupCell({ g, status }: { g: GroupMonthForecast; status: MonthForecast['status'] }) {
  if (status === 'future') {
    if (g.avgNet <= 0 && g.maxNet <= 0) return <span className="text-slate-300">—</span>;
    return (
      <span className="tabular-nums">
        <span className="font-semibold text-slate-900">~{fmt(g.avgNet)}</span>
        <span className="ml-1 text-[10px] text-slate-500">
          ({fmt(g.minNet)}–{fmt(g.maxNet)})
        </span>
      </span>
    );
  }
  if (status === 'current') {
    return (
      <span className="tabular-nums">
        <span className="font-semibold text-blue-700">อีก ~{fmt(g.expectedMoreNet ?? 0)}</span>
        <span className="ml-1 text-[10px] text-slate-500">เข้าแล้ว {fmt(g.actualNet ?? 0)}</span>
      </span>
    );
  }
  // past: จริง เทียบค่าเฉลี่ย
  const actual = g.actualNet ?? 0;
  if (actual <= 0 && g.avgNet <= 0) return <span className="text-slate-300">—</span>;
  return (
    <span className="tabular-nums">
      <span className="font-medium text-slate-700">{fmt(actual)}</span>
      <span className="ml-1 text-[10px] text-slate-400">เฉลี่ย {fmt(g.avgNet)}</span>
    </span>
  );
}

function currentMonthSummary(f: DemandForecast): string | null {
  const cur = f.months.find((m) => m.status === 'current');
  if (!cur) return null;
  const parts = FORECAST_GROUPS.filter((g) => (cur.groups[g].expectedMoreNet ?? 0) > 0).map(
    (g) => `${FORECAST_GROUP_LABELS[g]} ~${fmt(cur.groups[g].expectedMoreNet ?? 0)}`,
  );
  const detail = parts.length > 0 ? ` · แยก: ${parts.join(', ')}` : '';
  return (
    `${THAI_MONTH_SHORT[cur.month - 1]}: คาดทั้งเดือน ~${fmt(cur.total.avgNet)} อัตรา ` +
    `(${fmt(cur.total.minNet)}–${fmt(cur.total.maxNet)}) · เข้ามาแล้ว ${fmt(cur.total.actualNet ?? 0)} ` +
    `· คาดเข้ามาอีก ~${fmt(cur.total.expectedMoreNet ?? 0)}${detail}`
  );
}

const DemandForecastPanel: React.FC = () => {
  const [forecast, setForecast] = useState<DemandForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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

  const summary = useMemo(() => (forecast ? currentMonthSummary(forecast) : null), [forecast]);

  const yearsLabel = forecast?.historyYears.length
    ? `${forecast.historyYears[0]}–${forecast.historyYears[forecast.historyYears.length - 1]}`
    : '';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 space-y-2">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-700">
            <TrendingUp className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              พยากรณ์ใบขอเข้าใหม่ตามประเภท (หลังหักยกเลิก)
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              ค่าเฉลี่ยเดือนเดียวกันของปี {yearsLabel || 'ย้อนหลัง'} · ช่วง (ต่ำสุด–สูงสุด) จากปีจริง ·
              หน่วยเป็นอัตรา (คน)
            </p>
          </div>
        </div>

        {summary ? (
          <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2">
            <p className="text-xs font-medium text-slate-800">{summary}</p>
          </div>
        ) : null}
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
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="whitespace-nowrap px-2 py-2 text-left font-medium">เดือน</th>
                <th className="whitespace-nowrap px-2 py-2 text-right font-medium">รวม</th>
                {FORECAST_GROUPS.map((g) => (
                  <th key={g} className="whitespace-nowrap px-2 py-2 text-right font-medium">
                    {FORECAST_GROUP_LABELS[g]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {forecast.months.map((m) => (
                <tr
                  key={m.month}
                  className={
                    m.status === 'current'
                      ? 'border-b border-slate-100 bg-blue-50/50'
                      : m.status === 'past'
                        ? 'border-b border-slate-100 text-slate-500'
                        : 'border-b border-slate-100'
                  }
                >
                  <td className="whitespace-nowrap px-2 py-2 font-medium text-slate-800">
                    {THAI_MONTH_SHORT[m.month - 1]}
                    {m.status === 'current' ? (
                      <span className="ml-1 rounded bg-blue-600/10 px-1 py-0.5 text-[9px] font-semibold text-blue-700">
                        เดือนนี้
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    <GroupCell g={m.total} status={m.status} />
                  </td>
                  {FORECAST_GROUPS.map((g) => (
                    <td key={g} className="whitespace-nowrap px-2 py-2 text-right">
                      <GroupCell g={m.groups[g]} status={m.status} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 px-1 text-[10px] text-slate-400">
            เดือนที่ผ่านแล้ว = ยอดจริงปีนี้ (เทียบค่าเฉลี่ย) · เดือนนี้ = เข้าแล้ว + คาดเข้ามาอีก ·
            เดือนหน้า = พยากรณ์ ~เฉลี่ย (ต่ำสุด–สูงสุด) · ทุกตัวเลขหักยกเลิกแล้ว
          </p>
        </div>
      )}
    </div>
  );
};

export default DemandForecastPanel;
