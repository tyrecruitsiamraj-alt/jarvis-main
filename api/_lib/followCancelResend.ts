/**
 * ═══ ส่งคำสั่งยกเลิกซ้ำให้ Lumos — สายที่ฝั่งเรายกเลิกแล้วแต่ยังไม่ถึงเวลา (เจ้าของ 7 ต.ค. 2569) ═══
 *
 * ปัญหา Lumos 7/10/2569 ข้อ 1: *"ทศพร ภาระยาท กดยกเลิกแผนทั้งชุดไปตั้งแต่วันที่ 5/10/69 แต่วันนี้ลูมอสโทร…"*
 * วัดจริง: 14 วันล่าสุดมี 13 สายที่ฝั่งเรายกเลิกแล้ว แต่ผลโทรยังกลับมา (Lumos ยังถือแผนอยู่ — คำสั่งยกเลิกตอนนั้นไปไม่ถึง
 * หรือส่งด้วยรหัสที่ Lumos ไม่รู้จัก ก่อนแก้ "ยกเลิกต้องใช้รหัสหัวขบวน" 1 ต.ค.) · ค้างอีก 97 สายที่ยังไม่ถึงเวลา
 * Choice เจ้าของ: "ส่งคำสั่งยกเลิกซ้ำให้สายที่เรายกเลิกแล้ว"
 *
 * เงื่อนไข: แถวติดตามถูกยกเลิก (`cancelled_at`) · นัดหลังตอนนี้ · คิวสถานะ cancelled · ยังไม่เคยส่งซ้ำ (`push_state` ≠ 'cancel_resent')
 * · 🔴 แผนนั้นต้องไม่มีสายที่ยังรอโทร (pending) — ยกเลิกด้วยรหัสแผน = ยกเลิกทั้งแผน ห้ามโดนสายที่ยังต้องโทร
 * ส่งแล้ว (สำเร็จ หรือ 404 = Lumos ไม่มีแผนนี้แล้ว) จดลง `push_state` ไม่ส่งซ้ำอีก · ล้มอย่างอื่น = ลองใหม่รอบหน้า
 * 🔴 ไม่มีคีย์ push (เครื่อง dev) = ไม่ทำอะไร
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { getLumosPushConfig } from './lumosPushClient.js';
import { cancelPushedReminderIgnoringMissing } from './lumosDispatch.js';
import { logError, logInfo } from './logger.js';

const followTable = tableInAppSchema('follow_entries');
const queueTable = tableInAppSchema('lumos_dispatch_queue');
/** เพดานต่อรอบ — ไม่ถล่ม Lumos รอบแรกที่ของค้างเยอะ */
const LIMIT = 50;
export const CANCEL_RESENT_STATE = 'cancel_resent';

export function cancelResendSql(): string {
  return `
    select distinct coalesce(x.plan_ref, x.person_ref) as ref
      from ${followTable} e
      join ${queueTable} x
        on x.channel = 'reminder' and x.job_ref = 'follow' and x.person_ref = 'follow-' || e.id::text
     where e.cancelled_at is not null
       and e.scheduled_at > now()
       and x.status = 'cancelled'
       and coalesce(x.push_state, '') <> '${CANCEL_RESENT_STATE}'
       and not exists (
         select 1 from ${queueTable} y
          where y.channel = 'reminder' and y.job_ref = 'follow' and y.status = 'pending'
            and coalesce(y.plan_ref, y.person_ref) = coalesce(x.plan_ref, x.person_ref)
       )
     limit ${LIMIT}`;
}

export async function resendFollowCancels(): Promise<{ sent: number; failed: number }> {
  const out = { sent: 0, failed: 0 };
  if (!getLumosPushConfig()) return out;
  const { rows } = await dbQuery<{ ref: string }>(cancelResendSql());
  for (const { ref } of rows) {
    try {
      await cancelPushedReminderIgnoringMissing(ref);
      await dbQuery(
        `update ${queueTable} set push_state = $2
          where channel = 'reminder' and job_ref = 'follow' and status = 'cancelled'
            and coalesce(plan_ref, person_ref) = $1`,
        [ref, CANCEL_RESENT_STATE],
      );
      out.sent += 1;
    } catch (e) {
      out.failed += 1;
      logError('follow.cancelResend: ส่งยกเลิกไม่สำเร็จ (ลองใหม่รอบหน้า)', e, { ref });
    }
  }
  if (rows.length > 0) logInfo('follow.cancelResend', out);
  return out;
}
