import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { loadFollowUnitInfo } from '../_lib/followUnitInfo.js';

const q = (req: AuthedReq, key: string): string => {
  const v = req.query?.[key];
  return typeof v === 'string' ? v.trim().slice(0, 40) : '';
};

/**
 * ขั้น 4 ของฟอร์มเพิ่มคนติดตาม (เจ้าของสั่ง 14 ต.ค. 2569) — ประกัน + ผู้ติดต่อลูกค้าของหน่วยงานที่เลือกในขั้น 2
 * GET ?site=<รหัสไซต์>&request=<เลขที่ใบขอ> · อ่าน ERP อย่างเดียว · สิทธิ์ชุดเดียวกับหน้าติดตาม
 */
async function handler(req: AuthedReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') return sendError(res, 405, 'Method not allowed');
  const siteCode = q(req, 'site');
  const requestNo = q(req, 'request');
  if (!siteCode && !requestNo) return sendError(res, 400, 'Bad request', 'ต้องระบุหน่วยงาน');
  try {
    return res.status(200).json(await loadFollowUnitInfo({ siteCode, requestNo }));
  } catch (e) {
    return handleApiError(res, e, 'follow-unit-info', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'follow');
