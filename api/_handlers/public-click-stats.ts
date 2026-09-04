import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { listPublicClicksByJob } from '../_lib/publicClicks.js';

/**
 * `GET /api/public-click-stats?days=30` — ยอดคลิกบนหน้าสาธารณะรายใบขอ (เจ้าหน้าที่)
 *
 * ตอบคำถาม *"ประกาศไหนมีคนสนใจจริง"* — คู่กับยอดคลิกลิงก์ช่องทางที่มีอยู่แล้ว
 * 🔴 ยอดรวมล้วน ไม่มีข้อมูลว่าใครกด (ดู `_lib/publicClicks.ts`)
 */
async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') return sendError(res, 405, 'Method not allowed');
  try {
    const raw = Number((req.query?.days as string) ?? '30');
    const days = Number.isFinite(raw) ? raw : 30;
    const rows = await listPublicClicksByJob(days);
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json({ days, rows });
  } catch (e) {
    return handleApiError(res, e, 'public-click-stats');
  }
}

export default withRbac(handler, 'jobs');
