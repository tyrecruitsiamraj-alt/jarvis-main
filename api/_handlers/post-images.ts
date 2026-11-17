/**
 * GET /api/post-images?job= → { id | null } — รูปล่าสุดของใบขอ (ป๊อปโพสต์เอง + Autopost ใช้ร่วม · 17 พ.ย. 2569)
 * POST /api/post-images { data, job_id? } → { id } — รูปแนบโพสต์ของป๊อป Autopost (เจ้าของ 17 พ.ย. 2569)
 * สิทธิ์เดียวกับการสั่งโพสต์ (`matching-job-postings`) · ตัวรูปเปิดที่ /api/public/post-image?id= (ให้บอท So Scraping ดาวน์โหลด)
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { latestPostImageId, savePostImage } from '../_lib/postImages.js';

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'POST' && method !== 'GET') {
    res.setHeader?.('Allow', 'GET, POST');
    return sendError(res, 405, 'Method not allowed');
  }
  try {
    if (method === 'GET') {
      const raw = req.query?.job;
      const v: unknown = Array.isArray(raw) ? raw[0] : raw;
      const jobId = typeof v === 'string' ? v.trim().slice(0, 80) : '';
      if (!jobId) return sendError(res, 400, 'bad_request', 'ไม่มีใบขอ');
      return res.status(200).json({ id: await latestPostImageId(jobId) });
    }
    const body = ((await readJsonBody(req)) ?? {}) as Record<string, unknown>;
    const jobId = typeof body.job_id === 'string' ? body.job_id.trim().slice(0, 80) || null : null;
    const saved = await savePostImage(typeof body.data === 'string' ? body.data : '', { jobId, byName: req.user?.email ?? null });
    if (!saved.ok) return sendError(res, 400, 'bad_request', saved.message);
    return res.status(201).json({ id: saved.id });
  } catch (e) {
    return handleApiError(res, e, 'post-images', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'matching-job-postings');
