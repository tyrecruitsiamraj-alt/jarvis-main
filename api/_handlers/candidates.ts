import { dbQuery } from '../_lib/postgres.js';
import {
  withAuthDataRoute,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody, getString } from '../_lib/body.js';
import { tableInAppSchema } from '../_lib/schema.js';

const candidatesTable = tableInAppSchema('candidates');

type CandidateRow = {
  id: string;
  title_prefix: string | null;
  first_name: string;
  last_name: string;
  phone: string;
  age: number;
  gender: string;
  drinking: string;
  smoking: string;
  tattoo: string;
  van_driving: string;
  sedan_driving: string;
  address: string;
  lat: number | null;
  lng: number | null;
  application_date: string | Date;
  first_contact_date: string | Date | null;
  first_work_date: string | Date | null;
  status: string;
  responsible_recruiter: string | null;
  risk_percentage: number;
  staffing_track: string | null;
  created_at: string | Date;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function dateToYmd(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') return value;
  return null;
}

function dateToYmdOrUndefined(value: unknown): string | undefined {
  const s = dateToYmd(value);
  return s || undefined;
}

function toIsoString(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

const isGender = (v: unknown): v is 'male' | 'female' | 'other' =>
  v === 'male' || v === 'female' || v === 'other';

const isYesNo = (v: unknown): v is 'yes' | 'no' => v === 'yes' || v === 'no';

const isDrivingResult = (v: unknown): v is 'passed' | 'failed' | 'not_tested' =>
  v === 'passed' || v === 'failed' || v === 'not_tested';

const isCandidateStatus = (
  v: unknown,
): v is 'inprocess' | 'drop' | 'done' | 'waiting_interview' | 'waiting_to_start' | 'no_job' =>
  v === 'inprocess' ||
  v === 'drop' ||
  v === 'done' ||
  v === 'waiting_interview' ||
  v === 'waiting_to_start' ||
  v === 'no_job';

const isStaffingTrack = (v: unknown): v is 'regular' | 'wl' | 'ex' =>
  v === 'regular' || v === 'wl' || v === 'ex';

function normalizeStaffingTrackResponse(s: string | null | undefined): 'regular' | 'wl' | 'ex' {
  if (s === 'wl' || s === 'ex') return s;
  return 'regular';
}

const isDateYmd = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

const parseIntOrNull = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const parseFloatOrNull = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

function toCandidateResponse(row: CandidateRow) {
  return {
    id: row.id,
    ...(row.title_prefix?.trim() ? { title_prefix: row.title_prefix.trim() } : {}),
    first_name: row.first_name,
    last_name: row.last_name,
    phone: row.phone,
    age: row.age,
    gender: row.gender,
    drinking: row.drinking,
    smoking: row.smoking,
    tattoo: row.tattoo,
    van_driving: row.van_driving,
    sedan_driving: row.sedan_driving,
    address: row.address,
    lat: row.lat === null ? undefined : row.lat,
    lng: row.lng === null ? undefined : row.lng,
    application_date: dateToYmd(row.application_date) || '',
    first_contact_date: dateToYmdOrUndefined(row.first_contact_date),
    first_work_date: dateToYmdOrUndefined(row.first_work_date),
    status: row.status,
    responsible_recruiter: row.responsible_recruiter || undefined,
    risk_percentage: row.risk_percentage,
    staffing_track: normalizeStaffingTrackResponse(row.staffing_track),
    created_at: toIsoString(row.created_at),
  };
}

function parseLimitOffset(query: Record<string, unknown> | undefined): { limit: number; offset: number } {
  const limitRaw = query?.limit;
  const offsetRaw = query?.offset;
  const limit = Math.min(500, Math.max(1, parseIntOrNull(limitRaw) ?? 100));
  const offset = Math.max(0, parseIntOrNull(offsetRaw) ?? 0);
  return { limit, offset };
}

async function candidatesHandler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    try {
      const id = getString(req.query?.id);
      if (id) {
        const { rows } = await dbQuery<CandidateRow>(
          `select * from ${candidatesTable} where id = $1 limit 1`,
          [id],
        );
        if (rows.length === 0) return sendError(res, 404, 'Not found', 'Candidate not found');
        return res.status(200).json(toCandidateResponse(rows[0]));
      }

      const statusFilter = getString(req.query?.status);
      const statusOk = statusFilter && isCandidateStatus(statusFilter) ? statusFilter : null;
      const { limit, offset } = parseLimitOffset(req.query);

      const { rows } = await dbQuery<CandidateRow>(
        statusOk
          ? `
          select * from ${candidatesTable}
          where status = $1
          order by created_at desc
          limit $2 offset $3
        `
          : `
          select * from ${candidatesTable}
          order by created_at desc
          limit $1 offset $2
        `,
        statusOk ? [statusOk, limit, offset] : [limit, offset],
      );

      return res.status(200).json(rows.map(toCandidateResponse));
    } catch (e) {
      return handleApiError(res, e, 'candidates GET', { userId: req.user.sub });
    }
  }

  if (method === 'POST') {
    try {
      const raw = await readJsonBody(req);
      if (!isPlainObject(raw)) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }

      const titlePrefixRaw = getString(raw.title_prefix);
      const titlePrefix = titlePrefixRaw && titlePrefixRaw.length > 0 ? titlePrefixRaw : null;

      const firstName = getString(raw.first_name);
      const lastName = getString(raw.last_name);
      const phone = getString(raw.phone);
      const address = getString(raw.address);
      const gender = raw.gender;
      const age = parseIntOrNull(raw.age);

      const requiredMissing = [
        !firstName ? 'first_name' : null,
        !lastName ? 'last_name' : null,
        !phone ? 'phone' : null,
        age === null || age <= 0 ? 'age' : null,
        !isGender(gender) ? 'gender' : null,
        !address ? 'address' : null,
      ].filter(Boolean);

      if (requiredMissing.length > 0) {
        return sendError(res, 400, 'Bad request', 'Missing or invalid required fields', {
          fields: requiredMissing,
        });
      }

      const drinking = isYesNo(raw.drinking) ? raw.drinking : 'no';
      const smoking = isYesNo(raw.smoking) ? raw.smoking : 'no';
      const tattoo = isYesNo(raw.tattoo) ? raw.tattoo : 'no';

      const vanDriving = isDrivingResult(raw.van_driving) ? raw.van_driving : 'not_tested';
      const sedanDriving = isDrivingResult(raw.sedan_driving) ? raw.sedan_driving : 'not_tested';

      const applicationDate = isDateYmd(raw.application_date) ? raw.application_date : null;
      const firstContactDate = isDateYmd(raw.first_contact_date) ? raw.first_contact_date : null;
      const firstWorkDate = isDateYmd(raw.first_work_date) ? raw.first_work_date : null;

      const status = isCandidateStatus(raw.status) ? raw.status : null;
      const responsibleRecruiter = getString(raw.responsible_recruiter);

      const riskPercentage =
        parseIntOrNull(raw.risk_percentage) === null ? null : parseIntOrNull(raw.risk_percentage);

      const lat = parseFloatOrNull(raw.lat);
      const lng = parseFloatOrNull(raw.lng);

      const staffingPost =
        raw.staffing_track !== undefined && isStaffingTrack(raw.staffing_track) ? raw.staffing_track : 'regular';

      const { rows } = await dbQuery<CandidateRow>(
        `
          insert into ${candidatesTable} (
            title_prefix,
            first_name, last_name, phone, age, gender,
            drinking, smoking, tattoo,
            van_driving, sedan_driving,
            address, lat, lng,
            application_date, first_contact_date, first_work_date,
            status, responsible_recruiter, risk_percentage,
            staffing_track
          )
          values (
            $1,
            $2, $3, $4, $5, $6,
            $7, $8, $9,
            $10, $11,
            $12, $13, $14,
            COALESCE($15::date, current_date), $16::date, $17::date,
            COALESCE($18, 'inprocess'), $19, COALESCE($20, 0),
            COALESCE($21, 'regular')
          )
          returning *
        `,
        [
          titlePrefix,
          firstName,
          lastName,
          phone,
          age,
          gender,
          drinking,
          smoking,
          tattoo,
          vanDriving,
          sedanDriving,
          address,
          lat,
          lng,
          applicationDate,
          firstContactDate,
          firstWorkDate,
          status,
          responsibleRecruiter,
          riskPercentage,
          staffingPost,
        ],
      );

      const created = rows[0];
      if (!created) {
        return sendError(res, 500, 'Failed to create candidate');
      }

      return res.status(201).json(toCandidateResponse(created));
    } catch (e) {
      return handleApiError(res, e, 'candidates POST', { userId: req.user.sub });
    }
  }

  if (method === 'PATCH') {
    try {
      const raw = await readJsonBody(req);
      if (!isPlainObject(raw)) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      const id = getString(raw.id);
      if (!id) return sendError(res, 400, 'Bad request', 'id is required');

      const { rows: existingRows } = await dbQuery<CandidateRow>(
        `select * from ${candidatesTable} where id = $1 limit 1`,
        [id],
      );
      const cur = existingRows[0];
      if (!cur) return sendError(res, 404, 'Not found', 'Candidate not found');

      const titlePrefixRaw = raw.title_prefix !== undefined ? getString(raw.title_prefix) : undefined;
      const titlePrefix =
        titlePrefixRaw === undefined
          ? cur.title_prefix
          : titlePrefixRaw && titlePrefixRaw.length > 0
            ? titlePrefixRaw
            : null;

      const firstName = raw.first_name !== undefined ? getString(raw.first_name) : cur.first_name;
      const lastName = raw.last_name !== undefined ? getString(raw.last_name) : cur.last_name;
      const phone = raw.phone !== undefined ? getString(raw.phone) : cur.phone;
      const address = raw.address !== undefined ? getString(raw.address) : cur.address;
      const gender = raw.gender !== undefined ? raw.gender : cur.gender;
      const age = raw.age !== undefined ? parseIntOrNull(raw.age) : cur.age;

      if (!firstName || !lastName || !phone || !address || age === null || age <= 0 || !isGender(gender)) {
        return sendError(res, 400, 'Bad request', 'Invalid field values after merge');
      }

      const drinking = raw.drinking !== undefined ? (isYesNo(raw.drinking) ? raw.drinking : cur.drinking) : cur.drinking;
      const smoking = raw.smoking !== undefined ? (isYesNo(raw.smoking) ? raw.smoking : cur.smoking) : cur.smoking;
      const tattoo = raw.tattoo !== undefined ? (isYesNo(raw.tattoo) ? raw.tattoo : cur.tattoo) : cur.tattoo;
      const vanDriving =
        raw.van_driving !== undefined
          ? isDrivingResult(raw.van_driving)
            ? raw.van_driving
            : cur.van_driving
          : cur.van_driving;
      const sedanDriving =
        raw.sedan_driving !== undefined
          ? isDrivingResult(raw.sedan_driving)
            ? raw.sedan_driving
            : cur.sedan_driving
          : cur.sedan_driving;

      const applicationDate =
        raw.application_date !== undefined
          ? isDateYmd(raw.application_date)
            ? raw.application_date
            : dateToYmd(cur.application_date)
          : dateToYmd(cur.application_date);
      const firstContactDate =
        raw.first_contact_date !== undefined
          ? isDateYmd(raw.first_contact_date)
            ? raw.first_contact_date
            : dateToYmd(cur.first_contact_date)
          : dateToYmd(cur.first_contact_date);
      const firstWorkDate =
        raw.first_work_date !== undefined
          ? isDateYmd(raw.first_work_date)
            ? raw.first_work_date
            : dateToYmd(cur.first_work_date)
          : dateToYmd(cur.first_work_date);

      const status =
        raw.status !== undefined
          ? isCandidateStatus(raw.status)
            ? raw.status
            : cur.status
          : cur.status;

      const responsibleRecruiter =
        raw.responsible_recruiter !== undefined
          ? getString(raw.responsible_recruiter)
          : cur.responsible_recruiter;

      const riskPercentage =
        raw.risk_percentage !== undefined ? parseIntOrNull(raw.risk_percentage) ?? cur.risk_percentage : cur.risk_percentage;

      const lat = raw.lat !== undefined ? parseFloatOrNull(raw.lat) : cur.lat;
      const lng = raw.lng !== undefined ? parseFloatOrNull(raw.lng) : cur.lng;

      const curStaffing = normalizeStaffingTrackResponse(cur.staffing_track);
      const staffingTrack =
        raw.staffing_track !== undefined && isStaffingTrack(raw.staffing_track)
          ? raw.staffing_track
          : curStaffing;

      const { rows } = await dbQuery<CandidateRow>(
        `
        update ${candidatesTable} set
          title_prefix = $2,
          first_name = $3, last_name = $4, phone = $5, age = $6, gender = $7,
          drinking = $8, smoking = $9, tattoo = $10,
          van_driving = $11, sedan_driving = $12,
          address = $13, lat = $14, lng = $15,
          application_date = $16::date, first_contact_date = $17::date, first_work_date = $18::date,
          status = $19, responsible_recruiter = $20, risk_percentage = $21,
          staffing_track = $22
        where id = $1
        returning *
      `,
        [
          id,
          titlePrefix,
          firstName,
          lastName,
          phone,
          age,
          gender,
          drinking,
          smoking,
          tattoo,
          vanDriving,
          sedanDriving,
          address,
          lat,
          lng,
          applicationDate,
          firstContactDate,
          firstWorkDate,
          status,
          responsibleRecruiter,
          riskPercentage,
          staffingTrack,
        ],
      );

      const updated = rows[0];
      if (!updated) return sendError(res, 500, 'Failed to update candidate');
      return res.status(200).json(toCandidateResponse(updated));
    } catch (e) {
      return handleApiError(res, e, 'candidates PATCH', { userId: req.user.sub });
    }
  }

  if (method === 'DELETE') {
    try {
      const id = getString(req.query?.id);
      if (!id) return sendError(res, 400, 'Bad request', 'Query id is required');
      const { rows } = await dbQuery<{ id: string }>(
        `delete from ${candidatesTable} where id = $1 returning id`,
        [id],
      );
      if (rows.length === 0) return sendError(res, 404, 'Not found', 'Candidate not found');
      return res.status(200).json({ ok: true, id: rows[0].id });
    } catch (e) {
      return handleApiError(res, e, 'candidates DELETE', { userId: req.user.sub });
    }
  }

  return sendError(res, 405, 'Method not allowed');
}

export default withAuthDataRoute(candidatesHandler);
