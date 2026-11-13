import { apiFetch } from './apiFetch';
import type { JobPostActionsSummary, JobPostLinkOrigin } from './jobPostActions';
import type { SoPostGroupRow, SoPostGroupStatus } from './soPostGroups';

/** "ทำอะไรไปแล้ว" ของใบขอ (13 พ.ย. 2569) — พังโยนข้อความไทยจาก server */
async function readError(r: Response): Promise<never> {
  const data = (await r.json().catch(() => ({}))) as { message?: string };
  throw new Error(data.message || `ระบบตอบ ${r.status}`);
}

export async function fetchJobPostActions(): Promise<Record<string, JobPostActionsSummary>> {
  const r = await apiFetch('/api/job-post-actions');
  if (!r.ok) return readError(r);
  return ((await r.json()) as { byJob: Record<string, JobPostActionsSummary> }).byJob;
}

export type JobPostActionsDetail = {
  summary: JobPostActionsSummary;
  links: Array<{ id: string; origin: JobPostLinkOrigin; code: string; channel_label: string | null; created_at: string; created_by_name: string | null; clicks: number; applicants: number }>;
  orders: Array<{ request_type: 'content' | 'scraping'; status: string; created_at: string; requested_by_name: string | null; notes: string | null }>;
  groups: { statuses: SoPostGroupStatus[]; rows: SoPostGroupRow[]; error: string | null };
};

export async function fetchJobPostActionsDetail(jobId: string): Promise<JobPostActionsDetail> {
  const r = await apiFetch(`/api/job-post-actions?job=${encodeURIComponent(jobId)}`);
  if (!r.ok) return readError(r);
  return (await r.json()) as JobPostActionsDetail;
}
