import type { JobRequest } from '@/types';
import { isReplacementRequest, isResignationRequest } from '@/lib/dashboard/buildDashboardData';

export type LifecycleKind =
  | 'resignation'
  | 'replacement'
  | 'increase_headcount'
  | 'new_site'
  | 'other';

export const LIFECYCLE_KIND_LABELS: Record<LifecycleKind, string> = {
  resignation: 'ลาออก',
  replacement: 'เปลี่ยนตัว',
  increase_headcount: 'เพิ่มอัตรา',
  new_site: 'เปิดไซต์',
  other: 'อื่นๆ',
};

function actionText(job: JobRequest): string {
  return (job.request_action_name || '').trim();
}

/** จำแนกประเภทใบขอตาม request_action_name */
export function classifyLifecycleKind(job: JobRequest): LifecycleKind {
  const action = actionText(job);
  if (/ลาออก|resign/i.test(action) || isResignationRequest(job)) return 'resignation';
  if (/เปลี่ยนตัว|replacement/i.test(action) || isReplacementRequest(job)) return 'replacement';
  if (/เพิ่มอัตรา/i.test(action)) return 'increase_headcount';
  if (/เปิดไซต์/i.test(action)) return 'new_site';
  return 'other';
}

export function lifecycleKindLabel(kind: LifecycleKind, requestActionName?: string): string {
  if (kind === 'other' && requestActionName?.trim()) return requestActionName.trim();
  return LIFECYCLE_KIND_LABELS[kind];
}
