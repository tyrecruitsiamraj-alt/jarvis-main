/**
 * GET /api/job-post-actions            → ยอด "ทำอะไรไปแล้ว" ทุกใบ (การ์ดหน้าโพสต์ประกาศ · เจ้าของ 13 พ.ย. 2569)
 * GET /api/job-post-actions?job=<id>   → รายละเอียดใบเดียว (ป๊อป: Autopost รายกลุ่ม · ลิงก์โพสต์เอง · คำสั่ง Scrap)
 * GET /api/job-post-actions?days=1&from=&to=&bu= → โพสต์เองรายวัน (การ์ด 6 หน้าภาพรวม · BU แบบหน้าภาพรวม)
 * POST /api/job-post-actions { link_id }       → จดว่าโพสต์เองแล้ววันนี้ (กดคัดลอกข้อความในหน้าโพสต์เอง · 13 พ.ย. 2569)
 * อ่านอย่างเดียว · สิทธิ์เดียวกับหน้าโพสต์ประกาศ (`job-applications`) · จำกัด BU ตามเลขใบขอแบบเส้น board ของ So Scraping
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { loadScopedRequestNoSet } from '../_lib/siamrajUnitRequests.js';
import { getJobPostActions, linkJobId, listJobPostActions, loadManualPostDays, recordManualPost } from '../_lib/jobPostActions.js';
import { loadMatchingBuScope } from '../_lib/departmentScope.js';
import { pickDashboardBuSet } from '../_lib/homeBuSql.js';
import { requestNoOf } from '../../src/lib/jobKeyIndex.js';

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const OUT_OF_SCOPE = 'ไม่มีสิทธิ์ดูใบขอนี้';
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'POST') {
    try {
      const linkId = String((req.body as { link_id?: unknown } | undefined)?.link_id ?? '').trim();
      if (!UUID.test(linkId)) return sendError(res, 400, 'bad_request', 'ไม่รู้ว่าลิงก์ไหน');
      const jobId = await linkJobId(linkId);
      if (!jobId) return sendError(res, 404, 'not_found', 'ไม่พบลิงก์นี้');
      const scoped = await loadScopedRequestNoSet(req.user);
      if (scoped !== null && !scoped.has(requestNoOf(jobId))) return sendError(res, 403, 'Forbidden', OUT_OF_SCOPE);
      await recordManualPost(linkId, { id: req.user?.sub ?? null, name: req.user?.email ?? null });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return handleApiError(res, e, 'job-post-actions.record', { userId: req.user?.sub });
    }
  }
  if (method !== 'GET') {
    res.setHeader?.('Allow', 'GET, POST');
    return sendError(res, 405, 'Method not allowed');
  }
  try {
    if (one(req.query?.days) === '1') {
      const from = String(one(req.query?.from) ?? '').trim();
      const to = String(one(req.query?.to) ?? '').trim();
      if (!YMD.test(from) || !YMD.test(to) || from > to) return sendError(res, 400, 'bad_request', 'ช่วงวันที่ไม่ถูกต้อง');
      const { buSet } = pickDashboardBuSet(await loadMatchingBuScope(req.user), one(req.query?.bu));
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json(await loadManualPostDays({ from, to, buSet }));
    }
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
