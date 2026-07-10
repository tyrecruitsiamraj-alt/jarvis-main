import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';

const table = tableInAppSchema('siamraj_unit_notes');
const MAX_NOTE_LENGTH = 2000;

export type UnitNote = {
  request_no: string;
  note: string | null;
  send_replacement: boolean | null;
  parser_override_text: string | null;
  updated_at: string | null;
  updated_by_user_id?: string | null;
  updated_by_name?: string | null;
};

type Row = {
  request_no: string;
  note: string | null;
  send_replacement?: boolean | null;
  parser_override_text?: string | null;
  updated_at: string | Date | null;
  updated_by_user_id?: string | null;
  updated_by_name?: string | null;
};

let sendReplacementColumn: boolean | null = null;
let parserOverrideColumn: boolean | null = null;

function isMissingSendReplacementColumn(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /send_replacement/i.test(msg) && /(does not exist|column)/i.test(msg);
}

function isMissingNotesTable(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /siamraj_unit_notes/i.test(msg) && /(does not exist|relation)/i.test(msg);
}

function isMissingParserOverrideColumn(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /parser_override_text/i.test(msg) && /(does not exist|column)/i.test(msg);
}

async function hasSendReplacementColumn(): Promise<boolean> {
  if (sendReplacementColumn !== null) return sendReplacementColumn;
  try {
    await dbQuery(`select send_replacement from ${table} limit 0`);
    sendReplacementColumn = true;
  } catch (e) {
    if (isMissingSendReplacementColumn(e) || isMissingNotesTable(e)) {
      sendReplacementColumn = false;
    } else {
      throw e;
    }
  }
  return sendReplacementColumn;
}

async function hasParserOverrideColumn(): Promise<boolean> {
  if (parserOverrideColumn !== null) return parserOverrideColumn;
  try {
    await dbQuery(`select parser_override_text from ${table} limit 0`);
    parserOverrideColumn = true;
  } catch (e) {
    if (isMissingParserOverrideColumn(e) || isMissingNotesTable(e)) {
      parserOverrideColumn = false;
    } else {
      throw e;
    }
  }
  return parserOverrideColumn;
}

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

function cleanParserOverrideText(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  if (t.length > MAX_NOTE_LENGTH) {
    throw new Error(`parser_override_text must be at most ${MAX_NOTE_LENGTH} characters`);
  }
  return t;
}

function mapRow(r: Row, withReplacement: boolean, withParserOverride: boolean): UnitNote {
  return {
    request_no: r.request_no,
    note: r.note,
    send_replacement: withReplacement ? (r.send_replacement ?? null) : null,
    parser_override_text: withParserOverride ? (r.parser_override_text ?? null) : null,
    updated_at: toIso(r.updated_at),
    updated_by_user_id: r.updated_by_user_id ?? null,
    updated_by_name: r.updated_by_name ?? null,
  };
}

const userJoin = `
  left join ${tableInAppSchema('users')} u on u.id = n.updated_by_user_id
`;

function selectCols(withReplacement: boolean, withParserOverride: boolean): string {
  const base = `
    n.request_no,
    n.note,
    n.updated_at,
    n.updated_by_user_id,
    coalesce(nullif(trim(u.full_name), ''), u.email) as updated_by_name
  `;
  const extra = [
    withReplacement ? 'n.send_replacement' : null,
    withParserOverride ? 'n.parser_override_text' : null,
  ].filter(Boolean);
  return extra.length ? `${base}, ${extra.join(', ')}` : base;
}

export async function getUnitNote(requestNo: string): Promise<UnitNote | null> {
  const key = requestNo.trim();
  if (!key) return null;
  const withReplacement = await hasSendReplacementColumn();
  const withParserOverride = await hasParserOverrideColumn();
  const { rows } = await dbQuery<Row>(
    `
    select ${selectCols(withReplacement, withParserOverride)}
    from ${table} n
    ${userJoin}
    where n.request_no = $1
    `,
    [key],
  );
  return rows[0] ? mapRow(rows[0], withReplacement, withParserOverride) : null;
}

export async function getUnitNotesMap(requestNos: string[]): Promise<Map<string, UnitNote>> {
  const keys = [...new Set(requestNos.map((r) => (r || '').trim()).filter(Boolean))];
  const map = new Map<string, UnitNote>();
  if (keys.length === 0) return map;

  const withReplacement = await hasSendReplacementColumn();
  const withParserOverride = await hasParserOverrideColumn();
  const { rows } = await dbQuery<Row>(
    `
    select ${selectCols(withReplacement, withParserOverride)}
    from ${table} n
    ${userJoin}
    where n.request_no = ANY($1::text[])
    `,
    [keys],
  );
  for (const r of rows) map.set(r.request_no, mapRow(r, withReplacement, withParserOverride));
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
  send_replacement?: boolean | null;
  parser_override_text?: unknown;
  userId?: string | null;
}): Promise<UnitNote> {
  const key = input.requestNo.trim();
  if (!key) throw new Error('request_no is required');

  const withReplacement = await hasSendReplacementColumn();
  const withParserOverride = await hasParserOverrideColumn();
  const existing = await getUnitNote(key);
  const note = input.note !== undefined ? cleanNote(input.note) : (existing?.note ?? null);
  const sendReplacement =
    withReplacement && input.send_replacement !== undefined
      ? input.send_replacement
      : withReplacement
        ? (existing?.send_replacement ?? null)
        : null;
  const parserOverrideText =
    withParserOverride && input.parser_override_text !== undefined
      ? cleanParserOverrideText(input.parser_override_text)
      : withParserOverride
        ? (existing?.parser_override_text ?? null)
        : null;

  if (withReplacement && withParserOverride) {
    await dbQuery(
      `
      insert into ${table} (request_no, note, send_replacement, parser_override_text, updated_by_user_id, updated_at)
      values ($1, $2, $3, $4, $5, now())
      on conflict (request_no) do update set
        note = excluded.note,
        send_replacement = excluded.send_replacement,
        parser_override_text = excluded.parser_override_text,
        updated_by_user_id = excluded.updated_by_user_id,
        updated_at = now()
      `,
      [key, note, sendReplacement, parserOverrideText, input.userId ?? null],
    );
    return (await getUnitNote(key))!;
  }

  if (withReplacement) {
    await dbQuery(
      `
      insert into ${table} (request_no, note, send_replacement, updated_by_user_id, updated_at)
      values ($1, $2, $3, $4, now())
      on conflict (request_no) do update set
        note = excluded.note,
        send_replacement = excluded.send_replacement,
        updated_by_user_id = excluded.updated_by_user_id,
        updated_at = now()
      `,
      [key, note, sendReplacement, input.userId ?? null],
    );
    return (await getUnitNote(key))!;
  }

  await dbQuery(
    `
    insert into ${table} (request_no, note, updated_by_user_id, updated_at)
    values ($1, $2, $3, now())
    on conflict (request_no) do update set
      note = excluded.note,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = now()
    `,
    [key, note, input.userId ?? null],
  );
  return (await getUnitNote(key))!;
}
