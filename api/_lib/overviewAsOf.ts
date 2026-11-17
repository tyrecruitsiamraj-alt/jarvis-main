/**
 * ═══ ผล ณ วันสิ้นสุด — ภาพรวมงานสรรหา v2 (เจ้าของ 17 พ.ย. 2569 "ห้ามใช้ผลล่าสุดแทนย้อนหลัง") ═══
 *
 * คิวรี facts ของภาพรวมอ่าน "ผลล่าสุด" จากตารางเหตุการณ์ (คิว AI · ผลที่เจ้าหน้าที่ลง · บันทึกติดต่อ · มา/ไม่มา · ผ่าน/ไม่ผ่าน)
 * ช่วงที่วันสิ้นสุดเป็นอดีต = แทนตารางพวกนั้นด้วยแถวที่ **บันทึกก่อน cutoff** (สิ้นวัน `to` เวลาไทย) ใน CTE
 * ⇒ นิยามเดิมทุกตัว (`LATEST_*` · `CALLED_*` · `APPOINTMENT_AT_SQL` …) ทำงานเหมือนเดิมโดยไม่ต้องเขียนซ้ำ
 *
 * ข้อจำกัด (บอกบนจอ ไม่เดา):
 * - คิว AI: แถวที่ได้ผลหลัง cutoff = ยังไม่มีผล ณ วันนั้น (นับเป็นรอ AI ถ้าเข้าคิวก่อน cutoff) · ผลที่ถูกแก้ทีหลังใช้ค่าปัจจุบัน
 * - ผลที่เจ้าหน้าที่ลง (hold): ใช้เวลาเหตุการณ์ล่าสุดของแถว — ถ้าถูกแก้หลัง cutoff แถวนั้นหายจากวันในอดีต
 * - Lead / ผู้เก็บรายชื่อ / อายุ / จังหวัด / เหตุที่ไม่ส่ง AI = ค่าปัจจุบัน (ไม่มีประวัติ)
 */
import { tableInAppSchema } from './schema.js';
import { IN_QUEUE_SQL } from './applicantOverviewSql.js';

const QUEUE = tableInAppSchema('lumos_dispatch_queue');
const HOLDS = tableInAppSchema('candidate_call_holds');
const CONTACTS = tableInAppSchema('application_contact_logs');
const ATTENDANCE = tableInAppSchema('application_appointment_results');
const SCREEN = tableInAppSchema('application_screening_results');
const CANCELLATIONS = tableInAppSchema('application_cancellations');

/** ตารางเหตุการณ์ → ชื่อ CTE + เงื่อนไข "บันทึกก่อน cutoff" (`$c` = พารามิเตอร์ cutoff) */
const AS_OF_TABLES: ReadonlyArray<{ table: string; cte: string; where: string }> = [
  // ผลคิวต้องได้ก่อน cutoff — แถวที่ยังไม่มีผล (first_result_at ว่าง) ใช้เวลาที่แก้ล่าสุดแทน (สอดคล้อง QUEUE_EVENT_AT)
  { table: QUEUE, cte: 'ov_asof_queue', where: `created_at < $c and coalesce(first_result_at, updated_at) < $c` },
  { table: HOLDS, cte: 'ov_asof_holds', where: `coalesce(result_at, updated_at, released_at, held_at) < $c` },
  { table: CONTACTS, cte: 'ov_asof_contacts', where: `created_at < $c` },
  { table: ATTENDANCE, cte: 'ov_asof_attendance', where: `created_at < $c` },
  { table: SCREEN, cte: 'ov_asof_screening', where: `created_at < $c` },
  // ยกเลิกข้อมูลผู้สมัครหลัง cutoff = ณ วันนั้นยังไม่ยกเลิก
  { table: CANCELLATIONS, cte: 'ov_asof_cancellations', where: `cancelled_at < $c` },
];

/**
 * อยู่ในคิว AI ณ cutoff — เข้าคิวก่อน cutoff และยังไม่ได้ผลก่อน cutoff (ไม่นับยกเลิก)
 * แทน `IN_QUEUE_SQL` (อ่านสถานะคิวปัจจุบัน ซึ่งย้อนหลังไม่ได้) · อ่านตารางจริง ไม่ผ่าน CTE
 */
function inQueueAsOfSql(c: string): string {
  return `(
  exists (
    select 1 from ${QUEUE} q
     where q.created_at < ${c}
       and (q.first_result_at is null or q.first_result_at >= ${c})
       and q.status <> 'cancelled'
       and (q.person_ref = 'app-' || a.id::text
            or (a.phone_e164 is not null and coalesce(q.payload->>'recipient_phone', q.payload->>'phone') = a.phone_e164)))
)`;
}

/**
 * แปลงคิวรี facts ให้อ่านผล ณ cutoff — `cutoffRef` = พารามิเตอร์ เช่น `$4` (timestamptz ต้นวันถัดจาก `to` เวลาไทย)
 * คิวรีต้นทางต้องขึ้นต้นด้วย select (ไม่มี with ของตัวเอง)
 */
export function asOfSql(sql: string, cutoffRef: string): string {
  if (/^\s*with\b/i.test(sql)) throw new Error('asOfSql: คิวรีที่มี WITH ของตัวเองยังไม่รองรับ');
  // อยู่ในคิวต้องอ่านตารางจริง (แถวที่ได้ผลหลัง cutoff คือคนที่ยังรออยู่ ณ วันนั้น) — กันไว้ก่อนแทนชื่อตาราง แล้วค่อยใส่กลับ
  const HOLE = '/*ov_asof_in_queue*/';
  let body = sql.split(IN_QUEUE_SQL).join(HOLE);
  const ctes: string[] = [];
  for (const t of AS_OF_TABLES) {
    if (!body.includes(t.table)) continue;
    body = body.split(t.table).join(t.cte);
    ctes.push(`${t.cte} as (select * from ${t.table} where ${t.where.split('$c').join(cutoffRef)})`);
  }
  body = body.split(HOLE).join(inQueueAsOfSql(cutoffRef));
  return ctes.length ? `with ${ctes.join(',\n')}\n${body}` : body;
}

/**
 * cutoff ของช่วง — วันสิ้นสุดเป็นอดีต = ต้นวันถัดไปเวลาไทย · วันสิ้นสุดคือวันนี้ = null (อ่านผลล่าสุดได้เลย)
 * `to`/`today` = YYYY-MM-DD (ไทย)
 */
export function asOfCutoff(to: string, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(to) || to >= today) return null;
  const d = new Date(`${to}T00:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}
