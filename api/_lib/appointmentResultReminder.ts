/**
 * ═══ นัดที่เลยวันแล้วยังไม่ลงผลมา/ไม่มา (เจ้าของ 20 ต.ค. 2569 · Choice "แจ้งเตือนเจ้าของนัด" + "แถบแดงบนหัวกล่องงาน") ═══
 *
 * เหตุ: นัดที่เลยวันแล้ว ต.ค. 2569 ไม่มีใครลงผลเลย (8 จาก 8) ⇒ ระบบตอบไม่ได้ว่าคนมาจริงไหม ตัวเลขคุ้มไหมตันที่ขั้นนี้
 * - นัด = บันทึกติดต่อล่าสุดของใบที่ "สำเร็จ + มีวันนัด" (ตัวเดียวกับ `LATEST_CONTACT_APPOINTMENT_AT_SQL`)
 * - ยังไม่ลงผล = ผลนัดล่าสุดว่าง หรือ "เลื่อนนัด" (กติกาเดียวกับ `OVERDUE_NO_RESULT_SQL`)
 * - นับ Lead ด้วย — แท็บติดตามนัดหมายโชว์นัดของ Lead (ชิป "เลยวันนัด" ต้องเท่าแถบแดง · 20 ต.ค. 2569)
 * - ช้า = เลยเวลานัดเกิน 24 ชม. (กติกาเจ้าของ "ทุกอย่างต้องภายใน 24 ชม.") · ย้อนไม่เกิน 30 วัน (นัดเก่ากว่านั้นไม่เตือนแล้ว)
 * - เจ้าของนัด = คนที่บันทึกนัด (`created_by`) · แจ้งวันละครั้งต่อคน (dedupe ตามวัน) ตั้งแต่ 08:00 เวลาไทย
 * แจ้งเตือนเป็นของแถม — ล้มแล้วกลืน ห้ามทำงานหลักล้ม
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { notifyUsers } from './appNotifications.js';
import { logError, logInfo } from './logger.js';

const APPS = tableInAppSchema('public_job_applications');
const CONTACTS = tableInAppSchema('application_contact_logs');
const ATTENDANCE = tableInAppSchema('application_appointment_results');
const CANCELLATIONS = tableInAppSchema('application_cancellations');

export const OVERDUE_HOURS = 24;
export const LOOKBACK_DAYS = 30;
export const REMIND_FROM_HOUR = 8;

/** นัดค้างลงผล: ใบละแถว · `$1` = เจ้าของนัด (uuid) หรือ null = ทุกคน */
export function overdueAppointmentsSql(): string {
  return `
  select a.id::text as app_id, c.created_by::text as owner_id, c.appointment_at
    from ${APPS} a
    join lateral (
      select c.ok, c.appointment_at, c.created_by from ${CONTACTS} c
       where c.application_id = a.id
       order by c.created_at desc limit 1
    ) c on c.ok and c.appointment_at is not null
   where c.appointment_at < now() - interval '${OVERDUE_HOURS} hours'
     and c.appointment_at > now() - interval '${LOOKBACK_DAYS} days'
     and not exists (select 1 from ${CANCELLATIONS} x where x.application_id = a.id)
     and coalesce((select r.result from ${ATTENDANCE} r where r.application_id = a.id
                    order by r.appointment_at desc nulls last, r.created_at desc limit 1), 'rescheduled') = 'rescheduled'
     and ($1::uuid is null or c.created_by = $1::uuid)`;
}

export async function countOverdueAppointments(ownerId: string | null): Promise<number> {
  const { rows } = await dbQuery<{ n: number }>(`select count(*)::int as n from (${overdueAppointmentsSql()}) x`, [ownerId]);
  return Number(rows[0]?.n ?? 0);
}

/** จัดกลุ่มตามเจ้าของนัด — นัดที่ไม่รู้คนบันทึกแยกนับไว้ (ไม่มีใครให้แจ้ง) */
export function groupByOwner(rows: ReadonlyArray<{ owner_id: string | null }>): { byOwner: Map<string, number>; noOwner: number } {
  const byOwner = new Map<string, number>();
  let noOwner = 0;
  for (const r of rows) {
    if (!r.owner_id) {
      noOwner += 1;
      continue;
    }
    byOwner.set(r.owner_id, (byOwner.get(r.owner_id) ?? 0) + 1);
  }
  return { byOwner, noOwner };
}

const BKK_DAY_HOUR = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
});

/** วัน (YYYY-MM-DD) + ชั่วโมงเวลาไทย */
export function bangkokDayHour(now: Date): { day: string; hour: number } {
  const parts = Object.fromEntries(BKK_DAY_HOUR.formatToParts(now).map((p) => [p.type, p.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

/** ถึงเวลาเตือนของวันนี้ไหม — ตั้งแต่ 08:00 และวันนี้ยังไม่ได้เตือน */
export function isReminderDue(now: Date, lastRunDay: string | null): boolean {
  const { day, hour } = bangkokDayHour(now);
  return hour >= REMIND_FROM_HOUR && lastRunDay !== day;
}

export async function runAppointmentReminderOnce(now: Date = new Date()): Promise<{ owners: number; overdue: number; noOwner: number }> {
  const { rows } = await dbQuery<{ owner_id: string | null }>(overdueAppointmentsSql(), [null]);
  const { byOwner, noOwner } = groupByOwner(rows);
  const { day } = bangkokDayHour(now);
  for (const [ownerId, n] of byOwner) {
    await notifyUsers([ownerId], {
      type: 'appointment_no_result',
      title: `นัดที่ยังไม่ลงผลมา/ไม่มา ${n.toLocaleString('th-TH')} คน`,
      body: 'เลยวันนัดมาเกิน 24 ชม. แล้ว',
      link: '/jobs/board?view=appointments',
      dedupeKey: `appt-no-result:${day}`,
    });
  }
  return { owners: byOwner.size, overdue: rows.length, noOwner };
}

let running = false;
let stopped = false;
let lastRunDay: string | null = null;
const CHECK_EVERY_MS = 30 * 60_000;

/** เปิดโดยดีฟอลต์ · ปิดด้วย APPOINTMENT_REMINDER_ENABLED=false */
export function startAppointmentReminderWorker(): boolean {
  if ((process.env.APPOINTMENT_REMINDER_ENABLED || '').trim().toLowerCase() === 'false') return false;
  if (running) return true;
  running = true;
  stopped = false;
  void (async () => {
    while (!stopped) {
      const now = new Date();
      if (isReminderDue(now, lastRunDay)) {
        try {
          const out = await runAppointmentReminderOnce(now);
          lastRunDay = bangkokDayHour(now).day;
          logInfo('appointmentReminder.sent', out);
        } catch (e) {
          logError('appointmentReminder', e);
        }
      }
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, CHECK_EVERY_MS);
        t.unref?.();
      });
    }
    running = false;
  })();
  return true;
}

export function stopAppointmentReminderWorker(): void {
  stopped = true;
}
