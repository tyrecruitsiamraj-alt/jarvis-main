/**
 * GET /api/so-post-summary — ยอดโพสต์ลงกลุ่มต่อเลขใบขอ (สั่ง · แต่ละสถานะ) สำหรับการ์ดบนหน้าโพสต์ประกาศ
 * (เจ้าของ 12 พ.ย. 2569 "งานไหน สั่งไปเท่าไหร่ โพสต์ได้เท่าไหร่ บอกตรงนี้เลย") · ช่วง 1 ต.ค. 2569 – วันนี้ (เส้น post-groups ของ So Scraping เริ่มที่วันนั้น)
 * สิทธิ์เดียวกับหน้าโพสต์ประกาศ (`job-applications`) · key อยู่ฝั่ง server
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { fetchAllSoPostGroupRows, SoPostGroupsError } from '../_lib/soPostGroups.js';
import { summarizeSoPostGroups } from '../../src/lib/soPostGroups.js';
import { toBangkokYmd } from '../_lib/businessDate.js';

export const SO_POST_SUMMARY_FROM = '2026-10-01';

async function handler(req: AuthedReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return sendError(res, 405, 'Method not allowed');
  }
  try {
    const all = await fetchAllSoPostGroupRows({ from: SO_POST_SUMMARY_FROM, to: toBangkokYmd(new Date()), bu: null });
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json(summarizeSoPostGroups(all));
  } catch (e) {
    if (e instanceof SoPostGroupsError) return sendError(res, e.status, 'so_post_summary', e.message);
    return handleApiError(res, e, 'so-post-summary', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'job-applications');
