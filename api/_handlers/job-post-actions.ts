/**
 * GET /api/job-post-actions            → ยอด "ทำอะไรไปแล้ว" ทุกใบ (การ์ดหน้าโพสต์ประกาศ · เจ้าของ 13 พ.ย. 2569)
 * GET /api/job-post-actions?job=<id>   → รายละเอียดใบเดียว (ป๊อป: Autopost รายกลุ่ม · ลิงก์โพสต์เอง · คำสั่ง Scrap)
 * อ่านอย่างเดียว · สิทธิ์เดียวกับหน้าโพสต์ประกาศ (`job-applications`) · จำกัด BU ตามเลขใบขอแบบเส้น board ของ So Scraping
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { loadScopedRequestNoSet } from '../_lib/siamrajUnitRequests.js';
import { getJobPostActions, listJobPostActions } from '../_lib/jobPostActions.js';
import { requestNoOf } from '../../src/lib/jobKeyIndex.js';

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const OUT_OF_SCOPE = 'ไม่มีสิทธิ์ดูใบขอนี้';

async function handler(req: AuthedReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return sendError(res, 405, 'Method not allowed');
  }
  try {
    const scoped = await loadScopedRequestNoSet(req.user);
    const allow = (jobId: string) => scoped === null || scoped.has(requestNoOf(jobId));
    res.setHeader?.('Cache-Control', 'no-store');
    const job = String(one(req.query?.job) ?? '').trim();
    if (!job) return res.status(200).json({ byJob: await listJobPostActions(allow) });
    if (job.length > 120) return sendError(res, 400, 'bad_request', 'job ไม่ถูกต้อง');
    if (!allow(job)) return sendError(res, 403, 'Forbidden', OUT_OF_SCOPE);
    return res.status(200).json(await getJobPostActions(job, requestNoOf(job)));
  } catch (e) {
    return handleApiError(res, e, 'job-post-actions', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'job-applications');
