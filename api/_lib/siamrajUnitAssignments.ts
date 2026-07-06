import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';

const table = tableInAppSchema('siamraj_unit_assignments');

export type UnitAssignment = {
  request_no: string;
  recruiter_name: string | null;
  screener_name: string | null;
  opl_name: string | null;
  updated_at: string | null;
};

type Row = {
  request_no: string;
  recruiter_name: string | null;
  screener_name: string | null;
  opl_name: string | null;
  updated_at: string | Date | null;
};

const SELECT_COLS = 'request_no, recruiter_name, screener_name, opl_name, updated_at';

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
    opl_name: r.opl_name,
    updated_at: toIso(r.updated_at),
  };
}

/** ผู้รับผิดชอบของใบขอเดียว */
export async function getUnitAssignment(requestNo: string): Promise<UnitAssignment | null> {
  const key = requestNo.trim();
  if (!key) return null;
  const { rows } = await dbQuery<Row>(
    `select ${SELECT_COLS} from ${table} where request_no = $1`,
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
    `select ${SELECT_COLS} from ${table} where request_no = ANY($1::text[])`,
    [keys],
  );
  for (const r of rows) map.set(r.request_no, mapRow(r));
  return map;
}

/** สร้าง/อัปเดตผู้รับผิดชอบของใบขอ — อัปเดตเฉพาะฟิลด์ที่ส่งมา */
export async function upsertUnitAssignment(input: {
  requestNo: string;
  recruiterName?: unknown;
  screenerName?: unknown;
  oplName?: unknown;
  userId?: string | null;
}): Promise<UnitAssignment> {
  const key = input.requestNo.trim();
  if (!key) throw new Error('request_no is required');

  const hasRecruiter = input.recruiterName !== undefined;
  const hasScreener = input.screenerName !== undefined;
  const hasOpl = input.oplName !== undefined;

  const recruiter = hasRecruiter ? clean(input.recruiterName) : null;
  const screener = hasScreener ? clean(input.screenerName) : null;
  const opl = hasOpl ? clean(input.oplName) : null;

  const { rows: existing } = await dbQuery<Row>(
    `select ${SELECT_COLS} from ${table} where request_no = $1`,
    [key],
  );

  if (!existing[0]) {
    const { rows } = await dbQuery<Row>(
      `
      insert into ${table} (request_no, recruiter_name, screener_name, opl_name, updated_by_user_id, updated_at)
      values ($1, $2, $3, $4, $5, now())
      returning ${SELECT_COLS}
      `,
      [
        key,
        hasRecruiter ? recruiter : null,
        hasScreener ? screener : null,
        hasOpl ? opl : null,
        input.userId ?? null,
      ],
    );
    return mapRow(rows[0]);
  }

  const cur = existing[0];
  const nextRecruiter = hasRecruiter ? recruiter : cur.recruiter_name;
  const nextScreener = hasScreener ? screener : cur.screener_name;
  const nextOpl = hasOpl ? opl : cur.opl_name;

  const { rows } = await dbQuery<Row>(
    `
    update ${table}
    set recruiter_name = $2,
        screener_name = $3,
        opl_name = $4,
        updated_by_user_id = $5,
        updated_at = now()
    where request_no = $1
    returning ${SELECT_COLS}
    `,
    [key, nextRecruiter, nextScreener, nextOpl, input.userId ?? null],
  );
  return mapRow(rows[0]);
}

/** bulk import OPL — upsert opl_name ตาม request_no (คงสรรหา/คัดสรรเดิม) */
export async function bulkUpsertOplNames(
  items: Array<{ requestNo: string; oplName: string }>,
  userId?: string | null,
): Promise<{ inserted: number; updated: number }> {
  const cleaned = items
    .map((i) => ({ requestNo: i.requestNo.trim(), oplName: clean(i.oplName) }))
    .filter((i): i is { requestNo: string; oplName: string } => Boolean(i.requestNo && i.oplName));

  if (cleaned.length === 0) return { inserted: 0, updated: 0 };

  const requestNos = cleaned.map((i) => i.requestNo);
  const oplNames = cleaned.map((i) => i.oplName);

  const { rows: existing } = await dbQuery<{ request_no: string }>(
    `select request_no from ${table} where request_no = any($1::text[])`,
    [requestNos],
  );
  const existingSet = new Set(existing.map((r) => r.request_no));
  const updated = cleaned.filter((i) => existingSet.has(i.requestNo)).length;
  const inserted = cleaned.length - updated;

  await dbQuery(
    `
    insert into ${table} (request_no, opl_name, updated_by_user_id, updated_at)
    select r, o, $3, now()
    from unnest($1::text[], $2::text[]) as u(r, o)
    on conflict (request_no) do update set
      opl_name = excluded.opl_name,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = now()
    `,
    [requestNos, oplNames, userId ?? null],
  );

  return { inserted, updated };
}
