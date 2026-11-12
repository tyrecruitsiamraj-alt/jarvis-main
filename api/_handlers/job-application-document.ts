import { dbQuery } from '../_lib/postgres.js';
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { getString, readJsonBody } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { normalizeDocument } from '../_lib/publicApplications.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { isApplicationInWriteScope } from '../_lib/applicationScope.js';

const tbl = tableInAppSchema('public_job_applications');

type Row = {
  document_filename: string | null;
  document_mime: string | null;
  document_bytes: Buffer | null;
  job_id: string | null;
  department_code: string | null;
};

/**
 * POST { id, document: { base64, filename, mime } } — เจ้าหน้าที่แนบไฟล์ให้ใบที่มีอยู่ (เจ้าของ 12 พ.ย. 2569:
 * "นำเข้า excel เสร็จขึ้นมาข้างๆชื่อให้ Chose ไฟล์") · ตรวจชนิด/ขนาดตัวเดียวกับหน้าสมัคร (PDF/JPG/PNG ≤ 3MB)
 * · จำกัด BU เหมือน GET · ใบละไฟล์ แนบใหม่ = แทนไฟล์เดิม
 */
async function upload(req: AuthedReq, res: ApiRes) {
  const body = ((await readJsonBody(req)) ?? {}) as Record<string, unknown>;
  const id = getString(body.id);
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return sendError(res, 400, 'Bad request', 'id ไม่ถูกต้อง');
  const doc = normalizeDocument(body.document);
  if (doc.ok === false) return sendError(res, 400, 'Bad request', doc.message);
  if (!doc.value) return sendError(res, 400, 'Bad request', 'เลือกไฟล์ก่อน');
  const { rows } = await dbQuery<Pick<Row, 'job_id' | 'department_code'>>(`select job_id, department_code from ${tbl} where id = $1 limit 1`, [id]);
  const row = rows[0];
  if (!row) return sendError(res, 404, 'Not found', 'ไม่พบใบสมัครนี้');
  if (!(await isApplicationInWriteScope(req.user, row))) {
    return sendError(res, 403, 'Forbidden', 'ไม่มีสิทธิ์เข้าถึงใบสมัครของแผนกอื่น');
  }
  await dbQuery(
    `update ${tbl} set document_filename = $2, document_mime = $3, document_size = $4, document_bytes = $5 where id = $1`,
    [id, doc.value.filename, doc.value.mime, doc.value.size, Buffer.from(doc.value.base64, 'base64')],
  );
  await auditFromAuthed(req, {
    action: 'job_application.document_attach',
    entityType: 'job_application',
    entityId: id,
    after: { filename: doc.value.filename, mime: doc.value.mime, size: doc.value.size },
  });
  return res.status(200).json({ ok: true, filename: doc.value.filename });
}

/** GET /api/job-application-document?id=<uuid> → { filename, mime, dataBase64 } (authed) · POST = แนบไฟล์ */
async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'POST') {
    try {
      return await upload(req, res);
    } catch (e) {
      return handleApiError(res, e, 'job-application-document POST', { userId: req.user.sub });
    }
  }
  if (method !== 'GET') {
    res.setHeader?.('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const id = getString(req.query?.id);
  if (!id) return sendError(res, 400, 'Bad request', 'id required');

  try {
    const { rows } = await dbQuery<Row>(
      `select document_filename, document_mime, document_bytes, job_id, department_code from ${tbl} where id = $1 limit 1`,
      [id],
    );
    const row = rows[0];
    if (!row || !row.document_bytes) return sendError(res, 404, 'Not found', 'ไม่มีไฟล์แนบ');

    // จำกัดตาม BU — กันดาวน์โหลดไฟล์แนบ (CV) ของผู้สมัครงานแผนกอื่นด้วยการเดา id
    // (ยอมใบที่จำแผนกตัวเองไว้ด้วย — ใบขอปิดแล้วต้องยังโหลด CV ได้ถ้าเป็นแผนกตัวเอง)
    if (!(await isApplicationInWriteScope(req.user, row))) {
      return sendError(res, 403, 'Forbidden', 'ไม่มีสิทธิ์เข้าถึงใบสมัครของแผนกอื่น');
    }
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json({
      filename: row.document_filename || 'document',
      mime: row.document_mime || 'application/octet-stream',
      dataBase64: Buffer.from(row.document_bytes).toString('base64'),
    });
  } catch (e) {
    return handleApiError(res, e, 'job-application-document GET', { userId: req.user.sub });
  }
}

export default withRbac(handler, 'job-applications');
