import { dbQuery } from '../_lib/postgres.js';
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { getString } from '../_lib/body.js';
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

/** GET /api/job-application-document?id=<uuid> → { filename, mime, dataBase64 } (authed) */
async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    res.setHeader?.('Allow', 'GET');
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
