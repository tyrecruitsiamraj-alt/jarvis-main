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
import { apiFetch } from '@/lib/apiFetch';
import { requestNoOf } from '@/lib/jobKeyIndex';

export type JobRelease = {
  job_id: string;
  released_at: string;
  released_by_name: string | null;
  request_no: string | null;
  note: string | null;
};

async function readError(r: Response, fallback: string): Promise<never> {
  const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
  throw new Error(data.message || data.error || `${fallback} (HTTP ${r.status})`);
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
 * ใบนี้ปล่อยแล้วไหม — เทียบ **ทั้ง id เต็มและเลขที่ใบขอ**
 *
 * 🔴 เหตุผลเดียวกับฝั่ง server: feed ให้ใบล่วงหน้าเป็น `siamraj-pre:XXX` แต่ของฝั่งเรา
 * บางที่เก็บ `siamraj-sql:XXX` — เทียบ id เต็มอย่างเดียวจะพลาดใบล่วงหน้าทั้งกอง
 * (กับดักเดิมของโปรเจกต์ที่ทำให้ชิป "ปล่อยลิงก์แล้ว" ไม่ติดกับใบล่วงหน้า)
 */
export function buildReleaseIndex(releases: JobRelease[]): {
  has: (jobId: string) => boolean;
  count: number;
} {
  const ids = new Set<string>();
  const nos = new Set<string>();
  for (const r of releases) {
    ids.add(r.job_id);
    const no = (r.request_no || requestNoOf(r.job_id)).trim();
    if (no) nos.add(no);
  }
  return {
    has: (jobId: string) => ids.has(jobId) || nos.has(requestNoOf(jobId)),
    count: releases.length,
  };
}

/**
 * `siamraj-sql:OPL6908001` → `OPL6908001`
 * ⚠️ **แหล่งเดียวอยู่ที่ `jobKeyIndex.ts`** — re-export ไว้เพื่อไม่ให้ผู้เรียกเดิมพัง
 * (เคยมีตัวนี้สองก๊อปปี้ ฝั่ง client/server · ห้ามงอกตัวที่สาม)
 */
export { requestNoOf } from '@/lib/jobKeyIndex';
