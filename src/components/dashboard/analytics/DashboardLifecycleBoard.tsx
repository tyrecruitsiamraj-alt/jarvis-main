import React, { useMemo } from 'react';
import type { LifecycleBoardSummary, LifecycleBoardRow } from '@/lib/dashboard/lifecycle';
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

function kindShareLine(row: LifecycleBoardRow, showOther: boolean): string {
  const parts = [
    `ลาออก ${fmt(row.resignation.positions)}`,
    `เปลี่ยนตัว ${fmt(row.replacement.positions)}`,
    `เพิ่มอัตรา ${fmt(row.increaseHeadcount.positions)}`,
    `เปิดไซต์ ${fmt(row.newSite.positions)}`,
  ];
  if (showOther) parts.push(`อื่นๆ ${fmt(row.other.positions)}`);
  return parts.join(' · ');
}

function weakestFillLabel(board: LifecycleBoardSummary): string | null {
  const entries: { label: string; pct: number }[] = [];
  const add = (label: string, kind: keyof typeof board.fillRateByKind, requested: number) => {
    const pct = board.fillRateByKind[kind];
    if (pct == null || requested <= 0) return;
    entries.push({ label, pct });
  };
  const req = board.rows.find((r) => r.id === 'requested');
  if (!req) return null;
  add('ลาออก', 'resignation', req.resignation.positions);
  add('เปลี่ยนตัว', 'replacement', req.replacement.positions);
  add('เพิ่มอัตรา', 'increase_headcount', req.increaseHeadcount.positions);
  add('เปิดไซต์', 'new_site', req.newSite.positions);
  if (req.other.positions > 0) add('อื่นๆ', 'other', req.other.positions);
  if (entries.length === 0) return null;
  entries.sort((a, b) => a.pct - b.pct);
  const weak = entries[0]!;
  return `${weak.label} ปิดได้ช้าสุด (${weak.pct}%)`;
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
  const showOther = board.rows.some((r) => r.other.positions > 0 || r.other.requests > 0);
  const cols = showOther ? COLS : COLS.filter((c) => c.key !== 'other');

  const summary = useMemo(() => {
    const requested = board.rows.find((r) => r.id === 'requested');
    const filled = board.rows.find((r) => r.id === 'filled');
    const cancelled = board.rows.find((r) => r.id === 'cancelled');
    const remaining = board.rows.find((r) => r.id === 'remaining');
    if (!requested || !filled || !cancelled || !remaining) return null;

    const inPos = requested.total.positions;
    const closedPos = filled.total.positions;
    const cancelPos = cancelled.total.positions;
    const remPos = remaining.total.positions;
    const fillPct = inPos > 0 ? Math.round((closedPos / inPos) * 1000) / 10 : null;
    const stillOpenPct = inPos > 0 ? Math.round((remPos / inPos) * 1000) / 10 : null;
    const weak = weakestFillLabel(board);

    return {
      inPos,
      closedPos,
      cancelPos,
      remPos,
      fillPct,
      stillOpenPct,
      weak,
      intakeByType: kindShareLine(requested, showOther),
      remainingByType: kindShareLine(remaining, showOther),
    };
  }, [board, showOther]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 space-y-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Life Cycle ตามประเภทใบขอ</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            มุมวิเคราะห์: เข้ามาเท่าไหร่ → ปิด/ยกเลิกไปแล้วเท่าไหร่ → คงเหลือยังหาอยู่เท่าไหร่ · แยกตามประเภท · {periodLabel}
          </p>
        </div>

        {summary ? (
          <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 space-y-1.5">
            <p className="text-xs text-slate-800 font-medium">
              ข้อสรุป {periodLabel}: เข้ามา{' '}
              <span className="tabular-nums">{fmt(summary.inPos)}</span> · ปิดแล้ว{' '}
              <span className="tabular-nums">{fmt(summary.closedPos)}</span>
              {summary.fillPct != null ? ` (${summary.fillPct}%)` : ''} · ยกเลิก{' '}
              <span className="tabular-nums">{fmt(summary.cancelPos)}</span> · คงเหลือหาอยู่{' '}
              <span className="tabular-nums text-amber-900">{fmt(summary.remPos)}</span>
              {summary.stillOpenPct != null ? ` (~${summary.stillOpenPct}% ของที่เข้ามา)` : ''}
            </p>
            <p className="text-[11px] text-slate-600">
              เข้ามาแยกประเภท — {summary.intakeByType}
            </p>
            <p className="text-[11px] text-slate-600">
              คงเหลือแยกประเภท (= การ์ดคงเหลือ) — {summary.remainingByType}
            </p>
            {summary.weak ? (
              <p className="text-[11px] text-slate-600">
                อ่าน % ปิดได้: ประเภทไหนต่ำ = ปิดช้า/ค้างนาน · ตอนนี้{summary.weak}
              </p>
            ) : null}
          </div>
        ) : null}
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
