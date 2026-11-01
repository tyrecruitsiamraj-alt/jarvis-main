import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { JobRequest } from '@/types';
import { jobSlaCell, SLA_CELL_LABEL, SLA_CELL_SHORT, SLA_CELL_TONE } from '@/lib/dashboard/slaByLeadKind';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

/**
 * ป้าย SLA รายใบ — เขียว ยังทัน/ปิดทัน · เหลือง เสี่ยง · แดง เกินแล้ว/ปิดไม่ทัน
 * (เจ้าของ 1 พ.ย. 2569 "แนวโน้มบวกเป็นเขียว แดง เหลือง ให้ดูง่ายๆ")
 * ตัวตัดสินเดียวกับตาราง "ปิดทัน / ไม่ทัน ตามชนิดใบขอ" ใน Dashboard
 */
const JobSlaBadge: React.FC<{ job: JobRequest; className?: string }> = ({ job, className }) => {
  const cell = jobSlaCell(job);
  return (
    <Badge
      variant="outline"
      title={SLA_CELL_LABEL[cell]}
      className={cn('whitespace-nowrap font-medium', TONE[SLA_CELL_TONE[cell]].outline, className)}
    >
      {SLA_CELL_SHORT[cell]}
    </Badge>
  );
};

export default JobSlaBadge;
