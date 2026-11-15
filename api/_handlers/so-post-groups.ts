/**
 * GET /api/so-post-groups?from=YYYY-MM-DD&to=YYYY-MM-DD&bu=LBD&page=1
 * การ์ด "5. โพสต์ลงกลุ่ม Facebook" ในภาพรวมงานสรรหา (เจ้าของ 11 พ.ย. 2569) — ส่งต่อจาก So Scraping ด้วย key ฝั่ง server
 * สิทธิ์เดียวกับภาพรวม (`job-applications`) · from/to = วันที่ไทย รวมวันสุดท้าย · ไม่ส่ง bu = ทุก BU (เฉพาะคนที่เห็นทุก BU)
 * 🔴 BU ล็อกที่เซิร์ฟเวอร์ (QA 15 พ.ย. 2569 · ข้อเคาะ 10 พ.ย. "เห็นเฉพาะ BU ตัวเอง") — เดิมรับ bu จาก query ตรง ไม่ส่ง = ทุก BU
 *    เห็นหลาย BU แต่ไม่ได้เลือก = BU แรกในสิทธิ์ (หน้าสรุปเลือกทีละ BU) · ไม่มี BU = ไม่มีแถว
 * `status=not_tried` (12 พ.ย. 2569 "กดแล้วดูเหตุได้ไหม") = เฉพาะสถานะนั้น + เหตุจัดกลุ่มนับ (อ่านทุกแถวของช่วงแล้วกรองฝั่งเรา)
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { fetchAllSoPostGroupRows, fetchSoPostGroups, SoPostGroupsError } from '../_lib/soPostGroups.js';
import { filterSoPostGroups } from '../../src/lib/soPostGroups.js';
import { loadMatchingBuScope } from '../_lib/departmentScope.js';
import { pickDashboardBuSet } from '../_lib/homeBuSql.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const BU = /^[A-Za-z0-9_-]{1,20}$/;
const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);

async function handler(req: AuthedReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return sendError(res, 405, 'Method not allowed');
  }
  const from = String(one(req.query?.from) ?? '');
  const to = String(one(req.query?.to) ?? '');
  const buRaw = String(one(req.query?.bu) ?? '').trim();
  const page = Math.max(1, Number.parseInt(String(one(req.query?.page) ?? '1'), 10) || 1);
  if (!DAY.test(from) || !DAY.test(to)) return sendError(res, 400, 'bad_request', 'from และ to ต้องเป็น YYYY-MM-DD');
  if (buRaw && !BU.test(buRaw)) return sendError(res, 400, 'bad_request', 'bu ไม่ถูกต้อง');
  const status = String(one(req.query?.status) ?? '').trim();
  if (status && !/^[a-z_]{1,30}$/.test(status)) return sendError(res, 400, 'bad_request', 'status ไม่ถูกต้อง');
  try {
    const { bu, buSet } = pickDashboardBuSet(await loadMatchingBuScope(req.user), buRaw || null);
    if (buSet !== null && buSet.length === 0) {
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json(filterSoPostGroups({ statuses: [], rows: [] }, { from, to, bu: null }, status, page));
    }
    const meta = { from, to, bu: buSet === null ? buRaw || null : bu ?? buSet[0] };
    const body = status ? filterSoPostGroups(await fetchAllSoPostGroupRows(meta), meta, status, page) : await fetchSoPostGroups({ ...meta, page });
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json(body);
  } catch (e) {
    if (e instanceof SoPostGroupsError) return sendError(res, e.status, 'so_post_groups', e.message);
    return handleApiError(res, e, 'so-post-groups', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'job-applications');
