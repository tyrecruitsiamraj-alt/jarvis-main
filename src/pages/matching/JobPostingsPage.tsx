import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import { cn } from '@/lib/utils';
import { Copy, Check, ExternalLink } from 'lucide-react';
import {
  listJobPostingRequests,
  updateJobPostingStatus,
  jobPostingStatusLabel,
  type JobPostingRequest,
  type JobPostingStatus,
  type JobSnapshot,
} from '@/lib/jobPostingRequestsApi';

const STATUS_CLASS: Record<JobPostingStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-800',
  in_progress: 'bg-blue-500/15 text-blue-700',
  posted: 'bg-violet-500/15 text-violet-700',
  completed: 'bg-emerald-500/15 text-emerald-700',
  filled: 'bg-emerald-500/15 text-emerald-700',
  cancelled: 'bg-muted text-muted-foreground',
};

/** ปุ่มขั้นต่อไปตามประเภทงาน — Scraping ไม่มีสถานะ "โพสแล้ว". */
function nextStatuses(item: JobPostingRequest): { status: JobPostingStatus; label: string }[] | undefined {
  if (item.status === 'pending') return [
    { status: 'in_progress', label: 'รับไปทำ' },
    { status: 'cancelled', label: 'ยกเลิก' },
  ];
  if (item.status === 'in_progress') return [
    item.request_type === 'scraping'
      ? { status: 'completed', label: 'ตรวจรับแล้ว' }
      : { status: 'posted', label: 'โพสแล้ว' },
    { status: 'cancelled', label: 'ยกเลิก' },
  ];
  if (item.status === 'posted') return [
    { status: 'filled', label: 'ได้คนแล้ว' },
    { status: 'cancelled', label: 'ยกเลิก' },
  ];
  return undefined;
}

function num(v: number | null | undefined): string | null {
  return v == null || Number.isNaN(Number(v)) ? null : Number(v).toLocaleString('th-TH');
}

/** รายละเอียดใบขอที่แนบมากับคำขอ (job_snapshot) — ให้ทีมปลายทางเห็นครบโดยไม่ต้องต่อ MSSQL */
function SnapshotDetails({ snap }: { snap: JobSnapshot | null }) {
  if (!snap) {
    return (
      <p className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-400">
        คำขอเก่า — ไม่มีรายละเอียดใบขอแนบ (คำขอที่สร้างหลังจากนี้จะแนบให้อัตโนมัติ)
      </p>
    );
  }
  const age =
    snap.age_min != null || snap.age_max != null
      ? `${snap.age_min ?? '—'}–${snap.age_max ?? '—'} ปี`
      : null;
  const rows: { label: string; value: string | null }[] = [
    { label: 'หน่วยงาน', value: snap.unit_name ?? null },
    { label: 'พื้นที่', value: snap.location ?? null },
    { label: 'จำนวน', value: num(snap.qty) ? `${num(snap.qty)} อัตรา` : null },
    { label: 'รายได้', value: num(snap.income) ? `฿${num(snap.income)}` : null },
    { label: 'เพศ', value: snap.gender ?? null },
    { label: 'อายุ', value: age },
    { label: 'เวลาทำงาน', value: snap.work_schedule ?? null },
    { label: 'แผนก', value: snap.department ?? null },
    { label: 'วันที่ต้องการ', value: snap.required_date ?? null },
    { label: 'หมายเหตุ', value: snap.note ?? null },
  ].filter((r) => r.value);

  if (rows.length === 0) return null;
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-1 rounded-lg bg-slate-50/70 px-3 py-2 text-[11px] sm:grid-cols-2">
      {rows.map((r) => (
        <div key={r.label} className="flex gap-1.5">
          <dt className="shrink-0 text-slate-500">{r.label}:</dt>
          <dd className="min-w-0 break-words font-medium text-slate-800">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

function CopyIdButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = id;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={() => void copy()}
      title={id}
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-mono text-slate-600 hover:bg-slate-50"
    >
      {copied ? <Check className="h-2.5 w-2.5 text-emerald-600" /> : <Copy className="h-2.5 w-2.5" />}
      {id.slice(0, 8)}
    </button>
  );
}

const JobPostingsPage: React.FC = () => {
  const [items, setItems] = useState<JobPostingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | JobPostingStatus>('all');
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listJobPostingRequests(filterStatus === 'all' ? undefined : filterStatus);
      setItems(data);
    } catch {
      setError('โหลดรายการไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const patchStatus = async (id: string, status: JobPostingStatus) => {
    setError(null);
    try {
      const item = await updateJobPostingStatus(id, status);
      setItems((prev) => prev.map((it) => (it.id === item.id ? item : it)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'อัปเดตไม่สำเร็จ');
    }
  };

  const counts = useMemo(() => {
    const c: Record<JobPostingStatus, number> = { pending: 0, in_progress: 0, posted: 0, completed: 0, filled: 0, cancelled: 0 };
    for (const it of items) c[it.status]++;
    return c;
  }, [items]);

  return (
    <div>
      <PageHeader
        title="คำขอโพสหางานใหม่"
        subtitle="ใบขอที่หาคนของเราไม่ได้ — ทีมคอนเทนต์/สรรหารับ ID ไปโพสหาคนต่อ"
        backPath="/matching"
      />
      <div className="px-4 md:px-6 space-y-4 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            คำขอทั้งหมด {filterStatus === 'all' ? `(${items.length})` : ''}
          </h2>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | JobPostingStatus)}
            className="jarvis-soft-field min-h-[40px] text-xs w-auto"
          >
            <option value="all">ทุกสถานะ</option>
            {(['pending', 'in_progress', 'posted', 'completed', 'filled', 'cancelled'] as JobPostingStatus[]).map((s) => (
              <option key={s} value={s}>
                {jobPostingStatusLabel(s)} {filterStatus === 'all' ? `(${counts[s]})` : ''}
              </option>
            ))}
          </select>
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-white/80 bg-white/30 px-4 py-8 text-center">
            ยังไม่มีคำขอโพสหางาน — สร้างได้จากหน้า Matching เมื่อใบขอไม่มีคนของเรา
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((it) => (
              <li key={it.id} className="glass-card rounded-2xl border border-white/70 p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', STATUS_CLASS[it.status])}>
                    {jobPostingStatusLabel(it.status)}
                  </span>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-medium',
                    it.request_type === 'scraping' ? 'bg-emerald-500/15 text-emerald-700' : 'bg-orange-500/15 text-orange-700',
                  )}>
                    {it.request_type === 'scraping' ? 'Scraping' : 'Content'}
                  </span>
                  <CopyIdButton id={it.id} />
                  <span className="text-[11px] text-muted-foreground ml-auto">{formatWhen(it.created_at)}</span>
                </div>
                <h3 className="text-sm font-semibold text-foreground">
                  {it.job_snapshot?.position || 'ตำแหน่งไม่ระบุ'}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  เลขที่ใบขอ: <span className="font-mono">{it.request_no || it.job_id}</span>
                </p>
                <SnapshotDetails snap={it.job_snapshot} />
                {it.reason ? (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{it.reason}</p>
                ) : null}
                <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                  {it.requested_by_name ? <span>ขอโดย {it.requested_by_name}</span> : null}
                  <a
                    href={`/matching/match?jobId=${encodeURIComponent(it.job_id)}`}
                    className="inline-flex items-center gap-0.5 text-blue-700 hover:underline"
                  >
                    เปิดใบขอ <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
                {nextStatuses(it) ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {nextStatuses(it)!.map((n) => (
                      <button
                        key={n.status}
                        type="button"
                        onClick={() => void patchStatus(it.id, n.status)}
                        className={cn(
                          'rounded-full border px-3 py-1 text-[11px] font-medium',
                          n.status === 'cancelled'
                            ? 'border-red-200 bg-white text-red-600 hover:bg-red-50'
                            : 'border-blue-300 bg-blue-600 text-white hover:bg-blue-700',
                        )}
                      >
                        {n.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default JobPostingsPage;
