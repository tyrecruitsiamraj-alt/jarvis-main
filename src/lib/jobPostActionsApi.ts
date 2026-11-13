import { apiFetch } from './apiFetch';
import type { JobPostActionsSummary, JobPostLinkOrigin, ManualPostDays } from './jobPostActions';
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

/** โพสต์เองรายวัน (การ์ด 6 หน้าภาพรวม · 13 พ.ย. 2569) — ช่วง/BU ตามภาพรวม */
export async function fetchManualPostDays(opts: { from: string; to: string; bu: string | null }): Promise<ManualPostDays> {
  const q = new URLSearchParams({ days: '1', from: opts.from, to: opts.to });
  if (opts.bu) q.set('bu', opts.bu);
  const r = await apiFetch(`/api/job-post-actions?${q.toString()}`);
  if (!r.ok) return readError(r);
  return (await r.json()) as ManualPostDays;
}

/** จดว่าโพสต์เองแล้ววันนี้ (กดคัดลอกข้อความของกลุ่ม/ช่องทาง · 13 พ.ย. 2569) — กดซ้ำวันเดียวกันฝั่ง server ไม่นับเพิ่ม */
export async function markManualPosted(linkId: string): Promise<void> {
  const r = await apiFetch('/api/job-post-actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ link_id: linkId }) });
  if (!r.ok) return readError(r);
}
