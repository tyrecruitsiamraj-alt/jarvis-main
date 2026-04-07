import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import DetailListDialog from '@/components/shared/DetailListDialog';
import { JobRequest, JOB_TYPE_LABELS, JOB_CATEGORY_LABELS } from '@/types';
import { useDemoAwareJobs } from '@/hooks/useDemoAwareJobs';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { differenceInDays, parseISO } from 'date-fns';
import { JOB_STAFF_ROSTER_CHANGED_EVENT } from '@/lib/demoStorage';
import { buildRecruiterNameOptions, buildScreenerNameOptions } from '@/lib/jobStaffNames';

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

const SupervisorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [recruiterFilter, setRecruiterFilter] = useState<string>('all');
  const [screenerFilter, setScreenerFilter] = useState<string>('all');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogItems, setDialogItems] = useState<DetailDialogItem[]>([]);
  const [staffRosterRev, setStaffRosterRev] = useState(0);

  const { jobs, loading: loadingJobs } = useDemoAwareJobs();
  const today = new Date();

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

  const filteredJobs = useMemo(() => {
    let result = jobs;
    if (recruiterFilter !== 'all') result = result.filter((j) => j.recruiter_name === recruiterFilter);
    if (screenerFilter !== 'all') result = result.filter((j) => j.screener_name === screenerFilter);
    return result;
  }, [jobs, recruiterFilter, screenerFilter]);

  const totalJobs = filteredJobs.length;
  const urgentJobs = filteredJobs.filter((j) => j.urgency === 'urgent');
  const advanceJobs = filteredJobs.filter((j) => j.urgency === 'advance');
  const closedJobs = filteredJobs.filter((j) => j.status === 'closed');
  const cancelledJobs = filteredJobs.filter((j) => j.status === 'cancelled');
  const openJobs = filteredJobs.filter((j) => j.status !== 'closed' && j.status !== 'cancelled');

  const openUrgent = useMemo(() => openJobs.filter((j) => j.urgency === 'urgent'), [openJobs]);
  const openAdvance = useMemo(() => openJobs.filter((j) => j.urgency === 'advance'), [openJobs]);

  const byJobType = (type: string) => filteredJobs.filter((j) => j.job_type === type);
  const byJobCategory = (cat: string) => filteredJobs.filter((j) => j.job_category === cat);

  const getAgeDays = (j: JobRequest) => differenceInDays(today, parseISO(j.request_date));
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

  const closedOnTime = closedJobs.filter(
    (j) => j.closed_date && differenceInDays(parseISO(j.closed_date), parseISO(j.required_date)) <= 0,
  );
  const closedLate = closedJobs.filter(
    (j) => j.closed_date && differenceInDays(parseISO(j.closed_date), parseISO(j.required_date)) > 0,
  );
  const closedUrgent = closedJobs.filter((j) => j.urgency === 'urgent');
  const closedAdvance = closedJobs.filter((j) => j.urgency === 'advance');

  const currentMonth = today.getMonth();
  const remainingThisMonth = openJobs.filter((j) => parseISO(j.required_date).getMonth() === currentMonth);

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
      `${JOB_TYPE_LABELS[j.job_type]} • ${JOB_CATEGORY_LABELS[j.job_category]}`,
      `${j.urgency === 'urgent' ? 'ด่วน' : 'ล่วงหน้า'} • อายุใบขอ ${getAgeDays(j)} วัน`,
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
        navigate(`/jobs/${j.id}`);
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
        <Icon className="w-4 h-4 text-primary" /> {title}
      </h3>
      {expandedSection === id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
    </button>
  );

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="ภาพรวมสำหรับผู้บริหาร — งาน รายได้ และค่าปรับ (ตามฟิลเตอร์ด้านล่าง)"
      />
      <div className="px-4 md:px-6 space-y-6 pb-24 max-w-6xl mx-auto">
        {loadingJobs && <div className="text-sm text-muted-foreground">กำลังโหลดข้อมูล…</div>}

        {/* ฟิลเตอร์ — แถวเดียว อ่านง่าย */}
        <div className="rounded-xl border border-border/80 bg-card/50 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Filter className="w-4 h-4 text-primary shrink-0" />
            <span>ขอบเขตข้อมูล</span>
            <span className="text-xs font-normal text-muted-foreground">เลือกแล้วตัวเลขด้านล่างจะเปลี่ยนตามทันที</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">เจ้าหน้าที่สรรหา</label>
              <select
                value={recruiterFilter}
                onChange={(e) => setRecruiterFilter(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="all">ทั้งหมด</option>
                {recruiters.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">เจ้าหน้าที่คัดสรร</label>
              <select
                value={screenerFilter}
                onChange={(e) => setScreenerFilter(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="all">ทั้งหมด</option>
                {screeners.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
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
              <ListFilter className="w-4 h-4 text-primary" />
              รายละเอียดเชิงลึก (แยกประเภท บุคลากร ตารางเต็ม)
            </span>
            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-5 pt-0 space-y-6 border-t border-border/60">
            <div>
              <SectionHeader id="jobType" title="แยกตามลักษณะงาน" icon={Briefcase} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                {(['thai_executive', 'foreign_executive', 'central', 'valet_parking'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => showJobList(JOB_TYPE_LABELS[type], byJobType(type))}
                    className="glass-card rounded-xl p-3 border border-border text-left hover:border-primary/40 transition-colors"
                  >
                    <p className="text-xs text-muted-foreground truncate">{JOB_TYPE_LABELS[type]}</p>
                    <p className="text-xl font-bold text-foreground mt-1">{byJobType(type).length}</p>
                    <div className="flex gap-2 mt-1 text-[10px]">
                      <span className="text-destructive">{byJobType(type).filter((j) => j.urgency === 'urgent').length} ด่วน</span>
                      <span className="text-info">{byJobType(type).filter((j) => j.urgency === 'advance').length} ล่วงหน้า</span>
                    </div>
                  </button>
                ))}
              </div>
              {expandedSection === 'jobType' && (
                <div className="mt-3 glass-card rounded-xl border border-border overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="px-3 py-2 text-left text-muted-foreground">ลักษณะงาน</th>
                        <th className="px-3 py-2 text-center text-muted-foreground">ดำเนินการ</th>
                        <th className="px-3 py-2 text-center text-muted-foreground">ปิดแล้ว</th>
                        <th className="px-3 py-2 text-center text-muted-foreground">รวม</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(['thai_executive', 'foreign_executive', 'central', 'valet_parking'] as const).map((type) => {
                        const items = byJobType(type);
                        return (
                          <tr
                            key={type}
                            className="border-b border-border/50 cursor-pointer hover:bg-secondary/20"
                            onClick={() => showJobList(JOB_TYPE_LABELS[type], items)}
                          >
                            <td className="px-3 py-2 font-medium">{JOB_TYPE_LABELS[type]}</td>
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
                    className="glass-card rounded-xl p-3 border border-border text-left hover:border-primary/40 transition-colors"
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
                  <div className="glass-card rounded-xl p-4 border border-border">
                    <p className="text-xs font-medium text-muted-foreground mb-2">ปิดแยกตามลักษณะงาน</p>
                    {(['thai_executive', 'foreign_executive', 'central', 'valet_parking'] as const).map((type) => {
                      const closed = closedJobs.filter((j) => j.job_type === type);
                      const total = byJobType(type).length;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => showJobList(`${JOB_TYPE_LABELS[type]} (ปิดแล้ว)`, closed)}
                          className="flex w-full items-center justify-between py-1.5 border-b border-border/30 last:border-0 hover:bg-secondary/30 rounded px-1 text-left"
                        >
                          <span className="text-xs text-foreground">{JOB_TYPE_LABELS[type]}</span>
                          <span className="text-xs font-bold">
                            <span className="text-success">{closed.length}</span>
                            <span className="text-muted-foreground">/{total}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="glass-card rounded-xl p-4 border border-border">
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
              <SectionHeader id="personnel" title="เจ้าหน้าที่สรรหา & คัดสรร" icon={Filter} />
              {expandedSection === 'personnel' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                  <div className="glass-card rounded-xl p-4 border border-border">
                    <p className="text-xs font-medium text-muted-foreground mb-2">เจ้าหน้าที่สรรหา</p>
                    {recruiters.map((name) => {
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
                            <span className="text-sm font-bold text-primary">{rJobs.length} งาน</span>
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
                  <div className="glass-card rounded-xl p-4 border border-border">
                    <p className="text-xs font-medium text-muted-foreground mb-2">เจ้าหน้าที่คัดสรร</p>
                    {screeners.map((name) => {
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
                            <span className="text-sm font-bold text-primary">{sJobs.length} งาน</span>
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
                        <th className="px-3 py-2 text-center text-muted-foreground">ลักษณะ</th>
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
                          onClick={() => navigate(`/jobs/${j.id}`)}
                          className="border-b border-border/50 hover:bg-secondary/20 cursor-pointer"
                        >
                          <td className="px-3 py-2 font-medium text-primary max-w-[150px] truncate">{j.unit_name}</td>
                          <td className="px-3 py-2 text-center text-muted-foreground">{JOB_TYPE_LABELS[j.job_type]}</td>
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
