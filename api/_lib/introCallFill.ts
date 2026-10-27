/**
 * ═══ สายโทรเบื้องต้น → เติมอายุ/จังหวัดลงใบเฉพาะช่องที่ว่าง (เจ้าของ 21 ต.ค. 2569) ═══
 * > *"ต้องรู้อายุ และ ที่อยู่ โดยให้ Ai ถามมา"* · Choice "ลงใบให้เฉพาะช่องที่ว่าง"
 *
 * ใช้เฉพาะใบที่เจ้าหน้าที่เพิ่มเอง (บท `intro` · `isStaffKeyedApplication`) — รายชื่อ iRecruit ที่ได้บททักทายทั่วไป
 * ยังเป็นป้าย "บอก AI" อย่างเดียวตามกติกาเดิม (15 ต.ค. "ไม่แก้เอง")
 * 🔴 ช่องที่คนคีย์ไว้แล้วไม่ทับ · อ่านไม่ออก = ไม่เติม (ห้ามเดา — `parseGreetingAnswers`) · ล้มต้องไม่ทำให้รับผลล้ม
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { logWarn } from './logger.js';
import { GREETING_JOB_REF, isStaffKeyedApplication, parseGreetingAnswers } from '../../src/lib/greetingCall.js';

const QUEUE = tableInAppSchema('lumos_dispatch_queue');
const APPS = tableInAppSchema('public_job_applications');

export async function fillApplicationFromIntroCall(queueId: number): Promise<{ filled: boolean }> {
  try {
    const { rows } = await dbQuery<{
      id: string;
      age: number | null;
      province: string | null;
      created_by_name: string | null;
      transcript: unknown;
      greeting: boolean;
    }>(
      `select a.id::text as id, a.age, a.province, a.created_by_name, q.result->'transcript' as transcript,
              (q.job_ref = $2) as greeting
         from ${QUEUE} q
         join ${APPS} a on q.person_ref = 'app-' || a.id::text
        where q.id = $1 and q.channel = 'interview'`,
      [queueId, GREETING_JOB_REF],
    );
    const r = rows[0];
    if (!r || !isStaffKeyedApplication(r.created_by_name)) return { filled: false };
    const needAge = r.age == null;
    // สายตามใบขอ (นำเข้า Excel ไม่มีอายุ · 27 ต.ค. 2569 "ให้ Ai ถามมา") เติมแค่อายุ — บทใบขอไม่ได้ถามจังหวัด
    const needProvince = r.greeting && !r.province?.trim();
    if (!needAge && !needProvince) return { filled: false };
    const heard = parseGreetingAnswers(r.transcript);
    const age = needAge ? heard.age : null;
    const province = needProvince ? heard.province : null;
    if (age == null && !province) return { filled: false };
    const { rows: done } = await dbQuery<{ id: string }>(
      `update ${APPS}
          set age = coalesce(age, $2::int),
              province = case when coalesce(btrim(province), '') = '' then coalesce($3::text, province) else province end,
              updated_at = now()
        where id = $1::uuid
        returning id`,
      [r.id, age, province],
    );
    return { filled: done.length > 0 };
  } catch (e) {
    logWarn('introCallFill: เติมอายุ/จังหวัดจากสายโทรเบื้องต้นไม่สำเร็จ', { queueId, reason: e instanceof Error ? e.message : String(e) });
    return { filled: false };
  }
}
