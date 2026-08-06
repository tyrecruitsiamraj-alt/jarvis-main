import React from 'react';
import { cn } from '@/lib/utils';
import { TONE, type ToneKey } from '@/lib/designTokens';
import type { DashboardSlaStatus, DashboardTaskStatus } from '@/lib/dashboard/types';
import { DASHBOARD_STATUS_LABELS } from '@/lib/dashboard/buildDashboardData';

/** ป้ายสถานะ/SLA ใช้ชิปกลาง (jarvis-chip-*) ผ่าน token — เดิมประกาศสีเองและไม่มีคู่ dark mode */
const STATUS_TONE: Record<DashboardTaskStatus, ToneKey> = {
  pending: 'neutral',
  in_progress: 'primary',
  completed: 'success',
  overdue: 'danger',
  cancelled: 'neutral',
  at_risk: 'warn',
};

const SLA_TONE: Record<DashboardSlaStatus, ToneKey> = {
  on_track: 'success',
  at_risk: 'warn',
  breached: 'danger',
  closed_on_time: 'info',
  closed_late: 'orange',
};

const SLA_LABELS: Record<DashboardSlaStatus, string> = {
  on_track: 'On track',
  at_risk: 'At risk',
  breached: 'Breached',
  closed_on_time: 'Closed on time',
  closed_late: 'Closed late',
};

export function DashboardStatusBadge({ status }: { status: DashboardTaskStatus }) {
  return (
    <span
      className={cn(TONE[STATUS_TONE[status]].chip, 'whitespace-nowrap')}
    >
      {DASHBOARD_STATUS_LABELS[status]}
    </span>
  );
}

export function DashboardSlaBadge({ status }: { status: DashboardSlaStatus }) {
  return (
    <span
      className={cn(
        TONE[SLA_TONE[status]].chip,
        'jarvis-chip-sm uppercase tracking-wide whitespace-nowrap',
      )}
    >
      {SLA_LABELS[status]}
    </span>
  );
}
