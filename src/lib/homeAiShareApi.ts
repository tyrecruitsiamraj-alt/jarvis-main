/** ตัวดึง `/api/home-ai-share` — หน้าหลัก "ระบบไปกี่ %" (30 ก.ย. 2569) */
import type { OnlineReportResponse } from '@/lib/homeOnline';
import { apiFetch } from '@/lib/apiFetch';
import type {
  AiShareBlockKey,
  AiShareDetailResponse,
  AiShareListKey,
  AiShareListResponse,
  AiShareResponse,
  AiShareWindow,
} from '@/lib/homeAiShare';
import type { FollowJourneyResponse } from '@/lib/followJourney';
import type { HomeLumosSummaryResponse } from '@/lib/homeLumosSummary';
import type { TopicReportBlock, TopicReportResponse } from '@/lib/homeTopicReport';

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

/** เส้นทางติดตามทีละขั้น (7 ต.ค. 2569) — ทุกสายในช่วงแบบเบา ไม่มีเบอร์ · หน้านับเอง */
export function fetchFollowJourney(q: AiShareWindow & { bu?: string | null }): Promise<FollowJourneyResponse> {
  return read<FollowJourneyResponse>(`/api/home-ai-share${queryOf(q, { journey: 'follow' })}`);
}

/** สรุปแบบบอท Lumos (7 ต.ค. 2569) — งานที่ส่งให้ AI ช่วงเดียวกับปฏิทิน */
export function fetchHomeLumosSummary(q: AiShareWindow & { bu?: string | null }): Promise<HomeLumosSummaryResponse> {
  return read<HomeLumosSummaryResponse>(`/api/home-ai-share${queryOf(q, { summary: 'lumos' })}`);
}

/** แท็บทีม Online (8 ต.ค. 2569) — ใบขอ → ประกาศ → ผลประกาศ → ประเภทงาน → BU */
export function fetchHomeOnline(q: AiShareWindow & { bu?: string | null }): Promise<OnlineReportResponse> {
  return read<OnlineReportResponse>(`/api/home-ai-share${queryOf(q, { online: '1' })}`);
}

/** รายงานผลโทร งานสรรหา / จับคู่งาน / ดูแลหลังเริ่มงาน (7 ต.ค. 2569) */
export function fetchTopicReport(block: TopicReportBlock, q: AiShareWindow & { bu?: string | null }): Promise<TopicReportResponse> {
  return read<TopicReportResponse>(`/api/home-ai-share${queryOf(q, { report: block })}`);
}
