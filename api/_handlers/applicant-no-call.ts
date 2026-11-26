/**
 * /api/applicant-no-call — ปุ่ม "ไม่โทร" + เหตุผล (เจ้าของ 26 พ.ย. 2569 · migration 200 · ตรรกะ `api/_lib/applicantNoCall.ts`)
 * GET                         → { reasons } รายการเหตุผล (รวมที่เลิกใช้ — ใบเก่ายังอ่านชื่อออก)
 * POST  { ids, reasonId }     → ตั้งไม่โทร (reasonId = null ล้าง กลับกล่องเดิม) · ด่านสิทธิ์ต่อใบเดียวกับปุ่มส่ง AI
 * POST  { label, box }        → เพิ่มเหตุผล (Supervisor ขึ้นไป) · box = own | bad_data | over_age | employed
 * PATCH { id, label?, active? } → แก้ชื่อ / เปิด-เลิกใช้ (Supervisor ขึ้นไป) · ไม่มีลบ
 * ทุกการเปลี่ยนจด audit_logs
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { isApplicationInWriteScope } from '../_lib/applicationScope.js';
import { createNoCallReason, listNoCallReasons, setNoCall, updateNoCallReason } from '../_lib/applicantNoCall.js';

const APPS = tableInAppSchema('public_job_applications');
const MAX_IDS = 200;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const canManage = (req: AuthedReq) => req.user.role === 'admin' || req.user.role === 'supervisor';
const actorOf = (req: AuthedReq) => ({ id: req.user.sub, name: req.user.email || null });

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') {
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json({ reasons: await listNoCallReasons() });
    }
    const body = await readJsonBody(req);
    if (!isObj(body)) return sendError(res, 400, 'Bad request', 'Invalid JSON body');

    if (method === 'POST' && Array.isArray(body.ids)) {
      const ids = [...new Set(body.ids.filter((v): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)))];
      if (ids.length === 0) return sendError(res, 400, 'Bad request', 'ต้องระบุ ids ของใบสมัคร');
      if (ids.length > MAX_IDS) return sendError(res, 400, 'Bad request', `ทำได้ครั้งละไม่เกิน ${MAX_IDS} คน`);
      const reasonId = body.reasonId == null ? null : Number(body.reasonId);
      if (reasonId !== null && !Number.isInteger(reasonId)) return sendError(res, 400, 'Bad request', 'เหตุผลไม่ถูกต้อง');
      const { rows } = await dbQuery<{ id: string; job_id: string | null; department_code: string | null; created_by_name: string | null }>(
        `select id::text as id, job_id, department_code, created_by_name from ${APPS} where id = any($1::uuid[])`,
        [ids],
      );
      const allowed: string[] = [];
      for (const r of rows) if (await isApplicationInWriteScope(req.user, r)) allowed.push(r.id);
      if (allowed.length === 0) return sendError(res, 403, 'Forbidden', 'ใบสมัครที่เลือกอยู่นอกแผนกของคุณ');
      const out = await setNoCall(allowed, reasonId, actorOf(req));
      await auditFromAuthed(req, {
        action: reasonId === null ? 'application.no_call.clear' : 'application.no_call.set',
        entityType: 'job_application',
        entityId: allowed.length === 1 ? allowed[0] : `bulk:${allowed.length}`,
        after: { reasonId, ...out, outOfScope: rows.length - allowed.length },
      });
      return res.status(200).json({ ...out, skipped: ids.length - allowed.length });
    }

    if (!canManage(req)) return sendError(res, 403, 'Forbidden', 'แก้รายการเหตุผลได้เฉพาะ Supervisor ขึ้นไป');
    if (method === 'POST') {
      const item = await createNoCallReason({ label: body.label, box: body.box }, actorOf(req));
      await auditFromAuthed(req, { action: 'applicant_no_call_reason.create', entityType: 'applicant_no_call_reason', entityId: String(item.id), after: item });
      return res.status(200).json({ item });
    }
    if (method === 'PATCH') {
      const id = Number(body.id);
      if (!Number.isInteger(id)) return sendError(res, 400, 'Bad request', 'ต้องระบุ id');
      const r = await updateNoCallReason(id, { label: body.label, active: body.active }, actorOf(req));
      if (!r) return sendError(res, 404, 'Not found', 'ไม่พบเหตุผลนี้');
      await auditFromAuthed(req, { action: 'applicant_no_call_reason.update', entityType: 'applicant_no_call_reason', entityId: String(id), before: r.before, after: r.after });
      return res.status(200).json({ item: r.after });
    }
    res.setHeader?.('Allow', 'GET, POST, PATCH');
    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (/ต้องใส่ชื่อ|มีเหตุผลชื่อนี้|ไม่พบเหตุผลนี้/.test(msg)) return sendError(res, 400, 'Bad request', msg);
    return handleApiError(res, e, 'applicant-no-call', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'job-applications');
