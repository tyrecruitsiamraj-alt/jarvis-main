import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { formatYmdDmyBe } from '@/lib/dateTh';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import DetailListDialog from '@/components/shared/DetailListDialog';
import JobUrgencyBadge from '@/components/jobs/JobUrgencyBadge';
import { JOB_TYPE_LABELS, type JobRequest } from '@/types';
import { Briefcase, AlertTriangle, CheckCircle, ListTodo, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';
import { navigateToUnitRequest } from '@/lib/jobNavigation';
import { cn } from '@/lib/utils';
import {
  filterUnitRequestsByJobSubtype,
  jobSubtypeFilterOptions,
  type SiamrajJobSubtypeFilter,
} from '@/lib/siamrajUnitFilters';

type JobDialogItem = {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'destructive' | 'info';
  onClick?: () => void;
};

function jobRequestToDialogItem(j: JobRequest, onNavigate: (job: JobRequest) => void): JobDialogItem {
  const badge = j.status === 'closed' ? 'ปิดแล้ว' : 'ดำเนินการ';
  const badgeVariant: JobDialogItem['badgeVariant'] =
    j.status === 'closed' ? 'success' : j.status === 'cancelled' ? 'destructive' : 'warning';
  const actionLabel = j.request_action_name ? ` • ${j.request_action_name}` : '';
  const positionParts = [j.job_description_code_1, j.job_description_code_2].filter(Boolean).join(' / ');
  const roleLabel = positionParts || JOB_TYPE_LABELS[j.job_type];
  return {
    id: j.id,
    title: j.request_no ? `${j.unit_name} (${j.request_no})` : j.unit_name,
    subtitle: `${roleLabel}${actionLabel} • ต้องการ ${formatYmdDmyBe(j.required_date)}`,
    badge,
    badgeVariant,
    onClick: () => onNavigate(j),
  };
}

const JobDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { jobs, loading, refreshing, siamrajPrimary, dbSource, loadError, refetch } = useUnitRequestsFeed();
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [jobSubtypeFilter, setJobSubtypeFilter] = useState<SiamrajJobSubtypeFilter>('all');
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [jobDialogTitle, setJobDialogTitle] = useState('');
  const [jobDialogItems, setJobDialogItems] = useState<JobDialogItem[]>([]);

  const unitOptions = useMemo(() => {
    const set = new Set(jobs.map((j) => j.unit_name).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, 'th'));
  }, [jobs]);

  const jobSubtypeOptions = useMemo(
    () => (siamrajPrimary ? jobSubtypeFilterOptions(jobs) : []),
    [jobs, siamrajPrimary],
  );

  const unitCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const j of jobs) {
      if (!j.unit_name) continue;
      m.set(j.unit_name, (m.get(j.unit_name) ?? 0) + 1);
    }
    return m;
  }, [jobs]);

  const scopedJobs = useMemo(() => {
    let list = jobs;
    if (unitFilter !== 'all') list = list.filter((j) => j.unit_name === unitFilter);
    if (siamrajPrimary) list = filterUnitRequestsByJobSubtype(list, jobSubtypeFilter);
    return list;
  }, [jobs, unitFilter, jobSubtypeFilter, siamrajPrimary]);

  const closedJobs = useMemo(() => scopedJobs.filter((j) => j.status === 'closed'), [scopedJobs]);
  const activeJobs = useMemo(() => scopedJobs.filter((j) => j.status !== 'closed'), [scopedJobs]);

  const closedCount = closedJobs.length;
  const activeCount = activeJobs.length;

  const goToJob = (job: JobRequest) => navigateToUnitRequest(job, navigate);

  const openJobList = (title: string, list: JobRequest[]) => {
    setJobDialogTitle(`${title} (${list.length})`);
    setJobDialogItems(
      list.map((j) =>
        jobRequestToDialogItem(j, (job) => {
          setJobDialogOpen(false);
          goToJob(job);
        }),
      ),
    );
    setJobDialogOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="หน่วยงาน"
        subtitle={
          unitFilter !== 'all'
            ? `${scopedJobs.length} ใบขอ · ${unitFilter}`
            : siamrajPrimary
              ? dbSource === 'sqlserver'
                ? 'อ่านใบขอจาก Siamraj SQL Server — อัปเดตเมื่อมีการคีย์'
                : 'อ่านใบขอจาก Siamraj (so-operation) — อัปเดตอัตโนมัติเมื่อมีการคีย์'
              : 'จัดการหน่วยงานและใบขอ'
        }
        actions={
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={refreshing}
            className="flex items-center gap-1 px-3 py-2 rounded-full border border-white/70 bg-white/50 text-sm disabled:opacity-50"
            title="โหลดข้อมูลใหม่"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            รีเฟรช
          </button>
        }
      />
      <div className="px-4 md:px-6 space-y-6">
        {loading && <div className="text-sm text-muted-foreground">กำลังโหลดงาน...</div>}
        {loadError && (
          <div className="text-sm text-destructive rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2">
            {loadError}
          </div>
        )}

        {!loading && (unitOptions.length > 0 || jobSubtypeOptions.length > 1) && (
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            {unitOptions.length > 0 ? (
              <div className="flex items-center gap-2 max-w-xl flex-1 min-w-[220px]">
                <label htmlFor="job-dashboard-unit" className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  หน่วยงาน
                </label>
                <select
                  id="job-dashboard-unit"
                  value={unitFilter}
                  onChange={(e) => setUnitFilter(e.target.value)}
                  className="jarvis-soft-field flex-1"
                >
                  <option value="all">ทั้งหมด ({jobs.length})</option>
                  {unitOptions.map((u) => (
                    <option key={u} value={u}>
                      {u} ({unitCounts.get(u) ?? 0})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {siamrajPrimary && jobSubtypeOptions.length > 1 ? (
              <div className="flex items-center gap-2 max-w-xl flex-1 min-w-[240px]">
                <label htmlFor="job-dashboard-subtype" className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  ลักษณะงานย่อย
                </label>
                <select
                  id="job-dashboard-subtype"
                  value={jobSubtypeFilter}
                  onChange={(e) => setJobSubtypeFilter(e.target.value)}
                  className="jarvis-soft-field flex-1"
                >
                  {jobSubtypeOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            title="งานทั้งหมด"
            value={scopedJobs.length}
            icon={Briefcase}
            variant="primary"
            onClick={() => openJobList('งานทั้งหมด', scopedJobs)}
          />
          <StatCard
            title="ดำเนินการ"
            value={activeCount}
            icon={ListTodo}
            variant="warning"
            subtitle="ยังไม่ปิด"
            onClick={() => openJobList('ดำเนินการ', activeJobs)}
          />
          <StatCard
            title="ปิดแล้ว"
            value={closedCount}
            icon={CheckCircle}
            variant="success"
            onClick={() => openJobList('ปิดแล้ว', closedJobs)}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => navigate('/jobs/list')}
            className="flex-1 glass-card rounded-[1.5rem] p-4 border border-white/70 hover:border-blue-300/50 text-center"
          >
            <Briefcase className="w-6 h-6 text-blue-600 mx-auto mb-1" />
            <div className="text-sm font-semibold text-foreground">รายการงานทั้งหมด</div>
          </button>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">
            งานล่าสุด
            {unitFilter !== 'all' ? ` · ${unitFilter}` : ''}
          </h3>
          <div className="space-y-2">
            {scopedJobs.length === 0 && !loading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">ไม่มีใบขอในหน่วยงานนี้</p>
            ) : (
              scopedJobs.slice(0, 4).map((j) => (
              <motion.button
                key={j.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => goToJob(j)}
                className="w-full glass-card rounded-[1.5rem] p-4 border border-white/70 text-left hover:border-blue-300/50 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-foreground text-sm">
                    {j.request_no ? `${j.unit_name} · ${j.request_no}` : j.unit_name}
                  </span>
                  <div className="flex items-center gap-2">
                    {j.request_action_name ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/12 text-blue-700">
                        {j.request_action_name}
                      </span>
                    ) : (
                      <JobUrgencyBadge job={j} className="px-2 py-0.5 rounded-full bg-secondary" compact />
                    )}
                    <StatusBadge status={j.status} type="job" />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {j.job_description_code_1 ? `${j.job_description_code_1}` : JOB_TYPE_LABELS[j.job_type]}
                  {j.job_description_code_2 ? ` / ${j.job_description_code_2}` : ''}
                  {j.gender_requirement ? ` • เพศ ${j.gender_requirement}` : ''}
                  {(j.age_range_min != null || j.age_range_max != null)
                    ? ` • อายุ ${j.age_range_min ?? '—'}–${j.age_range_max ?? '—'}`
                    : ''}
                  {j.resigned_employee_name ? ` • ลาออก: ${j.resigned_employee_name}` : ''}
                  {` • ต้องการ ${formatYmdDmyBe(j.required_date)}`}
                  {j.submittedByName ? ` • ส่งโดย ${j.submittedByName}` : ''}
                </div>
                {j.total_penalty > 0 && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-destructive">
                    <AlertTriangle className="w-3 h-3" /> ค่าปรับ: ฿{j.total_penalty.toLocaleString()}
                  </div>
                )}
              </motion.button>
              ))
            )}
          </div>
        </div>
      </div>

      <DetailListDialog
        open={jobDialogOpen}
        onOpenChange={setJobDialogOpen}
        title={jobDialogTitle}
        items={jobDialogItems}
        emptyMessage="ไม่มีงานในกลุ่มนี้"
      />
    </div>
  );
};

export default JobDashboard;
