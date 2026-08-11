import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { getIrecruitSqlServerConfig } from '../_lib/irecruitSqlServer.js';
import { getRecruitFunnel } from '../_lib/recruitFunnelSql.js';

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

/**
 * แผงสรุปงานสรรหา (RM) — 9 ตัวเลขที่เจ้าของขอ
 * **อ่านอย่างเดียวจาก iRecruit** · `?from=` / `?to=` เป็น ISO date (to เป็นขอบบนแบบไม่รวม)
 *
 * ต่อ iRecruit ไม่ได้ → 503 พร้อมบอกว่าต้องตั้งค่าอะไร
 * ⚠️ ห้ามคืนศูนย์เมื่อเช็คไม่ได้ — "0 คนกรอกมา" กับ "ต่อฐานไม่ติด" คนละเรื่องกันคนละขั้ว
 */
async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method !== 'GET') {
      return sendError(res, 405, 'Method not allowed', 'Read-only feed from iRecruit');
    }
    res.setHeader?.('Cache-Control', 'no-store, no-cache, must-revalidate');

    if (!getIrecruitSqlServerConfig()) {
      return sendError(
        res,
        503,
        'Service unavailable',
        'ตั้งค่า IRECRUIT_DB_HOST / IRECRUIT_DB_USER / IRECRUIT_DB_NAME บนเซิร์ฟเวอร์ก่อน',
      );
    }

    const data = await getRecruitFunnel({
      from: getQuery(req, 'from') || null,
      to: getQuery(req, 'to') || null,
    });
    return res.status(200).json(data);
  } catch (e) {
    return handleApiError(res, e, 'recruit-funnel');
  }
}

export default withRbac(handler, 'recruit-funnel');
