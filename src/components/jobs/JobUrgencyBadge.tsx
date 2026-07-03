import React from 'react';
import type { JobRequest } from '@/types';
import { computeJobUrgency, requestStatusLabel, type JobUrgencyMeta } from '@/lib/jobUrgency';
import { cn } from '@/lib/utils';

type Props = {
  job: JobRequest;
  className?: string;
  compact?: boolean;
};

function statusStyle(kind: JobUrgencyMeta['kind']): string {
  switch (kind) {
    case 'retroactive':
      return 'text-destructive';
    case 'urgent':
      return 'text-destructive';
    case 'advance':
      return 'text-info';
    default:
      return 'text-muted-foreground';
  }
}

function statusHint(meta: JobUrgencyMeta): string {
  switch (meta.kind) {
    case 'retroactive':
      return 'ฉุกเฉิน/ย้อนหลัง: วันที่ต้องการอยู่ก่อนวันที่กรอกใบขอ';
    case 'urgent':
      return 'ฉุกเฉิน: วันที่กรอกถึงวันที่ต้องการน้อยกว่า 7 วัน';
    case 'advance':
      return 'ล่วงหน้า: วันที่กรอกถึงวันที่ต้องการ 7 วันขึ้นไป';
    default:
      return '';
  }
}

const JobUrgencyBadge: React.FC<Props> = ({ job, className, compact }) => {
  const meta = computeJobUrgency(job);
  const label = requestStatusLabel(meta.kind);
  const hot = meta.kind === 'retroactive' || meta.kind === 'urgent';

  return (
    <span
      title={statusHint(meta)}
      className={cn('inline-flex items-center gap-1 text-xs font-medium', statusStyle(meta.kind), className)}
    >
      {!compact && hot ? '🔴' : !compact && meta.kind === 'advance' ? '🔵' : null}
      {label}
    </span>
  );
};

export default JobUrgencyBadge;
