import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import { cn } from '@/lib/utils';
import { Phone, ExternalLink, X } from 'lucide-react';
import {
  listActiveProposals,
  cancelProposal,
  proposalStatusLabel,
  type CandidateProposal,
  type ProposalSource,
} from '@/lib/candidateProposalsApi';

const SOURCE_META: Record<ProposalSource, { label: string; cls: string }> = {
  board: { label: 'คนของเรา', cls: 'bg-sky-500/15 text-sky-700' },
  irecruit: { label: 'iRecruit', cls: 'bg-blue-500/15 text-blue-700' },
};

const STATUS_CLASS: Record<CandidateProposal['status'], string> = {
  proposed: 'bg-slate-500/15 text-slate-700',
  reserved: 'bg-amber-500/15 text-amber-800',
  contacted: 'bg-blue-500/15 text-blue-700',
  placed: 'bg-emerald-500/15 text-emerald-700',
  rejected: 'bg-red-500/10 text-red-700',
  cancelled: 'bg-muted text-muted-foreground',
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

const ReservationsPage: React.FC = () => {
  const [items, setItems] = useState<CandidateProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<'all' | ProposalSource>('all');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listActiveProposals();
      setItems(data);
    } catch {
      setError('โหลดรายการไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(
    () => items.filter((it) => (sourceFilter === 'all' ? true : it.source === sourceFilter)),
    [items, sourceFilter],
  );

  const cancel = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await cancelProposal(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
      setConfirmingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ยกเลิกไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="รายชื่อคนจอง"
        subtitle="ผู้สมัครที่กำลังจอง/ติดต่อ/ลงงานอยู่ — 1 คนจองได้ทีละใบขอเท่านั้น"
        backPath="/matching"
      />
      <div className="px-4 md:px-6 space-y-4 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">คนที่จองอยู่ ({rows.length})</h2>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as 'all' | ProposalSource)}
            className="jarvis-soft-field min-h-[40px] text-xs w-auto"
          >
            <option value="all">ทุกแหล่ง</option>
            <option value="board">คนของเรา</option>
            <option value="irecruit">iRecruit</option>
          </select>
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-white/80 bg-white/30 px-4 py-8 text-center">
            ยังไม่มีใครถูกจองอยู่ตอนนี้
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((it) => {
              const src = SOURCE_META[it.source];
              const confirming = confirmingId === it.id;
              const busy = busyId === it.id;
              return (
                <li key={it.id} className="glass-card rounded-2xl border border-white/70 p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', src.cls)}>
                      {src.label}
                    </span>
                    <span
                      className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', STATUS_CLASS[it.status])}
                    >
                      {proposalStatusLabel(it.status)}
                    </span>
                    <span className="text-[11px] text-muted-foreground ml-auto">{formatWhen(it.updated_at)}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {it.candidate_name || `#${it.candidate_ref}`}
                  </h3>
                  <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                    {it.candidate_position ? <span>{it.candidate_position}</span> : null}
                    {it.branch_name ? <span className="font-medium text-blue-700">สาขา: {it.branch_name}</span> : null}
                    {it.candidate_phone ? (
                      <a href={`tel:${it.candidate_phone}`} className="inline-flex items-center gap-1 text-sky-700 hover:underline">
                        <Phone className="h-3 w-3" /> {it.candidate_phone}
                      </a>
                    ) : null}
                  </div>
                  {it.reason ? (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">— {it.reason}</p>
                  ) : null}
                  <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                    <span>จองไว้กับใบขอ: {it.request_no || it.job_id}</span>
                    <a
                      href={`/matching/match?jobId=${encodeURIComponent(it.job_id)}`}
                      className="inline-flex items-center gap-0.5 text-blue-700 hover:underline"
                    >
                      เปิดใบขอ <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {confirming ? (
                      <>
                        <span className="text-[11px] text-destructive self-center">ยกเลิกการจองนี้แน่ใจนะ?</span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void cancel(it.id)}
                          className="rounded-full border border-red-300 bg-red-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                        >
                          {busy ? 'กำลังยกเลิก…' : 'ยืนยันยกเลิก'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingId(null)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                        >
                          ไม่ยกเลิก
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingId(it.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-3 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50"
                      >
                        <X className="h-3 w-3" /> ยกเลิกจอง
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ReservationsPage;
