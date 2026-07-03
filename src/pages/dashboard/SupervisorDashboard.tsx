import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import DetailListDialog from '@/components/shared/DetailListDialog';
import UnitRequestFilterFields from '@/components/jobs/UnitRequestFilterFields';
import { JobRequest, JOB_TYPE_LABELS, JOB_CATEGORY_LABELS } from '@/types';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';
import {
  filterUnitRequests,
  useSiamrajUnitRequestFilters,
} from '@/hooks/useSiamrajUnitRequestFilters';
import {
  loadSupervisorDashboardFilters,
  saveSupervisorDashboardFilters,
} from '@/lib/supervisorDashboardPageState';
import {
  Briefcase,
  Zap,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Timer,
  Filter,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  Wallet,
  Receipt,
  ListFilter,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { differenceInDays, parseISO, endOfMonth, startOfMonth } from 'date-fns';
import { JOB_STAFF_ROSTER_CHANGED_EVENT } from '@/lib/jobStaffRemote';
import { navigateToUnitRequest } from '@/lib/jobNavigation';
import DateRangeCalendarPicker, {
  type DateRangeYmd,
  isYmdInRange,
  jobRequestDateYmd,
} from '@/components/shared/DateRangeCalendarPicker';
import { computeJobUrgency, getJobRequestAgeLabel, requestStatusLabel } from '@/lib/jobUrgency';
import { toYmdLocal, formatYmdDmyBe } from '@/lib/dateTh';
import {
  extractDepartmentCode,
  extractDepartmentLabel,
  departmentCounts,
  departmentLabelForCode,
  formatJobSubtypeLabel,
} from '@/lib/siamrajUnitFilters';

type DetailDialogItem = {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'destructive' | 'info';
  onClick?: () => void;
  extra?: React.ReactNode;
};

function formatBaht(n: number) {
  return `฿${n.toLocaleString('th-TH')}`;
}

function defaultMonthRange(): DateRangeYmd {
  const now = new Date();
  return { from: toYmdLocal(startOfMonth(now)), to: toYmdLocal(endOfMonth(now)) };
}

const SupervisorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(() => loadSupervisorDashboardFilters());
  const [dateRange, setDateRange] = useState<DateRangeYmd | null>(() => defaultMonthRange());
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogItems, setDialogItems] = useState<DetailDialogItem[]>([]);
  const [staffRosterRev, setStaffRosterRev] = useState(0);

  const patchFilters = useCallback((patch: Partial<typeof filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const { jobs, loading: loadingJobs, refreshing, refetch, siamrajPrimary } = useUnitRequestsFeed();
  const today = new Date();

  useEffect(() => {
    saveSupervisorDashboardFilters(filters);
  }, [filters]);

  useEffect(() => {
    const fn = () => setStaffRosterRev((x) => x + 1);
    window.addEventListener(JOB_STAFF_ROSTER_CHANGED_EVENT, fn);
    return () => window.removeEventListener(JOB_STAFF_ROSTER_CHANGED_EVENT, fn);
  }, []);

  const filterApi = useSiamrajUnitRequestFilters(jobs, siamrajPrimary, filters, staffRosterRev);

  useEffect(() => {
    if (filters.jobSubtypeFilter === 'all') return;
    const stillValid = filterApi.jobSubtypeOptions.some((o) => o.value === filters.jobSubtypeFilter);
    if (!stillValid) patchFilters({ jobSubtypeFilter: 'all' });
  }, [filters.departmentFilter, filters.jobSubtypeFilter, filterApi.jobSubtypeOptions, patchFilters]);

  useEffect(() => {
    if (filters.unitFilter === 'all') return;
    if (!filterApi.unitOptions.includes(filters.unitFilter)) patchFilters({ unitFilter: 'all' });
  }, [filters.departmentFilter, filters.jobSubtypeFilter, filters.unitFilter, filterApi.unitOptions, patchFilters]);

  const filterByDate = useCallback(
    (source: JobRequest[]) => {
      if (!dateRange) return source;
      return source.filter((j) => isYmdInRange(jobRequestDateYmd(j), dateRange));
    },
    [dateRange],
  );

  const filteredJobs = useMemo(
    () => filterByDate(filterApi.filteredJobs),
    [filterApi.filteredJobs, filterByDate],
  );

  const jobsScopedForUnitBreakdown = useMemo(
    () => filterByDate(filterUnitRequests(jobs, siamrajPrimary, filters, { unitFilter: true })),
    [jobs, siamrajPrimary, filters, filterByDate],
  );

  const jobsScopedForDepartmentBreakdown = useMemo(
    () => filterByDate(filterUnitRequests(jobs, siamrajPrimary, filters, { departmentFilter: true })),
    [jobs, siamrajPrimary, filters, filterByDate],
  );

  const unitBreakdownOptions = useMemo(() => {
    const set = new Set(jobsScopedForUnitBreakdown.map((j) => j.unit_name).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, 'th'));
  }, [jobsScopedForUnitBreakdown]);

  const departmentBreakdown = useMemo(() => {
    const counts = departmentCounts(jobsScopedForDepartmentBreakdown);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'th'));
  }, [jobsScopedForDepartmentBreakdown]);

  const totalJobs = filteredJobs.length;
  const urgentJobs = filteredJobs.filter((j) => j.urgency === 'urgent');
  const advanceJobs = filteredJobs.filter((j) => j.urgency === 'advance');
  const closedJobs = filteredJobs.filter((j) => j.status === 'closed');
  const cancelledJobs = filteredJobs.filter((j) => j.status === 'cancelled');
  const openJobs = filteredJobs.filter((j) => j.status !== 'closed' && j.status !== 'cancelled');

  const openUrgent = useMemo(() => openJobs.filter((j) => j.urgency === 'urgent'), [openJobs]);
  const openAdvance = useMemo(() => openJobs.filter((j) => j.urgency === 'advance'), [openJobs]);

  const byDepartment = (code: string) => filteredJobs.filter((j) => extractDepartmentCode(j) === code);
  const byJobCategory = (cat: string) => filteredJobs.filter((j) => j.job_category === cat);

  const safeJobDate = (ymd?: string | null) => {
    if (!ymd || typeof ymd !== 'string') return null;
    const d = parseISO(ymd.slice(0, 10));
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const getAgeDays = (j: JobRequest) => {
    const d = safeJobDate(j.request_date);
    return d ? differenceInDays(today, d) : 0;
  };
  const over30 = openJobs.filter((j) => getAgeDays(j) > 30);
  const range15to30 = openJobs.filter((j) => {
    const d = getAgeDays(j);
    return d >= 15 && d <= 30;
  });
  const range7to14 = openJobs.filter((j) => {
    const d = getAgeDays(j);
    return d >= 7 && d < 15;
  });
  const over14 = openJobs.filter((j) => getAgeDays(j) > 14);

  const closedOnTime = closedJobs.filter((j) => {
    const closed = safeJobDate(j.closed_date);
    const required = safeJobDate(j.required_date);
    return closed && required && differenceInDays(closed, required) <= 0;
  });
  const closedLate = closedJobs.filter((j) => {
    const closed = safeJobDate(j.closed_date);
    const required = safeJobDate(j.required_date);
    return closed && required && differenceInDays(closed, required) > 0;
  });
  const closedUrgent = closedJobs.filter((j) => j.urgency === 'urgent');
  const closedAdvance = closedJobs.filter((j) => j.urgency === 'advance');

  const currentMonth = today.getMonth();
  const remainingThisMonth = openJobs.filter((j) => {
    const d = safeJobDate(j.required_date);
    return d ? d.getMonth() === currentMonth : false;
  });

  const totalIncome = useMemo(
    () => filteredJobs.reduce((s, j) => s + (j.total_income ?? 0), 0),
    [filteredJobs],
  );
  const totalPenalty = useMemo(
    () => filteredJobs.reduce((s, j) => s + (j.total_penalty ?? 0), 0),
    [filteredJobs],
  );
  const jobsWithPenalty = useMemo(
    () => filteredJobs.filter((j) => (j.total_penalty ?? 0) > 0),
    [filteredJobs],
  );
  const penaltyOnOpen = useMemo(
    () => openJobs.reduce((s, j) => s + (j.total_penalty ?? 0), 0),
    [openJobs],
  );
  const avgPenaltyWhenAny = useMemo(() => {
    if (jobsWithPenalty.length === 0) return 0;
    return Math.round(
      jobsWithPenalty.reduce((s, j) => s + (j.total_penalty ?? 0), 0) / jobsWithPenalty.length,
    );
  }, [jobsWithPenalty]);

  const toggleSection = (s: string) => setExpandedSection((prev) => (prev === s ? null : s));

  const jobToItem = (j: JobRequest): DetailDialogItem => {
    const pen = j.total_penalty ?? 0;
    const sub = [
      `${extractDepartmentLabel(j)} • ${JOB_CATEGORY_LABELS[j.job_category]}`,
      `${requestStatusLabel(computeJobUrgency(j).kind)} • ผ่านมา ${getJobRequestAgeLabel(j)}`,
      `รายได้ ${formatBaht(j.total_income ?? 0)}`,
      pen > 0 ? `ค่าปรับสะสม ${formatBaht(pen)}${j.days_without_worker ? ` • ขาดคน ${j.days_without_worker} วัน` : ''}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    return {
      id: j.id,
      title: j.unit_name,
      subtitle: sub,
      badge: j.status === 'closed' ? 'ปิดแล้ว' : 'ดำเนินการ',
      badgeVariant:
        j.status === 'closed' ? 'success' : j.status === 'cancelled' ? 'destructive' : 'warning',
      onClick: () => {
        setDialogOpen(false);
        navigateToUnitRequest(j, navigate);
      },
    };
  };

  const showJobList = (title: string, jobList: JobRequest[]) => {
    setDialogTitle(`${title} (${jobList.length})`);
    setDialogItems(jobList.map(jobToItem));
    setDialogOpen(true);
  };

  const SectionHeader = ({ id, title, icon: Icon }: { id: string; title: string; icon: React.ElementType }) => (
    <button type="button" onClick={() => toggleSection(id)} className="w-full flex items-center justify-between py-2 text-left">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Icon className="w-4 h-4 text-blue-600" /> {title}
      </h3>
      {expandedSection === id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
    </button>
  );

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={
          [
            dateRange ? `วันที่กรอก: ${formatYmdDmyBe(dateRange.from)} – ${formatYmdDmyBe(dateRange.to)}` : null,
            filters.unitFilter !== 'all' ? `หน่วยงาน: ${filters.unitFilter}` : null,
            filters.departmentFilter !== 'all'
              ? `แผนก: ${filterApi.departmentOptions.find((o) => o.value === filters.departmentFilter)?.label.replace(/\s*\(\d+\)$/, '') ?? filters.departmentFilter}`
              : null,
            filters.jobSubtypeFilter !== 'all' ? `ลักษณะงานย่อย: ${formatJobSubtypeLabel(filters.jobSubtypeFilter)}` : null,
          ]
            .filter(Boolean)
            .join(' · ') || 'ภาพรวมสำหรับผู้บริหาร — งาน รายได้ และค่าปรับ (ตามฟิลเตอร์ด้านล่าง)'
        }
        actions={
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={refreshing}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-full border border-white/70 bg-white/50 text-sm disabled:opacity-50',
            )}
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            รีเฟรช
          </button>
        }
      />
      <div className="px-4 md:px-6 space-y-6 pb-24 max-w-6xl mx-auto">
        {loadingJobs && <div className="text-sm text-muted-foreground">กำลังโหลดข้อมูล…</div>}

        {/* ฟิลเตอร์ — responsive ทุก device */}
        <div className="rounded-2xl border border-black/[0.06] bg-white/35 backdrop-blur-sm p-3 md:p-4 space-y-4">
          <div className="flex flex-col gap-1 min-w-0 max-w-md">
            <label htmlFor="dashboard-date" className="text-xs text-muted-foreground leading-snug">
              วันที่กรอก
            </label>
            <DateRangeCalendarPicker
              triggerId="dashboard-date"
              className="w-full min-w-0"
              value={dateRange}
              onChange={setDateRange}
            />
          </div>

          <UnitRequestFilterFields
            idPrefix="supervisor-dashboard"
            siamrajPrimary={siamrajPrimary}
            filters={filters}
            onChange={patchFilters}
            showStatusTabs
            showNoteFilter={false}
            options={{
              departmentOptions: filterApi.departmentOptions,
              jobSubtypeOptions: filterApi.jobSubtypeOptions,
              unitOptions: filterApi.unitOptions,
              recruiters: filterApi.recruiters,
              screeners: filterApi.screeners,
              unassignedRecruiterCount: filterApi.unassignedRecruiterCount,
              unassignedScreenerCount: filterApi.unassignedScreenerCount,
            }}
          />
        </div>

        {/* สรุป 3 บรรทัด — ผู้บริหารอ่านก่อน */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 md:p-5 space-y-2">
          <p className="text-sm font-semibold text-foreground">สรุปภาพรวม</p>
          <ul className="text-sm text-foreground/90 space-y-1.5 list-disc list-inside marker:text-primary">
            <li>
              มีใบขอทั้งหมด <strong>{totalJobs}</strong> ใบ — ยังต้องจัดการอยู่ <strong>{openJobs.length}</strong> ใบ (ยังไม่ปิดและไม่ยกเลิก)
              {cancelledJobs.length > 0 ? (
                <>
                  {' '}
                  · ยกเลิก <strong>{cancelledJobs.length}</strong> ใบ
                </>
              ) : null}
            </li>
            <li>
              งานด่วน <strong>{openUrgent.length}</strong> ใบ · งานล่วงหน้า <strong>{openAdvance.length}</strong> ใบ · ปิดแล้ว{' '}
              <strong>{closedJobs.length}</strong> ใบ · งานที่ค้างเกิน 14 วัน{' '}
              <strong className={over14.length > 0 ? 'text-destructive' : ''}>{over14.length}</strong> ใบ
              <span className="text-muted-foreground"> (ด่วน + ล่วงหน้า = จำนวนยังต้องจัดการ)</span>
            </li>
            <li>
              รายได้รวมจากชุดนี้ <strong>{formatBaht(totalIncome)}</strong> · ค่าปรับสะสมรวม <strong className={totalPenalty > 0 ? 'text-destructive' : ''}>{formatBaht(totalPenalty)}</strong>
              {jobsWithPenalty.length > 0 ? (
                <>
                  {' '}
                  (<strong>{jobsWithPenalty.length}</strong> ใบมีค่าปรับ)
                </>
              ) : null}
            </li>
          </ul>
        </div>

        {/* แถว KPI หลัก */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">ภาพรวมงาน</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title="ใบขอทั้งหมด"
              value={totalJobs}
              icon={Briefcase}
              variant="primary"
              subtitle="ในกรอบฟิลเตอร์"
              onClick={() => showJobList('งานทั้งหมด', filteredJobs)}
            />
            <StatCard
              title="ยังต้องจัดการ"
              value={openJobs.length}
              icon={ListFilter}
              variant="warning"
              subtitle="ยังไม่ปิด / ไม่ยกเลิก"
              onClick={() => showJobList('งานที่ยังต้องจัดการ', openJobs)}
            />
            <StatCard
              title="งานด่วน"
              value={urgentJobs.length}
              icon={Zap}
              variant="destructive"
              onClick={() => showJobList('งานฉุกเฉิน', urgentJobs)}
            />
            <StatCard
              title="งานล่วงหน้า"
              value={advanceJobs.length}
              icon={Clock}
              variant="info"
              onClick={() => showJobList('งานล่วงหน้า', advanceJobs)}
            />
          </div>
        </div>

        {/* รายได้และค่าปรับ */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">รายได้และค่าปรับ</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title="รายได้รวม"
              value={formatBaht(totalIncome)}
              icon={Wallet}
              variant="success"
              subtitle="จากใบขอในชุดนี้"
              onClick={() => showJobList('รายการตามชุดฟิลเตอร์', filteredJobs)}
            />
            <StatCard
              title="ค่าปรับสะสมรวม"
              value={formatBaht(totalPenalty)}
              icon={Receipt}
              variant={totalPenalty > 0 ? 'destructive' : 'default'}
              subtitle="รวมทุกสถานะ"
              onClick={() => showJobList('งานที่มีค่าปรับ (รวมศูนย์)', jobsWithPenalty)}
            />
            <StatCard
              title="ค่าปรับค้าง (งานดำเนินการ)"
              value={formatBaht(penaltyOnOpen)}
              icon={AlertTriangle}
              variant={penaltyOnOpen > 0 ? 'warning' : 'default'}
              subtitle="เฉพาะที่ยังไม่ปิด"
              onClick={() =>
                showJobList('งานที่ยังดำเนินการที่มีค่าปรับ', openJobs.filter((j) => (j.total_penalty ?? 0) > 0))
              }
            />
            <StatCard
              title="ใบที่มีค่าปรับ"
              value={jobsWithPenalty.length}
              icon={Receipt}
              variant="info"
              subtitle={jobsWithPenalty.length ? `เฉลี่ย ${formatBaht(avgPenaltyWhenAny)}/ใบ` : 'ไม่มีค่าปรับ'}
              onClick={() => showJobList('งานที่มีค่าปรับ', jobsWithPenalty)}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            รายได้หลังหักค่าปรับ (ประมาณการ):{' '}
            <strong className="text-foreground">{formatBaht(Math.max(0, totalIncome - totalPenalty))}</strong> — ใช้ดูเทียบภาพรวมเชิงเงิน
            ไม่ใช่กำไรสุทธิทางบัญชี
          </p>
        </div>

        {/* ความเสี่ยงและการปิดงาน — ย่อให้เหลือแกนหลัก */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">ความเสี่ยงและการปิดงาน</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard
              title="ค้างเกิน 14 วัน"
              value={over14.length}
              icon={AlertTriangle}
              variant="destructive"
              subtitle="ควรเร่ง"
              onClick={() => showJobList('งานค้างเกิน 14 วัน', over14)}
            />
            <StatCard
              title="15–30 วัน"
              value={range15to30.length}
              icon={Clock}
              variant="warning"
              onClick={() => showJobList('งาน 15–30 วัน', range15to30)}
            />
            <StatCard
              title="7–14 วัน"
              value={range7to14.length}
              icon={Clock}
              variant="info"
              onClick={() => showJobList('งาน 7–14 วัน', range7to14)}
            />
            <StatCard
              title="เกิน 30 วัน"
              value={over30.length}
              icon={Timer}
              variant="destructive"
              onClick={() => showJobList('งานเกิน 30 วัน', over30)}
            />
            <StatCard
              title="ปิดทันกำหนด"
              value={closedOnTime.length}
              icon={ThumbsUp}
              variant="success"
              subtitle={`จากปิดแล้ว ${closedJobs.length}`}
              onClick={() => showJobList('ปิดทันเวลา', closedOnTime)}
            />
            <StatCard
              title="ปิดช้ากว่ากำหนด"
              value={closedLate.length}
              icon={ThumbsDown}
              variant="destructive"
              subtitle={`จากปิดแล้ว ${closedJobs.length}`}
              onClick={() => showJobList('ปิดไม่ทัน', closedLate)}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <StatCard
              title="ปิดแล้วทั้งหมด"
              value={closedJobs.length}
              icon={CheckCircle2}
              variant="success"
              onClick={() => showJobList('งานที่ปิดแล้ว', closedJobs)}
            />
            <StatCard
              title="ปิดงานด่วน"
              value={closedUrgent.length}
              variant="success"
              subtitle={`จากด่วน ${urgentJobs.length} ใบ`}
              onClick={() => showJobList('ปิดงานด่วน', closedUrgent)}
            />
            <StatCard
              title="ปิดงานล่วงหน้า"
              value={closedAdvance.length}
              variant="success"
              subtitle={`จากล่วงหน้า ${advanceJobs.length} ใบ`}
              onClick={() => showJobList('ปิดงานล่วงหน้า', closedAdvance)}
            />
            <StatCard
              title="คงเหลือเดือนนี้"
              value={remainingThisMonth.length}
              icon={XCircle}
              variant="warning"
              subtitle="กำหนดส่งในเดือนนี้"
              onClick={() => showJobList('คงเหลือเดือนนี้', remainingThisMonth)}
            />
          </div>
        </div>

        {/* รายละเอียดเชิงลึก — พับไว้ */}
        <details className="group rounded-xl border border-border bg-card/40 open:bg-card/60 transition-colors">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <ListFilter className="w-4 h-4 text-blue-600" />
              รายละเอียดเชิงลึก (แยกประเภท บุคลากร ตารางเต็ม)
            </span>
            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-5 pt-0 space-y-6 border-t border-border/60">
            <div>
              <SectionHeader id="department" title="แยกตามแผนก" icon={Briefcase} />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
                {departmentBreakdown.length === 0 ? (
                  <p className="text-xs text-muted-foreground col-span-full">ยังไม่มีข้อมูลแผนก</p>
                ) : (
                  departmentBreakdown.map(([code, count]) => {
                    const deptJobs = jobsScopedForDepartmentBreakdown.filter(
                      (j) => extractDepartmentCode(j) === code,
                    );
                    const label = departmentLabelForCode(jobsScopedForDepartmentBreakdown, code);
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => {
                          patchFilters({ departmentFilter: code });
                          showJobList(`แผนก: ${label}`, deptJobs);
                        }}
                        className={cn(
                          'jarvis-menu-card rounded-[1.5rem] p-3 border border-white/70 text-left hover:border-blue-300/50 transition-colors',
                          filters.departmentFilter === code && 'border-blue-400/60 bg-blue-500/10',
                        )}
                      >
                        <p className="text-xs text-muted-foreground line-clamp-2">{label}</p>
                        <p className="text-xl font-bold text-foreground mt-1">{count}</p>
                        <div className="flex gap-2 mt-1 text-[10px]">
                          <span className="text-destructive">
                            {deptJobs.filter((j) => j.urgency === 'urgent').length} ด่วน
                          </span>
                          <span className="text-info">
                            {deptJobs.filter((j) => j.urgency === 'advance').length} ล่วงหน้า
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              {expandedSection === 'department' && (
                <div className="mt-3 glass-card rounded-xl border border-border overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="px-3 py-2 text-left text-muted-foreground">แผนก</th>
                        <th className="px-3 py-2 text-center text-muted-foreground">ดำเนินการ</th>
                        <th className="px-3 py-2 text-center text-muted-foreground">ปิดแล้ว</th>
                        <th className="px-3 py-2 text-center text-muted-foreground">รวม</th>
                      </tr>
                    </thead>
                    <tbody>
                      {departmentBreakdown.map(([code]) => {
                        const items = byDepartment(code);
                        const label = departmentLabelForCode(filteredJobs, code);
                        return (
                          <tr
                            key={code}
                            className={cn(
                              'border-b border-border/50 cursor-pointer hover:bg-secondary/20',
                              filters.departmentFilter === code && 'bg-blue-500/10',
                            )}
                            onClick={() => {
                              patchFilters({ departmentFilter: code });
                              showJobList(`แผนก: ${label}`, items);
                            }}
                          >
                            <td className="px-3 py-2 font-medium max-w-[200px]">{label}</td>
                            <td className="px-3 py-2 text-center">{items.filter((j) => j.status !== 'closed').length}</td>
                            <td className="px-3 py-2 text-center text-success">{items.filter((j) => j.status === 'closed').length}</td>
                            <td className="px-3 py-2 text-center font-bold">{items.length}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <SectionHeader id="jobCategory" title="แยกตามประเภทงาน" icon={Briefcase} />
              <div className="grid grid-cols-3 gap-3 mt-2">
                {(['bank', 'government', 'private'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => showJobList(JOB_CATEGORY_LABELS[cat], byJobCategory(cat))}
                    className="jarvis-menu-card rounded-[1.5rem] p-3 border border-white/70 text-left hover:border-blue-300/50 transition-colors"
                  >
                    <p className="text-xs text-muted-foreground">{JOB_CATEGORY_LABELS[cat]}</p>
                    <p className="text-xl font-bold text-foreground mt-1">{byJobCategory(cat).length}</p>
                    <div className="flex gap-2 mt-1 text-[10px]">
                      <span className="text-success">{byJobCategory(cat).filter((j) => j.status === 'closed').length} ปิด</span>
                      <span className="text-warning">{byJobCategory(cat).filter((j) => j.status !== 'closed').length} ดำเนินการ</span>
                    </div>
                  </button>
                ))}
              </div>
              {expandedSection === 'jobCategory' && (
                <div className="mt-3 glass-card rounded-xl border border-border overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="px-3 py-2 text-left text-muted-foreground">ประเภทงาน</th>
                        <th className="px-3 py-2 text-center text-muted-foreground">ด่วน</th>
                        <th className="px-3 py-2 text-center text-muted-foreground">ล่วงหน้า</th>
                        <th className="px-3 py-2 text-center text-muted-foreground">ปิดแล้ว</th>
                        <th className="px-3 py-2 text-center text-muted-foreground">รวม</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(['bank', 'government', 'private'] as const).map((cat) => {
                        const items = byJobCategory(cat);
                        return (
                          <tr
                            key={cat}
                            className="border-b border-border/50 cursor-pointer hover:bg-secondary/20"
                            onClick={() => showJobList(JOB_CATEGORY_LABELS[cat], items)}
                          >
                            <td className="px-3 py-2 font-medium">{JOB_CATEGORY_LABELS[cat]}</td>
                            <td className="px-3 py-2 text-center text-destructive">{items.filter((j) => j.urgency === 'urgent').length}</td>
                            <td className="px-3 py-2 text-center text-info">{items.filter((j) => j.urgency === 'advance').length}</td>
                            <td className="px-3 py-2 text-center text-success">{items.filter((j) => j.status === 'closed').length}</td>
                            <td className="px-3 py-2 text-center font-bold">{items.length}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <SectionHeader id="closedBreakdown" title="รายละเอียดงานที่ปิดแล้ว" icon={CheckCircle2} />
              {expandedSection === 'closedBreakdown' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                  <div className="glass-card rounded-[1.5rem] p-4 border border-white/70">
                    <p className="text-xs font-medium text-muted-foreground mb-2">ปิดแยกตามแผนก</p>
                    {departmentBreakdown.map(([code]) => {
                      const closed = closedJobs.filter((j) => extractDepartmentCode(j) === code);
                      const total = byDepartment(code).length;
                      const label = departmentLabelForCode(filteredJobs, code);
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => showJobList(`${label} (ปิดแล้ว)`, closed)}
                          className="flex w-full items-center justify-between py-1.5 border-b border-border/30 last:border-0 hover:bg-secondary/30 rounded px-1 text-left"
                        >
                          <span className="text-xs text-foreground line-clamp-1">{label}</span>
                          <span className="text-xs font-bold shrink-0 ml-2">
                            <span className="text-success">{closed.length}</span>
                            <span className="text-muted-foreground">/{total}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="glass-card rounded-[1.5rem] p-4 border border-white/70">
                    <p className="text-xs font-medium text-muted-foreground mb-2">ปิดแยกตามประเภทงาน</p>
                    {(['bank', 'government', 'private'] as const).map((cat) => {
                      const closed = closedJobs.filter((j) => j.job_category === cat);
                      const total = byJobCategory(cat).length;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => showJobList(`${JOB_CATEGORY_LABELS[cat]} (ปิดแล้ว)`, closed)}
                          className="flex w-full items-center justify-between py-1.5 border-b border-border/30 last:border-0 hover:bg-secondary/30 rounded px-1 text-left"
                        >
                          <span className="text-xs text-foreground">{JOB_CATEGORY_LABELS[cat]}</span>
                          <span className="text-xs font-bold">
                            <span className="text-success">{closed.length}</span>
                            <span className="text-muted-foreground">/{total}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div>
              <SectionHeader id="units" title="แยกตามหน่วยงาน" icon={Briefcase} />
              {expandedSection === 'units' && (
                <div className="mt-2 glass-card rounded-[1.5rem] p-4 border border-white/70 max-h-80 overflow-y-auto">
                  {unitBreakdownOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">ยังไม่มีข้อมูลหน่วยงาน</p>
                  ) : (
                    unitBreakdownOptions.map((unit) => {
                      const uJobs = jobsScopedForUnitBreakdown.filter((j) => j.unit_name === unit);
                      const openCount = uJobs.filter((j) => j.status !== 'closed' && j.status !== 'cancelled').length;
                      return (
                        <button
                          key={unit}
                          type="button"
                          onClick={() => {
                            patchFilters({ unitFilter: unit });
                            showJobList(`หน่วยงาน: ${unit}`, uJobs);
                          }}
                          className={cn(
                            'w-full py-2 border-b border-border/30 last:border-0 hover:bg-secondary/30 rounded px-1 text-left',
                            filters.unitFilter === unit && 'bg-blue-500/10',
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-foreground line-clamp-2">{unit}</span>
                            <span className="text-sm font-bold text-blue-600 shrink-0">{uJobs.length} ใบขอ</span>
                          </div>
                          <div className="flex flex-wrap gap-3 mt-1 text-[10px] text-muted-foreground">
                            <span>ดำเนินการ: {openCount}</span>
                            <span>ปิดแล้ว: {uJobs.filter((j) => j.status === 'closed').length}</span>
                            <span>ด่วน: {uJobs.filter((j) => j.urgency === 'urgent').length}</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div>
              <SectionHeader id="personnel" title="เจ้าหน้าที่สรรหา & คัดสรร" icon={Filter} />
              {expandedSection === 'personnel' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                  <div className="glass-card rounded-[1.5rem] p-4 border border-white/70">
                    <p className="text-xs font-medium text-muted-foreground mb-2">เจ้าหน้าที่สรรหา</p>
                    {filterApi.recruiters.map((name) => {
                      const rJobs = jobs.filter((j) => j.recruiter_name === name);
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => showJobList(`งานของ ${name} (สรรหา)`, rJobs)}
                          className="w-full py-2 border-b border-border/30 last:border-0 hover:bg-secondary/30 rounded px-1 text-left"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">{name}</span>
                            <span className="text-sm font-bold text-blue-600">{rJobs.length} งาน</span>
                          </div>
                          <div className="flex flex-wrap gap-3 mt-1 text-[10px] text-muted-foreground">
                            {(['thai_executive', 'foreign_executive', 'central', 'valet_parking'] as const).map((t) => {
                              const c = rJobs.filter((j) => j.job_type === t).length;
                              return c > 0 ? (
                                <span key={t}>
                                  {JOB_TYPE_LABELS[t]}: {c}
                                </span>
                              ) : null;
                            })}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="glass-card rounded-[1.5rem] p-4 border border-white/70">
                    <p className="text-xs font-medium text-muted-foreground mb-2">เจ้าหน้าที่คัดสรร</p>
                    {filterApi.screeners.map((name) => {
                      const sJobs = jobs.filter((j) => j.screener_name === name);
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => showJobList(`งานของ ${name} (คัดสรร)`, sJobs)}
                          className="w-full py-2 border-b border-border/30 last:border-0 hover:bg-secondary/30 rounded px-1 text-left"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">{name}</span>
                            <span className="text-sm font-bold text-blue-600">{sJobs.length} งาน</span>
                          </div>
                          <div className="flex flex-wrap gap-3 mt-1 text-[10px] text-muted-foreground">
                            {(['bank', 'government', 'private'] as const).map((c) => {
                              const count = sJobs.filter((j) => j.job_category === c).length;
                              return count > 0 ? (
                                <span key={c}>
                                  {JOB_CATEGORY_LABELS[c]}: {count}
                                </span>
                              ) : null;
                            })}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div>
              <SectionHeader id="jobList" title={`รายการงานทั้งหมด (${filteredJobs.length})`} icon={Briefcase} />
              {expandedSection === 'jobList' && (
                <div className="mt-2 glass-card rounded-xl border border-border overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="px-3 py-2 text-left text-muted-foreground">หน่วยงาน</th>
                        <th className="px-3 py-2 text-center text-muted-foreground">แผนก</th>
                        <th className="px-3 py-2 text-center text-muted-foreground">ประเภท</th>
                        <th className="px-3 py-2 text-center text-muted-foreground">ด่วน</th>
                        <th className="px-3 py-2 text-center text-muted-foreground">อายุ (วัน)</th>
                        <th className="px-3 py-2 text-right text-muted-foreground">ค่าปรับ</th>
                        <th className="px-3 py-2 text-center text-muted-foreground">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredJobs.map((j) => (
                        <tr
                          key={j.id}
                          onClick={() => navigateToUnitRequest(j, navigate)}
                          className="border-b border-border/50 hover:bg-secondary/20 cursor-pointer"
                        >
                          <td className="px-3 py-2 font-medium text-blue-600 max-w-[150px] truncate">{j.unit_name}</td>
                          <td className="px-3 py-2 text-center text-muted-foreground max-w-[120px] truncate">{extractDepartmentLabel(j)}</td>
                          <td className="px-3 py-2 text-center text-muted-foreground">{JOB_CATEGORY_LABELS[j.job_category]}</td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className={cn(
                                'px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                                j.urgency === 'urgent' ? 'bg-destructive/15 text-destructive' : 'bg-info/15 text-info',
                              )}
                            >
                              {j.urgency === 'urgent' ? 'ด่วน' : 'ล่วงหน้า'}
                            </span>
                          </td>
                          <td
                            className={cn(
                              'px-3 py-2 text-center font-medium',
                              getAgeDays(j) > 30 ? 'text-destructive' : getAgeDays(j) > 14 ? 'text-warning' : 'text-foreground',
                            )}
                          >
                            {getAgeDays(j)}
                          </td>
                          <td
                            className={cn(
                              'px-3 py-2 text-right font-medium tabular-nums',
                              (j.total_penalty ?? 0) > 0 ? 'text-destructive' : 'text-muted-foreground',
                            )}
                          >
                            {(j.total_penalty ?? 0) > 0 ? formatBaht(j.total_penalty ?? 0) : '—'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className={cn(
                                'px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                                j.status === 'closed'
                                  ? 'bg-success/15 text-success'
                                  : j.status === 'cancelled'
                                    ? 'bg-destructive/15 text-destructive'
                                    : 'bg-warning/15 text-warning',
                              )}
                            >
                              {j.status === 'closed' ? 'ปิดแล้ว' : 'ดำเนินการ'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </details>
      </div>
      <DetailListDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={dialogTitle}
        items={dialogItems}
        emptyMessage="ไม่มีรายการในกลุ่มนี้"
      />
    </div>
  );
};

export default SupervisorDashboard;
