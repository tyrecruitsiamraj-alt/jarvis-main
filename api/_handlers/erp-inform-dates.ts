/**
 * POST /api/erp-inform-dates { phones: string[] } → { dates: { [เบอร์ 9 ตัวท้าย]: 'YYYY-MM-DD' } }
 * วันแจ้งเข้าล่าสุดจาก ERP (อ่านอย่างเดียว) — เติมวันเริ่มงานที่ว่าง (เจ้าของเคาะ 17 ต.ค. 2569)
 * ใช้ POST เพราะส่งเบอร์ทีละหลายร้อย (ไม่ใส่เบอร์ใน URL) · ไม่เขียนอะไร
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { getSiamrajSqlServerConfig } from '../_lib/siamrajSqlServer.js';
import { erpInformDatesByPhones } from '../_lib/erpInformDates.js';

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method !== 'POST') return sendError(res, 405, 'Method not allowed');
    if (!getSiamrajSqlServerConfig()) return res.status(200).json({ dates: {} });
    const raw = (await readJsonBody(req)) as { phones?: unknown } | null;
    const phones = Array.isArray(raw?.phones) ? raw!.phones.filter((p): p is string => typeof p === 'string') : [];
    const map = await erpInformDatesByPhones(phones);
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json({ dates: Object.fromEntries(map) });
  } catch (e) {
    return handleApiError(res, e, 'erp-inform-dates', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'erp-inform-dates');
