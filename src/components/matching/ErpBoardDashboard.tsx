import React from 'react';
import { DASH, TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import { countBy, type ErpBoardCard, type ErpBoardOverview } from '@/lib/erpBoard';

/**
 * แท็บ Dashboard ของบอร์ด ERP — นับจากการ์ดของวัน/เดือนที่เลือก (ตามตัวกรองเดียวกับบอร์ด)
 * ช่อง/ขั้นตอนขึ้นครบทุกตัวแม้เป็น 0 (กติกา "ว่างแล้วห้ามหาย")
 */
const ErpBoardDashboard: React.FC<{ overview: ErpBoardOverview | null; cards: readonly ErpBoardCard[] }> = ({ overview, cards }) => {
  const total = cards.length;
  const linked = cards.filter((c) => c.requestNos.length > 0).length;
  const called = cards.filter((c) => c.calls > 0).length;
  const chkTotal = overview?.checklist.length ?? 0;
  const chkDone = cards.filter((c) => chkTotal > 0 && c.checklistDone >= chkTotal).length;

  const byColumn = (overview?.columns ?? []).map((col) => ({ label: col.label, count: cards.filter((c) => c.columnId === col.id).length }));
  const stepCounts = countBy(cards, (c) => c.step, 'ยังไม่มีสถานะ');
  const bySteps = [
    { label: 'ยังไม่มีสถานะ', count: stepCounts.find((x) => x.label === 'ยังไม่มีสถานะ')?.count ?? 0 },
    ...(overview?.steps ?? []).map((s) => ({ label: `${s.seq}. ${s.label}`, count: stepCounts.find((x) => x.label === s.label)?.count ?? 0 })),
  ];
  const byAssignee = countBy(cards, (c) => c.assignees, 'ยังไม่มีผู้ดูแล');
  const byTag = countBy(cards, (c) => c.tags, 'ไม่มีแท็ก');

  return (
    <div className="space-y-4" data-testid="erp-board-dashboard">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="ทั้งหมด" value={total} />
        <Stat label="ผูกใบขอแล้ว" value={linked} of={total} />
        <Stat label="โทรแล้ว" value={called} of={total} />
        <Stat label="ตรวจครบ" value={chkDone} of={total} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Bars title="ตามช่อง" rows={byColumn} total={total} />
        <Bars title="ตามขั้นตอนล่าสุด" rows={bySteps} total={total} />
        <Bars title="ตามผู้ดูแล" rows={byAssignee} total={total} />
        <Bars title="ตามแท็ก" rows={byTag} total={total} />
      </div>
    </div>
  );
};

function Stat({ label, value, of }: { label: string; value: number; of?: number }) {
  return (
    <div className={cn(DASH.card, 'p-4')}>
      <p className={DASH.sub}>{label}</p>
      <p className="text-2xl font-medium tabular-nums">
        {value.toLocaleString()}
        {of != null ? <span className={cn(DASH.sub, 'ml-1 text-sm')}>/ {of.toLocaleString()}</span> : null}
      </p>
    </div>
  );
}

function Bars({ title, rows, total }: { title: string; rows: { label: string; count: number }[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className={cn(DASH.card, 'space-y-2 p-4')}>
      <h3 className={DASH.title}>{title}</h3>
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-5 items-center gap-2 text-sm">
          <span className={cn(DASH.cell, 'col-span-2 truncate')}>{r.label}</span>
          <div className="col-span-2 h-2 rounded-full bg-muted">
            <div className={cn('h-2 rounded-full', TONE.primary.dot)} style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
          <span className="text-right tabular-nums">
            {r.count}
            <span className={cn(DASH.sub, 'ml-1')}>{total ? `${Math.round((r.count / total) * 100)}%` : '0%'}</span>
          </span>
        </div>
      ))}
    </section>
  );
}

export default ErpBoardDashboard;
