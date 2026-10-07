import { sendError, handleApiError, type ApiReq, type ApiRes } from '../../_lib/http.js';
import { rateLimitOrReject } from '../../_lib/rateLimit.js';
import { getPostingByLinkCode } from '../../_lib/recruitPostings.js';
import { logWarn } from '../../_lib/logger.js';
import { getLinkedPublicJob } from './jobs.js';

function getQuery(req: ApiReq, key: string): string {
  const v = (req as { query?: Record<string, unknown> }).query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

/**
 * GET /api/public/apply-link?code=xxxx — เปิดลิงก์สมัครโดยไม่ต้องล็อกอิน
 *
 * คืนเฉพาะข้อมูลที่ผู้สมัครควรเห็น — ไม่ส่ง BU / ผู้สร้าง / ยอดใบสมัคร ออกไปหน้าสาธารณะ
 * `job` = ใบงานรูปเดียวกับการ์ดหน้า /apply (`getLinkedPublicJob`) · null = ใช้การ์ดประกาศ
 */
export default async function handler(req: ApiReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') return sendError(res, 405, 'Method not allowed');
  if (!rateLimitOrReject(req, res, 'public-apply-link', 60, 10 * 60 * 1000)) return;

  try {
    const code = getQuery(req, 'code');
    if (!code) return sendError(res, 400, 'Bad request', 'ต้องระบุ code');

    const found = await getPostingByLinkCode(code);
    if (!found) return sendError(res, 404, 'Not found', 'ลิงก์นี้ใช้ไม่ได้แล้ว');

    const { posting, link } = found;
    /**
     * ใบงานแบบการ์ดหน้า /apply (6 ต.ค. 2569 · เจ้าของ "มันต้องเห็นแบบหน้า apply สิ่") — ช่องสาธารณะชุดเดียวกับหน้ารวม
     * โหลดไม่ขึ้น/ไม่ผ่านด่าน = null ⇒ หน้าใช้การ์ดประกาศเดิม · ห้ามทำให้ลิงก์ล่ม (คนจริงกำลังจะสมัคร)
     */
    let job: Awaited<ReturnType<typeof getLinkedPublicJob>> | null = null;
    if (posting.jobId && posting.status !== 'closed') {
      try {
        job = await getLinkedPublicJob(posting.jobId);
      } catch (e) {
        logWarn('public-apply-link: โหลดใบงานไม่ขึ้น', { error: e instanceof Error ? e.message : String(e) });
      }
    }
    return res.status(200).json({
      job,
      postingId: posting.id,
      linkId: link.id,
      jobId: posting.jobId,
      title: posting.title,
      detail: posting.detail,
      locationText: posting.locationText,
      salaryText: posting.salaryText,
      contactName: posting.contactName,
      contactPhone: posting.contactPhone,
      status: posting.status,
      channelLabel: link.channelLabel,
    });
  } catch (e) {
    return handleApiError(res, e, 'public-apply-link');
  }
}
