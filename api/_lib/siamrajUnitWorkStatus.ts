import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';

const table = tableInAppSchema('siamraj_unit_work_status');

export const UNIT_REQUEST_WORK_STATUSES = [
  'in_progress',
  'waiting_inform',
  'waiting_interview',
  'waiting_start',
] as const;

export type UnitRequestWorkStatus = (typeof UNIT_REQUEST_WORK_STATUSES)[number];

export type UnitWorkStatusRow = {
  request_no: string;
  status: UnitRequestWorkStatus;
  person_first_name: string | null;
  person_last_name: string | null;
  status_date: string | null;
  updated_at: string | null;
};

type Row = {
  request_no: string;
  status: string;
  person_first_name: string | null;
  person_last_name: string | null;
  status_date: string | Date | null;
  updated_at: string | Date | null;
};

function isMissingTable(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /siamraj_unit_work_status/i.test(msg) && /(does not exist|relation)/i.test(msg);
}

function toIso(v: string | Date | null): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

function toYmd(v: string | Date | null): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export function isUnitRequestWorkStatus(v: unknown): v is UnitRequestWorkStatus {
  return typeof v === 'string' && (UNIT_REQUEST_WORK_STATUSES as readonly string[]).includes(v);
}

function cleanName(v: unknown, field: string): string | null {
  if (v == null) return null;
  if (typeof v !== 'string') throw new Error(`${field} must be a string`);
  const t = v.trim();
  if (!t) return null;
  if (t.length > 120) throw new Error(`${field} must be at most 120 characters`);
  return t;
}

function cleanStatusDate(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v !== 'string') throw new Error('status_date must be YYYY-MM-DD or null');
  const s = v.trim().slice(0, 10);
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('status_date must be YYYY-MM-DD');
  return s;
}

function mapRow(r: Row): UnitWorkStatusRow {
  return {
    request_no: r.request_no,
    status: isUnitRequestWorkStatus(r.status) ? r.status : 'in_progress',
    person_first_name: r.person_first_name,
    person_last_name: r.person_last_name,
    status_date: toYmd(r.status_date),
    updated_at: toIso(r.updated_at),
  };
}

export async function getUnitWorkStatus(requestNo: string): Promise<UnitWorkStatusRow | null> {
  const key = requestNo.trim();
  if (!key) return null;
  try {
    const rows = await dbQuery<Row>(
      `select request_no, status, person_first_name, person_last_name, status_date, updated_at
       from ${table} where request_no = $1`,
      [key],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  } catch (e) {
    if (isMissingTable(e)) return null;
    throw e;
  }
}

export async function getUnitWorkStatusMap(requestNos: string[]): Promise<Map<string, UnitWorkStatusRow>> {
  const keys = [...new Set(requestNos.map((k) => k.trim()).filter(Boolean))];
  const map = new Map<string, UnitWorkStatusRow>();
  if (keys.length === 0) return map;
  try {
    const rows = await dbQuery<Row>(
      `select request_no, status, person_first_name, person_last_name, status_date, updated_at
       from ${table} where request_no = any($1::text[])`,
      [keys],
    );
    for (const r of rows) map.set(r.request_no, mapRow(r));
  } catch (e) {
    if (isMissingTable(e)) return map;
    throw e;
  }
  return map;
}

export async function upsertUnitWorkStatus(input: {
  requestNo: string;
  status: UnitRequestWorkStatus;
  person_first_name?: unknown;
  person_last_name?: unknown;
  status_date?: unknown;
  userId?: string | null;
}): Promise<UnitWorkStatusRow> {
  const requestNo = input.requestNo.trim();
  if (!requestNo) throw new Error('request_no is required');
  if (!isUnitRequestWorkStatus(input.status)) throw new Error('invalid status');

  const needsPerson = input.status !== 'in_progress';
  let first = cleanName(input.person_first_name, 'person_first_name');
  let last = cleanName(input.person_last_name, 'person_last_name');
  let statusDate = cleanStatusDate(input.status_date);

  if (!needsPerson) {
    first = null;
    last = null;
    statusDate = null;
  } else {
    if (!first) throw new Error('กรุณากรอกชื่อ');
    if (!last) throw new Error('กรุณากรอกนามสกุล');
  }

  const rows = await dbQuery<Row>(
    `insert into ${table} (
       request_no, status, person_first_name, person_last_name, status_date, updated_by_user_id, updated_at
     ) values ($1, $2, $3, $4, $5::date, $6, now())
     on conflict (request_no) do update set
       status = excluded.status,
       person_first_name = excluded.person_first_name,
       person_last_name = excluded.person_last_name,
       status_date = excluded.status_date,
       updated_by_user_id = excluded.updated_by_user_id,
       updated_at = now()
     returning request_no, status, person_first_name, person_last_name, status_date, updated_at`,
    [requestNo, input.status, first, last, statusDate, input.userId ?? null],
  );
  if (!rows[0]) throw new Error('upsert failed');
  return mapRow(rows[0]);
}
