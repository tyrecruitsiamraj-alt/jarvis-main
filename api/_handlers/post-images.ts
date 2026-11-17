/**
 * POST /api/post-images { data, job_id? } → { id } — รูปแนบโพสต์ของป๊อป Autopost (เจ้าของ 17 พ.ย. 2569)
 * สิทธิ์เดียวกับการสั่งโพสต์ (`matching-job-postings`) · ตัวรูปเปิดที่ /api/public/post-image?id= (ให้บอท So Scraping ดาวน์โหลด)
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { savePostImage } from '../_lib/postImages.js';

async function handler(req: AuthedReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return sendError(res, 405, 'Method not allowed');
  }
  try {
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
