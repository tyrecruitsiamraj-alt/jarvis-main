import { dbQuery } from '../_lib/postgres.js';
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody, getString } from '../_lib/body.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { auditFromAuthed } from '../_lib/audit.js';

const tbl = tableInAppSchema('public_job_applications');

type ApplicationStatus = 'new' | 'contacted' | 'converted' | 'rejected';
const STATUSES: ApplicationStatus[] = ['new', 'contacted', 'converted', 'rejected'];

function isStatus(v: unknown): v is ApplicationStatus {
  return typeof v === 'string' && (STATUSES as string[]).includes(v);
}

type Row = {
  id: string;
  full_name: string;
  title_prefix: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string;
  age: number | null;
  gender: string | null;
  province: string | null;
  district: string | null;
  subdistrict: string | null;
  postal_code: string | null;
  job_id: string | null;
  job_title: string | null;
  unit_name: string | null;
  position_interest: string | null;
  note: string | null;
  status: string;
  admin_note: string | null;
  created_at: string | Date;
};

function toIso(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function toApplication(r: Row) {
  return {
    id: r.id,
    full_name: r.full_name,
    title_prefix: r.title_prefix || undefined,
    first_name: r.first_name || undefined,
    last_name: r.last_name || undefined,
    phone: r.phone,
    age: r.age ?? undefined,
    gender: r.gender || undefined,
    province: r.province || undefined,
    district: r.district || undefined,
    subdistrict: r.subdistrict || undefined,
    postal_code: r.postal_code || undefined,
    job_id: r.job_id || undefined,
    job_title: r.job_title || undefined,
    unit_name: r.unit_name || undefined,
    position_interest: r.position_interest || undefined,
    note: r.note || undefined,
    status: r.status,
    admin_note: r.admin_note || undefined,
    created_at: toIso(r.created_at),
  };
}

/** GET /api/job-applications
 *   ?job_id=<id>  → applicants submitted for that job (newest first)
 *   ?counts=1     → { counts: { [job_id]: n } } for badge display on the board
 */
async function patchStatus(req: AuthedReq, res: ApiRes) {
  const raw = await readJsonBody(req);
  if (typeof raw !== 'object' || raw === null) {
    return sendError(res, 400, 'Bad request', 'Invalid JSON body');
  }
  const b = raw as Record<string, unknown>;
  const id = getString(b.id);
  if (!id) return sendError(res, 400, 'Bad request', 'id required');

  const hasStatus = b.status !== undefined;
  const hasNote = b.admin_note !== undefined;
  if (!hasStatus && !hasNote) {
    return sendError(res, 400, 'Bad request', 'ต้องระบุ status หรือ admin_note');
  }
  if (hasStatus && !isStatus(b.status)) {
    return sendError(res, 400, 'Bad request', 'สถานะไม่ถูกต้อง');
  }
  const adminNote =
    b.admin_note === null || b.admin_note === ''
      ? null
      : typeof b.admin_note === 'string'
        ? b.admin_note.trim().slice(0, 2000)
        : null;

  const { rows: beforeRows } = await dbQuery<Row>(`select * from ${tbl} where id = $1 limit 1`, [id]);
  const before = beforeRows[0];
  if (!before) return sendError(res, 404, 'Not found');

  const { rows } = await dbQuery<Row>(
    `
    update ${tbl}
    set status = coalesce($2, status),
        admin_note = case when $3::boolean then $4 else admin_note end,
        updated_at = now()
    where id = $1
    returning *
    `,
    [id, hasStatus ? (b.status as string) : null, hasNote, adminNote],
  );
  const row = rows[0];
  if (!row) return sendError(res, 404, 'Not found');

  await auditFromAuthed(req, {
    action: 'job_application.update',
    entityType: 'job_application',
    entityId: row.id,
    before: { status: before.status, admin_note: before.admin_note },
    after: { status: row.status, admin_note: row.admin_note },
  });

  return res.status(200).json({ item: toApplication(row) });
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'PATCH') {
    try {
      return await patchStatus(req, res);
    } catch (e) {
      return handleApiError(res, e, 'job-applications PATCH', { userId: req.user.sub });
    }
  }

  if (method !== 'GET') {
    res.setHeader?.('Allow', 'GET, PATCH');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader?.('Cache-Control', 'no-store');

  try {
    if (getString(req.query?.counts) === '1') {
      const { rows } = await dbQuery<{ job_id: string; n: string }>(
        `select job_id, count(*)::text as n from ${tbl} where job_id is not null group by job_id`,
      );
      const counts: Record<string, number> = {};
      for (const r of rows) counts[r.job_id] = Number(r.n);
      return res.status(200).json({ counts });
    }

    const jobId = getString(req.query?.job_id);
    const params: unknown[] = [];
    let where = '';
    if (jobId) {
      params.push(jobId);
      where = `where job_id = $1`;
    }

    const { rows } = await dbQuery<Row>(
      `select * from ${tbl} ${where} order by created_at desc limit 500`,
      params,
    );
    return res.status(200).json({ items: rows.map(toApplication) });
  } catch (e) {
    return handleApiError(res, e, 'job-applications GET', { userId: req.user.sub });
  }
}

export default withRbac(handler, 'job-applications');
