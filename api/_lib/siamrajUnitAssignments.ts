import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';

const table = tableInAppSchema('siamraj_unit_assignments');

export type UnitAssignment = {
  request_no: string;
  recruiter_name: string | null;
  screener_name: string | null;
  updated_at: string | null;
};

type Row = {
  request_no: string;
  recruiter_name: string | null;
  screener_name: string | null;
  updated_at: string | Date | null;
};

function toIso(v: string | Date | null): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

function clean(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

function mapRow(r: Row): UnitAssignment {
  return {
    request_no: r.request_no,
    recruiter_name: r.recruiter_name,
    screener_name: r.screener_name,
    updated_at: toIso(r.updated_at),
  };
}

/** ผู้รับผิดชอบของใบขอเดียว */
export async function getUnitAssignment(requestNo: string): Promise<UnitAssignment | null> {
  const key = requestNo.trim();
  if (!key) return null;
  const { rows } = await dbQuery<Row>(
    `select request_no, recruiter_name, screener_name, updated_at from ${table} where request_no = $1`,
    [key],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

/** map request_no -> ผู้รับผิดชอบ สำหรับ merge เข้า feed หลายใบพร้อมกัน */
export async function getUnitAssignmentsMap(
  requestNos: string[],
): Promise<Map<string, UnitAssignment>> {
  const keys = [...new Set(requestNos.map((r) => (r || '').trim()).filter(Boolean))];
  const map = new Map<string, UnitAssignment>();
  if (keys.length === 0) return map;

  const { rows } = await dbQuery<Row>(
    `select request_no, recruiter_name, screener_name, updated_at from ${table} where request_no = ANY($1::text[])`,
    [keys],
  );
  for (const r of rows) map.set(r.request_no, mapRow(r));
  return map;
}

/** สร้าง/อัปเดตผู้รับผิดชอบของใบขอ (upsert ด้วย request_no) */
export async function upsertUnitAssignment(input: {
  requestNo: string;
  recruiterName?: unknown;
  screenerName?: unknown;
  userId?: string | null;
}): Promise<UnitAssignment> {
  const key = input.requestNo.trim();
  if (!key) throw new Error('request_no is required');

  const recruiter = clean(input.recruiterName);
  const screener = clean(input.screenerName);

  const { rows } = await dbQuery<Row>(
    `
    insert into ${table} (request_no, recruiter_name, screener_name, updated_by_user_id, updated_at)
    values ($1, $2, $3, $4, now())
    on conflict (request_no) do update set
      recruiter_name = excluded.recruiter_name,
      screener_name = excluded.screener_name,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = now()
    returning request_no, recruiter_name, screener_name, updated_at
    `,
    [key, recruiter, screener, input.userId ?? null],
  );
  return mapRow(rows[0]);
}
