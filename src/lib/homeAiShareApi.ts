/** ตัวดึง `/api/home-ai-share` — หน้าหลัก "ระบบไปกี่ %" (30 ก.ย. 2569) */
import { apiFetch } from '@/lib/apiFetch';
import type {
  AiShareBlockKey,
  AiShareDetailResponse,
  AiShareListKey,
  AiShareListResponse,
  AiShareResponse,
  AiShareWindow,
} from '@/lib/homeAiShare';
import type { AiShareResultsResponse } from '@/lib/homeCallResults';
import type { FollowJourneyResponse } from '@/lib/followJourney';

function queryOf(q: AiShareWindow & { bu?: string | null }, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams(extra);
  if (q.from) p.set('from', q.from);
  if (q.to) p.set('to', q.to);
  if (q.bu) p.set('bu', q.bu);
  const qs = p.toString();
  return qs ? `?${qs}` : '';
}

async function read<T>(url: string): Promise<T> {
  const r = await apiFetch(url);
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(data.message || data.error || 'โหลดหน้าหลักไม่ขึ้น ลองรีเฟรชอีกครั้ง');
  }
  return (await r.json()) as T;
}

/** ช่วง null ทั้งคู่ = ทั้งหมด (ไม่ส่งวันที่ไปเลย) */
export function fetchHomeAiShare(q: AiShareWindow & { bu?: string | null }): Promise<AiShareResponse> {
  return read<AiShareResponse>(`/api/home-ai-share${queryOf(q)}`);
}

/** แยกวัน × BU ของก้อนเดียว — โหลดตอนกดการ์ดเท่านั้น */
export function fetchHomeAiShareDetail(
  block: AiShareBlockKey,
  q: AiShareWindow & { bu?: string | null },
): Promise<AiShareDetailResponse> {
  return read<AiShareDetailResponse>(`/api/home-ai-share${queryOf(q, { detail: block })}`);
}

/** รายชื่อหลังเลขในกล่อง (Popup ตอนกดกล่อง · รอบ 17) — หน้าเริ่มที่ 0 · ไม่มีสิทธิ์ = เส้นตอบ 403 พร้อมเหตุ */
export function fetchHomeAiShareList(
  block: AiShareBlockKey,
  key: AiShareListKey,
  page: number,
  q: AiShareWindow & { bu?: string | null },
): Promise<AiShareListResponse> {
  return read<AiShareListResponse>(`/api/home-ai-share${queryOf(q, { list: block, segment: key, page: String(page) })}`);
}

/** ผลโทรของก้อนเดียว แยก AI/คน (แผง "ผลโทร" · รอบ 18) — ตัวนับล้วน */
export function fetchHomeAiShareResults(
  block: AiShareBlockKey,
  q: AiShareWindow & { bu?: string | null },
): Promise<AiShareResultsResponse> {
  return read<AiShareResultsResponse>(`/api/home-ai-share${queryOf(q, { results: block })}`);
}

/** เส้นทางติดตามทีละขั้น (7 ต.ค. 2569) — ทุกสายในช่วงแบบเบา ไม่มีเบอร์ · หน้านับเอง */
export function fetchFollowJourney(q: AiShareWindow & { bu?: string | null }): Promise<FollowJourneyResponse> {
  return read<FollowJourneyResponse>(`/api/home-ai-share${queryOf(q, { journey: 'follow' })}`);
}
