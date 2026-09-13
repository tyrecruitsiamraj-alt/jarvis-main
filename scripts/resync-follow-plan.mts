/**
 * ═══ ส่งแผนโทรติดตามใหม่ให้ Lumos (ใช้ตอนของเก่ากับของใหม่ไม่ตรงกัน) ═══
 *
 *   npx tsx scripts/resync-follow-plan.mts --dry  <followId> [followId...]   # ดูอย่างเดียว
 *   npx tsx scripts/resync-follow-plan.mts --apply <followId> [followId...]  # ลงมือจริง
 *
 * 🔴 **ต้องรันบนเครื่องจริงเท่านั้น** — คีย์ push ของ Lumos อยู่ใน `.env` บน server
 * (เครื่อง dev ไม่มี ⇒ สคริปต์จะบอกว่า push ปิดอยู่แล้วจบ ไม่ทำอะไร)
 *
 * ที่มา (13-14 ก.ย. 2569): งานของวันที่ 14 ก.ย. มี 3 ใน 10 คนที่ Lumos ถือของคนละชุดกับเรา
 * เพราะถูกกด "แก้ไข" หลังส่งไปแล้ว — ตอนนั้นการแก้ยังไม่ส่งใหม่ให้เขา
 * โค้ดใหม่แก้ทางนั้นแล้ว สคริปต์นี้ไว้ **ตามเก็บของที่ค้างอยู่ก่อนโค้ดใหม่ขึ้น**
 *
 * ⚠️ ทำงานเท่ากับที่หน้าจอทำตอนกดบันทึกเป๊ะ ๆ (`resyncFollowPlanWithLumos`):
 * ยกเลิกของเดิมที่ Lumos → เขียนคิว/ลำดับใหม่ → ส่งแผนใหม่ทั้งก้อน
 * **เอาเฉพาะรอบที่ยังไม่ถูกโทร** รอบที่โทรไปแล้วไม่ถูกดึงกลับมา
 */
import '../server/bootstrap-env.js';
import { dbQuery } from '../api/_lib/postgres.js';
import { tableInAppSchema } from '../api/_lib/schema.js';
import { resyncFollowPlanWithLumos } from '../api/_lib/lumosDispatch.js';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const ids = args.filter((a) => !a.startsWith('--'));

if (ids.length === 0) {
  console.error('ต้องระบุ id ของรายการติดตามอย่างน้อยหนึ่งตัว');
  process.exit(1);
}

const staffTable = tableInAppSchema('follow_staff_contacts');
const followTable = tableInAppSchema('follow_entries');
const queueTable = tableInAppSchema('lumos_dispatch_queue');

/** ชื่อเจ้าหน้าที่จากเบอร์ — เทียบ 9 ตัวท้าย (เบอร์สองตารางเขียนคนละรูป) */
async function staffNameOfPhone(phone: string | null): Promise<string | null> {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 9) return null;
  try {
    const { rows } = await dbQuery<{ name: string }>(
      `select name from ${staffTable}
        where right(regexp_replace(phone, '\\D', '', 'g'), 9) = $1
        order by created_at desc limit 1`,
      [digits.slice(-9)],
    );
    return rows[0]?.name?.trim() || null;
  } catch {
    return null;
  }
}

/** ภาพก่อน/หลัง: เวลาในฐาน เทียบ เวลาที่ส่งไปจริง (อ่านจาก payload ของแถวหัวขบวน) */
async function snapshot(followId: string): Promise<string> {
  const { rows } = await dbQuery<{ mine: string | null; sent: string | null }>(
    `with plan as (
       select coalesce(q.plan_ref, q.person_ref) as ref
         from ${queueTable} q
        where q.channel = 'reminder' and q.job_ref = 'follow'
          and q.person_ref = $1
        limit 1)
     select (select string_agg(to_char(f.scheduled_at at time zone 'Asia/Bangkok','HH24:MI'), ' , '
                               order by f.scheduled_at)
               from ${queueTable} q2
               join ${followTable} f on 'follow-' || f.id::text = q2.person_ref
              where coalesce(q2.plan_ref, q2.person_ref) = (select ref from plan)
                and f.cancelled_at is null) as mine,
            (select string_agg(to_char((s->>'scheduled_at')::timestamptz at time zone 'Asia/Bangkok','HH24:MI'), ' , ')
               from ${queueTable} q3,
                    lateral jsonb_array_elements(coalesce(q3.payload->'steps','[]'::jsonb)) s
              where coalesce(q3.plan_ref, q3.person_ref) = (select ref from plan)
                and coalesce(q3.step_position, 0) = 0) as sent`,
    [`follow-${followId}`],
  );
  return `ในฐาน: ${rows[0]?.mine ?? '-'}   ส่งไปแล้ว: ${rows[0]?.sent ?? '-'}`;
}

for (const id of ids) {
  console.log(`\n=== ${id}`);
  console.log(`ก่อน  ${await snapshot(id)}`);
  if (!apply) {
    console.log('(--dry) ยังไม่ลงมือ — ใส่ --apply ถึงจะส่งจริง');
    continue;
  }
  const out = await resyncFollowPlanWithLumos(id, staffNameOfPhone);
  console.log('ผล   ', out);
  console.log(`หลัง  ${await snapshot(id)}`);
}

process.exit(0);
