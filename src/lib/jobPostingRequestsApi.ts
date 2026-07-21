import { apiFetch } from '@/lib/apiFetch';

/** คำขอ "โพสหางานใหม่" — สร้าง ID ให้ทีมอื่นรับไปทำคอนเทนต์/โพสหาคนต่อ */
export type JobPostingStatus = 'pending' | 'in_progress' | 'posted' | 'completed' | 'filled' | 'cancelled';
export type JobPostingRequestType = 'content' | 'scraping';

export type JobPostingRequest = {
  id: string;
  job_id: string;
  request_no: string | null;
  request_type: JobPostingRequestType;
  status: JobPostingStatus;
  reason: string | null;
  notes: string | null;
  requested_by_user_id: string | null;
  requested_by_name: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_LABEL: Record<JobPostingStatus, string> = {
  pending: 'รอดำเนินการ',
  in_progress: 'กำลังทำ',
  posted: 'โพสแล้ว',
  completed: 'ตรวจรับแล้ว',
  filled: 'ได้คนแล้ว',
  cancelled: 'ยกเลิก',
};

export function jobPostingStatusLabel(status: JobPostingStatus): string {
  return STATUS_LABEL[status] ?? status;
}

async function readError(r: Response, fallback: string): Promise<never> {
  const d = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
  throw new Error(d.message || d.error || `${fallback} (HTTP ${r.status})`);
}

export async function getActiveJobPostingForJob(jobId: string): Promise<JobPostingRequest | null> {
  const r = await apiFetch(`/api/matching/job-postings?jobId=${encodeURIComponent(jobId)}`);
  if (!r.ok) return null;
  const d = (await r.json().catch(() => ({}))) as { item?: JobPostingRequest | null };
  return d.item ?? null;
}

export async function listJobPostingRequests(status?: JobPostingStatus): Promise<JobPostingRequest[]> {
  const params = status ? `?status=${encodeURIComponent(status)}` : '';
  const r = await apiFetch(`/api/matching/job-postings${params}`);
  if (!r.ok) return [];
  const d = (await r.json().catch(() => ({}))) as { items?: JobPostingRequest[] };
  return d.items ?? [];
}

export async function createJobPostingRequest(input: {
  jobId: string;
  requestNo?: string | null;
  reason?: string | null;
  requestType?: JobPostingRequestType;
}): Promise<JobPostingRequest> {
  const r = await apiFetch('/api/matching/job-postings', {
    method: 'POST',
    body: JSON.stringify({
      job_id: input.jobId,
      request_no: input.requestNo ?? null,
      reason: input.reason ?? null,
      request_type: input.requestType ?? 'content',
    }),
  });
  if (!r.ok) return readError(r, 'สร้างคำขอไม่สำเร็จ');
  return (await r.json()) as JobPostingRequest;
}

export async function updateJobPostingStatus(
  id: string,
  status: JobPostingStatus,
  notes?: string | null,
): Promise<JobPostingRequest> {
  const r = await apiFetch(`/api/matching/job-postings?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, ...(notes !== undefined ? { notes } : {}) }),
  });
  if (!r.ok) return readError(r, 'อัปเดตสถานะไม่สำเร็จ');
  return (await r.json()) as JobPostingRequest;
}
