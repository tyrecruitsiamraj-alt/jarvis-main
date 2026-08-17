import { dbQuery, isPgUndefinedTable } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { isAttendanceResult, type AttendanceResult } from '../../src/lib/appointmentAttendance.js';

const table = tableInAppSchema('application_appointment_results');

const MAX_NOTE = 2000;

/**
 * ผลติดตามนัด "มาตามนัด / ไม่มา / เลื่อนนัด" (migration 089) — append-only
 * ผลล่าสุดต่อ (ใบ, วันนัด) ชนะ · **ไม่แตะ status ใบ** (สถานะจากขั้นที่คนทำ)
 */
export type AttendanceLog = {
  id: string;
  applicationId: string;
  appointmentAt: string;
  result: AttendanceResult;
  note: string | null;
  recordedByName: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  application_id: string;
  appointment_at: string;
  result: string;
  note: string | null;
  recorded_by_name: string | null;
  created_at: string;
};

const COLS = `id, application_id, appointment_at, result, note, recorded_by_name, created_at`;

function mapRow(r: Row): AttendanceLog {
  return {
    id: r.id,
    applicationId: r.application_id,
    appointmentAt: r.appointment_at,
    result: isAttendanceResult(r.result) ? r.result : 'rescheduled',
    note: r.note,
    recordedByName: r.recorded_by_name,
    createdAt: r.created_at,
  };
}

export async function createAttendanceResult(input: {
  applicationId: string;
  appointmentAt: string;
  result: AttendanceResult;
  note?: string | null;
  recordedBy?: string | null;
  recordedByName?: string | null;
}): Promise<AttendanceLog> {
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
  return mapRow(rows[0]);
}

/**
 * ผลล่าสุดต่อใบ (ของนัดล่าสุด) — แนบเข้าแถวในแท็บติดตามนัดหมาย
 * ตารางยังไม่ migrate (089) → map ว่าง (ปุ่มยังกดได้ แต่จะ 503 ตอนบันทึก — บอกตรง ๆ)
 */
export async function loadLatestAttendanceByApplication(
  applicationIds: string[],
): Promise<Map<string, AttendanceLog>> {
  const out = new Map<string, AttendanceLog>();
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
    for (const r of rows) out.set(r.application_id, mapRow(r));
  } catch (e) {
    if (!isPgUndefinedTable(e)) throw e;
  }
  return out;
}

/** ประวัติผลนัดของใบเดียว (ล่าสุดก่อน) */
export async function listAttendanceLogs(applicationId: string): Promise<AttendanceLog[]> {
  try {
    const { rows } = await dbQuery<Row>(
      `select ${COLS} from ${table}
        where application_id = $1
        order by created_at desc
        limit 50`,
      [applicationId],
    );
    return rows.map(mapRow);
  } catch (e) {
    if (isPgUndefinedTable(e)) return [];
    throw e;
  }
}
