import { formatYmdDmyBe } from '@/lib/dateTh';
import { jobPositionUnits } from '@/lib/jobPositionUnits';
import { DASHBOARD_STATUS_LABELS, mapJobToTaskStatus } from '@/lib/dashboard/buildDashboardData';
import { REQUEST_CONTROL_STATUS_LABELS } from '@/lib/requestControl';
import type { RequestControlRecord } from '@/lib/requestControl';
import { lifecycleKindLabel } from '@/lib/dashboard/lifecycle';
import { JOB_TYPE_LABELS, type JobRequest } from '@/types';

export type DashboardDetailDialogItem = {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'destructive' | 'info';
  onClick?: () => void;
};

function statusBadgeVariant(
  status: ReturnType<typeof mapJobToTaskStatus>,
): DashboardDetailDialogItem['badgeVariant'] {
  switch (status) {
    case 'completed':
      return 'success';
    case 'overdue':
      return 'destructive';
    case 'at_risk':
      return 'warning';
    case 'cancelled':
      return 'default';
    default:
      return 'info';
  }
}

export function controlRecordToDashboardDetailItem(
  rec: RequestControlRecord,
  onOpen: (job: JobRequest) => void,
): DashboardDetailDialogItem {
  const job = rec.job;
  const positionParts = [job.job_description_code_1, job.job_description_code_2].filter(Boolean).join(' / ');
  const roleLabel = positionParts || JOB_TYPE_LABELS[job.job_type];

  return {
    id: rec.id,
    title: `${rec.unitName ?? '—'} (${rec.requestNo})`,
    subtitle: [
      lifecycleKindLabel(rec.lifecycleKind, rec.requestActionName),
      rec.requestActionName,
      `ขอ ${rec.requestPositions} · ปิดได้ ${rec.filledPositions} · ยกเลิก ${rec.cancelledPositions} · เหลือ ${rec.remainingPositions}`,
      rec.slaDueDate ? `SLA ${formatYmdDmyBe(rec.slaDueDate)}` : null,
      roleLabel,
    ]
      .filter(Boolean)
      .join(' · '),
    badge: REQUEST_CONTROL_STATUS_LABELS[rec.controlStatus],
    badgeVariant:
      rec.controlStatus === 'fully_closed'
        ? 'success'
        : rec.slaStatus === 'breached'
          ? 'destructive'
          : rec.controlStatus === 'partial'
            ? 'warning'
            : 'info',
    onClick: () => onOpen(job),
  };
}

export function jobToDashboardDetailItem(
  job: JobRequest,
  onOpen: (job: JobRequest) => void,
  today = new Date(),
): DashboardDetailDialogItem {
  const status = mapJobToTaskStatus(job, today);
  const positionParts = [job.job_description_code_1, job.job_description_code_2].filter(Boolean).join(' / ');
  const roleLabel = positionParts || JOB_TYPE_LABELS[job.job_type];
  const actionLabel = job.request_action_name ? ` • ${job.request_action_name}` : '';

  return {
    id: job.id,
    title: job.request_no ? `${job.unit_name} (${job.request_no})` : job.unit_name,
    subtitle: `${roleLabel}${actionLabel} • ต้องการ ${formatYmdDmyBe(job.required_date)} • ${jobPositionUnits(job)} ตำแหน่ง`,
    badge: DASHBOARD_STATUS_LABELS[status],
    badgeVariant: statusBadgeVariant(status),
    onClick: () => onOpen(job),
  };
}
