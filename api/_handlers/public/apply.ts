import { dbQuery } from '../../_lib/postgres.js';
import { sendError, handleApiError, type ApiReq, type ApiRes } from '../../_lib/http.js';
import { readJsonBody } from '../../_lib/body.js';
import { tableInAppSchema } from '../../_lib/schema.js';
import { rateLimitOrReject } from '../../_lib/rateLimit.js';
import { validatePublicApplication } from '../../_lib/publicApplications.js';

const tbl = tableInAppSchema('public_job_applications');

/** POST /api/public/apply — รับใบสมัครจากหน้า /apply โดยไม่ต้องล็อกอิน */
export default async function handler(req: ApiReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'POST') return sendError(res, 405, 'Method not allowed');

  if (!rateLimitOrReject(req, res, 'public-apply', 5, 10 * 60 * 1000)) return;

  try {
    const parsed = validatePublicApplication(await readJsonBody(req));
    if (!parsed.ok) return sendError(res, 400, 'Bad request', parsed.message);
    const v = parsed.value;

    const { rows } = await dbQuery<{ id: string }>(
      `
      insert into ${tbl}
        (full_name, phone, job_id, job_title, unit_name, position_interest, note)
      values ($1, $2, $3, $4, $5, $6, $7)
      returning id
      `,
      [v.fullName, v.phone, v.jobId, v.jobTitle, v.unitName, v.positionInterest, v.note],
    );
    const id = rows[0]?.id;
    if (!id) return sendError(res, 500, 'Failed to submit application');

    return res.status(201).json({ ok: true, id });
  } catch (e) {
    return handleApiError(res, e, 'public/apply');
  }
}
