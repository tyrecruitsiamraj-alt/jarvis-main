/**
 * POST /api/application-dispatch { jobId } — ปุ่ม "🤖 ส่งให้ AI โทร" ในกล่องงาน
 * (S8 · เจ้าของเคาะ 15 ส.ค. 2569: ส่งอัตโนมัติตอนกรอก + ปุ่ม manual สำหรับใบตกค้าง
 * เช่น ใบที่กรอกก่อนเปิดระบบ / ใบที่เพิ่งแก้เบอร์)
 *
 * server เป็นคนคัด "ใบที่เข้าเกณฑ์" เองทั้งหมด (client ส่งได้แค่ jobId — กันยัดเบอร์):
 *   ใบผูกใบขอนี้ · เบอร์ E.164 ได้ (087) · ยังไม่ถูกโทร (นิยามเดียวกับ dashboard —
 *   applicantOverviewSql) · ไม่อยู่ในคิว · ไม่เป็น Lead · ไม่ถูก claim (มีคนถืองานอยู่)
 * กันชั้นสุดท้าย (held/suppressed phone) อยู่ใน insertQueueItems ตามเดิม
 */
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody, getString } from '../_lib/body.js';
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { loadScopedJobIdSet } from '../_lib/siamrajUnitRequests.js';
import { enqueueLumosInterviewForApplications } from '../_lib/lumosDispatch.js';
import { CALLED_SQL, IN_QUEUE_SQL } from '../_lib/applicantOverviewSql.js';
import { auditFromAuthed } from '../_lib/audit.js';

const tbl = tableInAppSchema('public_job_applications');

async function handler(req: AuthedReq, res: ApiRes) {
  if ((req.method || '').toUpperCase() !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return sendError(res, 405, 'Method not allowed');
  }
  try {
    const raw = await readJsonBody(req);
    const jobId = (getString((raw as Record<string, unknown>)?.jobId) ?? '').trim();
    if (!jobId) return sendError(res, 400, 'Bad request', 'jobId จำเป็น');

    // BU scope — ส่งโทรได้เฉพาะใบขอที่ตัวเองเห็น
    const scopedJobIds = await loadScopedJobIdSet(req.user);
    if (scopedJobIds && !scopedJobIds.has(jobId)) {
      return sendError(res, 403, 'Forbidden', 'ไม่มีสิทธิ์ส่งโทรใบขอของแผนกอื่น');
    }

    // เกณฑ์ "เข้าเกณฑ์" — นิยามเดียวกับถังบน dashboard (ห้ามนิยามซ้ำ)
    const { rows: eligible } = await dbQuery<{
      id: string;
      full_name: string;
      phone: string;
      job_id: string | null;
      job_title: string | null;
      unit_name: string | null;
      position_interest: string | null;
    }>(
      `select a.id, a.full_name, a.phone, a.job_id, a.job_title, a.unit_name, a.position_interest
         from ${tbl} a
        where a.job_id = $1
          and a.phone_e164 is not null
          and not a.is_lead
          and a.claimed_by is null
          and not ${CALLED_SQL}
          and not ${IN_QUEUE_SQL}
        order by a.created_at asc
        limit 200`,
      [jobId],
    );

    if (eligible.length === 0) {
      return res.status(200).json({ eligible: 0, queued: 0, duplicated: [], skipped: [] });
    }

    const outcome = await enqueueLumosInterviewForApplications(jobId, eligible);

    void auditFromAuthed(req, {
      action: 'application-dispatch.send',
      entityType: 'job_application',
      entityId: jobId,
      after: { eligible: eligible.length, queued: outcome.queued, skipped: outcome.skipped.length },
    });

    return res.status(200).json({ eligible: eligible.length, ...outcome });
  } catch (e) {
    return handleApiError(res, e, 'application-dispatch', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'job-applications');
