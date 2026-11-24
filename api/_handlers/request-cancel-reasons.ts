/**
 * GET /api/request-cancel-reasons — เหตุผลยกเลิกใบขอ: รายการกลาง (`reasons`) + เหตุผลที่ทีมใส่บนใบ (`tags`) · เจ้าของ 24 พ.ย. 2569
 *   หน้า Dashboard กดเลขยกเลิกแล้วแยก ได้คนแล้ว / ยกเลิกจริง / ไม่ได้กรอกเหตุผล · ตัวตัดสิน `src/lib/requestCancelReason.ts`
 * PUT  {requestNo, reasonId|null} — ใส่/เปลี่ยน/ล้างเหตุผลบนใบ (ทุกคน) · ใส่ได้เฉพาะใบที่ ERP ไม่มีเหตุผล หรือเป็น "ยกเลิกโดย-สยามราช"
 * POST {label, gotPerson} — เพิ่มเหตุผลในรายการกลาง (admin)
 * PATCH {id, label?, gotPerson?, active?} — แก้ชื่อ (เฉพาะข้อที่ทีมเพิ่ม) · ติ๊กได้คนแล้ว · เปิด/เลิกใช้ (admin) · ไม่มีลบ
 * ไม่เขียนกลับ ERP · ทุกการเปลี่ยนจด audit_logs (ใคร · ใบไหน · จากอะไรเป็นอะไร)
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import {
  createCancelReason,
  listCancelReasonMasters,
  listCancelReasonTags,
  setCancelReasonTag,
  updateCancelReason,
} from '../_lib/requestCancelReasons.js';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const actorOf = (req: AuthedReq) => ({ id: req.user.sub, name: req.user.email });

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') {
      const [reasons, tags] = await Promise.all([listCancelReasonMasters(), listCancelReasonTags()]);
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json({ reasons, tags });
    }

    const body = await readJsonBody(req);
    if (!isObj(body)) return sendError(res, 400, 'Bad request', 'Invalid JSON body');

    if (method === 'PUT') {
      const requestNo = typeof body.requestNo === 'string' ? body.requestNo : '';
      const reasonId = body.reasonId == null ? null : Number(body.reasonId);
      if (!requestNo) return sendError(res, 400, 'Bad request', 'ต้องระบุเลขที่ใบขอ');
      if (reasonId != null && !Number.isInteger(reasonId)) return sendError(res, 400, 'Bad request', 'เหตุผลไม่ถูกต้อง');
      const r = await setCancelReasonTag(requestNo, reasonId, actorOf(req));
      if (!r.ok) return sendError(res, r.status, 'Rejected', r.message);
      await auditFromAuthed(req, {
        action: 'request_cancel_reason.tag',
        entityType: 'request',
        entityId: requestNo.trim().toUpperCase(),
        before: r.before,
        after: r.after,
      });
      return res.status(200).json({ ok: true, after: r.after });
    }

    if (method === 'POST') {
      const item = await createCancelReason({ label: body.label, gotPerson: body.gotPerson }, actorOf(req));
      await auditFromAuthed(req, { action: 'request_cancel_reason.create', entityType: 'request_cancel_reason', entityId: String(item.id), after: item });
      return res.status(200).json({ item });
    }

    if (method === 'PATCH') {
      const id = Number(body.id);
      if (!Number.isInteger(id)) return sendError(res, 400, 'Bad request', 'ต้องระบุ id');
      const r = await updateCancelReason(id, { label: body.label, gotPerson: body.gotPerson, active: body.active }, actorOf(req));
      if (!r) return sendError(res, 404, 'Not found', 'ไม่พบเหตุผลนี้');
      await auditFromAuthed(req, { action: 'request_cancel_reason.update', entityType: 'request_cancel_reason', entityId: String(id), before: r.before, after: r.after });
      return res.status(200).json({ item: r.after });
    }

    res.setHeader?.('Allow', 'GET, PUT, POST, PATCH');
    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (/ต้องใส่ชื่อ|มีเหตุผลชื่อนี้|แก้ชื่อไม่ได้/.test(msg)) return sendError(res, 400, 'Bad request', msg);
    return handleApiError(res, e, 'request-cancel-reasons', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'request-cancel-reasons');
