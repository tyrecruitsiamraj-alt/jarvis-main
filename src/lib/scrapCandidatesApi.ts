import { apiFetch } from './apiFetch';
import type { ScrapCandidateRow, ScrapCounts, ScrapToContactResult } from './scrapCandidates';

/** รายชื่อจาก Scrap (17 พ.ย. 2569) — พังโยนข้อความไทยจาก server */
async function readError(r: Response): Promise<never> {
  const data = (await r.json().catch(() => ({}))) as { message?: string };
  throw new Error(data.message || `ระบบตอบ ${r.status}`);
}

export type ScrapCandidatesOfJob = { request_no: string | null; counts: ScrapCounts; rows: ScrapCandidateRow[] };
export type ScrapCandidatesAll = { requests: Array<{ request_no: string; total: number }>; counts: ScrapCounts; rows: ScrapCandidateRow[] };

export async function fetchScrapCandidatesOfJob(jobId: string): Promise<ScrapCandidatesOfJob> {
  const r = await apiFetch(`/api/scrap-candidates?job=${encodeURIComponent(jobId)}`);
  if (!r.ok) return readError(r);
  return (await r.json()) as ScrapCandidatesOfJob;
}

export async function fetchScrapCandidatesAll(): Promise<ScrapCandidatesAll> {
  const r = await apiFetch('/api/scrap-candidates?all=1');
  if (!r.ok) return readError(r);
  return (await r.json()) as ScrapCandidatesAll;
}

/** ยอดรายชื่อ Scrap ต่อเลขใบขอ — ใบที่ไม่มีในนี้ = 0 */
export async function fetchScrapCountsByRequest(): Promise<Record<string, number>> {
  const r = await apiFetch('/api/scrap-candidates?counts=1');
  if (!r.ok) return readError(r);
  return ((await r.json()) as { counts: Record<string, number> }).counts;
}

/** ลิงก์แท็บผู้สมัคร ▾ Scrap ของหน้างานสรรหา เลือกใบขอไว้ให้ */
export const SCRAP_REQUEST_PARAM = 'scrap_req';
export function boardScrapPathOfRequest(requestNo: string): string {
  return `/jobs/board?view=scrap&${SCRAP_REQUEST_PARAM}=${encodeURIComponent(requestNo)}`;
}

export async function addScrapCandidatesToContact(jobId: string, candidateIds: string[]): Promise<ScrapToContactResult[]> {
  const r = await apiFetch('/api/scrap-candidates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'to_contact', job_id: jobId, candidate_ids: candidateIds }),
  });
  if (!r.ok) return readError(r);
  return ((await r.json()) as { results: ScrapToContactResult[] }).results;
}
