import { dbQuery } from '../_lib/postgres.js';
import {
  withRbac,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { getString } from '../_lib/body.js';
import { tableInAppSchema } from '../_lib/schema.js';

const tbl = tableInAppSchema('public_job_applications');

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
    created_at: toIso(r.created_at),
  };
}

/** GET /api/job-applications
 *   ?job_id=<id>  → applicants submitted for that job (newest first)
 *   ?counts=1     → { counts: { [job_id]: n } } for badge display on the board
 */
async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    res.setHeader?.('Allow', 'GET');
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
