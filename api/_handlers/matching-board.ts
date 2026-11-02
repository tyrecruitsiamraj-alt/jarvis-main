/**
 * ═══ /api/matching/board — บอร์ดรายชื่อผู้สมัครของ ERP อ่านอย่างเดียว (ช่วง 1 · เจ้าของ 2 พ.ย. 2569) ═══
 * GET ?overview=1        → ช่อง · วัน · ขั้นตอน · แท็ก
 * GET ?item=<itemId>     → การ์ดของวันนั้น · หรือ ?from=YYYY-MM-DD&to=YYYY-MM-DD · ไม่ส่ง = วันล่าสุด
 * GET ?card=<cardId>     → ป๊อปการ์ด (คอมเมนต์ · เช็กลิสต์ · กิจกรรม · ประวัติขั้นตอน)
 * 🔴 GET เท่านั้น — ช่วง 2 (เขียนกลับ ERP) ยังไม่ทำ ต้องคุยทีม ERP ก่อน · staff เท่านั้น (ชื่อคนจริง)
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { getSiamrajSqlServerConfig } from '../_lib/siamrajSqlServer.js';
import { listErpBoardCards, loadErpBoardCardDetail, loadErpBoardOverview } from '../_lib/erpBoardSql.js';

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}
const intOf = (v: string): number | null => (/^\d{1,9}$/.test(v) ? Number(v) : null);
const ymdOf = (v: string): string | null => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

async function handler(req: AuthedReq, res: ApiRes) {
  try {
    if ((req.method || 'GET').toUpperCase() !== 'GET') return sendError(res, 405, 'Method not allowed', 'บอร์ดอ่านอย่างเดียว แก้ที่ ERP');
    if (!getSiamrajSqlServerConfig()) return sendError(res, 503, 'Service unavailable', 'ยังไม่ได้ตั้งค่า Siamraj SQL Server (DB_HOST)');
    res.setHeader?.('Cache-Control', 'no-store');

    const card = intOf(getQuery(req, 'card'));
    if (card) {
      const detail = await loadErpBoardCardDetail(card);
      if (!detail) return sendError(res, 404, 'Not found', 'ไม่พบการ์ดนี้บนบอร์ด');
      return res.status(200).json(detail);
    }
    if (getQuery(req, 'overview') === '1') return res.status(200).json(await loadErpBoardOverview());

    const itemId = intOf(getQuery(req, 'item'));
    const from = ymdOf(getQuery(req, 'from'));
    const to = ymdOf(getQuery(req, 'to'));
    const cards = await listErpBoardCards({ itemId, from, to });
    return res.status(200).json({ cards });
  } catch (e) {
    return handleApiError(res, e, 'matching-board');
  }
}

export default withRbac(handler, 'matching-board');
