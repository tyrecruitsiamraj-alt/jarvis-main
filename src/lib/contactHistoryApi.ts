import { apiFetch } from '@/lib/apiFetch';
import { readJsonSafe } from '@/lib/api';

/**
 * ประวัติการติดต่อผู้สมัคร รวมคนโทรเอง + AI โทร — ดู api/_handlers/matching-contact-history.ts
 * คีย์คือเบอร์โทร (เหตุผลเดียวกับล็อกโทร: คนเดียวหลาย ref แต่เบอร์เดียว)
 */
export type ContactHistoryItem = {
  kind: 'human' | 'ai';
  at: string;
  jobRef: string | null;
  outcome: string | null;
  scope: string | null;
  byName: string | null;
  queueStatus: string | null;
  attemptCount: number | null;
};

/** โหลดพลาด = ลิสต์ว่าง — เป็นข้อมูลประกอบการโทร ไม่ควรทำให้หน้าพัง */
export async function fetchContactHistory(phone: string): Promise<ContactHistoryItem[]> {
  const p = (phone || '').trim();
  if (!p) return [];
  try {
    const r = await apiFetch(`/api/matching/contact-history?phone=${encodeURIComponent(p)}`);
    if (!r.ok) return [];
    const data = await readJsonSafe<{ items?: ContactHistoryItem[] }>(r);
    return data?.items ?? [];
  } catch {
    return [];
  }
}
