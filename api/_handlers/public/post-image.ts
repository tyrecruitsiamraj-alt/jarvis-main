/**
 * GET /api/public/post-image?id=<uuid> — ตัวรูปแนบโพสต์ (ไม่ต้องล็อกอิน · เจ้าของ 17 พ.ย. 2569)
 * บอท So Scraping ดาวน์โหลดตอนโพสต์ลงกลุ่ม · รหัสสุ่มเดาไม่ได้ · รูปไม่เปลี่ยนจึงเก็บแคชได้ยาว
 */
import { sendError, handleApiError, type ApiReq, type ApiRes } from '../../_lib/http.js';
import { rateLimitOrReject } from '../../_lib/rateLimit.js';
import { getPostImage } from '../../_lib/postImages.js';
import { isQuizImageId } from '../../../src/lib/skillQuiz.js';

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);

export default async function handler(req: ApiReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') return sendError(res, 405, 'Method not allowed');
  try {
    if (!rateLimitOrReject(req, res, 'public-post-image', 600, 10 * 60 * 1000)) return;
    const id = String(one(req.query?.id) ?? '');
    const img = isQuizImageId(id) ? await getPostImage(id) : null;
    if (!img) return sendError(res, 404, 'not_found', 'ไม่พบรูป');
    res.setHeader?.('Content-Type', img.mime);
    res.setHeader?.('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader?.('X-Content-Type-Options', 'nosniff');
    return res.status(200).end?.(img.bytes);
  } catch (e) {
    return handleApiError(res, e, 'public-post-image');
  }
}
