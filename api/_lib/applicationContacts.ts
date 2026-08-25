import { dbQuery, isPgUndefinedTable } from './postgres.js';
import { tableInAppSchema } from './schema.js';

const table = tableInAppSchema('application_contact_logs');
const appsTable = tableInAppSchema('public_job_applications');

const MAX_TEXT = 300;
const MAX_NOTE = 2000;

/**
 * บันทึกผลการติดต่อผู้สมัคร (ลิสต์ข้อ 7 · 14 ส.ค. 2569) — ดู migrations/086
 *
 * สถานะใบสมัครขยับตาม "ขั้นที่คนทำ" (เจ้าของเคาะ):
 * - ติดต่อสำเร็จ + นัดได้ → `converted` (ไปแท็บติดตามนัดหมาย)
 * - ติดต่อสำเร็จ แต่ยังนัดไม่ได้ / ติดต่อไม่สำเร็จ → `contacted` (ยังอยู่การติดต่อ ตามต่อ)
 */
export type ContactLog = {
  id: string;
  applicationId: string;
  ok: boolean;
  reasonId: string | null;
  reasonLabel: string | null;
  appointmentAt: string | null;
  appointmentPlace: string | null;
  jobId: string | null;
  jobLabel: string | null;
  note: string | null;
  createdByName: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  application_id: string;
  ok: boolean;
  reason_id: string | null;
  reason_label: string | null;
  appointment_at: string | null;
  appointment_place: string | null;
  job_id: string | null;
  job_label: string | null;
  note: string | null;
  created_by_name: string | null;
  created_at: string;
};

const COLS = `id, application_id, ok, reason_id, reason_label, appointment_at,
  appointment_place, job_id, job_label, note, created_by_name, created_at`;

function mapRow(r: Row): ContactLog {
  return {
    id: r.id,
    applicationId: r.application_id,
    ok: Boolean(r.ok),
    reasonId: r.reason_id,
    reasonLabel: r.reason_label,
    appointmentAt: r.appointment_at,
    appointmentPlace: r.appointment_place,
    jobId: r.job_id,
    jobLabel: r.job_label,
    note: r.note,
    createdByName: r.created_by_name,
    createdAt: r.created_at,
  };
}

function trimTo(v: unknown, max: number): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s.slice(0, max) : null;
}

export type CreateContactLogInput = {
  applicationId: string;
  ok: boolean;
  reasonId?: string | null;
  reasonLabel?: unknown;
  appointmentAt?: string | null;
  appointmentPlace?: unknown;
  jobId?: unknown;
  jobLabel?: unknown;
  note?: unknown;
  createdBy?: string | null;
  createdByName?: string | null;
};

/**
 * บันทึกผล + ขยับสถานะใบในทรานแซกชันเดียวกันเชิงตรรกะ (สองคำสั่งเรียงกัน —
 * ถ้าอัปเดตสถานะล้ม log ยังอยู่ ซึ่งถูกต้อง: ผลติดต่อคือข้อเท็จจริง สถานะเป็นของแถม)
 *
 * ⚠️ ฝั่ง "ไม่สำเร็จ" ห้ามมีวันนัดติดไป · ฝั่ง "สำเร็จ" ห้ามมีเหตุผลติดไป —
 * เคลียร์ที่นี่ ไม่เชื่อ payload (กติกาเดียวกับ resolveAppointment ของผลโทร)
 */
export async function createContactLog(input: CreateContactLogInput): Promise<ContactLog> {
  const ok = Boolean(input.ok);
  const appointmentAt = ok ? (input.appointmentAt ?? null) : null;
  const { rows } = await dbQuery<Row>(
    `insert into ${table}
       (application_id, ok, reason_id, reason_label, appointment_at, appointment_place,
        job_id, job_label, note, created_by, created_by_name)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     returning ${COLS}`,
    [
      input.applicationId,
      ok,
      ok ? null : (input.reasonId ?? null),
      ok ? null : trimTo(input.reasonLabel, MAX_TEXT),
      appointmentAt,
      ok ? trimTo(input.appointmentPlace, MAX_TEXT) : null,
      ok && appointmentAt ? trimTo(input.jobId, MAX_TEXT) : null,
      ok && appointmentAt ? trimTo(input.jobLabel, MAX_TEXT) : null,
      trimTo(input.note, MAX_NOTE),
      input.createdBy ?? null,
      input.createdByName ?? null,
    ],
  );

  // สถานะตาม "ขั้นที่คนทำ": นัดได้ = converted (ไปแท็บนัดหมาย) · ที่เหลือ = contacted
  const nextStatus = ok && appointmentAt ? 'converted' : 'contacted';
  await dbQuery(`update ${appsTable} set status = $2, updated_at = now() where id = $1`, [
    input.applicationId,
    nextStatus,
  ]);

  return mapRow(rows[0]);
}

/** ประวัติการติดต่อของใบ (ล่าสุดก่อน) — ตารางยังไม่ migrate คืนว่าง ไม่พัง */
export async function listContactLogs(applicationId: string): Promise<ContactLog[]> {
  try {
    const { rows } = await dbQuery<Row>(
      `select ${COLS} from ${table} where application_id = $1 order by created_at desc limit 50`,
      [applicationId],
    );
    return rows.map(mapRow);
  } catch (e) {
    if (isPgUndefinedTable(e)) return [];
    throw e;
  }
}

/**
 * ผลติดต่อล่าสุดต่อใบ (สำเร็จ/ไม่สำเร็จ) — มุมมองรายชื่อใช้ตัดสิน "ไม่สนใจ" (Phase 5.11)
 *
 * ⚠️ ต้องคืน **เวลา** มาด้วย ไม่ใช่แค่ ok — ฝั่งหน้าเว็บเทียบกับเวลาผลโทรเพื่อดูว่าอันไหน
 * ใหม่กว่า (ปฏิเสธเมื่อวานแล้ววันนี้โทรติดว่าเอางาน ต้องอ่านว่าสนใจ)
 * ⚠️ ตารางยังไม่ migrate (086) → คืน map ว่าง ไม่โยน (รายชื่อต้องไม่หายเพราะของแถม)
 */
export async function loadLatestContactResults(
  applicationIds: string[],
): Promise<Map<string, { ok: boolean; at: string }>> {
  const out = new Map<string, { ok: boolean; at: string }>();
  if (applicationIds.length === 0) return out;
  try {
    const { rows } = await dbQuery<{ application_id: string; ok: boolean; created_at: string }>(
      `select distinct on (application_id) application_id, ok, created_at
         from ${table}
        where application_id = any($1::uuid[])
        order by application_id, created_at desc`,
      [applicationIds],
    );
    for (const r of rows) out.set(r.application_id, { ok: r.ok, at: r.created_at });
    return out;
  } catch (e) {
    if (isPgUndefinedTable(e)) return out;
    throw e;
  }
}

/**
 * นัดล่าสุดต่อใบ (หลายใบในคิวรีเดียว) — แท็บติดตามนัดหมาย + หน้า PDF ใช้
 * DISTINCT ON เอานัดล่าสุดต่อใบ (เลื่อนนัด = บันทึกรอบใหม่ทับ)
 */
export async function loadContactAppointments(
  applicationIds: string[],
): Promise<Map<string, { at: string; place: string | null; jobLabel: string | null }>> {
  const out = new Map<string, { at: string; place: string | null; jobLabel: string | null }>();
  if (applicationIds.length === 0) return out;
  try {
    const { rows } = await dbQuery<{
      application_id: string;
      appointment_at: string;
      appointment_place: string | null;
      job_label: string | null;
    }>(
      `select distinct on (application_id)
              application_id, appointment_at, appointment_place, job_label
         from ${table}
        where application_id = any($1::uuid[]) and appointment_at is not null
        order by application_id, created_at desc`,
      [applicationIds],
    );
    for (const r of rows) {
      out.set(r.application_id, {
        at: r.appointment_at,
        place: r.appointment_place,
        jobLabel: r.job_label,
      });
    }
    return out;
  } catch (e) {
    if (isPgUndefinedTable(e)) return out;
    throw e;
  }
}
