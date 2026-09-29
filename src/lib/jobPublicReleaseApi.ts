/**
 * ปล่อย / ดึงลง ใบขอบนหน้าสาธารณะ (`/api/job-public-release`)
 *
 * เจ้าของเคาะ 22 ส.ค. 2569: **ทุกใบต้องกดปล่อย** — ใบที่ไม่มีในทะเบียนนี้จะไม่ขึ้น
 * หน้า `/apply` และ AI (Lumos) ก็ไม่เห็น
 *
 * ⚠️ ต้องส่ง **id เต็ม** (`siamraj-sql:OPL6908001`) ไม่ใช่เลขที่ใบขอเปล่า ๆ
 * ⚠️ DELETE ส่งทาง query — body ของ DELETE ไม่ถึง handler ในเซิร์ฟเวอร์ท้องถิ่น
 *    (เจอจริงตอนตรวจ 23 ส.ค. 2569)
 */
import { apiFetch, HttpError } from '@/lib/apiFetch';

export type JobRelease = {
  job_id: string;
  released_at: string;
  released_by_name: string | null;
  request_no: string | null;
  note: string | null;
};

async function readError(r: Response, fallback: string): Promise<never> {
  const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
  // พก status มาด้วย — หน้าจอต้องแยก "ไม่มีสิทธิ์" ออกจาก "ต่อไม่ติด" (ดู HttpError)
  throw new HttpError(r.status, data.message || data.error || `${fallback} (HTTP ${r.status})`);
}

export async function fetchJobReleases(): Promise<JobRelease[]> {
  const r = await apiFetch('/api/job-public-release');
  if (!r.ok) await readError(r, 'โหลดรายการใบที่ปล่อยแล้วไม่สำเร็จ');
  const data = (await r.json()) as { releases?: JobRelease[] };
  return data.releases ?? [];
}

export async function releaseJobsToPublic(jobIds: string[], note?: string): Promise<number> {
  const r = await apiFetch('/api/job-public-release', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobIds, note }),
  });
  if (!r.ok) await readError(r, 'ปล่อยใบขอไม่สำเร็จ');
  const data = (await r.json()) as { count?: number };
  return data.count ?? 0;
}

export async function unreleaseJobsFromPublic(jobIds: string[]): Promise<number> {
  const qs = jobIds.map((id) => `jobId=${encodeURIComponent(id)}`).join('&');
  const r = await apiFetch(`/api/job-public-release?${qs}`, { method: 'DELETE' });
  if (!r.ok) await readError(r, 'ดึงใบขอลงไม่สำเร็จ');
  const data = (await r.json()) as { count?: number };
  return data.count ?? 0;
}

/**
 * ใบนี้ปล่อยแล้วไหม — ตัวจริงย้ายไป `@/lib/jobReleaseIndex` (29 ก.ย. 2569 · ให้ฝั่ง server ใช้ตัวเดียวกัน)
 * re-export ไว้ที่นี่ ผู้เรียกเดิมไม่ต้องแก้
 */
export { buildReleaseIndex } from '@/lib/jobReleaseIndex';

/**
 * `siamraj-sql:OPL6908001` → `OPL6908001`
 * ⚠️ **แหล่งเดียวอยู่ที่ `jobKeyIndex.ts`** — re-export ไว้เพื่อไม่ให้ผู้เรียกเดิมพัง
 * (เคยมีตัวนี้สองก๊อปปี้ ฝั่ง client/server · ห้ามงอกตัวที่สาม)
 */
export { requestNoOf } from '@/lib/jobKeyIndex';
