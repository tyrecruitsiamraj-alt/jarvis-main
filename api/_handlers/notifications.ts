/**
 * GET   /api/notifications          → { items, unread, fastUntil } กล่องขาเข้าของฉัน
 *       fastUntil = ถึงเวลานี้ให้หน้าเว็บถามถี่ขึ้น (มีผู้สมัครเปิดลิงก์ส่งเอกสารของฉันอยู่ ยังไม่ส่ง) · null = รอบปกติ
 * GET   /api/notifications?history=<ชนิด>&before=<id>&limit= → ประวัติของชนิดนั้นทีละหน้า { items, nextBefore }
 * PATCH /api/notifications { ids? } → ทำเครื่องหมายอ่านแล้ว (ไม่ส่ง ids = อ่านหมด)
 *
 * ทุก role อ่านได้ — เห็นเฉพาะของตัวเอง (คีย์จาก token ไม่รับ userId จากภายนอก)
 */
import { withAuth, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { listMyNotifications, listNotificationHistory, markNotificationsRead } from '../_lib/appNotifications.js';
import { documentWatchUntil } from '../_lib/documents/outbox.js';

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  const userId = req.user?.sub;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    if (method === 'GET') {
      res.setHeader?.('Cache-Control', 'no-store');
      const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
      const history = one(req.query?.history);
      if (typeof history === 'string' && /^[a-z_]{3,60}$/.test(history)) {
        const before = Number(one(req.query?.before));
        return res.status(200).json(
          await listNotificationHistory(userId, { type: history, beforeId: Number.isInteger(before) && before > 0 ? before : null, limit: Number(one(req.query?.limit)) || 20 }),
        );
      }
      const [inbox, fastUntil] = await Promise.all([listMyNotifications(userId), documentWatchUntil(userId).catch(() => null)]);
      return res.status(200).json({ ...inbox, fastUntil });
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
