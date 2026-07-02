import React from 'react';
import type { JobRequest } from '@/types';
import { computeJobUrgency, urgencyDisplayLabel } from '@/lib/jobUrgency';
import { cn } from '@/lib/utils';

type Props = {
  job: JobRequest;
  className?: string;
  compact?: boolean;
};

const JobUrgencyBadge: React.FC<Props> = ({ job, className, compact }) => {
  const meta = computeJobUrgency(job);
  const label = urgencyDisplayLabel(meta);
  const urgent = meta.urgency === 'urgent';
  const hint = meta.escalated
    ? 'งานด่วน: เดิมเป็นล่วงหน้า แต่เหลือเวลาถึงวันที่ต้องการน้อยกว่า 7 วัน'
    : meta.urgency === 'urgent'
      ? 'ฉุกเฉิน: วันที่ส่งถึงวันที่ต้องการน้อยกว่า 7 วัน'
      : 'ล่วงหน้า: วันที่ส่งถึงวันที่ต้องการ 7 วันขึ้นไป';

  return (
    <span
      title={hint}
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium',
        urgent ? 'text-destructive' : 'text-info',
        className,
      )}
    >
      {!compact && (urgent ? '🔴' : '🔵')}
      {label}
      {meta.escalated && !compact ? (
        <span className="px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive text-[10px]">ยกระดับ</span>
      ) : null}
    </span>
  );
};

export default JobUrgencyBadge;
