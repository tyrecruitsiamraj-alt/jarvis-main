import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { formatYmdDmyBe } from '@/lib/dateTh';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import DetailListDialog from '@/components/shared/DetailListDialog';
import TrackingBucketGrid from '@/components/jobs/TrackingBucketGrid';
import JobUrgencyBadge from '@/components/jobs/JobUrgencyBadge';
import { JOB_TYPE_LABELS, type JobRequest } from '@/types';
import {
  Briefcase,
  Plus,
  AlertTriangle,
  CheckCircle,
  ListTodo,
  RefreshCw,
  Zap,
  Clock,
  CalendarClock,
  Timer,
  Users,
  FileText,
  Layers,
  XCircle,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';
import { navigateToUnitRequest } from '@/lib/jobNavigation';
import { cn } from '@/lib/utils';
import { computeJobUrgency, urgencyDisplayLabel } from '@/lib/jobUrgency';
import {
  jobRoleFilterOptions,
  filterUnitRequestsByJobRole,
  type SiamrajJobRoleFilter,
} from '@/lib/siamrajUnitFilters';
import { buildTrackingSnapshot, type TrackingBucket } from '@/lib/unitRequestTracking';

type JobDialogItem = {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'destructive' | 'info';
  onClick?: () => void;
};

function jobRequestToDialogItem(j: JobRequest, onNavigate: (job: JobRequest) => void): JobDialogItem {
  const urgencyMeta = computeJobUrgency(j);
  const badge = j.status === 'closed' ? 'ปิดแล้ว' : j.status === 'cancelled' ? 'ยกเลิก' : 'ดำเนินการ';
  const badgeVariant: JobDialogItem['badgeVariant'] =
    j.status === 'closed' ? 'success' : j.status === 'cancelled' ? 'destructive' : 'warning';

  const parts = [
    j.request_no ? `#${j.request_no}` : null,
    j.request_action_name || JOB_TYPE_LABELS[j.job_type],
    j.job_description_code_1,
    urgencyDisplayLabel(urgencyMeta),
    j.siamraj_status ? `ST:${j.siamraj_status}` : null,
    `ต้องการ ${formatYmdDmyBe(j.required_date)}`,
    j.resigned_employee_name ? `ลาออก: ${j.resigned_employee_name}` : null,
  ].filter(Boolean);

  return {
    id: j.id,
    title: j.unit_name,
    subtitle: parts.join(' · '),
    badge,
    badgeVariant,
    onClick: () => onNavigate(j),
  };
}

function TrackingSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

const JobDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { jobs, loading, refreshing, siamrajPrimary, readOnly, dbSource, loadError, refetch } = useUnitRequestsFeed();
  const [jobRoleFilter, setJobRoleFilter] = useState<SiamrajJobRoleFilter>('all');
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [jobDialogTitle, setJobDialogTitle] = useState('');
  const [jobDialogItems, setJobDialogItems] = useState<JobDialogItem[]>([]);

  const jobRoleOptions = useMemo(
    () => (siamrajPrimary ? jobRoleFilterOptions(jobs) : []),
    [jobs, siamrajPrimary],
  );

  const scopedJobs = useMemo(
    () => (siamrajPrimary ? filterUnitRequestsByJobRole(jobs, jobRoleFilter) : jobs),
    [jobs, siamrajPrimary, jobRoleFilter],
  );

  const track = useMemo(() => buildTrackingSnapshot(scopedJobs), [scopedJobs]);

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

  const openBucket = (bucket: TrackingBucket) => {
    openJobList(bucket.label, bucket.jobs);
  };

  return (
    <div>
      <PageHeader
        title="ภาพรวม 360°"
        subtitle={
          siamrajPrimary
            ? dbSource === 'sqlserver'
              ? 'ติดตามใบขอ Siamraj ทุกมิติ — กดตัวเลขเพื่อดูรายการและติดตาม'
              : 'ติดตามใบขอหน่วยงานทุกมิติ — กดตัวเลขเพื่อดูรายการและติดตาม'
            : 'ติดตามงานและใบขอทุกมิติ — กดตัวเลขเพื่อดูรายการ'
        }
        actions={
          <div className="flex items-center gap-2">
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
            {!readOnly && hasPermission('staff') ? (
              <button onClick={() => navigate('/jobs/add')} className="flex items-center gap-1 px-3 py-2 jarvis-pill-btn text-sm">
                <Plus className="w-4 h-4" /> สร้างงานใหม่
              </button>
            ) : null}
          </div>
        }
      />

      <div className="px-4 md:px-6 space-y-6 pb-24 max-w-6xl mx-auto">
        {loading && <div className="text-sm text-muted-foreground">กำลังโหลดงาน...</div>}
        {loadError && (
          <div className="text-sm text-destructive rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2">
            {loadError}
          </div>
        )}

        {siamrajPrimary ? (
          <div className="flex items-center gap-2 max-w-md">
            <label htmlFor="job-dash-role" className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
              ลักษณะงาน
            </label>
            <select
              id="job-dash-role"
              value={jobRoleFilter}
              onChange={(e) => setJobRoleFilter(e.target.value)}
              className="jarvis-soft-field flex-1"
            >
              {jobRoleOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Layers className="w-4 h-4 text-orange-600" />
            สรุปภาพรวม 360°
          </p>
          <ul className="text-sm text-foreground/90 space-y-1.5 list-disc list-inside marker:text-primary">
            <li>
              ใบขอทั้งหมด <strong>{track.total}</strong> · ดำเนินการ <strong>{track.open.length}</strong> · ปิดแล้ว{' '}
              <strong>{track.closed.length}</strong>
            </li>
            <li>
              ฉุกเฉิน <strong className="text-destructive">{track.openUrgent.length}</strong> · ล่วงหน้า{' '}
              <strong>{track.openAdvance.length}</strong> · ยกระดับเป็นงานด่วน{' '}
              <strong className="text-destructive">{track.escalated.length}</strong>
            </li>
            <li>
              เลยกำหนด <strong className={track.overdue.length > 0 ? 'text-destructive' : ''}>{track.overdue.length}</strong>{' '}
              · ครบภายใน 7 วัน <strong>{track.dueSoon.length}</strong> · ค้างเกิน 14 วัน{' '}
              <strong className={track.stale.length > 0 ? 'text-destructive' : ''}>{track.stale.length}</strong>
            </li>
          </ul>
        </div>

        <TrackingSection title="สถานะใบขอ" hint="กดเพื่อติดตามรายการ">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title="ทั้งหมด"
              value={track.total}
              icon={Briefcase}
              variant="primary"
              onClick={() => openJobList('ใบขอทั้งหมด', scopedJobs)}
            />
            <StatCard
              title="ดำเนินการ"
              value={track.open.length}
              icon={ListTodo}
              variant="warning"
              subtitle="ยังไม่ปิด"
              onClick={() => openJobList('ดำเนินการ', track.open)}
            />
            <StatCard
              title="ปิดแล้ว"
              value={track.closed.length}
              icon={CheckCircle}
              variant="success"
              onClick={() => openJobList('ปิดแล้ว', track.closed)}
            />
            <StatCard
              title="ยกเลิก"
              value={track.cancelled.length}
              icon={XCircle}
              variant="default"
              onClick={() => openJobList('ยกเลิก', track.cancelled)}
            />
          </div>
        </TrackingSection>

        <TrackingSection title="ความเร่งด่วน" hint="คำนวณจากวันที่ส่ง vs วันที่ต้องการ">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title="ฉุกเฉิน"
              value={track.openUrgent.length}
              icon={Zap}
              variant="destructive"
              subtitle="lead time < 7 วัน"
              onClick={() => openJobList('ฉุกเฉิน (ดำเนินการ)', track.openUrgent)}
            />
            <StatCard
              title="ล่วงหน้า"
              value={track.openAdvance.length}
              icon={Clock}
              variant="info"
              subtitle="lead time ≥ 7 วัน"
              onClick={() => openJobList('ล่วงหน้า (ดำเนินการ)', track.openAdvance)}
            />
            <StatCard
              title="ยกระดับงานด่วน"
              value={track.escalated.length}
              icon={TrendingUp}
              variant="destructive"
              subtitle="ล่วงหน้า → เหลือ < 7 วัน"
              onClick={() => openJobList('ยกระดับเป็นงานด่วน', track.escalated.filter((j) => j.status !== 'closed'))}
            />
            {siamrajPrimary ? (
              <StatCard
                title="ต้องจัดคน"
                value={track.needStaff.length}
                icon={Users}
                variant="warning"
                subtitle="need_staff"
                onClick={() => openJobList('ต้องจัดคน', track.needStaff)}
              />
            ) : (
              <StatCard
                title="ฉุกเฉิน (รวมปิด)"
                value={track.urgent.length}
                icon={Zap}
                variant="destructive"
                onClick={() => openJobList('ฉุกเฉิน (ทั้งหมด)', track.urgent)}
              />
            )}
          </div>
        </TrackingSection>

        <TrackingSection title="กำหนดเวลา & อายุงาน" hint="ติดตาม deadline และงานค้าง">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title="เลยกำหนด"
              value={track.overdue.length}
              icon={AlertTriangle}
              variant="destructive"
              subtitle="วันที่ต้องการผ่านแล้ว"
              onClick={() => openJobList('เลยกำหนด', track.overdue)}
            />
            <StatCard
              title="ครบภายใน 7 วัน"
              value={track.dueSoon.length}
              icon={CalendarClock}
              variant="warning"
              onClick={() => openJobList('ครบภายใน 7 วัน', track.dueSoon)}
            />
            <StatCard
              title="ค้างเกิน 14 วัน"
              value={track.stale.length}
              icon={Timer}
              variant={track.stale.length > 0 ? 'destructive' : 'default'}
              subtitle="นับจากวันที่ส่ง"
              onClick={() => openJobList('ค้างเกิน 14 วัน', track.stale)}
            />
            <StatCard
              title="ครบเดือนนี้"
              value={track.thisMonth.length}
              icon={CalendarClock}
              variant="info"
              onClick={() => openJobList('ครบกำหนดเดือนนี้', track.thisMonth)}
            />
          </div>
        </TrackingSection>

        {track.byRequestAction.length > 0 ? (
          <TrackingSection title="ประเภทใบขอ" hint="แยกตาม request_action">
            <TrackingBucketGrid
              buckets={track.byRequestAction}
              onSelect={openBucket}
              emptyMessage="ไม่มีประเภทใบขอ"
            />
          </TrackingSection>
        ) : null}

        {siamrajPrimary && track.bySiamrajStatus.length > 0 ? (
          <TrackingSection title="สถานะ Siamraj" hint="แยกตามสถานะ ST">
            <TrackingBucketGrid
              buckets={track.bySiamrajStatus}
              onSelect={openBucket}
              emptyMessage="ไม่มีสถานะ ST"
            />
          </TrackingSection>
        ) : null}

        {track.byJobRole.length > 1 ? (
          <TrackingSection title="ลักษณะงาน (ดำเนินการ)" hint="กดเพื่อติดตามแต่ละตำแหน่ง">
            <TrackingBucketGrid
              buckets={track.byJobRole}
              onSelect={openBucket}
              emptyMessage="ไม่มีลักษณะงาน"
            />
          </TrackingSection>
        ) : null}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => navigate('/jobs/list')}
            className="flex-1 glass-card rounded-[1.5rem] p-4 border border-white/70 hover:border-orange-300/50 text-left"
          >
            <FileText className="w-6 h-6 text-orange-600 mb-1" />
            <div className="text-sm font-semibold text-foreground">รายการงานทั้งหมด</div>
            <div className="text-xs text-muted-foreground mt-0.5">ค้นหา กรอง และติดตามรายใบ</div>
          </button>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">งานล่าสุด — กดเพื่อติดตาม</h3>
          <div className="space-y-2">
            {scopedJobs.slice(0, 6).map((j) => (
              <motion.button
                key={j.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => goToJob(j)}
                className="w-full glass-card rounded-[1.5rem] p-4 border border-white/70 text-left hover:border-orange-300/50 transition-all"
              >
                <div className="flex items-center justify-between mb-2 gap-2">
                  <span className="font-semibold text-foreground text-sm truncate">
                    {j.request_no ? `${j.unit_name} · ${j.request_no}` : j.unit_name}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {j.request_action_name ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/12 text-orange-700">
                        {j.request_action_name}
                      </span>
                    ) : null}
                    <JobUrgencyBadge job={j} compact />
                    <StatusBadge status={j.status} type="job" />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {j.job_description_code_1 ? `${j.job_description_code_1} · ` : ''}
                  {j.resigned_employee_name ? `ลาออก: ${j.resigned_employee_name} · ` : ''}
                  ต้องการ {formatYmdDmyBe(j.required_date)}
                  {j.siamraj_status ? ` · ST: ${j.siamraj_status}` : ''}
                </div>
                {j.total_penalty > 0 && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-destructive">
                    <AlertTriangle className="w-3 h-3" /> ค่าปรับ: ฿{j.total_penalty.toLocaleString()}
                  </div>
                )}
              </motion.button>
            ))}
            {scopedJobs.length === 0 && !loading ? (
              <p className="text-sm text-muted-foreground text-center py-6">ไม่มีใบขอในขอบเขตนี้</p>
            ) : null}
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
