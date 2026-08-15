/**
 * GET/POST /api/application-attendance — ผลติดตามนัด "มาตามนัด/ไม่มา/เลื่อนนัด"
 * (เจ้าของสั่ง 15 ส.ค. 2569 · migration 089)
 *
 * POST { applicationId, appointmentAt, result: 'showed'|'no_show'|'rescheduled', note? }
 * GET  ?applicationId= → { items }
 *
 * กติกา (ตรวจฝั่ง server ห้ามเชื่อฟอร์ม):
 * - บันทึกได้ตั้งแต่ **วันนัด (เวลาไทย) เป็นต้นไป** — ก่อนวันนัด 400 (กันกดล่วงหน้า)
 * - append-only กดซ้ำเพื่อแก้ได้ ล่าสุดชนะ · **ไม่แตะ status ใบ**
 * - ใครกดก็ได้ (คนอยู่หน้างานวันนัดมักไม่ใช่คนโทร) — ระบบ stamp ชื่อคนกดเสมอ
 * - rbac + ด่าน BU เดียวกับใบสมัคร
 */
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody, getString } from '../_lib/body.js';
import { createAttendanceResult, listAttendanceLogs } from '../_lib/applicationAttendance.js';
import { isApplicationInWriteScope, loadApplicationScopeRowOrNull } from '../_lib/applicationScope.js';
import { canRecordAttendance, isAttendanceResult } from '../../src/lib/appointmentAttendance.js';
import { auditFromAuthed } from '../_lib/audit.js';

const OUT_OF_SCOPE = 'ไม่มีสิทธิ์เข้าถึงใบสมัครของแผนกอื่น';

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
      const items = await listAttendanceLogs(applicationId);
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json({ items });
    }

    if (method === 'POST') {
      const raw = await readJsonBody(req);
      const body = (typeof raw === 'object' && raw !== null ? raw : {}) as {
        applicationId?: string;
        appointmentAt?: string;
        result?: string;
        note?: string | null;
      };
      const applicationId = (body.applicationId ?? '').trim();
      if (!applicationId) return sendError(res, 400, 'Bad request', 'applicationId จำเป็น');
      if (!isAttendanceResult(body.result)) {
        return sendError(res, 400, 'Bad request', 'result ต้องเป็น showed, no_show หรือ rescheduled');
      }
      const appointmentAt = (body.appointmentAt ?? '').trim();
      const appt = new Date(appointmentAt);
      if (!appointmentAt || Number.isNaN(appt.getTime())) {
        return sendError(res, 400, 'Bad request', 'appointmentAt ไม่ถูกต้อง');
      }
      // บันทึกได้ตั้งแต่วันนัด (เวลาไทย) — ด่านเดียวกับที่ฟอร์มใช้ตัดสินว่าโชว์ปุ่มไหม
      if (!canRecordAttendance(appointmentAt, new Date())) {
        return sendError(res, 400, 'Bad request', 'ยังไม่ถึงวันนัด — บันทึกผลได้ตั้งแต่วันนัดเป็นต้นไป');
      }
      if (!(await guardScope(req, res, applicationId))) return;

      let log;
      try {
        log = await createAttendanceResult({
          applicationId,
          appointmentAt,
          result: body.result,
          note: body.note,
          recordedBy: req.user?.sub ?? null,
          recordedByName: req.user?.email ?? null,
        });
      } catch (e) {
        // ตารางยังไม่ migrate → บอกตรง ๆ (แพตเทิร์นเดียวกับ claim/079)
        if ((e as { code?: string })?.code === '42P01') {
          return sendError(
            res,
            503,
            'Migration required',
            'ปุ่มบันทึกผลนัดต้องรัน migration 089 ก่อน (node scripts/migrate.mjs) — ยังใช้ไม่ได้',
          );
        }
        throw e;
      }

      void auditFromAuthed(req, {
        action: 'application-attendance.log',
        entityType: 'application_appointment_result',
        entityId: log.id,
        after: { applicationId, appointmentAt: log.appointmentAt, result: log.result },
      });

      return res.status(201).json({ item: log });
    }

    res.setHeader?.('Allow', 'GET, POST');
    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    return handleApiError(res, e, 'application-attendance', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'job-applications');
