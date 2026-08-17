import { apiFetch } from '@/lib/apiFetch';
import { readErrorMessage, readJsonSafe } from '@/lib/api';
import type { CandidateScreening, ScreeningAnswer } from '@/lib/candidatePriority';

/**
 * ผลคัดกรองผู้สมัคร (เหล้า/บุหรี่ + ประวัติคดี) — ข้อมูลที่ Jarvis เก็บเอง
 * เพราะบอร์ด iRecruit ไม่มีสองฟิลด์นี้ · ดู api/_lib/candidateScreening.ts
 */
export type ScreeningSource = 'board' | 'irecruit';

export type CandidateScreeningRecord = CandidateScreening & {
  source: ScreeningSource;
  candidateRef: string;
  candidateName: string | null;
  criminalNote: string | null;
  screenedByName: string | null;
  updatedAt: string;
};

/** ขอได้ครั้งละไม่เกินเท่านี้ (ฝั่ง server ปฏิเสธถ้าเกิน) — ตัวเรียกต้องแบ่งก้อนเอง */
export const SCREENING_REFS_PER_REQUEST = 300;

/**
 * อ่านผลคัดกรองของผู้สมัครหลายคน — คืน map candidateRef → record
 * ล้มเหลวคืน map ว่าง (ข้อมูลเสริมของการเรียงลำดับ ไม่ควรทำให้หน้า Matching พัง)
 */
export async function fetchCandidateScreening(
  source: ScreeningSource,
  candidateRefs: string[],
): Promise<Map<string, CandidateScreeningRecord>> {
  const refs = [...new Set(candidateRefs.map((r) => (r || '').trim()).filter(Boolean))];
  const out = new Map<string, CandidateScreeningRecord>();
  if (refs.length === 0) return out;

  for (let i = 0; i < refs.length; i += SCREENING_REFS_PER_REQUEST) {
    const batch = refs.slice(i, i + SCREENING_REFS_PER_REQUEST);
    try {
      const params = new URLSearchParams({ source, refs: batch.join(',') });
      const r = await apiFetch(`/api/matching/candidate-screening?${params}`);
      if (!r.ok) continue;
      const data = await readJsonSafe<{ items?: CandidateScreeningRecord[] }>(r);
      for (const item of data?.items ?? []) out.set(item.candidateRef, item);
    } catch {
      /* ก้อนนี้พลาดก็ข้าม — คนที่อ่านไม่ได้จะเป็น unknown ซึ่งไม่ถูกนับในคะแนน */
    }
  }
  return out;
}

export type SaveScreeningInput = {
  source: ScreeningSource;
  candidateRef: string;
  candidateName?: string | null;
  drinking?: ScreeningAnswer;
  smoking?: ScreeningAnswer;
  criminalRecord?: ScreeningAnswer;
  criminalNote?: string | null;
};

/** บันทึกผลคัดกรอง — ส่งฟิลด์ไหนอัปเดตเฉพาะฟิลด์นั้น */
export async function saveCandidateScreening(
  input: SaveScreeningInput,
): Promise<CandidateScreeningRecord> {
  const r = await apiFetch('/api/matching/candidate-screening', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'บันทึกผลคัดกรองไม่สำเร็จ'));
  return (await readJsonSafe<CandidateScreeningRecord>(r)) as CandidateScreeningRecord;
}
