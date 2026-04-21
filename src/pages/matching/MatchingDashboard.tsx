import React, { useMemo, useState } from 'react';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { JOB_TYPE_LABELS, JOB_CATEGORY_LABELS, type JobRequest } from '@/types';
import { Users, Search, ClipboardCheck, Briefcase, type LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDemoAwareJobs } from '@/hooks/useDemoAwareJobs';
import { useDemoAwareCandidates } from '@/hooks/useDemoAwareCandidates';
import { CANDIDATE_STATUS_LABELS, type CandidateStatus } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const TOP_N = 10;

const CANDIDATE_STATUS_SUMMARY_ORDER: CandidateStatus[] = [
  'inprocess',
  'waiting_interview',
  'waiting_to_start',
  'done',
  'drop',
  'no_job',
];

function sortByRequiredDate(a: JobRequest, b: JobRequest) {
  return new Date(a.required_date).getTime() - new Date(b.required_date).getTime();
}

function JobRow({ job, onOpen }: { job: JobRequest; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left rounded-lg border border-border/80 bg-secondary/20 hover:bg-primary/10 hover:border-primary/30 px-3 py-2 transition-colors"
    >
      <div className="font-medium text-foreground text-sm line-clamp-1">{job.unit_name}</div>
      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
        <span>ต้องการ {formatYmdDmyBe(job.required_date)}</span>
        <span className={cn(job.urgency === 'urgent' ? 'text-destructive' : 'text-info')}>
          {job.urgency === 'urgent' ? 'ด่วน' : 'ล่วงหน้า'}
        </span>
        <span>{JOB_TYPE_LABELS[job.job_type]}</span>
      </div>
    </button>
  );
}

const MatchingDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { jobs, loading: loadingJobs } = useDemoAwareJobs();
  const { candidates: matchCandidates, loading: loadingMatchCandidates } = useDemoAwareCandidates();
  const [allJobsOpen, setAllJobsOpen] = useState(false);

  const candidateStatusCounts = useMemo(() => {
    const counts: Record<CandidateStatus, number> = {
      inprocess: 0,
      waiting_interview: 0,
      waiting_to_start: 0,
      done: 0,
      drop: 0,
      no_job: 0,
    };
    matchCandidates.forEach((c) => {
      counts[c.status] += 1;
    });
    return counts;
  }, [matchCandidates]);

  const urgentTop = useMemo(
    () =>
      jobs
        .filter((j) => j.urgency === 'urgent' && j.status !== 'cancelled')
        .sort(sortByRequiredDate)
        .slice(0, TOP_N),
    [jobs],
  );

  const nearDueTop = useMemo(
    () =>
      jobs
        .filter((j) => j.status === 'open' || j.status === 'in_progress')
        .sort(sortByRequiredDate)
        .slice(0, TOP_N),
    [jobs],
  );

  const allJobsSorted = useMemo(() => [...jobs].sort(sortByRequiredDate), [jobs]);

  const toolMenus: { path: string; label: string; icon: LucideIcon }[] = [
    { path: '/matching/match', label: 'Matching', icon: Search },
    { path: '/matching/pre-check', label: 'Pre-Check', icon: ClipboardCheck },
  ];

  const openJob = (id: string) => {
    navigate(`/jobs/${id}`);
  };

  return (
    <div>
      <PageHeader title="Matching Module" subtitle="จับคู่กับงาน" />
      <div className="px-4 md:px-6 space-y-6">
        {loadingJobs && <div className="text-sm text-muted-foreground">กำลังโหลดข้อมูลงาน...</div>}

        {/* Matching + Pre-Check */}
        <div className="grid grid-cols-2 gap-3">
          {toolMenus.map((item, i) => (
            <motion.button
              key={item.path}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(item.path)}
              className="glass-card rounded-xl p-3 border border-border hover:border-primary/40 transition-all text-center"
            >
              <item.icon className="w-5 h-5 text-primary mx-auto mb-1" />
              <div className="text-xs font-semibold text-foreground leading-tight">{item.label}</div>
            </motion.button>
          ))}
        </div>

        {/* สรุปสถานะ Candidates — กดเปิดรายการพร้อมกรอง */}
        <div className="rounded-xl border border-border/80 bg-card/40 p-3 md:p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              สรุปตามสถานะ · Candidates
            </h3>
            {loadingMatchCandidates ? (
              <span className="text-xs text-muted-foreground">กำลังโหลด…</span>
            ) : (
              <span className="text-xs text-muted-foreground">รวม {matchCandidates.length} คน</span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {CANDIDATE_STATUS_SUMMARY_ORDER.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => navigate(`/matching/candidates?status=${st}`)}
                className="rounded-lg border border-border bg-secondary/25 hover:border-primary/35 hover:bg-primary/5 p-3 text-left transition-colors"
              >
                <div className="text-[11px] font-medium text-muted-foreground leading-snug">
                  {CANDIDATE_STATUS_LABELS[st]}
                </div>
                <div className="text-2xl font-bold text-foreground tabular-nums mt-0.5">{candidateStatusCounts[st]}</div>
                <div className="text-[10px] text-muted-foreground">คน</div>
              </button>
            ))}
          </div>
        </div>

        {/* Job Request Summary — 10 ด่วน + 10 ใกล้กำหนด */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-primary" />
              Job Request Summary
            </h3>
            <Button type="button" variant="outline" size="sm" onClick={() => setAllJobsOpen(true)}>
              ดูงานทั้งหมด ({jobs.length})
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            แสดงงานด่วนและงานที่ใกล้ถึงวันที่ต้องการ อย่างละ {TOP_N} รายการแรก (เรียงตามวันที่ต้องการ)
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-destructive uppercase tracking-wide">งานด่วน</h4>
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {urgentTop.length === 0 ? (
                  <p className="text-xs text-muted-foreground">ไม่มีงานด่วน</p>
                ) : (
                  urgentTop.map((job) => <JobRow key={job.id} job={job} onOpen={() => openJob(job.id)} />)
                )}
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-info uppercase tracking-wide">ใกล้ถึงวันที่ต้องการ</h4>
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {nearDueTop.length === 0 ? (
                  <p className="text-xs text-muted-foreground">ไม่มีงานที่เปิดอยู่</p>
                ) : (
                  nearDueTop.map((job) => <JobRow key={job.id} job={job} onOpen={() => openJob(job.id)} />)
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={allJobsOpen} onOpenChange={setAllJobsOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-foreground">งานทั้งหมด</DialogTitle>
            <DialogDescription>เรียงตามวันที่ต้องการ — กดรายการเพื่อเปิดรายละเอียด</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
            {allJobsSorted.map((job) => (
              <JobRow key={job.id} job={job} onOpen={() => { setAllJobsOpen(false); openJob(job.id); }} />
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground pt-2 border-t border-border">
            สรุปตามประเภท:{' '}
            {(Object.keys(JOB_TYPE_LABELS) as Array<keyof typeof JOB_TYPE_LABELS>)
              .map((t) => `${JOB_TYPE_LABELS[t]} ${jobs.filter((j) => j.job_type === t).length}`)
              .join(' · ')}
          </div>
          <div className="text-[10px] text-muted-foreground">
            หมวด:{' '}
            {(Object.keys(JOB_CATEGORY_LABELS) as Array<keyof typeof JOB_CATEGORY_LABELS>)
              .map((c) => `${JOB_CATEGORY_LABELS[c]} ${jobs.filter((j) => j.job_category === c).length}`)
              .join(' · ')}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MatchingDashboard;
