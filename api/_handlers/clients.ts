import { dbQuery } from '../_lib/postgres.js';
import {
  withAuth,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody, getString } from '../_lib/body.js';
import { tableInAppSchema } from '../_lib/schema.js';

const tbl = tableInAppSchema('client_workplaces');

type Row = {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  contact_person: string | null;
  contact_phone: string | null;
  default_income: number;
  default_cost: number;
  default_shift: string;
  job_type: string;
  job_category: string;
  is_active: boolean;
  created_at: string | Date;
};

const parseFloatOrNull = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

const parseIntOrNull = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const isJobType = (v: unknown): v is Row['job_type'] =>
  v === 'thai_executive' || v === 'foreign_executive' || v === 'central' || v === 'valet_parking';

const isJobCategory = (v: unknown): v is Row['job_category'] =>
  v === 'private' || v === 'government' || v === 'bank';

function toIso(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function toClient(row: Row) {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    lat: row.lat === null ? undefined : row.lat,
    lng: row.lng === null ? undefined : row.lng,
    contact_person: row.contact_person ?? undefined,
    contact_phone: row.contact_phone ?? undefined,
    default_income: row.default_income,
    default_cost: row.default_cost,
    default_shift: row.default_shift,
    job_type: row.job_type,
    job_category: row.job_category,
    is_active: row.is_active,
    created_at: toIso(row.created_at),
  };
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    try {
      const activeOnly = getString(req.query?.active_only) === '1';
      const { rows } = await dbQuery<Row>(
        activeOnly
          ? `select * from ${tbl} where is_active = true order by name asc`
          : `select * from ${tbl} order by name asc`,
      );
      return res.status(200).json(rows.map(toClient));
    } catch (e) {
      return handleApiError(res, e, 'clients GET', { userId: req.user.sub });
    }
  }

  if (req.user.role !== 'admin') {
    return sendError(res, 403, 'Forbidden', 'Only administrators can modify clients');
  }

  if (method === 'POST') {
    try {
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      const b = raw as Record<string, unknown>;
      const name = getString(b.name);
      if (!name) return sendError(res, 400, 'Bad request', 'name required');
      const address = typeof b.address === 'string' ? b.address : '';
      const lat = parseFloatOrNull(b.lat);
      const lng = parseFloatOrNull(b.lng);
      const contact_person =
        typeof b.contact_person === 'string' && b.contact_person.trim() ? b.contact_person.trim() : null;
      const contact_phone =
        typeof b.contact_phone === 'string' && b.contact_phone.trim() ? b.contact_phone.trim() : null;
      const default_income = parseIntOrNull(b.default_income) ?? 0;
      const default_cost = parseIntOrNull(b.default_cost) ?? 0;
      const default_shift =
        typeof b.default_shift === 'string' && b.default_shift.trim() ? b.default_shift.trim() : '08:00-17:00';
      const job_type = isJobType(b.job_type) ? b.job_type : 'thai_executive';
      const job_category = isJobCategory(b.job_category) ? b.job_category : 'private';
      const is_active = b.is_active === false ? false : true;

      const { rows } = await dbQuery<Row>(
        `
        insert into ${tbl} (
          name, address, lat, lng, contact_person, contact_phone,
          default_income, default_cost, default_shift, job_type, job_category, is_active
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        returning *
      `,
        [
          name,
          address,
          lat,
          lng,
          contact_person,
          contact_phone,
          default_income,
          default_cost,
          default_shift,
          job_type,
          job_category,
          is_active,
        ],
      );

      const row = rows[0];
      if (!row) return sendError(res, 500, 'Failed to create client');
      return res.status(201).json(toClient(row));
    } catch (e) {
      return handleApiError(res, e, 'clients POST', { userId: req.user.sub });
    }
  }

  if (method === 'PATCH') {
    try {
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      const b = raw as Record<string, unknown>;
      const id = getString(b.id);
      if (!id) return sendError(res, 400, 'Bad request', 'id required');

      const { rows: curRows } = await dbQuery<Row>(`select * from ${tbl} where id = $1 limit 1`, [id]);
      const cur = curRows[0];
      if (!cur) return sendError(res, 404, 'Not found', 'Client not found');

      const name = b.name !== undefined ? getString(b.name) : cur.name;
      if (!name) return sendError(res, 400, 'Bad request', 'name cannot be empty');

      const address = b.address !== undefined ? String(b.address) : cur.address;
      const lat = b.lat !== undefined ? parseFloatOrNull(b.lat) : cur.lat;
      const lng = b.lng !== undefined ? parseFloatOrNull(b.lng) : cur.lng;
      const contact_person =
        b.contact_person !== undefined
          ? typeof b.contact_person === 'string'
            ? b.contact_person.trim() || null
            : cur.contact_person
          : cur.contact_person;
      const contact_phone =
        b.contact_phone !== undefined
          ? typeof b.contact_phone === 'string'
            ? b.contact_phone.trim() || null
            : cur.contact_phone
          : cur.contact_phone;
      const default_income =
        b.default_income !== undefined ? parseIntOrNull(b.default_income) ?? cur.default_income : cur.default_income;
      const default_cost =
        b.default_cost !== undefined ? parseIntOrNull(b.default_cost) ?? cur.default_cost : cur.default_cost;
      const default_shift =
        b.default_shift !== undefined && typeof b.default_shift === 'string'
          ? b.default_shift.trim() || cur.default_shift
          : cur.default_shift;
      const job_type =
        b.job_type !== undefined && isJobType(b.job_type) ? b.job_type : cur.job_type;
      const job_category =
        b.job_category !== undefined && isJobCategory(b.job_category) ? b.job_category : cur.job_category;
      const is_active = b.is_active !== undefined ? Boolean(b.is_active) : cur.is_active;

      const { rows } = await dbQuery<Row>(
        `
        update ${tbl} set
          name = $2, address = $3, lat = $4, lng = $5,
          contact_person = $6, contact_phone = $7,
          default_income = $8, default_cost = $9, default_shift = $10,
          job_type = $11, job_category = $12, is_active = $13
        where id = $1
        returning *
      `,
        [
          id,
          name,
          address,
          lat,
          lng,
          contact_person,
          contact_phone,
          default_income,
          default_cost,
          default_shift,
          job_type,
          job_category,
          is_active,
        ],
      );

      const row = rows[0];
      if (!row) return sendError(res, 500, 'Failed to update');
      return res.status(200).json(toClient(row));
    } catch (e) {
      return handleApiError(res, e, 'clients PATCH', { userId: req.user.sub });
    }
  }

  return sendError(res, 405, 'Method not allowed');
}

export default withAuth(handler);
