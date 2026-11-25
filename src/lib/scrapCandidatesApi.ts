import { apiFetch } from './apiFetch';
import { SCRAP_TO_CONTACT_MAX, type ScrapCandidateRow, type ScrapCounts, type ScrapToContactResult } from './scrapCandidates';
import { parseScrapVirtualId } from './scrapApplicants';

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

/** ยอดรายชื่อ Scrap ต่อเลขใบขอ + โทรแล้ว (19 พ.ย. 2569) — ใบที่ไม่มีในนี้ = 0 */
export type ScrapCountsByRequest = { counts: Record<string, number>; called: Record<string, number> };
export async function fetchScrapCountsByRequest(): Promise<ScrapCountsByRequest> {
  const r = await apiFetch('/api/scrap-candidates?counts=1');
  if (!r.ok) return readError(r);
  const data = (await r.json()) as Partial<ScrapCountsByRequest>;
  return { counts: data.counts ?? {}, called: data.called ?? {} };
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

/**
 * ใบเสมือนของแท็บ Scrap → ใบสมัครจริง (เจ้าของ 25 พ.ย. 2569) — ขั้นแรกของ "ส่ง AI โทร" / "เก็บไปโทรเอง" / "เก็บเข้า Lead"
 * ยิงทีละใบขอ ครั้งละไม่เกิน `SCRAP_TO_CONTACT_MAX` · ใบขอที่ล้ม (ปิดแล้ว/นอก BU) ไม่ทำให้ใบขออื่นล้ม — บอกเป็นข้อความ
 * `ids` ที่ไม่ใช่ใบเสมือนส่งผ่านไปตามเดิม
 */
export async function resolveScrapApplicationIds(
  ids: readonly string[],
  mode: 'apply' | 'to_contact' = 'apply',
): Promise<{ ids: string[]; notes: string[] }> {
  const real: string[] = [];
  const notes: string[] = [];
  const byRequest = new Map<string, string[]>();
  for (const id of ids) {
    const v = parseScrapVirtualId(id);
    if (!v) {
      real.push(id);
      continue;
    }
    const list = byRequest.get(v.requestNo) ?? [];
    list.push(v.candidateId);
    byRequest.set(v.requestNo, list);
  }
  for (const [requestNo, candidateIds] of byRequest) {
    for (let i = 0; i < candidateIds.length; i += SCRAP_TO_CONTACT_MAX) {
      const chunk = candidateIds.slice(i, i + SCRAP_TO_CONTACT_MAX);
      try {
        const r = await apiFetch('/api/scrap-candidates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: mode, job_id: requestNo, candidate_ids: chunk }),
        });
        if (!r.ok) await readError(r);
        const { results } = (await r.json()) as { results: ScrapToContactResult[] };
        for (const x of results) {
          if (x.application_id && x.outcome !== 'skipped') real.push(x.application_id);
          else if (x.note) notes.push(`${x.name || 'ไม่มีชื่อ'}: ${x.note}`);
        }
      } catch (e) {
        notes.push(`ใบขอ ${requestNo}: ${e instanceof Error ? e.message : 'ทำไม่สำเร็จ'}`);
      }
    }
  }
  return { ids: real, notes };
}
