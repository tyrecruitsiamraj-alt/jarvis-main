import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { formatYmdDmyBe } from '@/lib/dateTh';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import DetailListDialog from '@/components/shared/DetailListDialog';
import { JOB_TYPE_LABELS, type JobRequest } from '@/types';
import { Briefcase, Plus, AlertTriangle, CheckCircle, ListTodo } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';
import { navigateToUnitRequest } from '@/lib/jobNavigation';

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
  return {
    id: j.id,
    title: j.request_no ? `${j.unit_name} (${j.request_no})` : j.unit_name,
    subtitle: `${j.request_action_name || JOB_TYPE_LABELS[j.job_type]}${actionLabel} • ต้องการ ${formatYmdDmyBe(j.required_date)}`,
    badge,
    badgeVariant,
    onClick: () => onNavigate(j),
  };
}

const JobDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { jobs, loading, siamrajPrimary, readOnly } = useUnitRequestsFeed();
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [jobDialogTitle, setJobDialogTitle] = useState('');
  const [jobDialogItems, setJobDialogItems] = useState<JobDialogItem[]>([]);

  const closedJobs = useMemo(() => jobs.filter((j) => j.status === 'closed'), [jobs]);
  const activeJobs = useMemo(() => jobs.filter((j) => j.status !== 'closed'), [jobs]);

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
        subtitle={siamrajPrimary ? 'อ่านใบขอจาก Siamraj (so-operation) — อัปเดตอัตโนมัติเมื่อมีการคีย์' : 'จัดการหน่วยงานและใบขอ'}
        actions={
          !readOnly && hasPermission('staff') ? (
            <button onClick={() => navigate('/jobs/add')} className="flex items-center gap-1 px-3 py-2 jarvis-pill-btn text-sm">
              <Plus className="w-4 h-4" /> สร้างงานใหม่
            </button>
          ) : undefined
        }
      />
      <div className="px-4 md:px-6 space-y-6">
        {loading && <div className="text-sm text-muted-foreground">กำลังโหลดงาน...</div>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            title="งานทั้งหมด"
            value={jobs.length}
            icon={Briefcase}
            variant="primary"
            onClick={() => openJobList('งานทั้งหมด', jobs)}
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

        {/* Quick nav */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => navigate('/jobs/list')}
            className="flex-1 glass-card rounded-[1.5rem] p-4 border border-white/70 hover:border-orange-300/50 text-center"
          >
            <Briefcase className="w-6 h-6 text-orange-600 mx-auto mb-1" />
            <div className="text-sm font-semibold text-foreground">รายการงานทั้งหมด</div>
          </button>
        </div>

        {/* Recent jobs */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">งานล่าสุด</h3>
          <div className="space-y-2">
            {jobs.slice(0, 4).map(j => (
              <motion.button key={j.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                onClick={() => goToJob(j)}
                className="w-full glass-card rounded-[1.5rem] p-4 border border-white/70 text-left hover:border-orange-300/50 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-foreground text-sm">
                    {j.request_no ? `${j.unit_name} · ${j.request_no}` : j.unit_name}
                  </span>
                  <div className="flex items-center gap-2">
                    {j.request_action_name ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/12 text-orange-700">
                        {j.request_action_name}
                      </span>
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${j.urgency === 'urgent' ? 'bg-destructive/15 text-destructive' : 'bg-info/15 text-info'}`}>
                        {j.urgency === 'urgent' ? 'ด่วน' : 'ล่วงหน้า'}
                      </span>
                    )}
                    <StatusBadge status={j.status} type="job" />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {j.resigned_employee_name ? `ลาออก: ${j.resigned_employee_name} • ` : ''}
                  ต้องการ {formatYmdDmyBe(j.required_date)}
                  {j.submittedByName ? ` • ส่งโดย ${j.submittedByName}` : ''}
                </div>
                {j.total_penalty > 0 && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-destructive">
                    <AlertTriangle className="w-3 h-3" /> ค่าปรับ: ฿{j.total_penalty.toLocaleString()}
                  </div>
                )}
              </motion.button>
            ))}
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
