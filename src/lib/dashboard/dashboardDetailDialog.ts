import { formatYmdDmyBe } from '@/lib/dateTh';
import { jobPositionUnits } from '@/lib/jobPositionUnits';
import { DASHBOARD_STATUS_LABELS, mapJobToTaskStatus } from '@/lib/dashboard/buildDashboardData';
import { REQUEST_CONTROL_STATUS_LABELS } from '@/lib/requestControl';
import type { RequestControlRecord } from '@/lib/requestControl';
import { lifecycleKindLabel } from '@/lib/dashboard/lifecycle';
import { JOB_TYPE_LABELS, type JobRequest } from '@/types';
import type { CohortDrillKpi, CohortDrillRow } from '@/lib/dashboard/cohortDrillDown';
import { REQUEST_LEAD_KIND_LABEL } from '@/lib/requestLeadKind';

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

const COHORT_KPI_BADGE: Record<CohortDrillKpi, { label: string; variant: DashboardDetailDialogItem['badgeVariant'] }> = {
  total_requests: { label: 'เข้ามา', variant: 'info' },
  closed: { label: 'ปิดได้', variant: 'success' },
  cancelled: { label: 'ยกเลิก', variant: 'default' },
  remaining: { label: 'คงเหลือ', variant: 'warning' },
};

/**
 * รายการ drill-down ของการ์ด เข้ามา/ปิดได้/ยกเลิก/คงเหลือ — สร้างจาก `CohortDrillRow`
 * (ชุดเดียวกับที่เลขบนการ์ดนับ) ไม่ใช่จากกองใบเปิดในกล่องงาน
 *
 * `onOpen` ไม่มี = ใบนั้นเปิดหน้าไม่ได้ (ไม่รู้ id เต็ม) — โชว์ข้อมูลเฉย ๆ ไม่หลอกว่ากดได้
 */
export function cohortRowToDashboardDetailItem(
  row: CohortDrillRow,
  kpi: CohortDrillKpi,
  onOpen?: () => void,
): DashboardDetailDialogItem {
  const badge = COHORT_KPI_BADGE[kpi];
  const buckets = [
    `ขอ ${row.requestPositions.toLocaleString('th-TH')}`,
    `ปิดได้ ${row.filledPositions.toLocaleString('th-TH')}`,
    `ยกเลิก ${row.cancelledPositions.toLocaleString('th-TH')}`,
    `เหลือ ${row.remainingPositions.toLocaleString('th-TH')}`,
  ].join(' · ');
  /**
   * เจ้าของสั่ง 18 ส.ค. 2569: *"กดดูแล้วโชว์หน่วยงาน บอกหน่อยว่าเป็นงานล่วงหน้าหรือฉุกเฉิน"*
   * — ขึ้นเป็นคำแรกของบรรทัดรอง พร้อมวันที่ต้องการคน จะได้เห็นว่าทำไมถึงเร่ง
   */
  const leadLabel = REQUEST_LEAD_KIND_LABEL[row.leadKind];
  return {
    id: row.jobId ?? row.requestNo,
    title: `${row.unitName ?? '—'} (${row.requestNoDisplay})`,
    subtitle: [
      leadLabel,
      `เข้ามา ${formatYmdDmyBe(row.requestDate)}`,
      row.requiredDate ? `ต้องการ ${formatYmdDmyBe(row.requiredDate)}` : null,
      row.requestActionName,
      buckets,
      row.siteCode ? `ไซต์ ${row.siteCode}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    badge: `${badge.label} ${row.positions.toLocaleString('th-TH')}`,
    badgeVariant: badge.variant,
    onClick: onOpen,
  };
}
