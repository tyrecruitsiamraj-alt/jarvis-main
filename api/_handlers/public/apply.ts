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

    const docBytes = v.document ? Buffer.from(v.document.base64, 'base64') : null;

    const { rows } = await dbQuery<{ id: string }>(
      `
      insert into ${tbl}
        (full_name, title_prefix, first_name, last_name, phone, age, gender,
         province, district, subdistrict, postal_code,
         weight_kg, height_cm, education, referral_source,
         document_filename, document_mime, document_size, document_bytes,
         job_id, job_title, unit_name, position_interest, note)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
              $12, $13, $14, $15, $16, $17, $18, $19,
              $20, $21, $22, $23, $24)
      returning id
      `,
      [
        v.fullName,
        v.titlePrefix,
        v.firstName,
        v.lastName,
        v.phone,
        v.age,
        v.gender,
        v.province,
        v.district,
        v.subdistrict,
        v.postalCode,
        v.weightKg,
        v.heightCm,
        v.education,
        v.referralSource,
        v.document?.filename ?? null,
        v.document?.mime ?? null,
        v.document?.size ?? null,
        docBytes,
        v.jobId,
        v.jobTitle,
        v.unitName,
        v.positionInterest,
        v.note,
      ],
    );
    const id = rows[0]?.id;
    if (!id) return sendError(res, 500, 'Failed to submit application');

    return res.status(201).json({ ok: true, id });
  } catch (e) {
    return handleApiError(res, e, 'public/apply');
  }
}
