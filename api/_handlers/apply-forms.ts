/**
 * /api/apply-forms — แบบฟอร์มใบสมัครหลายแบบ (เจ้าของ 27 พ.ย. 2569 · migration 201 · ตรรกะ `api/_lib/applyForms.ts`)
 * GET                                          → { forms } ทุกฟอร์ม (รวมที่เลิกใช้) — ป๊อป Gen link กรองตาม BU เอง
 * POST   { name, departmentCodes, fields }     → เพิ่มฟอร์ม (Supervisor ขึ้นไป)
 * PATCH  { id, name?, departmentCodes?, fields?, active? } → แก้ / เลิกใช้ / กลับมาใช้ (Supervisor ขึ้นไป)
 * DELETE ?id=                                  → ลบได้เฉพาะฟอร์มที่ยังไม่มีลิงก์ใช้ · มีแล้ว = 409 ให้กดเลิกใช้แทน
 * ทุกการเปลี่ยนจด audit_logs
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { createApplyForm, deleteApplyForm, listApplyForms, updateApplyForm } from '../_lib/applyForms.js';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const canManage = (req: AuthedReq) => req.user.role === 'admin' || req.user.role === 'supervisor';
const actorOf = (req: AuthedReq) => ({ id: req.user.sub, name: req.user.email || null });
const USER_ERRORS = /ต้องใส่ชื่อ|ใช้ไม่ได้|ติ๊กช่องเสริม|มีฟอร์มชื่อนี้แล้ว/;

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') {
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json({ forms: await listApplyForms() });
    }
    if (!canManage(req)) return sendError(res, 403, 'Forbidden', 'แก้แบบฟอร์มได้เฉพาะ Supervisor ขึ้นไป');

    if (method === 'DELETE') {
      const id = Number((req.query as Record<string, unknown> | undefined)?.id);
      if (!Number.isInteger(id)) return sendError(res, 400, 'Bad request', 'ต้องระบุ id');
      const r = await deleteApplyForm(id);
      if (r === 'not_found') return sendError(res, 404, 'Not found', 'ไม่พบฟอร์มนี้');
      if (r === 'in_use') return sendError(res, 409, 'Conflict', 'ฟอร์มนี้มีลิงก์ใช้อยู่ — กด "เลิกใช้" แทน ลิงก์เดิมยังเปิดได้');
      await auditFromAuthed(req, { action: 'apply_form.delete', entityType: 'apply_form', entityId: String(id) });
      return res.status(200).json({ ok: true });
    }

    const body = await readJsonBody(req);
    if (!isObj(body)) return sendError(res, 400, 'Bad request', 'Invalid JSON body');
    if (method === 'POST') {
      const item = await createApplyForm({ name: body.name, departmentCodes: body.departmentCodes, fields: body.fields }, actorOf(req));
      await auditFromAuthed(req, { action: 'apply_form.create', entityType: 'apply_form', entityId: String(item.id), after: item });
      return res.status(200).json({ item });
    }
    if (method === 'PATCH') {
      const id = Number(body.id);
      if (!Number.isInteger(id)) return sendError(res, 400, 'Bad request', 'ต้องระบุ id');
      const r = await updateApplyForm(
        id,
        { name: body.name, departmentCodes: body.departmentCodes, fields: body.fields, active: body.active },
        actorOf(req),
      );
      if (!r) return sendError(res, 404, 'Not found', 'ไม่พบฟอร์มนี้');
      await auditFromAuthed(req, { action: 'apply_form.update', entityType: 'apply_form', entityId: String(id), before: r.before, after: r.after });
      return res.status(200).json({ item: r.after });
    }
    res.setHeader?.('Allow', 'GET, POST, PATCH, DELETE');
    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (USER_ERRORS.test(msg)) return sendError(res, 400, 'Bad request', msg);
    return handleApiError(res, e, 'apply-forms', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'job-applications');
