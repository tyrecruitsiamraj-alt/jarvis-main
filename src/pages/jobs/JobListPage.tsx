import React, { useEffect, useMemo, useState } from 'react';
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
import JobUrgencyBadge from '@/components/jobs/JobUrgencyBadge';
import { UnitRequestNoteCell } from '@/components/jobs/UnitRequestNoteField';
import { formatYmdDmyBe } from '@/lib/dateTh';
import {
  compareJobsByAssigneeThenAgeDaysDesc,
  getJobRequestAgeDays,
  getJobRequestSubmittedDate,
} from '@/lib/jobUrgency';
import { JOB_STAFF_ROSTER_CHANGED_EVENT } from '@/lib/jobStaffRemote';
import { buildRecruiterNameOptions, buildScreenerNameOptions } from '@/lib/jobStaffNames';
import {
  departmentFilterOptions,
  filterUnitRequestsByDepartment,
  extractJobSubtypeLabel,
  filterUnitRequestsByJobSubtype,
  jobSubtypeFilterOptions,
  type SiamrajDepartmentFilter,
  type SiamrajJobSubtypeFilter,
} from '@/lib/siamrajUnitFilters';

type JobListFilter = 'all' | 'active' | 'closed';

const PAGE_SIZE = 20;

function formatSubmittedDate(job: JobRequest): string {
  const d = getJobRequestSubmittedDate(job);
  if (!d) return '—';
  return formatYmdDmyBe(d.toISOString().slice(0, 10));
}

function ageDaysLabel(job: JobRequest): string {
  const days = getJobRequestAgeDays(job);
  if (days == null) return '—';
  if (days <= 0) return 'วันนี้';
  return `${days} วัน`;
}

const JobListPage: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<JobListFilter>('all');
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<SiamrajDepartmentFilter>('all');
  const [jobSubtypeFilter, setJobSubtypeFilter] = useState<SiamrajJobSubtypeFilter>('all');
  const [recruiterFilter, setRecruiterFilter] = useState<string>('all');
  const [screenerFilter, setScreenerFilter] = useState<string>('all');
  const [staffRosterRev, setStaffRosterRev] = useState(0);
  const [noteOverrides, setNoteOverrides] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);

  const { jobs, loading, refreshing, siamrajPrimary, loadError, refetch } = useUnitRequestsFeed();

  useEffect(() => {
    const fn = () => setStaffRosterRev((x) => x + 1);
    window.addEventListener(JOB_STAFF_ROSTER_CHANGED_EVENT, fn);
    return () => window.removeEventListener(JOB_STAFF_ROSTER_CHANGED_EVENT, fn);
  }, []);

  const recruiters = useMemo(() => {
    void staffRosterRev;
    return buildRecruiterNameOptions(jobs);
  }, [staffRosterRev, jobs]);

  const screeners = useMemo(() => {
    void staffRosterRev;
    return buildScreenerNameOptions(jobs);
  }, [staffRosterRev, jobs]);

  const departmentOptions = useMemo(
    () => (siamrajPrimary ? departmentFilterOptions(jobs) : []),
    [jobs, siamrajPrimary],
  );

  const jobSubtypeOptions = useMemo(
    () => (siamrajPrimary ? jobSubtypeFilterOptions(jobs) : []),
    [jobs, siamrajPrimary],
  );

  const departmentScopedJobs = useMemo(
    () => (siamrajPrimary ? filterUnitRequestsByDepartment(jobs, departmentFilter) : jobs),
    [jobs, siamrajPrimary, departmentFilter],
  );

  const subtypeScopedJobs = useMemo(
    () => (siamrajPrimary ? filterUnitRequestsByJobSubtype(departmentScopedJobs, jobSubtypeFilter) : departmentScopedJobs),
    [departmentScopedJobs, siamrajPrimary, jobSubtypeFilter],
  );

  const unitOptions = useMemo(() => {
    const set = new Set(subtypeScopedJobs.map((j) => j.unit_name).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, 'th'));
  }, [subtypeScopedJobs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();

    return subtypeScopedJobs
      .filter((j) => {
        if (unitFilter !== 'all' && j.unit_name !== unitFilter) return false;
        if (recruiterFilter !== 'all' && j.recruiter_name !== recruiterFilter) return false;
        if (screenerFilter !== 'all' && j.screener_name !== screenerFilter) return false;
        if (filter === 'all') return true;
        if (filter === 'closed') return j.status === 'closed';
        return j.status !== 'closed';
      })
      .filter(
        (j) =>
          `${j.unit_name} ${j.request_no || ''} ${j.department_code || ''} ${j.department_name || ''} ${j.location_address} ${j.request_action_name || ''} ${j.job_description_code_1 || ''} ${j.job_description_code_2 || ''} ${JOB_TYPE_LABELS[j.job_type]} ${JOB_CATEGORY_LABELS[j.job_category]} ${j.resigned_employee_name || ''} ${j.submittedByName || ''} ${j.recruiter_name || ''} ${j.screener_name || ''}`
            .toLowerCase()
            .includes(q),
      )
      .sort(compareJobsByAssigneeThenAgeDaysDesc);
  }, [subtypeScopedJobs, filter, search, unitFilter, recruiterFilter, screenerFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [filter, search, unitFilter, departmentFilter, jobSubtypeFilter, recruiterFilter, screenerFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageFrom = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageTo = Math.min(page * PAGE_SIZE, filtered.length);

  const noteForJob = (j: JobRequest) => {
    const key = j.request_no || j.externalId || j.id;
    return noteOverrides[key] ?? j.list_note ?? '';
  };

  return (
    <div>
      <PageHeader
        title="รายการงานทั้งหมด"
        subtitle={
          siamrajPrimary
            ? filtered.length > 0
              ? `${filtered.length} ใบขอจาก Siamraj · แสดง ${pageFrom}–${pageTo}`
              : '0 ใบขอจาก Siamraj'
            : filtered.length > 0
              ? `${filtered.length} งาน · แสดง ${pageFrom}–${pageTo}`
              : '0 งาน'
        }
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
        {loadError && (
          <div className="text-sm text-destructive rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2">
            {loadError}
          </div>
        )}

        <SearchField
          wrapperClassName="w-full"
          type="text"
          placeholder="ค้นหางาน..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="flex flex-col md:flex-row gap-3 md:items-center flex-wrap">
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

          {siamrajPrimary ? (
            <div className="flex items-center gap-2 min-w-[220px]">
              <label htmlFor="job-list-department" className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                แผนก
              </label>
              <select
                id="job-list-department"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="jarvis-soft-field flex-1"
              >
                {departmentOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {siamrajPrimary ? (
            <div className="flex items-center gap-2 min-w-[240px]">
              <label htmlFor="job-list-subtype" className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                ลักษณะงานย่อย
              </label>
              <select
                id="job-list-subtype"
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

          <div className="flex items-center gap-2 min-w-[200px]">
            <label htmlFor="job-list-recruiter" className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
              เจ้าหน้าที่สรรหา
            </label>
            <select
              id="job-list-recruiter"
              value={recruiterFilter}
              onChange={(e) => setRecruiterFilter(e.target.value)}
              className="jarvis-soft-field flex-1"
            >
              <option value="all">ทั้งหมด</option>
              {recruiters.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 min-w-[200px]">
            <label htmlFor="job-list-screener" className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
              เจ้าหน้าที่คัดสรร
            </label>
            <select
              id="job-list-screener"
              value={screenerFilter}
              onChange={(e) => setScreenerFilter(e.target.value)}
              className="jarvis-soft-field flex-1"
            >
              <option value="all">ทั้งหมด</option>
              {screeners.map((s) => (
                <option key={s} value={s}>
                  {s}
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

        {filtered.length === 0 && !loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">ไม่พบใบขอ</div>
        ) : isMobile ? (
          <div className="space-y-3">
            {paginated.map((j) => (
              <div
                key={j.id}
                className="glass-card rounded-[1.5rem] p-4 border border-white/70"
              >
                <button
                  type="button"
                  onClick={() => navigateToUnitRequest(j, navigate)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <span className="font-semibold text-foreground text-sm">
                      {j.request_no || j.unit_name}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground whitespace-nowrap">
                        ผ่านมา {ageDaysLabel(j)}
                      </span>
                      <StatusBadge status={j.status} type="job" />
                    </div>
                  </div>

                  <div className="text-xs font-medium text-foreground/90">{j.unit_name}</div>

                  <div className="text-xs text-muted-foreground mt-1">
                    {j.request_action_name || JOB_TYPE_LABELS[j.job_type]}
                    {j.job_description_code_1 ? ` • ${j.job_description_code_1}` : ''}
                    {j.job_description_code_2 ? ` • ${j.job_description_code_2}` : ''}
                    {j.resigned_employee_name ? ` • ${j.resigned_employee_name}` : ''}
                  </div>

                  <div className="text-xs text-muted-foreground mt-1 grid gap-0.5">
                    <span>กรอกโดย: {j.submittedByName || '—'}</span>
                    <span>วันที่กรอก: {formatSubmittedDate(j)}</span>
                    <span>วันที่ต้องการ: {formatYmdDmyBe(j.required_date)}</span>
                  </div>

                  <div className="text-xs text-muted-foreground mt-1">{j.location_address}</div>

                  {(j.recruiter_name || j.screener_name) && (
                    <div className="text-xs text-muted-foreground mt-1">
                      ผู้รับผิดชอบ:{' '}
                      {[
                        j.recruiter_name ? `สรรหา ${j.recruiter_name}` : null,
                        j.screener_name ? `คัดสรร ${j.screener_name}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2 text-xs">
                    <span className="text-primary">฿{j.total_income.toLocaleString()}</span>
                    <JobUrgencyBadge job={j} />
                  </div>
                </button>

                <div className="mt-3 pt-3 border-t border-border/50">
                  <p className="text-[10px] text-muted-foreground mb-1">หมายเหตุ</p>
                  <UnitRequestNoteCell
                    job={{ ...j, list_note: noteForJob(j) }}
                    onSaved={(note) => {
                      const key = j.request_no || j.externalId || j.id;
                      setNoteOverrides((prev) => ({ ...prev, [key]: note }));
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[1200px]">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">เลขที่ใบขอ</th>
                  <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">ผ่านมา</th>
                  <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">หน่วยงาน</th>
                  <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">ผู้กรอก</th>
                  <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">วันที่กรอก</th>
                  <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">วันที่ต้องการ</th>
                  <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">ประเภทใบขอ</th>
                  <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">ตำแหน่ง</th>
                  <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">ลักษณะงานย่อย</th>
                  <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">ผู้ลาออก</th>
                  <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">ผู้รับผิดชอบ</th>
                  <th className="px-3 py-3 text-left text-muted-foreground font-medium min-w-[180px]">หมายเหตุ</th>
                  <th className="px-3 py-3 text-center text-muted-foreground font-medium whitespace-nowrap">ด่วน</th>
                  <th className="px-3 py-3 text-right text-muted-foreground font-medium whitespace-nowrap">รายได้</th>
                  <th className="px-3 py-3 text-center text-muted-foreground font-medium whitespace-nowrap">สถานะ</th>
                </tr>
              </thead>

              <tbody>
                {paginated.map((j) => (
                  <tr
                    key={j.id}
                    onClick={() => navigateToUnitRequest(j, navigate)}
                    className="border-b border-border/50 hover:bg-secondary/20 cursor-pointer"
                  >
                    <td className="px-3 py-3 font-medium text-foreground whitespace-nowrap">{j.request_no || '—'}</td>
                    <td className="px-3 py-3 text-xs whitespace-nowrap">
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                        {ageDaysLabel(j)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-foreground text-xs">{j.unit_name || '—'}</td>
                    <td className="px-3 py-3 text-muted-foreground text-xs whitespace-nowrap">{j.submittedByName || '—'}</td>
                    <td className="px-3 py-3 text-muted-foreground text-xs whitespace-nowrap">{formatSubmittedDate(j)}</td>
                    <td className="px-3 py-3 text-muted-foreground text-xs whitespace-nowrap">{formatYmdDmyBe(j.required_date)}</td>
                    <td className="px-3 py-3 text-muted-foreground text-xs">{j.request_action_name || JOB_TYPE_LABELS[j.job_type]}</td>
                    <td className="px-3 py-3 text-muted-foreground text-xs">{j.job_description_code_1 || '—'}</td>
                    <td className="px-3 py-3 text-muted-foreground text-xs">{extractJobSubtypeLabel(j)}</td>
                    <td className="px-3 py-3 text-muted-foreground text-xs">{j.resigned_employee_name || '—'}</td>
                    <td className="px-3 py-3">
                      {j.recruiter_name || j.screener_name ? (
                        <div className="text-xs leading-tight whitespace-nowrap">
                          <div>
                            <span className="text-muted-foreground">สรรหา </span>
                            {j.recruiter_name || '—'}
                          </div>
                          <div>
                            <span className="text-muted-foreground">คัดสรร </span>
                            {j.screener_name || '—'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <UnitRequestNoteCell
                        job={{ ...j, list_note: noteForJob(j) }}
                        compact
                        onSaved={(note) => {
                          const key = j.request_no || j.externalId || j.id;
                          setNoteOverrides((prev) => ({ ...prev, [key]: note }));
                        }}
                      />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <JobUrgencyBadge job={j} compact />
                    </td>
                    <td className="px-3 py-3 text-right text-foreground whitespace-nowrap">฿{j.total_income.toLocaleString()}</td>
                    <td className="px-3 py-3 text-center">
                      <StatusBadge status={j.status} type="job" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > PAGE_SIZE ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <p className="text-xs text-muted-foreground">
              หน้า {page} / {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-4 py-2 rounded-full border border-border text-sm disabled:opacity-40"
              >
                ก่อนหน้า
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-4 py-2 rounded-full border border-border text-sm disabled:opacity-40"
              >
                ถัดไป
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default JobListPage;
