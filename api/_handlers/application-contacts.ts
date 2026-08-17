/**
 * GET/POST /api/application-contacts — บันทึก/อ่านผลการติดต่อผู้สมัคร (ลิสต์ข้อ 7 · 14 ส.ค. 2569)
 *
 * POST { applicationId, ok, reasonId?, reasonLabel?, appointmentAt?, appointmentPlace?,
 *        jobId?, jobLabel?, note? }
 * GET  ?applicationId= → { items }
 *
 * กติกา (ตรวจฝั่ง server ห้ามเชื่อฟอร์ม):
 * - ok=false ต้องมีเหตุผล (reasonLabel) — "ไม่สำเร็จเฉย ๆ" ไม่บอกอะไรใคร
 * - นัด (appointmentAt) มีได้เฉพาะ ok=true · ปี พ.ศ. โดนดักเหมือนวันนัดผลโทร
 * - rbac เดียวกับใบสมัคร ('job-applications') — ใครเห็นใบ คนนั้นบันทึกผลติดต่อได้
 */
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody, getString } from '../_lib/body.js';
import { createContactLog, listContactLogs } from '../_lib/applicationContacts.js';
import { isApplicationInWriteScope, loadApplicationScopeRowOrNull } from '../_lib/applicationScope.js';
import { resolveAppointment } from '../../src/lib/callAppointment.js';
import { auditFromAuthed } from '../_lib/audit.js';

const OUT_OF_SCOPE = 'ไม่มีสิทธิ์เข้าถึงใบสมัครของแผนกอื่น';

/** ตรวจว่าใบนี้อยู่ในแผนกผู้ใช้ก่อนอ่าน/เขียน — คืน error ที่ต้องตอบ หรือ null ถ้าผ่าน */
async function guardScope(req: AuthedReq, res: ApiRes, applicationId: string): Promise<boolean> {
  const row = await loadApplicationScopeRowOrNull(applicationId);
  if (!row) {
    sendError(res, 404, 'Not found', 'ไม่พบใบสมัคร');
    return false;
  }
  if (!(await isApplicationInWriteScope(req.user, row))) {
    sendError(res, 403, 'Forbidden', OUT_OF_SCOPE);
    return false;
  }
  return true;
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') {
      const applicationId = (getString(req.query?.applicationId) ?? '').trim();
      if (!applicationId) return sendError(res, 400, 'Bad request', 'applicationId จำเป็น');
      if (!(await guardScope(req, res, applicationId))) return;
      const items = await listContactLogs(applicationId);
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json({ items });
    }

    if (method === 'POST') {
      const raw = await readJsonBody(req);
      const body = (typeof raw === 'object' && raw !== null ? raw : {}) as {
        applicationId?: string;
        ok?: boolean;
        reasonId?: string | null;
        reasonLabel?: string | null;
        appointmentAt?: string | null;
        appointmentPlace?: string | null;
        jobId?: string | null;
        jobLabel?: string | null;
        note?: string | null;
      };
      const applicationId = (body.applicationId ?? '').trim();
      if (!applicationId) return sendError(res, 400, 'Bad request', 'applicationId จำเป็น');
      if (typeof body.ok !== 'boolean') {
        return sendError(res, 400, 'Bad request', 'ต้องระบุว่าติดต่อสำเร็จหรือไม่ (ok)');
      }
      // จำกัดตาม BU ก่อนเขียน — createContactLog ดันสถานะใบด้วย ห้ามให้ข้ามแผนกด้วย id
      if (!(await guardScope(req, res, applicationId))) return;

      if (!body.ok && !(body.reasonLabel ?? '').trim()) {
        return sendError(res, 400, 'Bad request', 'ติดต่อไม่สำเร็จต้องเลือกเหตุผล');
      }

      // วันนัด: ตรวจด้วยด่านเดียวกับผลโทร (รูปแบบ + กันปี พ.ศ. + เที่ยงวันไทย)
      let appointmentAt: string | null = null;
      if (body.ok && (body.appointmentAt ?? '').toString().trim()) {
        const decided = resolveAppointment({
          outcome: 'confirmed',
          scope: 'scheduled',
          appointmentAt: body.appointmentAt,
          now: new Date().toISOString(),
        });
        if (!decided.ok) return sendError(res, 400, 'Bad request', decided.reason ?? 'วันนัดไม่ถูกต้อง');
        appointmentAt = decided.appointmentAt;
      }

      const log = await createContactLog({
        applicationId,
        ok: body.ok,
        reasonId: body.reasonId ?? null,
        reasonLabel: body.reasonLabel,
        appointmentAt,
        appointmentPlace: body.appointmentPlace,
        jobId: body.jobId,
        jobLabel: body.jobLabel,
        note: body.note,
        createdBy: req.user?.sub ?? null,
        createdByName: req.user?.email ?? null,
      });

      void auditFromAuthed(req, {
        action: 'application-contact.log',
        entityType: 'application_contact_log',
        entityId: log.id,
        after: {
          applicationId,
          ok: body.ok,
          appointmentAt: log.appointmentAt,
          jobId: log.jobId,
          reasonLabel: log.reasonLabel,
        },
      });

      return res.status(201).json({ item: log });
    }

    res.setHeader?.('Allow', 'GET, POST');
    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    return handleApiError(res, e, 'application-contacts', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'job-applications');
