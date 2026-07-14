import React from 'react';
import type { LifecycleBoardSummary } from '@/lib/dashboard/lifecycle';
import { LIFECYCLE_KIND_LABELS } from '@/lib/dashboard/lifecycle';

type Props = {
  board: LifecycleBoardSummary;
  periodLabel: string;
};

function fmt(n: number): string {
  return n.toLocaleString('th-TH');
}

function cell(bucket: { positions: number; requests: number }) {
  if (bucket.positions <= 0 && bucket.requests <= 0) {
    return <span className="text-slate-300">—</span>;
  }
  return (
    <span className="tabular-nums">
      <span className="font-semibold text-slate-900">{fmt(bucket.positions)}</span>
      <span className="text-[10px] text-slate-500 ml-1">{fmt(bucket.requests)} ใบ</span>
    </span>
  );
}

const COLS: { key: 'total' | 'resignation' | 'replacement' | 'increaseHeadcount' | 'newSite' | 'other'; label: string }[] = [
  { key: 'total', label: 'รวม' },
  { key: 'resignation', label: LIFECYCLE_KIND_LABELS.resignation },
  { key: 'replacement', label: LIFECYCLE_KIND_LABELS.replacement },
  { key: 'increaseHeadcount', label: LIFECYCLE_KIND_LABELS.increase_headcount },
  { key: 'newSite', label: LIFECYCLE_KIND_LABELS.new_site },
  { key: 'other', label: LIFECYCLE_KIND_LABELS.other },
];

const DashboardLifecycleBoard: React.FC<Props> = ({ board, periodLabel }) => {
  const remainingRow = board.rows.find((r) => r.id === 'remaining');
  const showOther = board.rows.some((r) => r.other.positions > 0 || r.other.requests > 0);
  const cols = showOther ? COLS : COLS.filter((c) => c.key !== 'other');

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900">Life Cycle ตามประเภทใบขอ</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          ใช้ชุดเดียวกับสรุปอัตรา · เข้ามา/ปิดแล้ว/ยกเลิกจาก cohort · คงเหลือจากคิวเปิด · {periodLabel}
        </p>
        {remainingRow ? (
          <p className="text-xs text-slate-600 mt-1">
            คงเหลือรวม {fmt(remainingRow.total.positions)} อัตรา (= การ์ดคงเหลือ) — ลาออก{' '}
            {fmt(remainingRow.resignation.positions)} · เปลี่ยนตัว {fmt(remainingRow.replacement.positions)} · เพิ่มอัตรา{' '}
            {fmt(remainingRow.increaseHeadcount.positions)} · เปิดไซต์ {fmt(remainingRow.newSite.positions)}
            {showOther ? ` · อื่นๆ ${fmt(remainingRow.other.positions)}` : ''}
          </p>
        ) : null}
        <p className="text-[11px] text-slate-500 mt-1">
          คอลัมน์รวมของเข้ามา/ปิดแล้ว/ยกเลิก ต้องเท่าการ์ดสรุปอัตรา · คงเหลือเท่าการ์ดคงเหลือ
        </p>
      </div>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full min-w-[40rem] text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="text-left font-medium px-2 py-2 whitespace-nowrap">รายการ</th>
              {cols.map((c) => (
                <th key={c.key} className="text-right font-medium px-2 py-2 whitespace-nowrap">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {board.rows.map((row) => (
              <tr
                key={row.id}
                className={
                  row.id === 'remaining'
                    ? 'border-b border-slate-100 bg-amber-50/40'
                    : 'border-b border-slate-100'
                }
              >
                <td className="px-2 py-2.5 font-medium text-slate-800 whitespace-nowrap">{row.label}</td>
                {cols.map((c) => (
                  <td key={c.key} className="px-2 py-2.5 text-right">
                    {cell(row[c.key])}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="text-slate-500">
              <td className="px-2 py-2.5 whitespace-nowrap">% ปิดได้ / ที่ขอ</td>
              {cols.map((c) => {
                const kind =
                  c.key === 'resignation'
                    ? 'resignation'
                    : c.key === 'replacement'
                      ? 'replacement'
                      : c.key === 'increaseHeadcount'
                        ? 'increase_headcount'
                        : c.key === 'newSite'
                          ? 'new_site'
                          : c.key === 'other'
                            ? 'other'
                            : null;
                if (!kind) {
                  const req = board.rows.find((r) => r.id === 'requested')?.total.positions ?? 0;
                  const fill = board.rows.find((r) => r.id === 'filled')?.total.positions ?? 0;
                  const pct = req > 0 ? Math.round((fill / req) * 1000) / 10 : null;
                  return (
                    <td key={c.key} className="px-2 py-2.5 text-right tabular-nums">
                      {pct == null ? '—' : `${pct}%`}
                    </td>
                  );
                }
                const pct = board.fillRateByKind[kind];
                return (
                  <td key={c.key} className="px-2 py-2.5 text-right tabular-nums">
                    {pct == null ? '—' : `${pct}%`}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DashboardLifecycleBoard;
