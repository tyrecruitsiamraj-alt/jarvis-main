import { apiFetch } from '@/lib/apiFetch';
import { readJsonSafe } from '@/lib/api';

/**
 * "คนนี้แมทอยู่กี่งาน งานไหนบ้าง" — client ของ GET /api/matching/candidate-job-matches
 *
 * ใช้ทำป้าย "แมทอยู่ N งาน" บนรายชื่อผู้สมัคร และ popup เลือกงานตอนส่งโทร
 * (เจ้าของสั่ง 12 ส.ค. 2569) · นับเฉพาะใบขอเปิดใน BU scope + tier เขียว/เหลือง
 */
export type CandidateJobMatchItem = {
  jobId: string;
  requestNo: string | null;
  position: string;
  unit: string | null;
  tier: 'green' | 'yellow';
};

/**
 * โหลดรายการงานที่แต่ละ card แมทอยู่ — โหลดไม่ได้คืน {} (ป้ายแค่ไม่ขึ้น ไม่พังหน้า)
 * แบ่งก้อนละ 300 ตามเพดานของ API (แพตเทิร์นเดียวกับ candidateScreeningApi)
 */
export async function fetchCandidateJobMatches(
  cardIds: number[],
): Promise<Record<string, CandidateJobMatchItem[]>> {
  const out: Record<string, CandidateJobMatchItem[]> = {};
  for (let i = 0; i < cardIds.length; i += 300) {
    const chunk = cardIds.slice(i, i + 300);
    if (chunk.length === 0) continue;
    try {
      const r = await apiFetch(`/api/matching/candidate-job-matches?cards=${chunk.join(',')}`);
      if (!r.ok) continue;
      const data = await readJsonSafe<{ items?: Record<string, CandidateJobMatchItem[]> }>(r);
      Object.assign(out, data?.items ?? {});
    } catch {
      /* เงียบ — ป้ายเป็นของเสริม ไม่ขวางงานหลัก */
    }
  }
  return out;
}
