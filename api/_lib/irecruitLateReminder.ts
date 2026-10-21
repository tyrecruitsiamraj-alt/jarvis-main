/**
 * ═══ เตือนรายชื่อ iRecruit ที่ค้างเกิน 24 ชม. (เจ้าของ 21 ต.ค. 2569 "ข้อ 2 ทำ") ═══
 * รายชื่อที่ดึงจาก iRecruit ให้คนโทร (AI ไม่โทรเอง) — ทีมทำใน iRecruit ⇒ ค้าง = สถานะ iRecruit ยัง "รอดำเนินการ" (W · 158)
 * และลงทะเบียนมาเกิน 24 ชม. · เช้าละครั้งตั้งแต่ 08:00 แจ้งผู้รับผิดชอบใน iRecruit (`responsible_name` → ผู้ใช้ Jarvis)
 * จับชื่อไม่ได้ = รวมแจ้งหัวหน้า (admin/supervisor) · กันแจ้งซ้ำต่อคนต่อวัน (dedupe_key) · ปิดด้วย IRECRUIT_LATE_REMINDER_ENABLED=false
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { notifyRoles, notifyUsers } from './appNotifications.js';
import { bangkokDayHour, isReminderDue } from './appointmentResultReminder.js';
import { logError, logInfo } from './logger.js';
import { IRECRUIT_LATE_HOURS } from '../../src/lib/irecruitPullStatus.js';

const APPS = tableInAppSchema('public_job_applications');
const IMPORTS = tableInAppSchema('app_irecruit_imports');
const USERS = tableInAppSchema('users');
const CANCELLATIONS = tableInAppSchema('application_cancellations');
const LOOKBACK_DAYS = 14;
const CHECK_EVERY_MS = 30 * 60_000;
export const IRECRUIT_LATE_LINK = '/jobs/board?view=list&list=irecruit_pull';

/** ค้างต่อผู้รับผิดชอบ · $1 = ชั่วโมงที่นับว่าค้าง · $2 = ย้อนกี่วัน */
export function irecruitLateSql(): string {
  return `
    select nullif(btrim(a.responsible_name), '') as responsible, count(*)::int as n
      from ${APPS} a
      join ${IMPORTS} i on i.application_id = a.id
     where a.created_by_name = 'iRecruit'
       and i.irecruit_status = 'W'
       and a.created_at <= now() - make_interval(hours => $1::int)
       and a.created_at > now() - make_interval(days => $2::int)
       and not exists (select 1 from ${CANCELLATIONS} c where c.application_id = a.id)
     group by 1`;
}

/** ชื่อผู้รับผิดชอบ → ผู้ใช้ (ชื่อเล่น · ชื่อเต็ม · อีเมล ไม่สนตัวพิมพ์) · ชื่อซ้ำหลายคน = ไม่เดา */
export function matchUsersByName(
  names: readonly string[],
  users: ReadonlyArray<{ id: string; nickname: string | null; full_name: string | null; email: string | null }>,
): Map<string, string> {
  const out = new Map<string, string>();
  const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
  for (const name of names) {
    const k = norm(name);
    if (!k) continue;
    const hits = users.filter((u) => [u.nickname, u.full_name, u.email].some((v) => norm(v) === k));
    if (hits.length === 1) out.set(name, hits[0].id);
  }
  return out;
}

export async function runIrecruitLateReminderOnce(now: Date = new Date()): Promise<{ people: number; late: number; unmatched: number }> {
  let rows: Array<{ responsible: string | null; n: number }>;
  try {
    ({ rows } = await dbQuery<{ responsible: string | null; n: number }>(irecruitLateSql(), [IRECRUIT_LATE_HOURS, LOOKBACK_DAYS]));
  } catch (e) {
    if (/irecruit_status/.test(String((e as Error)?.message ?? e))) return { people: 0, late: 0, unmatched: 0 };
    throw e;
  }
  const late = rows.reduce((s, r) => s + r.n, 0);
  if (late === 0) return { people: 0, late: 0, unmatched: 0 };
  const { rows: users } = await dbQuery<{ id: string; nickname: string | null; full_name: string | null; email: string | null }>(
    `select id::text as id, nickname, full_name, email from ${USERS} where coalesce(is_active, true)`,
  );
  const named = rows.filter((r) => r.responsible).map((r) => r.responsible as string);
  const byName = matchUsersByName(named, users);
  const { day } = bangkokDayHour(now);
  let unmatched = 0;
  for (const r of rows) {
    const uid = r.responsible ? byName.get(r.responsible) : undefined;
    if (!uid) {
      unmatched += r.n;
      continue;
    }
    await notifyUsers([uid], {
      type: 'irecruit_late',
      title: `iRecruit รอโทรเกิน ${IRECRUIT_LATE_HOURS} ชม. ${r.n} คน`,
      body: 'รายชื่อที่ดึงจาก iRecruit ยังเป็น "รอดำเนินการ"',
      link: IRECRUIT_LATE_LINK,
      dedupeKey: `irecruit_late:${day}`,
    });
  }
  if (unmatched > 0) {
    await notifyRoles(['admin', 'supervisor'], {
      type: 'irecruit_late',
      title: `iRecruit รอโทรเกิน ${IRECRUIT_LATE_HOURS} ชม. ${unmatched} คน (ไม่รู้ผู้รับผิดชอบ)`,
      body: null,
      link: IRECRUIT_LATE_LINK,
      dedupeKey: `irecruit_late_unmatched:${day}`,
    });
  }
  return { people: rows.length, late, unmatched };
}

let running = false;
let stopped = false;
let lastRunDay: string | null = null;

export function startIrecruitLateReminderWorker(): boolean {
  if ((process.env.IRECRUIT_LATE_REMINDER_ENABLED || '').trim().toLowerCase() === 'false') return false;
  if (running) return true;
  running = true;
  stopped = false;
  void (async () => {
    while (!stopped) {
      const now = new Date();
      if (isReminderDue(now, lastRunDay)) {
        try {
          const out = await runIrecruitLateReminderOnce(now);
          lastRunDay = bangkokDayHour(now).day;
          logInfo('irecruitLateReminder.sent', out);
        } catch (e) {
          logError('irecruitLateReminder', e);
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

export function stopIrecruitLateReminderWorker(): void {
  stopped = true;
}
