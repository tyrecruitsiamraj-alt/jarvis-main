import React from 'react';
import type { JobRequest } from '@/types';
import { computeJobUrgency, requestStatusLabel, type JobUrgencyMeta } from '@/lib/jobUrgency';
import { REQUEST_LEAD_KIND_TONE } from '@/lib/requestLeadKind';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

type Props = {
  job: JobRequest;
  className?: string;
  compact?: boolean;
};

/**
 * 🔴 สีมาจาก `REQUEST_LEAD_KIND_TONE` ที่เดียว — เดิม `advance` เขียนเป็น `text-info` (ฟ้า)
 * ทำให้คำว่า "ล่วงหน้า" บนหน้าเดียวกันมีทั้งเขียว (ช่องผ่านมา) และฟ้า (ช่องนี้)
 * เจ้าของสั่ง 19 ส.ค. 2569: *"อันไหนมัน Logic เดียวกันก็ไปทางเดียวกัน ป้องกัน user งง"*
 */
function statusStyle(kind: JobUrgencyMeta['kind']): string {
  return TONE[REQUEST_LEAD_KIND_TONE[kind]].value;
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
      {/* 🟢 = ล่วงหน้า (สีเดียวกับตัวหนังสือ) · 🔴 = ต้องรีบ — เดิมเป็น 🔵 ขัดกับสีเขียว */}
      {!compact && hot ? '🔴' : !compact && meta.kind === 'advance' ? '🟢' : null}
      {label}
    </span>
  );
};

export default JobUrgencyBadge;
