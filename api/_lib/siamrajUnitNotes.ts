import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';

const table = tableInAppSchema('siamraj_unit_notes');
const MAX_NOTE_LENGTH = 2000;

export type UnitNote = {
  request_no: string;
  note: string | null;
  updated_at: string | null;
};

type Row = {
  request_no: string;
  note: string | null;
  updated_at: string | Date | null;
};

function toIso(v: string | Date | null): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

function cleanNote(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  if (t.length > MAX_NOTE_LENGTH) {
    throw new Error(`note must be at most ${MAX_NOTE_LENGTH} characters`);
  }
  return t;
}

function mapRow(r: Row): UnitNote {
  return {
    request_no: r.request_no,
    note: r.note,
    updated_at: toIso(r.updated_at),
  };
}

export async function getUnitNote(requestNo: string): Promise<UnitNote | null> {
  const key = requestNo.trim();
  if (!key) return null;
  const { rows } = await dbQuery<Row>(
    `select request_no, note, updated_at from ${table} where request_no = $1`,
    [key],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getUnitNotesMap(requestNos: string[]): Promise<Map<string, UnitNote>> {
  const keys = [...new Set(requestNos.map((r) => (r || '').trim()).filter(Boolean))];
  const map = new Map<string, UnitNote>();
  if (keys.length === 0) return map;

  const { rows } = await dbQuery<Row>(
    `select request_no, note, updated_at from ${table} where request_no = ANY($1::text[])`,
    [keys],
  );
  for (const r of rows) map.set(r.request_no, mapRow(r));
  return map;
}

/** หมายเหตุที่เคยบันทึกไว้ (ไม่ซ้ำ) สำหรับ autocomplete */
export async function listDistinctUnitNoteSuggestions(limit = 50): Promise<string[]> {
  const cap = Math.min(Math.max(limit, 1), 100);
  const { rows } = await dbQuery<{ note: string }>(
    `
    select note
    from (
      select note, max(updated_at) as last_used
      from ${table}
      where note is not null and trim(note) <> ''
      group by note
      order by last_used desc
      limit $1
    ) recent
    `,
    [cap],
  );
  return rows.map((r) => r.note.trim()).filter(Boolean);
}

export async function upsertUnitNote(input: {
  requestNo: string;
  note?: unknown;
  userId?: string | null;
}): Promise<UnitNote> {
  const key = input.requestNo.trim();
  if (!key) throw new Error('request_no is required');

  const note = cleanNote(input.note);

  const { rows } = await dbQuery<Row>(
    `
    insert into ${table} (request_no, note, updated_by_user_id, updated_at)
    values ($1, $2, $3, now())
    on conflict (request_no) do update set
      note = excluded.note,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = now()
    returning request_no, note, updated_at
    `,
    [key, note, input.userId ?? null],
  );
  return mapRow(rows[0]);
}
