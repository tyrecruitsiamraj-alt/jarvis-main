/**
 * ═══ แจ้งคนสั่งเมื่อ So Scraping เปลี่ยนสถานะ (เจ้าของ 20 ต.ค. 2569: "สั่งแล้วดูไม่ได้จะตามงานยังไง") ═══
 * ทุก 5 นาที: คำขอที่เป็น โพสต์แล้ว / เสร็จ / ไม่รับงาน → แจ้งเตือนกระดิ่งของคนที่กดสั่ง (ครั้งเดียวต่อคำขอต่อสถานะ · dedupe_key)
 * กดแจ้งเตือน = เปิดกล่องงานที่ใบนั้น · ปิดด้วย SO_SCRAPING_NOTICE_ENABLED=false
 */
import { notifyUsers } from './appNotifications.js';
import { listRecentlyResolvedJobPostings } from './jobPostingRequests.js';
import { logError, logInfo } from './logger.js';
import { soNoticeTitle } from '../../src/lib/soScraping.js';

const CHECK_EVERY_MS = 5 * 60_000;
let running = false;
let stopped = false;

export async function runSoScrapingNoticesOnce(): Promise<{ checked: number }> {
  const rows = await listRecentlyResolvedJobPostings();
  for (const r of rows) {
    const title = soNoticeTitle(r.request_type, r.status);
    if (!title || !r.requested_by_user_id) continue;
    const position = typeof r.job_snapshot?.position === 'string' ? r.job_snapshot.position : null;
    const what = [r.request_no ? `ใบขอ ${r.request_no}` : null, position].filter(Boolean).join(' · ');
    const why = r.status === 'rejected' && r.notes?.trim() ? `เหตุผล: ${r.notes.trim()}` : null;
    await notifyUsers([r.requested_by_user_id], {
      type: 'so_scraping_status',
      title,
      body: [what, why].filter(Boolean).join('\n') || null,
      link: `/jobs/board?posting=${encodeURIComponent(r.job_id)}`,
      dedupeKey: `so_scraping:${r.id}:${r.status}`,
    });
  }
  return { checked: rows.length };
}

export function startSoScrapingNoticeWorker(): boolean {
  if ((process.env.SO_SCRAPING_NOTICE_ENABLED || '').trim().toLowerCase() === 'false') return false;
  if (running) return true;
  running = true;
  stopped = false;
  void (async () => {
    while (!stopped) {
      try {
        const out = await runSoScrapingNoticesOnce();
        if (out.checked > 0) logInfo('soScraping.notice', out);
      } catch (e) {
        logError('soScraping.notice', e);
      }
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, CHECK_EVERY_MS);
        t.unref?.();
      });
    }
    running = false;
  })();
  return true;
}

export function stopSoScrapingNoticeWorker(): void {
  stopped = true;
}
