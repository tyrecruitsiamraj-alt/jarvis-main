/**
 * ═══ GET /api/public/channels — ช่องทางหลักให้หน้าสมัครเลือก (เจ้าของ 28 ต.ค. 2569) ═══
 * > *"มันต้องยึดตามช่องทางหลัก"* → *"https://jarvis.siamrajathanee.dev/recruit/channels ยึดตามนี้"* ·
 * > Choice "ใช้รายการเดียวกัน" (ช่อง "เห็นประกาศจากช่องทางไหน" เดิมล็อก 5 ค่า Facebook/TikTok/Instagram/ใบปลิว/อื่นๆ)
 * ไม่ต้องล็อกอิน · คืนเฉพาะ `{ id, name }` ของช่องทางหลักที่เปิดใช้ (ตัวเดียวกับ ChannelPicker / หน้าจัดช่องทาง)
 */
import { sendError, handleApiError, type ApiReq, type ApiRes } from '../../_lib/http.js';
import { rateLimitOrReject } from '../../_lib/rateLimit.js';
import { listRecruitChannelRoots } from '../../_lib/recruitPostings.js';

export default async function handler(req: ApiReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') return sendError(res, 405, 'Method not allowed');
  if (!rateLimitOrReject(req, res, 'public-channels', 60, 10 * 60 * 1000)) return;
  try {
    const roots = await listRecruitChannelRoots(false);
    res.setHeader?.('Cache-Control', 'public, max-age=300');
    return res.status(200).json({ channels: roots.map((c) => ({ id: c.id, name: c.name })) });
  } catch (e) {
    return handleApiError(res, e, 'public-channels');
  }
}
