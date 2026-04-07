import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import type { JobRequest } from '@/types';
import { JOB_TYPE_LABELS, JOB_CATEGORY_LABELS } from '@/types';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { DEMO_JOBS_CHANGED_EVENT, getJobs } from '@/lib/demoStorage';
import { isDemoMode } from '@/lib/demoMode';
import { mergeJobSources, getMergedJobsInitial } from '@/lib/mergeJobs';
import { apiFetch } from '@/lib/apiFetch';

type JobListFilter = 'all' | 'active' | 'closed';

const JobListPage: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<JobListFilter>('all');
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState<string>('all');

  const [jobs, setJobs] = useState<JobRequest[]>(getMergedJobsInitial());
  const [loading, setLoading] = useState(false);
  const apiJobsRef = useRef<JobRequest[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    apiFetch('/api/jobs?limit=500')
      .then(async (r) => {
        if (!r.ok) throw new Error(`API_${r.status}`);
        return r.json() as Promise<JobRequest[]>;
      })
      .then((data) => {
        if (cancelled) return;
        const arr = Array.isArray(data) ? data : [];
        apiJobsRef.current = arr;
        setJobs(mergeJobSources(arr, getJobs()));
      })
      .catch(() => {
        if (cancelled) return;
        apiJobsRef.current = [];
        setJobs(mergeJobSources([], getJobs()));
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
    const sync = () => setJobs(mergeJobSources(apiJobsRef.current, getJobs()));
    window.addEventListener(DEMO_JOBS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(DEMO_JOBS_CHANGED_EVENT, sync);
  }, []);

  const unitOptions = useMemo(() => {
    const set = new Set(jobs.map((j) => j.unit_name).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, 'th'));
  }, [jobs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();

    return jobs
      .filter((j) => {
        if (unitFilter !== 'all' && j.unit_name !== unitFilter) return false;
        if (filter === 'all') return true;
        if (filter === 'closed') return j.status === 'closed';
        return j.status !== 'closed';
      })
      .filter(
        (j) =>
          `${j.unit_name} ${j.location_address} ${JOB_TYPE_LABELS[j.job_type]} ${JOB_CATEGORY_LABELS[j.job_category]}`
            .toLowerCase()
            .includes(q),
      );
  }, [jobs, filter, search, unitFilter]);

  return (
    <div>
      <PageHeader title="รายการงานทั้งหมด" subtitle={`${filtered.length} งาน`} backPath="/jobs" />

      <div className="px-4 md:px-6 space-y-4">
        {loading && <div className="text-sm text-muted-foreground">กำลังโหลดงาน...</div>}

        <div className="flex flex-col md:flex-row gap-3 md:items-center flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="ค้นหางาน..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex items-center gap-2 min-w-[200px]">
            <label htmlFor="job-list-unit" className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
              หน่วยงาน
            </label>
            <select
              id="job-list-unit"
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            >
              <option value="all">ทั้งหมด</option>
              {unitOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-1.5 overflow-x-auto">
            {[
              { value: 'all' as const, label: 'ทั้งหมด' },
              { value: 'active' as const, label: 'ดำเนินการ' },
              { value: 'closed' as const, label: 'ปิดแล้ว' },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap',
                  filter === f.value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {isMobile ? (
          <div className="space-y-2">
            {filtered.map((j) => (
              <button
                key={j.id}
                onClick={() => navigate(`/jobs/${j.id}`)}
                className="w-full glass-card rounded-xl p-4 border border-border text-left hover:border-primary/40"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-foreground text-sm">{j.unit_name}</span>
                  <StatusBadge status={j.status} type="job" />
                </div>

                <div className="text-xs text-muted-foreground">
                  {JOB_TYPE_LABELS[j.job_type]} • {JOB_CATEGORY_LABELS[j.job_category]}
                </div>

                <div className="text-xs text-muted-foreground mt-1">{j.location_address}</div>

                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className="text-primary">฿{j.total_income.toLocaleString()}</span>
                  <span className={j.urgency === 'urgent' ? 'text-destructive' : 'text-info'}>
                    {j.urgency === 'urgent' ? '🔴 ด่วน' : '🔵 ล่วงหน้า'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="glass-card rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium">หน่วยงาน</th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium">ลักษณะงาน</th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium">ประเภท</th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium">สถานที่</th>
                  <th className="px-4 py-3 text-center text-muted-foreground font-medium">ด่วน</th>
                  <th className="px-4 py-3 text-right text-muted-foreground font-medium">รายได้</th>
                  <th className="px-4 py-3 text-center text-muted-foreground font-medium">สถานะ</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((j) => (
                  <tr
                    key={j.id}
                    onClick={() => navigate(`/jobs/${j.id}`)}
                    className="border-b border-border/50 hover:bg-secondary/20 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{j.unit_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{JOB_TYPE_LABELS[j.job_type]}</td>
                    <td className="px-4 py-3 text-muted-foreground">{JOB_CATEGORY_LABELS[j.job_category]}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{j.location_address}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={j.urgency === 'urgent' ? 'text-destructive' : 'text-info'}>
                        {j.urgency === 'urgent' ? 'ด่วน' : 'ล่วงหน้า'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">฿{j.total_income.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={j.status} type="job" />
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

export default JobListPage;