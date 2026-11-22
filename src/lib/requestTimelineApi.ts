import { apiFetch } from './apiFetch';
import type { RequestTimelineResponse } from './requestTimeline';

/**
 * ใบขอทำอะไรไปแล้ว (แท็บ Scale ลง 20 พ.ย. 2569) — `events` = ขอเหตุการณ์ไล่ตามวันด้วย (ใบเดียว)
 * ค่า null ของใบ = ใบนอก BU ที่เห็น · ครั้งละไม่เกิน `REQUEST_TIMELINE_MAX` ใบ
 */
export async function fetchRequestTimeline(jobIds: readonly string[], events = false): Promise<RequestTimelineResponse['jobs']> {
  const p = new URLSearchParams({ jobs: jobIds.join(',') });
  if (events) p.set('events', '1');
  const r = await apiFetch(`/api/request-timeline?${p.toString()}`);
  if (!r.ok) {
    const b = (await r.json().catch(() => ({}))) as { message?: string };
    throw new Error(b.message || 'อ่านงานของใบขอไม่ได้');
  }
  return ((await r.json()) as RequestTimelineResponse).jobs;
}
