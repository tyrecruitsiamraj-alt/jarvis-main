import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import {
  CANDIDATE_STATUS_LABELS,
  type Candidate,
  type CandidateStaffingTrack,
  type CandidateStatus,
} from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Search, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DEMO_CANDIDATES_CHANGED_EVENT,
  getCandidates,
  hydrateCandidateStaffing,
  setDemoCandidateStaffingTrack,
} from '@/lib/demoStorage';
import { mergeCandidateSources, getMergedCandidatesInitial } from '@/lib/mergeCandidates';
import { CANDIDATE_STAFFING_OPTIONS } from '@/lib/candidateStaffing';
import { formatCandidateDisplayName } from '@/lib/formatCandidateName';
import { isDemoMode } from '@/lib/demoMode';
import { apiFetch } from '@/lib/apiFetch';

const statusFilters: { value: CandidateStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'inprocess', label: 'In Process' },
  { value: 'waiting_interview', label: 'รอสัมภาษณ์' },
  { value: 'waiting_to_start', label: 'รอเริ่มงาน' },
  { value: 'done', label: 'Done' },
  { value: 'drop', label: 'Drop' },
  { value: 'no_job', label: 'ไม่มีงาน' },
];

/** ลำดับกล่องสรุปด้านบน (ให้ตรงลำดับที่ใช้กรองด้านล่าง) */
const STATUS_SUMMARY_ORDER: CandidateStatus[] = [
  'inprocess',
  'waiting_interview',
  'waiting_to_start',
  'done',
  'drop',
  'no_job',
];

const CandidatesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hasPermission } = useAuth();
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<CandidateStatus | 'all'>(() => {
    const s = searchParams.get('status');
    if (s === 'inprocess' || s === 'drop' || s === 'done' || s === 'waiting_interview' || s === 'waiting_to_start' || s === 'no_job') {
      return s;
    }
    return 'all';
  });
  const [search, setSearch] = useState('');

  const [candidates, setCandidates] = useState<Candidate[]>(getMergedCandidatesInitial());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiCandidatesRef = useRef<Candidate[]>([]);

  const applyStaffingTrack = async (c: Candidate, track: CandidateStaffingTrack) => {
    if (isDemoMode()) {
      setDemoCandidateStaffingTrack(c.id, track);
      setCandidates((prev) =>
        prev.map((x) => (x.id === c.id ? hydrateCandidateStaffing({ ...x, staffing_track: track }) : x)),
      );
      return;
    }
    try {
      const r = await apiFetch('/api/candidates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id, staffing_track: track }),
      });
      if (!r.ok) return;
      const updated = (await r.json()) as Candidate;
      setCandidates((prev) =>
        prev.map((x) => (x.id === c.id ? hydrateCandidateStaffing(updated) : x)),
      );
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (isDemoMode()) {
      apiCandidatesRef.current = [];
      setCandidates(mergeCandidateSources([], getCandidates()));
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetch('/api/candidates?limit=500')
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`API_${r.status}`);
        }
        return r.json() as Promise<Candidate[]>;
      })
      .then((data) => {
        if (cancelled) return;
        const arr = Array.isArray(data) ? data : [];
        apiCandidatesRef.current = arr;
        setCandidates(mergeCandidateSources(arr, getCandidates()));
      })
      .catch(() => {
        if (cancelled) return;
        apiCandidatesRef.current = [];
        setCandidates(mergeCandidateSources([], getCandidates()));
        setError(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isDemoMode()) return;
    const sync = () =>
      setCandidates(mergeCandidateSources(apiCandidatesRef.current, getCandidates()));
    window.addEventListener(DEMO_CANDIDATES_CHANGED_EVENT, sync);
    return () => window.removeEventListener(DEMO_CANDIDATES_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    const s = searchParams.get('status');
    if (
      s === 'inprocess' ||
      s === 'drop' ||
      s === 'done' ||
      s === 'waiting_interview' ||
      s === 'waiting_to_start' ||
      s === 'no_job'
    ) {
      setFilter(s);
    }
  }, [searchParams]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return candidates
      .filter((c) => filter === 'all' || c.status === filter)
      .filter((c) =>
        `${formatCandidateDisplayName(c)} ${c.phone} ${c.address}`.toLowerCase().includes(q),
      );
  }, [candidates, filter, search]);

  const statusCounts = useMemo(() => {
    const counts: Record<CandidateStatus, number> = {
      inprocess: 0,
      waiting_interview: 0,
      waiting_to_start: 0,
      done: 0,
      drop: 0,
      no_job: 0,
    };
    candidates.forEach((c) => {
      counts[c.status] += 1;
    });
    return counts;
  }, [candidates]);

  const selectStatusFromSummary = (st: CandidateStatus) => {
    setFilter(st);
    navigate(`/matching/candidates?status=${st}`, { replace: true });
  };

  return (
    <div>
      <PageHeader
        title="ผู้สมัครทั้งหมด"
        subtitle={`${filtered.length} คน${filter !== 'all' ? ` (กรอง: ${statusFilters.find((f) => f.value === filter)?.label})` : ''}`}
        backPath="/matching"
        actions={
          hasPermission('supervisor') ? (
            <button
              onClick={() => navigate('/matching/candidates/add')}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm"
            >
              <Plus className="w-4 h-4" /> เพิ่ม
            </button>
          ) : undefined
        }
      />

      <div className="px-4 md:px-6 space-y-4">
        {loading && <div className="text-sm text-muted-foreground">กำลังโหลดผู้สมัคร...</div>}
        {error && <div className="text-sm text-destructive">เกิดข้อผิดพลาด: {error}</div>}

        {/* สรุปจำนวนตามสถานะ — กดเพื่อกรองรายชื่อด้านล่าง */}
        <div className="rounded-xl border border-border/80 bg-card/40 p-3 md:p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">สรุปผู้สมัครตามสถานะ</h3>
            <span className="text-xs text-muted-foreground">รวม {candidates.length} คน</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {STATUS_SUMMARY_ORDER.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => selectStatusFromSummary(st)}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors',
                  filter === st
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : 'border-border bg-secondary/25 hover:border-primary/35 hover:bg-primary/5',
                )}
              >
                <div className="text-[11px] font-medium text-muted-foreground leading-snug">
                  {CANDIDATE_STATUS_LABELS[st]}
                </div>
                <div className="text-2xl font-bold text-foreground tabular-nums mt-0.5">{statusCounts[st]}</div>
                <div className="text-[10px] text-muted-foreground">คน</div>
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground font-medium">รายชื่อทั้งหมด</p>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="ค้นหาผู้สมัคร..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {statusFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                  filter === f.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {isMobile ? (
          <div className="space-y-2">
            {filtered.map((c) => (
              <div key={c.id} className="glass-card rounded-xl p-4 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => navigate(`/matching/candidates/${c.id}`)}
                    className="font-semibold text-foreground text-sm hover:text-primary"
                  >
                    {formatCandidateDisplayName(c)}
                  </button>
                  <StatusBadge status={c.status} type="candidate" />
                </div>

                <div className="text-xs text-muted-foreground mb-2">
                  {c.address} • อายุ {c.age} ปี
                </div>

                <div className="mb-2">
                  <label className="text-[10px] text-muted-foreground block mb-1">ประเภทบุคลากร</label>
                  <select
                    value={c.staffing_track ?? 'regular'}
                    onChange={(e) => void applyStaffingTrack(c, e.target.value as CandidateStaffingTrack)}
                    disabled={!hasPermission('supervisor')}
                    className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs text-foreground disabled:opacity-60"
                  >
                    {CANDIDATE_STAFFING_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-primary">Risk: {c.risk_percentage}%</span>

                  <div className="flex gap-2">
                    <a href={`tel:${c.phone}`} className="p-1.5 rounded-lg bg-success/10 text-success">
                      <Phone className="w-3.5 h-3.5" />
                    </a>

                    {hasPermission('supervisor') && (
                      <button
                        onClick={() => navigate(`/matching/candidates/${c.id}`)}
                        className="text-xs px-2 py-1 rounded bg-primary/10 text-primary"
                      >
                        มอบหมายงาน
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium">ชื่อ-สกุล</th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium">เบอร์โทร</th>
                  <th className="px-4 py-3 text-center text-muted-foreground font-medium">อายุ</th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium">ที่อยู่</th>
                  <th className="px-4 py-3 text-center text-muted-foreground font-medium">Risk</th>
                  <th className="px-4 py-3 text-center text-muted-foreground font-medium">สถานะ</th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium min-w-[150px]">
                    ประเภทบุคลากร
                  </th>
                  <th className="px-4 py-3 text-center text-muted-foreground font-medium">จัดการ</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/matching/candidates/${c.id}`)}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {formatCandidateDisplayName(c)}
                      </button>
                    </td>

                    <td className="px-4 py-3 text-muted-foreground">{c.phone}</td>
                    <td className="px-4 py-3 text-center text-foreground">{c.age}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{c.address}</td>

                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          'font-semibold',
                          c.risk_percentage <= 20
                            ? 'text-success'
                            : c.risk_percentage <= 50
                              ? 'text-warning'
                              : 'text-destructive',
                        )}
                      >
                        {c.risk_percentage}%
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={c.status} type="candidate" />
                    </td>

                    <td className="px-4 py-3">
                      <select
                        value={c.staffing_track ?? 'regular'}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => void applyStaffingTrack(c, e.target.value as CandidateStaffingTrack)}
                        disabled={!hasPermission('supervisor')}
                        className="w-full max-w-[180px] bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs text-foreground disabled:opacity-60"
                      >
                        {CANDIDATE_STAFFING_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-4 py-3 text-center">
                      {hasPermission('supervisor') && (
                        <button
                          onClick={() => navigate(`/matching/candidates/${c.id}`)}
                          className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20"
                        >
                          มอบหมายงาน
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CandidatesPage;