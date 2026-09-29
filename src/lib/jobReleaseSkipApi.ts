/**
 * ตั้ง / ยกเลิก "ไม่ปล่อย + เหตุผล" ของใบขอ (`/api/job-release-skip` · migration 129 · 29 ก.ย. 2569)
 * นิยาม/เหตุผล/ตัวตรวจ อยู่ที่ `@/lib/jobReleaseSkips` (pure) · ไฟล์นี้ยิงเส้นอย่างเดียว
 * ⚠️ ต้องส่ง **id เต็ม** ของใบ · DELETE ส่งทาง query (บทเรียนทะเบียนปล่อย)
 */
import { apiFetch, HttpError } from '@/lib/apiFetch';
import type { JobReleaseSkip, ReleaseSkipReason } from '@/lib/jobReleaseSkips';

async function readError(r: Response, fallback: string): Promise<never> {
  const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
  throw new HttpError(r.status, data.message || data.error || `${fallback} (HTTP ${r.status})`);
}

export async function fetchReleaseSkips(): Promise<JobReleaseSkip[]> {
  const r = await apiFetch('/api/job-release-skip');
  if (!r.ok) await readError(r, 'โหลดรายการใบที่ไม่ปล่อยไม่สำเร็จ');
  const data = (await r.json()) as { skips?: JobReleaseSkip[] };
  return data.skips ?? [];
}

export async function markReleaseSkip(jobId: string, reason: ReleaseSkipReason, note: string | null): Promise<JobReleaseSkip> {
  const r = await apiFetch('/api/job-release-skip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, reason, note }),
  });
  if (!r.ok) await readError(r, 'บันทึก “ไม่ปล่อย” ไม่สำเร็จ');
  const data = (await r.json()) as { skip: JobReleaseSkip };
  return data.skip;
}

export async function clearReleaseSkip(jobId: string): Promise<number> {
  const r = await apiFetch(`/api/job-release-skip?jobId=${encodeURIComponent(jobId)}`, { method: 'DELETE' });
  if (!r.ok) await readError(r, 'ยกเลิก “ไม่ปล่อย” ไม่สำเร็จ');
  const data = (await r.json()) as { count?: number };
  return data.count ?? 0;
}
