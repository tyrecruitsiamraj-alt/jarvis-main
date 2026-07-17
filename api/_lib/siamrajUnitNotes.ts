import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';

const table = tableInAppSchema('siamraj_unit_notes');
const MAX_NOTE_LENGTH = 2000;

/** override ฟิลด์ใบขอที่ผู้ใช้แก้เอง (persist) — null/undefined = ใช้ค่าจาก ERP ตามเดิม */
export type UnitBranchOverride = {
  branch_id?: string;
  branch_name_clean: string;
  address_raw?: string | null;
  road?: string | null;
  subdistrict?: string | null;
  requested_qty: number;
  district_hint: string | null;
  province_hint: string | null;
  postal_code?: string | null;
  lat?: number | null;
  lng?: number | null;
  geocode_status?: 'unverified' | 'estimated' | 'confirmed' | 'not_found';
};
export type UnitFieldOverrides = {
  age_min?: number | null;
  age_max?: number | null;
  gender?: string | null;
  branches?: UnitBranchOverride[] | null;
};

export type UnitNote = {
  request_no: string;
  note: string | null;
  send_replacement: boolean | null;
  parser_override_text: string | null;
  field_overrides: UnitFieldOverrides | null;
  updated_at: string | null;
};

type Row = {
  request_no: string;
  note: string | null;
  send_replacement?: boolean | null;
  parser_override_text?: string | null;
  field_overrides?: UnitFieldOverrides | string | null;
  updated_at: string | Date | null;
};

const optionalColumns = ['send_replacement', 'parser_override_text', 'field_overrides'] as const;
type OptionalColumn = (typeof optionalColumns)[number];
const columnExists: Partial<Record<OptionalColumn, boolean>> = {};

function isMissingNotesTable(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /siamraj_unit_notes/i.test(msg) && /(does not exist|relation)/i.test(msg);
}

async function hasColumn(col: OptionalColumn): Promise<boolean> {
  if (columnExists[col] !== undefined) return columnExists[col] as boolean;
  try {
    await dbQuery(`select ${col} from ${table} limit 0`);
    columnExists[col] = true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if ((new RegExp(col, 'i').test(msg) && /(does not exist|column)/i.test(msg)) || isMissingNotesTable(e)) {
      columnExists[col] = false;
    } else {
      throw e;
    }
  }
  return columnExists[col] as boolean;
}

function toIso(v: string | Date | null): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

function cleanNote(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  if (t.length > MAX_NOTE_LENGTH) throw new Error(`note must be at most ${MAX_NOTE_LENGTH} characters`);
  return t;
}

function cleanParserOverrideText(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  if (t.length > MAX_NOTE_LENGTH) throw new Error(`parser_override_text must be at most ${MAX_NOTE_LENGTH} characters`);
  return t;
}

/** sanitize field_overrides ที่รับจาก client ให้เก็บเฉพาะ shape ที่รู้จัก */
export function cleanFieldOverrides(v: unknown): UnitFieldOverrides | null {
  if (v == null) return null;
  const src = typeof v === 'string' ? safeParse(v) : v;
  if (!src || typeof src !== 'object') return null;
  const o = src as Record<string, unknown>;
  const out: UnitFieldOverrides = {};

  const numOrNull = (x: unknown) => {
    if (x == null || x === '') return null;
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  };
  if ('age_min' in o) out.age_min = numOrNull(o.age_min);
  if ('age_max' in o) out.age_max = numOrNull(o.age_max);
  if ('gender' in o) out.gender = typeof o.gender === 'string' && o.gender.trim() ? o.gender.trim() : null;

  if ('branches' in o) {
    if (!Array.isArray(o.branches)) {
      out.branches = null;
    } else {
      out.branches = o.branches
        .map((b): UnitBranchOverride | null => {
          if (!b || typeof b !== 'object') return null;
          const row = b as Record<string, unknown>;
          const name = typeof row.branch_name_clean === 'string' ? row.branch_name_clean.trim() : '';
          if (!name) return null;
          return {
            branch_id:
              typeof row.branch_id === 'string' && row.branch_id.trim()
                ? row.branch_id.trim().slice(0, 120)
                : undefined,
            branch_name_clean: name.slice(0, 200),
            address_raw:
              typeof row.address_raw === 'string' && row.address_raw.trim()
                ? row.address_raw.trim().slice(0, 500)
                : null,
            road:
              typeof row.road === 'string' && row.road.trim() ? row.road.trim().slice(0, 200) : null,
            subdistrict:
              typeof row.subdistrict === 'string' && row.subdistrict.trim()
                ? row.subdistrict.trim().slice(0, 120)
                : null,
            requested_qty: Math.max(0, Math.floor(numOrNull(row.requested_qty) ?? 0)),
            district_hint:
              typeof row.district_hint === 'string' && row.district_hint.trim()
                ? row.district_hint.trim().slice(0, 120)
                : null,
            province_hint:
              typeof row.province_hint === 'string' && row.province_hint.trim()
                ? row.province_hint.trim().slice(0, 120)
                : null,
            postal_code:
              typeof row.postal_code === 'string' && row.postal_code.trim()
                ? row.postal_code.trim().slice(0, 10)
                : null,
            lat: numOrNull(row.lat),
            lng: numOrNull(row.lng),
            geocode_status:
              typeof row.geocode_status === 'string' &&
              ['unverified', 'estimated', 'confirmed', 'not_found'].includes(row.geocode_status)
                ? (row.geocode_status as UnitBranchOverride['geocode_status'])
                : 'unverified',
          };
        })
        .filter((x): x is UnitBranchOverride => Boolean(x))
        .slice(0, 50);
    }
  }

  return Object.keys(out).length > 0 ? out : null;
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function readFieldOverrides(v: UnitFieldOverrides | string | null | undefined): UnitFieldOverrides | null {
  if (v == null) return null;
  if (typeof v === 'string') return (safeParse(v) as UnitFieldOverrides) ?? null;
  return v;
}

function mapRow(r: Row, cols: Record<OptionalColumn, boolean>): UnitNote {
  return {
    request_no: r.request_no,
    note: r.note,
    send_replacement: cols.send_replacement ? (r.send_replacement ?? null) : null,
    parser_override_text: cols.parser_override_text ? (r.parser_override_text ?? null) : null,
    field_overrides: cols.field_overrides ? readFieldOverrides(r.field_overrides) : null,
    updated_at: toIso(r.updated_at),
  };
}

async function resolveCols(): Promise<Record<OptionalColumn, boolean>> {
  const [send_replacement, parser_override_text, field_overrides] = await Promise.all([
    hasColumn('send_replacement'),
    hasColumn('parser_override_text'),
    hasColumn('field_overrides'),
  ]);
  return { send_replacement, parser_override_text, field_overrides };
}

function selectColumns(cols: Record<OptionalColumn, boolean>): string {
  return ['request_no', 'note', ...optionalColumns.filter((c) => cols[c]), 'updated_at'].join(', ');
}

export async function getUnitNote(requestNo: string): Promise<UnitNote | null> {
  const key = requestNo.trim();
  if (!key) return null;
  const cols = await resolveCols();
  const { rows } = await dbQuery<Row>(
    `select ${selectColumns(cols)} from ${table} where request_no = $1`,
    [key],
  );
  return rows[0] ? mapRow(rows[0], cols) : null;
}

export async function getUnitNotesMap(requestNos: string[]): Promise<Map<string, UnitNote>> {
  const keys = [...new Set(requestNos.map((r) => (r || '').trim()).filter(Boolean))];
  const map = new Map<string, UnitNote>();
  if (keys.length === 0) return map;
  const cols = await resolveCols();
  const { rows } = await dbQuery<Row>(
    `select ${selectColumns(cols)} from ${table} where request_no = ANY($1::text[])`,
    [keys],
  );
  for (const r of rows) map.set(r.request_no, mapRow(r, cols));
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
  field_overrides?: unknown;
  userId?: string | null;
}): Promise<UnitNote> {
  const key = input.requestNo.trim();
  if (!key) throw new Error('request_no is required');

  const cols = await resolveCols();
  const existing = await getUnitNote(key);

  const note = input.note !== undefined ? cleanNote(input.note) : (existing?.note ?? null);

  // ค่าที่จะเขียน — ถ้าไม่ได้ส่งมาให้คงค่าเดิม
  const values: Record<string, unknown> = { note };
  if (cols.send_replacement) {
    values.send_replacement =
      input.send_replacement !== undefined ? input.send_replacement : (existing?.send_replacement ?? null);
  }
  if (cols.parser_override_text) {
    values.parser_override_text =
      input.parser_override_text !== undefined
        ? cleanParserOverrideText(input.parser_override_text)
        : (existing?.parser_override_text ?? null);
  }
  if (cols.field_overrides) {
    const next =
      input.field_overrides !== undefined
        ? cleanFieldOverrides(input.field_overrides)
        : (existing?.field_overrides ?? null);
    // jsonb ต้อง stringify ก่อนส่งเป็น param
    values.field_overrides = next == null ? null : JSON.stringify(next);
  }

  const insertCols = ['request_no', ...Object.keys(values), 'updated_by_user_id', 'updated_at'];
  const params: unknown[] = [key, ...Object.values(values), input.userId ?? null];
  // updated_by_user_id param index = params.length (1-based)
  const updatedByIdx = params.length;
  const finalPlaceholders = insertCols.map((c) => {
    if (c === 'updated_at') return 'now()';
    if (c === 'request_no') return '$1';
    if (c === 'updated_by_user_id') return `$${updatedByIdx}`;
    const idx = Object.keys(values).indexOf(c) + 2;
    return c === 'field_overrides' ? `$${idx}::jsonb` : `$${idx}`;
  });

  const updateSet = [...Object.keys(values), 'updated_by_user_id']
    .map((c) => `${c} = excluded.${c}`)
    .concat('updated_at = now()')
    .join(', ');

  const { rows } = await dbQuery<Row>(
    `
    insert into ${table} (${insertCols.join(', ')})
    values (${finalPlaceholders.join(', ')})
    on conflict (request_no) do update set ${updateSet}
    returning ${selectColumns(cols)}
    `,
    params,
  );
  return mapRow(rows[0], cols);
}
