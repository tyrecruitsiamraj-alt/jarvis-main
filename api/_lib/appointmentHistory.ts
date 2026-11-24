import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { STAFF_NAME_SQL } from './staffNameSql.js';

/**
 * ═══ ประวัตินัดหมายของคนคนหนึ่ง ข้ามทุกใบสมัคร (เจ้าของเคาะ 24 พ.ย. 2569) ═══
 * > *"บันทึกไว้ด้วยว่าเคยนัดไปลงหน่วยงานไหนมาก่อน แล้วจบที่อะไร เพื่อที่คนอื่นมาโทรจะได้ไม่เสนองานเดิม"*
 * > *"ต้องบอกอะว่าเคยนัดไปหน่วยงานไหนแล้วไม่ไป ที่ประวัตินัดหมายอะ"*
 *
 * นัด = ผลติดต่อ "ติดต่อได้ + มีวันนัด" (`application_contact_logs` — แท็บการติดต่อ + นัดจากถังโทรตั้งแต่ 24 พ.ย.)
 * ผล = ผ่าน/ไม่ผ่าน ล่าสุด (151) ก่อน · ไม่มีก็ มา/ไม่มา/เลื่อนนัด ล่าสุด (089) · ไม่มีเลย = null (รอผล)
 * จับคู่ผลกับนัดด้วยใบเดียวกัน + เวลานัดระดับนาทีเดียวกัน
 * ผู้เรียกส่งเฉพาะ id ใบที่ผู้ดูมีสิทธิ์ (กรองสิทธิ์ BU รายใบไว้แล้ว) · อ่านอย่างเดียว
 */
const contacts = tableInAppSchema('application_contact_logs');
const apps = tableInAppSchema('public_job_applications');
const attendance = tableInAppSchema('application_appointment_results');
const screening = tableInAppSchema('application_screening_results');
const users = tableInAppSchema('users');

export type AppointmentHistoryRow = {
  id: string;
  application_id: string;
  appointment_at: string;
  place: string | null;
  unit_name: string | null;
  job_title: string | null;
  job_label: string | null;
  by_name: string | null;
  created_at: string;
  attendance: string | null;
  screening: string | null;
};

const iso = (v: string | Date | null): string | null => (v == null ? null : new Date(v).toISOString());

export async function loadAppointmentHistory(applicationIds: readonly string[]): Promise<AppointmentHistoryRow[]> {
  const ids = [...new Set(applicationIds.filter(Boolean))];
  if (ids.length === 0) return [];
  const { rows } = await dbQuery<Omit<AppointmentHistoryRow, 'appointment_at' | 'created_at'> & { appointment_at: string | Date; created_at: string | Date }>(
    `select c.id::text as id, c.application_id::text as application_id, c.appointment_at,
            nullif(btrim(c.appointment_place), '') as place,
            nullif(btrim(a.unit_name), '') as unit_name,
            coalesce(nullif(btrim(a.job_title), ''), nullif(btrim(a.position_interest), '')) as job_title,
            nullif(btrim(c.job_label), '') as job_label,
            ${STAFF_NAME_SQL('u', 'c.created_by_name')} as by_name,
            c.created_at,
            (select r.result from ${attendance} r
              where r.application_id = c.application_id
                and date_trunc('minute', r.appointment_at) = date_trunc('minute', c.appointment_at)
              order by r.created_at desc limit 1) as attendance,
            (select s.result from ${screening} s
              where s.application_id = c.application_id
                and date_trunc('minute', s.appointment_at) = date_trunc('minute', c.appointment_at)
              order by s.created_at desc limit 1) as screening
       from ${contacts} c
       join ${apps} a on a.id = c.application_id
       left join ${users} u on u.id = c.created_by
      where c.application_id = any($1::uuid[]) and c.ok and c.appointment_at is not null
      order by c.appointment_at desc, c.created_at desc
      limit 100`,
    [ids],
  );
  return rows.map((r) => ({ ...r, appointment_at: iso(r.appointment_at) ?? '', created_at: iso(r.created_at) ?? '' }));
}
