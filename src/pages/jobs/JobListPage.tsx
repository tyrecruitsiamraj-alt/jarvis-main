import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import type { JobRequest } from '@/types';
import { JOB_TYPE_LABELS, JOB_CATEGORY_LABELS } from '@/types';
import SearchField from '@/components/shared/SearchField';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';
import { navigateToUnitRequest } from '@/lib/jobNavigation';
import { RefreshCw } from 'lucide-react';

type JobListFilter = 'all' | 'active' | 'closed';

const JobListPage: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<JobListFilter>('all');
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState<string>('all');

  const { jobs, loading, refreshing, siamrajPrimary, refetch } = useUnitRequestsFeed();

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
          `${j.unit_name} ${j.request_no || ''} ${j.location_address} ${j.request_action_name || ''} ${JOB_TYPE_LABELS[j.job_type]} ${JOB_CATEGORY_LABELS[j.job_category]} ${j.resigned_employee_name || ''}`
            .toLowerCase()
            .includes(q),
      );
  }, [jobs, filter, search, unitFilter]);

  return (
    <div>
      <PageHeader
        title="รายการงานทั้งหมด"
        subtitle={siamrajPrimary ? `${filtered.length} ใบขอจาก Siamraj` : `${filtered.length} งาน`}
        backPath="/jobs"
        actions={
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={refreshing}
            className="flex items-center gap-1 px-3 py-2 rounded-full border border-white/70 bg-white/50 text-sm disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            รีเฟรช
          </button>
        }
      />

      <div className="px-4 md:px-6 space-y-4">
        {loading && <div className="text-sm text-muted-foreground">กำลังโหลดงาน...</div>}

        <div className="flex flex-col md:flex-row gap-3 md:items-center flex-wrap">
          <SearchField
            wrapperClassName="flex-1 min-w-[200px]"
            type="text"
            placeholder="ค้นหางาน..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="flex items-center gap-2 min-w-[200px]">
            <label htmlFor="job-list-unit" className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
              หน่วยงาน
            </label>
            <select
              id="job-list-unit"
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="jarvis-soft-field flex-1"
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
                onClick={() => navigateToUnitRequest(j, navigate)}
                className="w-full glass-card rounded-[1.5rem] p-4 border border-white/70 text-left hover:border-orange-300/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-foreground text-sm">
                    {j.request_no ? `${j.unit_name} · ${j.request_no}` : j.unit_name}
                  </span>
                  <StatusBadge status={j.status} type="job" />
                </div>

                <div className="text-xs text-muted-foreground">
                  {j.request_action_name || JOB_TYPE_LABELS[j.job_type]}
                  {j.resigned_employee_name ? ` • ${j.resigned_employee_name}` : ''}
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
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium">ไซต์ / ใบขอ</th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium">ประเภทใบขอ</th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium">ผู้ลาออก</th>
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
                    onClick={() => navigateToUnitRequest(j, navigate)}
                    className="border-b border-border/50 hover:bg-secondary/20 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {j.request_no ? `${j.unit_name} (${j.request_no})` : j.unit_name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{j.request_action_name || JOB_TYPE_LABELS[j.job_type]}</td>
                    <td className="px-4 py-3 text-muted-foreground">{j.resigned_employee_name || '—'}</td>
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
