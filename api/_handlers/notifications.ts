/**
 * GET   /api/notifications          → { items, unread } กล่องขาเข้าของฉัน
 * PATCH /api/notifications { ids? } → ทำเครื่องหมายอ่านแล้ว (ไม่ส่ง ids = อ่านหมด)
 *
 * ทุก role อ่านได้ — เห็นเฉพาะของตัวเอง (คีย์จาก token ไม่รับ userId จากภายนอก)
 */
import { withAuth, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { listMyNotifications, markNotificationsRead } from '../_lib/appNotifications.js';

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  const userId = req.user?.sub;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    if (method === 'GET') {
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json(await listMyNotifications(userId));
    }

    if (method === 'PATCH') {
      const body = await readJsonBody(req);
      const ids =
        body && typeof body === 'object' && Array.isArray((body as { ids?: unknown }).ids)
          ? ((body as { ids: unknown[] }).ids.filter((v) => Number.isInteger(v)) as number[])
          : undefined;
      await markNotificationsRead(userId, ids);
      return res.status(200).json({ ok: true });
    }

    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    return handleApiError(res, e, 'notifications');
  }
}

export default withAuth(handler);
