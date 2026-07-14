import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';

const table = tableInAppSchema('siamraj_unit_work_status');
const historyTable = tableInAppSchema('siamraj_unit_work_status_history');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const UNIT_REQUEST_WORK_STATUSES = [
  'in_progress',
  'evaluating',
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

function isCheckViolation(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /check constraint|violates check/i.test(msg);
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

function asUserId(v?: string | null): string | null {
  if (!v || typeof v !== 'string') return null;
  const t = v.trim();
  return UUID_RE.test(t) ? t : null;
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

/** สำรองเมื่อ migrate ยังไม่ครบ — สร้างตาราง + ขยาย check ให้รองรับ evaluating */
async function ensureWorkStatusTable(): Promise<void> {
  await dbQuery(`
    create table if not exists ${table} (
      request_no text primary key,
      status text not null,
      person_first_name text null,
      person_last_name text null,
      status_date date null,
      updated_by_user_id uuid null,
      updated_at timestamptz not null default now()
    )
  `);
  await dbQuery(`
    alter table ${table} drop constraint if exists siamraj_unit_work_status_status_check
  `);
  await dbQuery(`
    alter table ${table}
      add constraint siamraj_unit_work_status_status_check
      check (status in (
        'in_progress',
        'evaluating',
        'waiting_inform',
        'waiting_interview',
        'waiting_start'
      ))
  `);
  await dbQuery(`
    create index if not exists siamraj_unit_work_status_status_idx on ${table} (status)
  `);
  await dbQuery(`
    create index if not exists siamraj_unit_work_status_updated_at_idx on ${table} (updated_at desc)
  `);
  await ensureWorkStatusHistoryTable();
}

async function ensureWorkStatusHistoryTable(): Promise<void> {
  await dbQuery(`
    create table if not exists ${historyTable} (
      id bigserial primary key,
      request_no text not null,
      status text not null,
      person_first_name text null,
      person_last_name text null,
      status_date date null,
      previous_status text null,
      previous_person_first_name text null,
      previous_person_last_name text null,
      previous_status_date date null,
      updated_by_user_id uuid null,
      created_at timestamptz not null default now()
    )
  `);
  await dbQuery(`
    create index if not exists siamraj_unit_work_status_history_request_no_idx
      on ${historyTable} (request_no, created_at desc)
  `);
}

async function appendWorkStatusHistory(input: {
  requestNo: string;
  next: UnitWorkStatusRow;
  previous: UnitWorkStatusRow | null;
  userId: string | null;
}): Promise<void> {
  const params = [
    input.requestNo,
    input.next.status,
    input.next.person_first_name,
    input.next.person_last_name,
    input.next.status_date,
    input.previous?.status ?? null,
    input.previous?.person_first_name ?? null,
    input.previous?.person_last_name ?? null,
    input.previous?.status_date ?? null,
    input.userId,
  ];
  try {
    await dbQuery(
      `insert into ${historyTable} (
         request_no, status, person_first_name, person_last_name, status_date,
         previous_status, previous_person_first_name, previous_person_last_name, previous_status_date,
         updated_by_user_id, created_at
       ) values (
         $1, $2, $3, $4, $5::date,
         $6, $7, $8, $9::date,
         $10, now()
       )`,
      params,
    );
  } catch (e) {
    if (isMissingTable(e)) {
      try {
        await ensureWorkStatusHistoryTable();
        await dbQuery(
          `insert into ${historyTable} (
             request_no, status, person_first_name, person_last_name, status_date,
             previous_status, previous_person_first_name, previous_person_last_name, previous_status_date,
             updated_by_user_id, created_at
           ) values (
             $1, $2, $3, $4, $5::date,
             $6, $7, $8, $9::date,
             $10, now()
           )`,
          params,
        );
      } catch (e2) {
        console.error('siamraj_unit_work_status_history.append_failed_after_ensure', e2);
      }
      return;
    }
    // ประวัติเป็นข้อมูลเสริม — ไม่ให้ทำให้บันทึกหลักล่ม
    console.error('siamraj_unit_work_status_history.append_failed', e);
  }
}

export async function getUnitWorkStatus(requestNo: string): Promise<UnitWorkStatusRow | null> {
  const key = requestNo.trim();
  if (!key) return null;
  try {
    const { rows } = await dbQuery<Row>(
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
    const { rows } = await dbQuery<Row>(
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

  const userId = asUserId(input.userId ?? null);
  const params = [requestNo, input.status, first, last, statusDate, userId] as const;
  const previous = await getUnitWorkStatus(requestNo);

  const runInsert = async (): Promise<Row> => {
    const { rows } = await dbQuery<Row>(
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
      [...params],
    );
    if (!rows[0]) throw new Error('upsert failed');
    return rows[0];
  };

  const finish = async (row: Row): Promise<UnitWorkStatusRow> => {
    const next = mapRow(row);
    await appendWorkStatusHistory({
      requestNo,
      next,
      previous,
      userId,
    });
    return next;
  };

  try {
    return finish(await runInsert());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/invalid input syntax for type uuid/i.test(msg)) {
      throw new Error('บันทึกไม่สำเร็จ: รหัสผู้ใช้ไม่ถูกต้อง');
    }
    if (isMissingTable(e) || isCheckViolation(e)) {
      try {
        await ensureWorkStatusTable();
        return finish(await runInsert());
      } catch (e2) {
        const msg2 = e2 instanceof Error ? e2.message : String(e2);
        throw new Error(
          `บันทึกสถานะทำงานไม่สำเร็จ — ตรวจ migration ตาราง siamraj_unit_work_status (${msg2})`,
        );
      }
    }
    throw e;
  }
}
