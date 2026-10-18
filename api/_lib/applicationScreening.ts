import { dbQuery, isPgUndefinedTable } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { isScreeningResult, type ScreeningResult } from '../../src/lib/appointmentScreening.js';

const table = tableInAppSchema('application_screening_results');
const MAX_NOTE = 2000;

/** ผล "ผ่าน / ไม่ผ่าน" หลังมาตามนัด (migration 151) — append-only ล่าสุดต่อ (ใบ, วันนัด) ชนะ · ไม่แตะ status ใบ */
export type ScreeningLog = {
  id: string;
  applicationId: string;
  appointmentAt: string;
  result: ScreeningResult;
  recordedByName: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  application_id: string;
  appointment_at: string;
  result: string;
  recorded_by_name: string | null;
  created_at: string;
};

const COLS = `id, application_id, appointment_at, result, recorded_by_name, created_at`;

function mapRow(r: Row): ScreeningLog | null {
  if (!isScreeningResult(r.result)) return null;
  return {
    id: r.id,
    applicationId: r.application_id,
    appointmentAt: r.appointment_at,
    result: r.result,
    recordedByName: r.recorded_by_name,
    createdAt: r.created_at,
  };
}

export async function createScreeningResult(input: {
  applicationId: string;
  appointmentAt: string;
  result: ScreeningResult;
  note?: string | null;
  recordedBy?: string | null;
  recordedByName?: string | null;
}): Promise<ScreeningLog> {
  const { rows } = await dbQuery<Row>(
    `insert into ${table}
       (application_id, appointment_at, result, note, recorded_by, recorded_by_name)
     values ($1, $2::timestamptz, $3, $4, $5, $6)
     returning ${COLS}`,
    [
      input.applicationId,
      input.appointmentAt,
      input.result,
      (input.note ?? '').trim().slice(0, MAX_NOTE) || null,
      input.recordedBy ?? null,
      input.recordedByName ?? null,
    ],
  );
  return mapRow(rows[0]) as ScreeningLog;
}

/** ผลล่าสุดต่อใบ (ของนัดล่าสุด) · ตารางยังไม่ migrate = map ว่าง */
export async function loadLatestScreeningByApplication(applicationIds: string[]): Promise<Map<string, ScreeningLog>> {
  const out = new Map<string, ScreeningLog>();
  const ids = [...new Set(applicationIds.filter(Boolean))];
  if (ids.length === 0) return out;
  try {
    const { rows } = await dbQuery<Row>(
      `select distinct on (application_id) ${COLS}
         from ${table}
        where application_id = any($1::uuid[])
        order by application_id, appointment_at desc, created_at desc`,
      [ids],
    );
    for (const r of rows) {
      const m = mapRow(r);
      if (m) out.set(r.application_id, m);
    }
  } catch (e) {
    if (!isPgUndefinedTable(e)) throw e;
  }
  return out;
}
