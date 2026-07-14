import React, { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DashboardActivityTrendPoint } from '@/lib/dashboard/types';

type Props = {
  data: DashboardActivityTrendPoint[];
  /** ช่วงที่เลือก เช่น ปี 2569 / ก.ค. 2026 */
  scopeLabel: string;
};

function fmt(n: number): string {
  return n.toLocaleString('th-TH');
}

function remByType(p: DashboardActivityTrendPoint) {
  return {
    resignation: p.resignations ?? 0,
    replacement: p.replacements ?? 0,
    increaseHeadcount: p.increaseHeadcount ?? 0,
    newSite: p.newSite ?? 0,
    other: p.other ?? 0,
  };
}

function remTotal(p: DashboardActivityTrendPoint): number {
  const t = remByType(p);
  return t.resignation + t.replacement + t.increaseHeadcount + t.newSite + t.other;
}

const DashboardLifecycleMonthlyPanel: React.FC<Props> = ({ data, scopeLabel }) => {
  const months = useMemo(
    () =>
      data.filter(
        (p) =>
          (p.requestedPositions ?? 0) > 0 ||
          (p.filledPositions ?? p.closedPositions ?? 0) > 0 ||
          (p.cancelledPositions ?? 0) > 0 ||
          remTotal(p) > 0,
      ),
    [data],
  );

  const totals = useMemo(() => {
    return months.reduce(
      (acc, p) => {
        const rem = remByType(p);
        return {
          requested: acc.requested + (p.requestedPositions ?? 0),
          filled: acc.filled + (p.filledPositions ?? p.closedPositions ?? 0),
          cancelled: acc.cancelled + (p.cancelledPositions ?? 0),
          remaining: acc.remaining + remTotal(p),
          resignation: acc.resignation + rem.resignation,
          replacement: acc.replacement + rem.replacement,
          increaseHeadcount: acc.increaseHeadcount + rem.increaseHeadcount,
          newSite: acc.newSite + rem.newSite,
          other: acc.other + rem.other,
        };
      },
      {
        requested: 0,
        filled: 0,
        cancelled: 0,
        remaining: 0,
        resignation: 0,
        replacement: 0,
        increaseHeadcount: 0,
        newSite: 0,
        other: 0,
      },
    );
  }, [months]);

  const chartData = useMemo(
    () =>
      months.map((p) => ({
        label: p.label,
        resignations: p.resignations ?? 0,
        replacements: p.replacements ?? 0,
        increaseHeadcount: p.increaseHeadcount ?? 0,
        newSite: p.newSite ?? 0,
        other: p.other ?? 0,
        requested: p.requestedPositions ?? 0,
        filled: p.filledPositions ?? p.closedPositions ?? 0,
        remaining: remTotal(p),
      })),
    [months],
  );

  const summaries = useMemo(() => {
    const lines: string[] = [];
    lines.push(
      `${scopeLabel}: เข้ามา ${fmt(totals.requested)} · ปิดแล้ว ${fmt(totals.filled)} · ยกเลิก ${fmt(totals.cancelled)} · คงเหลือ ${fmt(totals.remaining)} อัตรา`,
    );
    lines.push(
      `คงเหลือแยกประเภทใน${scopeLabel} — ลาออก ${fmt(totals.resignation)} · เปลี่ยนตัว ${fmt(totals.replacement)} · เพิ่มอัตรา ${fmt(totals.increaseHeadcount)} · เปิดไซต์ ${fmt(totals.newSite)}` +
        (totals.other > 0 ? ` · อื่นๆ ${fmt(totals.other)}` : ''),
    );
    if (months.length > 0) {
      const peakRem = [...months].sort((a, b) => remTotal(b) - remTotal(a))[0]!;
      const peakIn = [...months].sort(
        (a, b) => (b.requestedPositions ?? 0) - (a.requestedPositions ?? 0),
      )[0]!;
      if (remTotal(peakRem) > 0) {
        lines.push(`เดือนที่คงเหลือสูงสุดในช่วงนี้: ${peakRem.label} (${fmt(remTotal(peakRem))} อัตรา)`);
      }
      if ((peakIn.requestedPositions ?? 0) > 0) {
        lines.push(`เดือนที่เข้ามามากสุดในช่วงนี้: ${peakIn.label} (${fmt(peakIn.requestedPositions ?? 0)} อัตรา)`);
      }
    }
    return lines;
  }, [months, scopeLabel, totals]);

  const showOther = totals.other > 0;

  if (months.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
        <h3 className="text-sm font-semibold text-slate-900">
          ประเภทใบขอรายเดือน — เข้ามา / ปิดแล้ว / คงเหลือ
        </h3>
        <p className="text-xs text-slate-500 mt-1">ยังไม่มีข้อมูลในช่วง {scopeLabel}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          ประเภทใบขอรายเดือน — เข้ามา / ปิดแล้ว / คงเหลือ
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          แยกตามเดือนที่กรอกใบ · คงเหลือ = อัตราที่ยังต้องหา (แยกประเภท) · สรุปตาม {scopeLabel}
        </p>
        <ul className="text-xs text-slate-700 mt-2 space-y-0.5 list-disc list-inside">
          {summaries.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full min-w-[44rem] text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="text-left font-medium px-2 py-2 whitespace-nowrap">เดือน</th>
              <th className="text-right font-medium px-2 py-2 whitespace-nowrap">เข้ามา</th>
              <th className="text-right font-medium px-2 py-2 whitespace-nowrap">ปิดแล้ว</th>
              <th className="text-right font-medium px-2 py-2 whitespace-nowrap">ยกเลิก</th>
              <th className="text-right font-medium px-2 py-2 whitespace-nowrap">คงเหลือ</th>
              <th className="text-right font-medium px-2 py-2 whitespace-nowrap">ลาออก</th>
              <th className="text-right font-medium px-2 py-2 whitespace-nowrap">เปลี่ยนตัว</th>
              <th className="text-right font-medium px-2 py-2 whitespace-nowrap">เพิ่มอัตรา</th>
              <th className="text-right font-medium px-2 py-2 whitespace-nowrap">เปิดไซต์</th>
              {showOther ? (
                <th className="text-right font-medium px-2 py-2 whitespace-nowrap">อื่นๆ</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {months.map((p) => {
              const rem = remByType(p);
              return (
                <tr key={p.date} className="border-b border-slate-100">
                  <td className="px-2 py-2 font-medium text-slate-800 whitespace-nowrap">{p.label}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmt(p.requestedPositions ?? 0)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {fmt(p.filledPositions ?? p.closedPositions ?? 0)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmt(p.cancelledPositions ?? 0)}</td>
                  <td className="px-2 py-2 text-right tabular-nums font-semibold text-amber-800">
                    {fmt(remTotal(p))}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmt(rem.resignation)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmt(rem.replacement)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmt(rem.increaseHeadcount)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmt(rem.newSite)}</td>
                  {showOther ? (
                    <td className="px-2 py-2 text-right tabular-nums">{fmt(rem.other)}</td>
                  ) : null}
                </tr>
              );
            })}
            <tr className="bg-slate-50 border-t border-slate-200">
              <td className="px-2 py-2.5 font-semibold text-slate-900 whitespace-nowrap">รวม {scopeLabel}</td>
              <td className="px-2 py-2.5 text-right tabular-nums font-semibold">{fmt(totals.requested)}</td>
              <td className="px-2 py-2.5 text-right tabular-nums font-semibold">{fmt(totals.filled)}</td>
              <td className="px-2 py-2.5 text-right tabular-nums font-semibold">{fmt(totals.cancelled)}</td>
              <td className="px-2 py-2.5 text-right tabular-nums font-semibold text-amber-900">
                {fmt(totals.remaining)}
              </td>
              <td className="px-2 py-2.5 text-right tabular-nums font-semibold">{fmt(totals.resignation)}</td>
              <td className="px-2 py-2.5 text-right tabular-nums font-semibold">{fmt(totals.replacement)}</td>
              <td className="px-2 py-2.5 text-right tabular-nums font-semibold">
                {fmt(totals.increaseHeadcount)}
              </td>
              <td className="px-2 py-2.5 text-right tabular-nums font-semibold">{fmt(totals.newSite)}</td>
              {showOther ? (
                <td className="px-2 py-2.5 text-right tabular-nums font-semibold">{fmt(totals.other)}</td>
              ) : null}
            </tr>
          </tbody>
        </table>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-600 mb-2">แนวโน้มคงเหลือแยกประเภท (รายเดือน)</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  `${fmt(Number(value))} อัตรา`,
                  name,
                ]}
              />
              <Legend />
              <Line type="monotone" dataKey="resignations" name="ลาออก" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="replacements" name="เปลี่ยนตัว" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="increaseHeadcount" name="เพิ่มอัตรา" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="newSite" name="เปิดไซต์" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
              {showOther ? (
                <Line type="monotone" dataKey="other" name="อื่นๆ" stroke="#64748b" strokeWidth={2} dot={{ r: 3 }} />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default DashboardLifecycleMonthlyPanel;
