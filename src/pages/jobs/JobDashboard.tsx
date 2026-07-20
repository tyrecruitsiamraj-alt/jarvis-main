import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { formatYmdDmyBe } from '@/lib/dateTh';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import DetailListDialog from '@/components/shared/DetailListDialog';
import JobUrgencyBadge from '@/components/jobs/JobUrgencyBadge';
import UnitRequestFilterFields from '@/components/jobs/UnitRequestFilterFields';
import { JOB_TYPE_LABELS, type JobRequest } from '@/types';
import { Briefcase, AlertTriangle, CheckCircle, ListTodo, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';
import { useSiamrajUnitRequestFilters } from '@/hooks/useSiamrajUnitRequestFilters';
import { navigateToUnitRequest } from '@/lib/jobNavigation';
import { cn } from '@/lib/utils';
import { loadJobDashboardFilters, saveJobDashboardFilters } from '@/lib/jobDashboardPageState';
import { jobListReturnTo } from '@/lib/jobListPageState';
import { loadJobListLastUrl, saveUnitLastPath } from '@/lib/jobUnitSessionState';
import { JOB_STAFF_ROSTER_CHANGED_EVENT } from '@/lib/jobStaffRemote';
import { jobPositionUnits, sumJobPositionUnits } from '@/lib/jobPositionUnits';

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
    subtitle: `${roleLabel}${actionLabel} • ต้องการ ${formatYmdDmyBe(j.required_date)} • ${jobPositionUnits(j)} ตำแหน่ง`,
    badge,
    badgeVariant,
    onClick: () => onNavigate(j),
  };
}

const JobDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = jobListReturnTo(location.pathname, location.search);
  const { jobs, loading, refreshing, siamrajPrimary, dbSource, loadError, refetch } = useUnitRequestsFeed();
  const [filters, setFilters] = useState(() => loadJobDashboardFilters());
  const [staffRosterRev, setStaffRosterRev] = useState(0);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [jobDialogTitle, setJobDialogTitle] = useState('');
  const [jobDialogItems, setJobDialogItems] = useState<JobDialogItem[]>([]);

  const patchFilters = useCallback((patch: Partial<typeof filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    saveJobDashboardFilters(filters);
  }, [filters]);

  useEffect(() => {
    saveUnitLastPath('/jobs/overview');
  }, []);

  useEffect(() => {
    const fn = () => setStaffRosterRev((x) => x + 1);
    window.addEventListener(JOB_STAFF_ROSTER_CHANGED_EVENT, fn);
    return () => window.removeEventListener(JOB_STAFF_ROSTER_CHANGED_EVENT, fn);
  }, []);

  const filterApi = useSiamrajUnitRequestFilters(jobs, siamrajPrimary, filters, staffRosterRev);
  const { filteredJobs: scopedJobs } = filterApi;

  useEffect(() => {
    if (filters.jobSubtypeFilter === 'all') return;
    const stillValid = filterApi.jobSubtypeOptions.some((o) => o.value === filters.jobSubtypeFilter);
    if (!stillValid) patchFilters({ jobSubtypeFilter: 'all' });
  }, [filters.departmentFilter, filters.jobSubtypeFilter, filterApi.jobSubtypeOptions, patchFilters]);

  const closedJobs = useMemo(() => scopedJobs.filter((j) => j.status === 'closed'), [scopedJobs]);
  const activeJobs = useMemo(() => scopedJobs.filter((j) => j.status !== 'closed'), [scopedJobs]);

  const closedCount = closedJobs.length;
  const activeCount = activeJobs.length;
  const totalUnits = sumJobPositionUnits(scopedJobs);
  const activeUnits = sumJobPositionUnits(activeJobs);
  const closedUnits = sumJobPositionUnits(closedJobs);

  const goToJob = (job: JobRequest) => navigateToUnitRequest(job, navigate, { returnTo });

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

  const filterSummary =
    filters.departmentFilter !== 'all'
      ? filterApi.departmentOptions.find((o) => o.value === filters.departmentFilter)?.label.replace(/\s*\(\d+\)$/, '')
      : null;

  return (
    <div>
      <PageHeader
        title="หน่วยงาน"
        subtitle={
          filterSummary
            ? `${totalUnits} ตำแหน่ง · ${scopedJobs.length} ใบขอ · ${filterSummary}`
            : siamrajPrimary
              ? `${totalUnits} ตำแหน่ง · ${scopedJobs.length} ใบขอ · ${
                  dbSource === 'sqlserver'
                    ? 'อ่านใบขอจาก Siamraj SQL Server — อัปเดตเมื่อมีการคีย์'
                    : 'อ่านใบขอจาก Siamraj (so-operation) — อัปเดตอัตโนมัติเมื่อมีการคีย์'
                }`
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

        {!loading && jobs.length > 0 ? (
          <div className="rounded-2xl border border-black/[0.06] bg-white/35 backdrop-blur-sm p-3 md:p-4">
            <UnitRequestFilterFields
              idPrefix="job-dashboard"
              siamrajPrimary={siamrajPrimary}
              filters={filters}
              onChange={patchFilters}
              showStatusTabs
              showUnitFilter={false}
              options={{
                departmentOptions: filterApi.departmentOptions,
                jobSubtypeOptions: filterApi.jobSubtypeOptions,
                unitOptions: filterApi.unitOptions,
                recruiters: filterApi.recruiters,
                screeners: filterApi.screeners,
                opls: filterApi.opls,
                unassignedRecruiterCount: filterApi.unassignedRecruiterCount,
                unassignedScreenerCount: filterApi.unassignedScreenerCount,
                unassignedOplCount: filterApi.unassignedOplCount,
              }}
            />
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            title="งานทั้งหมด"
            value={totalUnits}
            icon={Briefcase}
            variant="primary"
            subtitle={`${scopedJobs.length} ใบขอ`}
            onClick={() => openJobList('งานทั้งหมด', scopedJobs)}
          />
          <StatCard
            title="ดำเนินการ"
            value={activeUnits}
            icon={ListTodo}
            variant="warning"
            subtitle={`${activeCount} ใบขอ · ยังไม่ปิด`}
            onClick={() => openJobList('ดำเนินการ', activeJobs)}
          />
          <StatCard
            title="ปิดแล้ว"
            value={closedUnits}
            icon={CheckCircle}
            variant="success"
            subtitle={`${closedCount} ใบขอ`}
            onClick={() => openJobList('ปิดแล้ว', closedJobs)}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => navigate(loadJobListLastUrl() || '/jobs/list')}
            className="flex-1 glass-card rounded-[1.5rem] p-4 border border-white/70 hover:border-blue-300/50 text-center"
          >
            <Briefcase className="w-6 h-6 text-blue-600 mx-auto mb-1" />
            <div className="text-sm font-semibold text-foreground">รายการงานทั้งหมด</div>
          </button>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">
            งานล่าสุด
            {filterSummary ? ` · ${filterSummary}` : ''}
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
                    {` • ต้องการ ${formatYmdDmyBe(j.required_date)} · ${jobPositionUnits(j)} ตำแหน่ง`}
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
