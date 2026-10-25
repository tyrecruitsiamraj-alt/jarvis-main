/**
 * ═══ GET/POST /api/follow-oldid-repush — แผนติดตามรหัสเดิมที่ยังค้าง (หน้า ตั้งค่า › เชื่อมระบบภายนอก · 22 ต.ค. 2569) ═══
 * - GET: เหลือกี่แผน กี่สาย
 * - POST: ส่งแผนพวกนี้กลับไปด้วยรหัสใหม่ เวลาเดิม — กดหลังทีม Lumos ยืนยันว่ายกเลิกแผนรหัสเดิมแล้วเท่านั้น
 * - POST ?action=recancel: ยิงยกเลิกซ้ำที่ Lumos ให้แผนรหัสเดิมที่ยกเลิกในระบบเราแล้ว (ข้ามเบอร์ที่ยังมีสายรอโทร)
 * - GET ?action=history: ประวัติยิงยกเลิกทุกครั้ง (จากบันทึกการใช้งาน) + สถานะที่ถามล่าสุด (25 ต.ค. 2569)
 * - POST ?action=status&run=<id>: ถามสถานะคำสั่งยกเลิกของครั้งนั้นจาก Lumos อีกรอบ แล้วจดลงบันทึก
 * แอดมินเท่านั้น · จดบันทึกทุกครั้ง · ที่มา/กติกาดู `api/_lib/followOldIdRepush.ts`
 */
import { withAuth, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { auditFromAuthed } from '../_lib/audit.js';
import {
  checkRecancelRun,
  listCancelledOldIdFollowPlans,
  listOldIdFollowPlans,
  listRecancelRuns,
  recancelOldIdFollowPlans,
  RECANCEL_ACTION,
  RECANCEL_STATUS_ACTION,
  repushOldIdFollowPlans,
} from '../_lib/followOldIdRepush.js';
import { cancelPushedReminder, getEventStatus } from '../_lib/lumosPushClient.js';
import { staffNameOfPhone } from '../_lib/followStaffName.js';

async function handler(req: AuthedReq, res: ApiRes) {
  if (req.user.role !== 'admin') return sendError(res, 403, 'Forbidden', 'เฉพาะแอดมิน');
  const m = (req.method || 'GET').toUpperCase();
  try {
    if (m === 'GET' && req.query?.action === 'history') {
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json({ runs: await listRecancelRuns() });
    }
    if (m === 'POST' && req.query?.action === 'status') {
      const runId = typeof req.query?.run === 'string' ? req.query.run : '';
      if (!/^[0-9a-f-]{36}$/i.test(runId)) return sendError(res, 400, 'Bad request', 'ไม่รู้ว่าครั้งไหน');
      const statuses = await checkRecancelRun(runId, getEventStatus);
      if (!statuses) return sendError(res, 404, 'Not found', 'ไม่เจอครั้งที่ยิง');
      await auditFromAuthed(req, { action: RECANCEL_STATUS_ACTION, entityType: 'follow_entry', entityId: runId, after: { statuses } });
      return res.status(200).json({ statuses });
    }
    if (m === 'GET') {
      const [plans, cancelled] = await Promise.all([listOldIdFollowPlans(), listCancelledOldIdFollowPlans()]);
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json({
        plans: plans.length,
        calls: plans.reduce((n, p) => n + p.memberIds.length, 0),
        cancelledPlans: cancelled.length,
      });
    }
    if (m === 'POST' && req.query?.action === 'recancel') {
      const items = await recancelOldIdFollowPlans({ cancel: cancelPushedReminder, eventStatus: getEventStatus });
      await auditFromAuthed(req, { action: RECANCEL_ACTION, entityType: 'follow_entry', entityId: 'oldid-plans', after: { items } });
      return res.status(200).json({ items });
    }
    if (m === 'POST') {
      const out = await repushOldIdFollowPlans(staffNameOfPhone);
      await auditFromAuthed(req, { action: 'follow.oldid_repush', entityType: 'follow_entry', entityId: 'oldid-plans', after: out });
      return res.status(200).json(out);
    }
    res.setHeader?.('Allow', 'GET, POST');
    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    return handleApiError(res, e, 'follow-oldid-repush', { userId: req.user?.sub });
  }
}

export default withAuth(handler);
