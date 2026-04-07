import React from 'react';
import { cn } from '@/lib/utils';
import { WorkStatus, CandidateStatus, JobStatus, WORK_STATUS_LABELS, CANDIDATE_STATUS_LABELS } from '@/types';

type BadgeVariant = 'success' | 'destructive' | 'warning' | 'info' | 'muted' | 'primary';

const workStatusVariants: Record<WorkStatus, BadgeVariant> = {
  normal_work: 'success',
  cancel_by_employee: 'destructive',
  late: 'warning',
  cancel_by_client: 'info',
  no_show: 'muted',
  day_off: 'muted',
  available: 'primary',
};

const candidateStatusVariants: Record<CandidateStatus, BadgeVariant> = {
  inprocess: 'info',
  drop: 'destructive',
  done: 'success',
  waiting_interview: 'warning',
  waiting_to_start: 'primary',
  no_job: 'muted',
};

const jobStatusVariants: Record<JobStatus, BadgeVariant> = {
  open: 'warning',
  in_progress: 'warning',
  closed: 'success',
  cancelled: 'destructive',
};

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-success/15 text-success border-success/30',
  destructive: 'bg-destructive/15 text-destructive border-destructive/30',
  warning: 'bg-warning/15 text-warning border-warning/30',
  info: 'bg-info/15 text-info border-info/30',
  muted: 'bg-muted text-muted-foreground border-border',
  primary: 'bg-primary/15 text-primary border-primary/30',
};

interface StatusBadgeProps {
  status: WorkStatus | CandidateStatus | JobStatus;
  type: 'work' | 'candidate' | 'job';
  className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type, className }) => {
  let variant: BadgeVariant = 'muted';
  let label: string = status;

  if (type === 'work') {
    variant = workStatusVariants[status as WorkStatus] || 'muted';
    label = WORK_STATUS_LABELS[status as WorkStatus] || status;
  } else if (type === 'candidate') {
    variant = candidateStatusVariants[status as CandidateStatus] || 'muted';
    label = CANDIDATE_STATUS_LABELS[status as CandidateStatus] || status;
  } else if (type === 'job') {
    variant = jobStatusVariants[status as JobStatus] || 'muted';
    const jobLabels: Record<string, string> = {
      open: 'ดำเนินการ',
      in_progress: 'ดำเนินการ',
      closed: 'ปิดแล้ว',
      cancelled: 'ดำเนินการ',
    };
    label = jobLabels[status] || status;
  }

  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', variantStyles[variant], className)}>
      {label}
    </span>
  );
};

export default StatusBadge;
