import React from 'react';
import { cn } from '@/lib/utils';
import type { DashboardSlaStatus, DashboardTaskStatus } from '@/lib/dashboard/types';
import { DASHBOARD_STATUS_LABELS } from '@/lib/dashboard/buildDashboardData';

const STATUS_STYLES: Record<DashboardTaskStatus, string> = {
  pending: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  overdue: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  at_risk: 'bg-amber-50 text-amber-800 border-amber-200',
};

const SLA_STYLES: Record<DashboardSlaStatus, string> = {
  on_track: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  at_risk: 'bg-amber-50 text-amber-800 border-amber-200',
  breached: 'bg-red-50 text-red-700 border-red-200',
};

const SLA_LABELS: Record<DashboardSlaStatus, string> = {
  on_track: 'On track',
  at_risk: 'At risk',
  breached: 'Breached',
};

export function DashboardStatusBadge({ status }: { status: DashboardTaskStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        STATUS_STYLES[status],
      )}
    >
      {DASHBOARD_STATUS_LABELS[status]}
    </span>
  );
}

export function DashboardSlaBadge({ status }: { status: DashboardSlaStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide whitespace-nowrap',
        SLA_STYLES[status],
      )}
    >
      {SLA_LABELS[status]}
    </span>
  );
}
