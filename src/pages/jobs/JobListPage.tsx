import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
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
import { UnitRequestNotePreview } from '@/components/jobs/UnitRequestNoteField';
import { formatYmdDmyBe } from '@/lib/dateTh';
import {
  compareJobsByAssigneeThenAgeDaysDesc,
  getJobRequestAgeDays,
  getJobRequestSubmittedDate,
  matchesNoteFilter,
  matchesUrgencyFilter,
  URGENCY_FILTER_OPTIONS,
} from '@/lib/jobUrgency';
import { JOB_STAFF_ROSTER_CHANGED_EVENT } from '@/lib/jobStaffRemote';
import { buildRecruiterNameOptions, buildScreenerNameOptions, countUnassignedRecruiters, countUnassignedScreeners, matchesRecruiterFilter, matchesScreenerFilter, STAFF_ASSIGNEE_UNASSIGNED, STAFF_ASSIGNEE_UNASSIGNED_LABEL } from '@/lib/jobStaffNames';
import {
  departmentFilterOptions,
  filterUnitRequestsByDepartment,
  extractJobSubtypeLabel,
  filterUnitRequestsByJobSubtype,
  jobSubtypeFilterOptions,
} from '@/lib/siamrajUnitFilters';
import ListPaginationBar from '@/components/shared/ListPaginationBar';
import { getTotalPages } from '@/lib/pagination';
import {
  buildJobListSearchParams,
  jobListReturnTo,
  mergeJobListState,
  parseJobListSearchParams,
} from '@/lib/jobListPageState';

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
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();

  const listState = useMemo(() => parseJobListSearchParams(searchParams), [searchParams]);
  const {
    filter,
    search,
    unitFilter,
    departmentFilter,
    jobSubtypeFilter,
    recruiterFilter,
    screenerFilter,
    urgencyFilter,
    noteFilter,
    page,
    pageSize,
  } = listState;

  const returnTo = jobListReturnTo(location.pathname, location.search);

  const updateListState = useCallback(
    (patch: Partial<typeof listState>) => {
      const next = mergeJobListState(listState, patch);
      setSearchParams(buildJobListSearchParams(next), { replace: true });
    },
    [listState, setSearchParams],
  );

  const [staffRosterRev, setStaffRosterRev] = useState(0);

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

  const departmentScopedJobs = useMemo(
    () => (siamrajPrimary ? filterUnitRequestsByDepartment(jobs, departmentFilter) : jobs),
    [jobs, siamrajPrimary, departmentFilter],
  );

  const jobSubtypeOptions = useMemo(
    () => (siamrajPrimary ? jobSubtypeFilterOptions(departmentScopedJobs) : []),
    [departmentScopedJobs, siamrajPrimary],
  );

  const subtypeScopedJobs = useMemo(
    () => (siamrajPrimary ? filterUnitRequestsByJobSubtype(departmentScopedJobs, jobSubtypeFilter) : departmentScopedJobs),
    [departmentScopedJobs, siamrajPrimary, jobSubtypeFilter],
  );

  const unitOptions = useMemo(() => {
    const set = new Set(subtypeScopedJobs.map((j) => j.unit_name).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, 'th'));
  }, [subtypeScopedJobs]);

  const recruiterFilterScope = useMemo(() => {
    return subtypeScopedJobs.filter((j) => {
      if (unitFilter !== 'all' && j.unit_name !== unitFilter) return false;
      if (!matchesScreenerFilter(j, screenerFilter)) return false;
      return true;
    });
  }, [subtypeScopedJobs, unitFilter, screenerFilter]);

  const screenerFilterScope = useMemo(() => {
    return subtypeScopedJobs.filter((j) => {
      if (unitFilter !== 'all' && j.unit_name !== unitFilter) return false;
      if (!matchesRecruiterFilter(j, recruiterFilter)) return false;
      return true;
    });
  }, [subtypeScopedJobs, unitFilter, recruiterFilter]);

  const unassignedRecruiterCount = useMemo(
    () => countUnassignedRecruiters(recruiterFilterScope),
    [recruiterFilterScope],
  );

  const unassignedScreenerCount = useMemo(
    () => countUnassignedScreeners(screenerFilterScope),
    [screenerFilterScope],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();

    return subtypeScopedJobs
      .filter((j) => {
        if (unitFilter !== 'all' && j.unit_name !== unitFilter) return false;
        if (!matchesRecruiterFilter(j, recruiterFilter)) return false;
        if (!matchesScreenerFilter(j, screenerFilter)) return false;
        if (!matchesUrgencyFilter(j, urgencyFilter)) return false;
        if (!matchesNoteFilter(j, noteFilter)) return false;
        if (filter === 'all') return true;
        if (filter === 'closed') return j.status === 'closed';
        return j.status !== 'closed';
      })
      .filter(
        (j) =>
          `${j.unit_name} ${j.request_no || ''} ${j.department_code || ''} ${j.department_name || ''} ${j.location_address} ${j.request_action_name || ''} ${j.job_description_code_1 || ''} ${j.job_description_code_2 || ''} ${j.list_note || ''} ${JOB_TYPE_LABELS[j.job_type]} ${JOB_CATEGORY_LABELS[j.job_category]} ${j.resigned_employee_name || ''} ${j.submittedByName || ''} ${j.recruiter_name || ''} ${j.screener_name || ''}`
            .toLowerCase()
            .includes(q),
      )
      .sort(compareJobsByAssigneeThenAgeDaysDesc);
  }, [subtypeScopedJobs, filter, search, unitFilter, recruiterFilter, screenerFilter, urgencyFilter, noteFilter]);

  const totalPages = getTotalPages(filtered.length, pageSize);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    if (jobSubtypeFilter === 'all') return;
    const stillValid = jobSubtypeOptions.some((o) => o.value === jobSubtypeFilter);
    if (!stillValid) updateListState({ jobSubtypeFilter: 'all' });
  }, [departmentFilter, jobSubtypeOptions, jobSubtypeFilter, updateListState]);

  useEffect(() => {
    if (unitFilter === 'all') return;
    if (!unitOptions.includes(unitFilter)) updateListState({ unitFilter: 'all' });
  }, [departmentFilter, jobSubtypeFilter, unitOptions, unitFilter, updateListState]);

  useEffect(() => {
    if (page > totalPages) updateListState({ page: totalPages });
  }, [page, totalPages, updateListState]);

  const pageFrom = filtered.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageTo = Math.min(page * pageSize, filtered.length);

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

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <SearchField
            wrapperClassName="flex-1 min-w-0"
            type="text"
            placeholder="ค้นหางาน..."
            value={search}
            onChange={(e) => updateListState({ search: e.target.value })}
          />

          <div className="flex items-center gap-2 w-full sm:w-[280px] shrink-0">
            <label htmlFor="job-list-unit" className="text-xs text-muted-foreground whitespace-nowrap shrink-0 w-14">
              หน่วยงาน
            </label>
            <select
              id="job-list-unit"
              value={unitFilter}
              onChange={(e) => updateListState({ unitFilter: e.target.value })}
              className="jarvis-soft-field flex-1 min-w-0"
            >
              <option value="all">ทั้งหมด</option>
              {unitOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          className={cn(
            'grid gap-3 items-center',
            siamrajPrimary ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2',
          )}
        >
          {siamrajPrimary ? (
            <div className="flex items-center gap-2 min-w-0">
              <label htmlFor="job-list-department" className="text-xs text-muted-foreground whitespace-nowrap shrink-0 w-14">
                แผนก
              </label>
              <select
                id="job-list-department"
                value={departmentFilter}
                onChange={(e) => updateListState({ departmentFilter: e.target.value })}
                className="jarvis-soft-field flex-1 min-w-0"
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
            <div className="flex items-center gap-2 min-w-0">
              <label htmlFor="job-list-subtype" className="text-xs text-muted-foreground whitespace-nowrap shrink-0 w-[5.5rem]">
                ลักษณะงานย่อย
              </label>
              <select
                id="job-list-subtype"
                value={jobSubtypeFilter}
                onChange={(e) => updateListState({ jobSubtypeFilter: e.target.value })}
                className="jarvis-soft-field flex-1 min-w-0"
              >
                {jobSubtypeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="flex items-center gap-2 min-w-0">
            <label htmlFor="job-list-recruiter" className="text-xs text-muted-foreground whitespace-nowrap shrink-0 w-[5.5rem]">
              เจ้าหน้าที่สรรหา
            </label>
            <select
              id="job-list-recruiter"
              value={recruiterFilter}
              onChange={(e) => updateListState({ recruiterFilter: e.target.value })}
              className="jarvis-soft-field flex-1 min-w-0"
            >
              <option value="all">ทั้งหมด</option>
              <option value={STAFF_ASSIGNEE_UNASSIGNED}>
                {STAFF_ASSIGNEE_UNASSIGNED_LABEL} ({unassignedRecruiterCount})
              </option>
              {recruiters.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <label htmlFor="job-list-screener" className="text-xs text-muted-foreground whitespace-nowrap shrink-0 w-[5.5rem]">
              เจ้าหน้าที่คัดสรร
            </label>
            <select
              id="job-list-screener"
              value={screenerFilter}
              onChange={(e) => updateListState({ screenerFilter: e.target.value })}
              className="jarvis-soft-field flex-1 min-w-0"
            >
              <option value="all">ทั้งหมด</option>
              <option value={STAFF_ASSIGNEE_UNASSIGNED}>
                {STAFF_ASSIGNEE_UNASSIGNED_LABEL} ({unassignedScreenerCount})
              </option>
              {screeners.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-2 min-w-0">
            <label htmlFor="job-list-urgency" className="text-xs text-muted-foreground whitespace-nowrap shrink-0 w-14">
              ความเร่งด่วน
            </label>
            <select
              id="job-list-urgency"
              value={urgencyFilter}
              onChange={(e) => updateListState({ urgencyFilter: e.target.value as typeof urgencyFilter })}
              className="jarvis-soft-field flex-1 min-w-0"
            >
              {URGENCY_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} title={o.hint}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <label htmlFor="job-list-note-filter" className="text-xs text-muted-foreground whitespace-nowrap shrink-0 w-14">
              หมายเหตุ
            </label>
            <select
              id="job-list-note-filter"
              value={noteFilter}
              onChange={(e) => updateListState({ noteFilter: e.target.value as typeof noteFilter })}
              className="jarvis-soft-field flex-1 min-w-0"
            >
              <option value="all">ทั้งหมด</option>
              <option value="has">มีหมายเหตุ</option>
              <option value="empty">ไม่มีหมายเหตุ</option>
            </select>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground -mt-1">
          <strong>งานด่วน</strong> = ใบขอล่วงหน้าที่เหลือเวลาถึงวันที่ต้องการน้อยกว่า 7 วัน (ยกระดับ) · แก้หมายเหตุได้ในหน้ารายละเอียดใบขอ
        </p>

        <div className="flex gap-1.5">
            {[
              { value: 'all' as const, label: 'ทั้งหมด' },
              { value: 'active' as const, label: 'ดำเนินการ' },
              { value: 'closed' as const, label: 'ปิดแล้ว' },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => updateListState({ filter: f.value })}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap',
                  filter === f.value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
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
                  onClick={() => navigateToUnitRequest(j, navigate, { returnTo })}
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

                {j.list_note?.trim() ? (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <p className="text-[10px] text-muted-foreground mb-1">หมายเหตุ</p>
                    <UnitRequestNotePreview note={j.list_note} />
                  </div>
                ) : null}
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
                    onClick={() => navigateToUnitRequest(j, navigate, { returnTo })}
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
                    <td className="px-3 py-2 max-w-[200px]">
                      <UnitRequestNotePreview note={j.list_note} />
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

        {filtered.length > 0 ? (
          <ListPaginationBar
            page={page}
            pageSize={pageSize}
            totalItems={filtered.length}
            totalPages={totalPages}
            pageFrom={pageFrom}
            pageTo={pageTo}
            onPageChange={(nextPage) => updateListState({ page: nextPage })}
            onPageSizeChange={(nextSize) => updateListState({ pageSize: nextSize })}
          />
        ) : null}
      </div>
    </div>
  );
};

export default JobListPage;
