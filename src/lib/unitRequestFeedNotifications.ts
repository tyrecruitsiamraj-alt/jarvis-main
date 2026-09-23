import type { JobRequest } from '@/types';

export type FeedNotificationEvent =
  | { type: 'new_job'; job: JobRequest }
  | { type: 'job_closed'; job: JobRequest };

/**
 * คีย์คงที่สำหรับเทียบ feed
 *
 * 🔴 **ต้องใช้ `id` ก่อน** (23 ก.ย. 2569) — เดิมใช้เลขที่ใบขอก่อน แต่ **ใบขอล่วงหน้า
 * กับใบขอจริงเลขที่ใบซ้ำกันได้** (วัดจริง: ชนกัน 27 จาก 42 ใบล่วงหน้า) ⇒ สองใบยุบเป็น
 * คีย์เดียวใน Map ⇒ ใบหนึ่งทับอีกใบ แล้วแจ้งเตือน "ใบขอใหม่ / ปิดแล้ว" ของใบที่ถูกทับหายไป
 * `id` พก prefix มาด้วยเสมอ (`siamraj-sql:` / `siamraj-pre:`) จึงไม่ชนกัน
 */
export function unitRequestFeedKey(job: JobRequest): string {
  return String(job.id || job.externalId || job.request_no || '').trim();
}

/**
 * แจ้งเตือนเฉพาะใบขอใหม่ และใบขอที่เปลี่ยนเป็นปิดแล้ว
 * รอบโหลดแรกไม่แจ้ง; ถ้า feed ว่างชั่วคราวหลังมีข้อมูลแล้ว ไม่อัปเดต snapshot
 */
export function diffUnitRequestFeedNotifications(
  prev: Map<string, string> | null,
  jobs: JobRequest[],
): { events: FeedNotificationEvent[]; next: Map<string, string> } {
  const next = new Map(
    jobs
      .map((j) => [unitRequestFeedKey(j), j.status] as const)
      .filter(([key]) => key.length > 0),
  );

  if (prev === null) {
    return { events: [], next };
  }

  if (jobs.length === 0 && prev.size > 0) {
    return { events: [], next: prev };
  }

  const events: FeedNotificationEvent[] = [];

  for (const job of jobs) {
    const key = unitRequestFeedKey(job);
    if (!key) continue;

    const before = prev.get(key);
    if (before === undefined) {
      events.push({ type: 'new_job', job });
      continue;
    }
    if (before !== 'closed' && job.status === 'closed') {
      events.push({ type: 'job_closed', job });
    }
  }

  return { events, next };
}
