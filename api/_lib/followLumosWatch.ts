/**
 * ═══ กัน AI ไม่โทรแบบเงียบ ๆ — สองชั้น (เจ้าของ 8 ต.ค. 2569 · Choice "ทำทั้งสองชั้น") ═══
 *
 * > *"ครบหมดเมื่อวานก็ครบหมด แต่ไม่โทรแล้วมันจะเกิดอีกไหมหล่ะ"*
 * แผนของอิทธิชัย 8 ต.ค.: Lumos ตอบรับคำขอ (`push_accepted_at`) แต่ไม่โทร — คำตอบรับ = "ได้รับคำขอแล้ว"
 * ยังไม่ใช่ "นำเข้าสำเร็จ" · Lumos บอกได้ที่ `GET /events/{id}` (imported / failed / discarded) แต่เราไม่เคยถาม
 *
 * ชั้น 1 `checkFollowPlanImports` — ถามสถานะของทุกแผนที่ส่งไป (แถวหัวขบวน) จนกว่าจะ imported
 *   - failed / discarded → ส่งแผนใหม่ 1 ครั้ง (`resyncFollowPlanWithLumos` คีย์ใหม่)
 *   - ส่งใหม่แล้วยังไม่ผ่าน → ทุกสายในแผนขึ้น "Lumos ไม่รับแผน" + แจ้งเตือน
 *   - pending/processing ค้างเกิน 30 นาที → จด log อย่างเดียว (ยังไม่รู้ว่า Lumos ใช้ pending กับแผนเตือนยังไง —
 *     ตัดสินจากมันเมื่อไหร่ รอบแรกหลังขึ้นเว็บอาจขึ้นเตือนทั้งระบบ · ชั้น 2 ตามจับตอนเลยเวลาแทน)
 *   🔴 ถามไม่ได้ (เน็ต/404/คีย์) = **ไม่ทำอะไร** รอบหน้าถามใหม่ — ห้ามตีความว่าล้ม แล้วส่งแผนใหม่ทั้งระบบ
 *   🔴 ส่งใหม่ได้ไม่เกิน `MAX_RESYNC_PER_RUN` แผนต่อรอบ — ถ้า Lumos ล้มทั้งระบบ ไม่ถล่มเขาซ้ำ
 * ชั้น 2 `alertOverdueAiFollow` — สาย AI เลยเวลานัด 15 นาทียังไม่มีผล → แจ้งคนเพิ่ม + admin/supervisor ครั้งเดียวต่อสาย
 *   🔴 **ไม่สลับเป็นคนโทรเอง** (เจ้าของ 7 ต.ค. 2569 ปัญหา Lumos ข้อ 3 "ไม่ต้องการให้เปลี่ยนอัตโนมัติ")
 *
 * เดินในรอบของตัวส่งซ้ำงานติดตาม (`followPushRetryWorker` ทุก 1 นาที) · เครื่องไม่มีคีย์ push = ไม่ทำอะไร
 * ยังไม่ migrate 138 = ข้ามเงียบ ๆ
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { getEventStatus, getLumosPushConfig } from './lumosPushClient.js';
import { resyncFollowPlanWithLumos } from './lumosDispatch.js';
import { staffNameOfPhone } from './followStaffName.js';
import { notifyRoles, notifyUsers } from './appNotifications.js';
import { errorSummaryText, logError, logInfo, logWarn } from './logger.js';

const followTable = tableInAppSchema('follow_entries');
const queueTable = tableInAppSchema('lumos_dispatch_queue');

/** ถามได้เมื่อส่งไปแล้วอย่างน้อยเท่านี้ (ให้ Lumos นำเข้าก่อน) */
export const IMPORT_CHECK_AFTER_MINUTES = 2;
/** ค้าง pending/processing นานกว่านี้ = ถือว่าไม่เข้า */
export const IMPORT_STUCK_MINUTES = 30;
export const MAX_RESYNC_PER_RUN = 10;
/** เลยเวลานัดกี่นาทีถึงเตือน (เจ้าของเลือก 15 นาที) */
export const OVERDUE_ALERT_MINUTES = 15;
const CHECK_LIMIT = 50;

function isUndefinedColumn(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42703';
}

type PlanRow = {
  qid: string;
  entry_id: string;
  plan: string;
  event_id: string;
  retries: number;
  stuck: boolean;
};

/** แผนที่ยังไม่รู้ว่านำเข้าสำเร็จ — แถวหัวขบวนที่ยังรอโทร ส่งไปแล้ว ≥ 2 นาที */
export function pendingImportSql(): string {
  return `
    select q.id::text as qid, f.id::text as entry_id, coalesce(q.plan_ref, q.person_ref) as plan,
           q.push_event_id as event_id, q.lumos_import_retries as retries,
           (q.push_accepted_at < now() - interval '${IMPORT_STUCK_MINUTES} minutes') as stuck
      from ${queueTable} q
      join ${followTable} f on q.person_ref = 'follow-' || f.id::text
     where q.channel = 'reminder' and q.job_ref = 'follow'
       and q.person_ref = coalesce(q.plan_ref, q.person_ref)
       and q.status = 'pending' and q.result is null
       and q.push_event_id is not null
       and q.push_accepted_at < now() - interval '${IMPORT_CHECK_AFTER_MINUTES} minutes'
       and q.push_accepted_at > now() - interval '3 days'
       and coalesce(q.lumos_import_status, 'pending') in ('pending', 'processing')
       and (q.lumos_import_checked_at is null or q.lumos_import_checked_at < now() - interval '1 minute')
       and f.cancelled_at is null and f.completed_at is null
     order by q.push_accepted_at
     limit ${CHECK_LIMIT}`;
}

async function setImport(qid: string, status: string, error: string | null): Promise<void> {
  await dbQuery(
    `update ${queueTable} set lumos_import_status = $2, lumos_import_error = $3, lumos_import_checked_at = now()
      where id = $1::bigint`,
    [qid, status, error],
  );
}

/** ทุกสายในแผนขึ้น "Lumos ไม่รับแผน" + แจ้งคนเพิ่ม/หัวหน้า ครั้งเดียวต่อแผน */
async function markNotImported(plan: string, reason: string): Promise<void> {
  const { rows } = await dbQuery<{ id: string; created_by: string | null; name: string; at: string | Date }>(
    `update ${followTable} f
        set dispatch_state = 'not_imported', dispatch_error = $2
       from ${queueTable} q
      where q.channel = 'reminder' and q.job_ref = 'follow' and q.person_ref = 'follow-' || f.id::text
        and coalesce(q.plan_ref, q.person_ref) = $1
        and q.status = 'pending' and q.result is null
        and f.cancelled_at is null and f.completed_at is null
      returning f.id::text as id, f.created_by::text as created_by, f.recipient_name as name, f.scheduled_at as at`,
    [plan, `Lumos ไม่รับแผน: ${reason}`.slice(0, 300)],
  );
  if (rows.length === 0) return;
  const first = rows.reduce((a, b) => (new Date(a.at) <= new Date(b.at) ? a : b));
  const input = {
    type: 'follow_not_imported',
    title: `AI จะไม่โทร ${first.name} — Lumos ไม่รับแผน`,
    body: `${rows.length} สาย · ให้เจ้าหน้าที่โทรแทน`,
    link: '/follow',
    dedupeKey: `follow_not_imported:${plan}`,
  };
  await notifyUsers(
    rows.map((r) => r.created_by).filter((v): v is string => !!v),
    input,
  );
  await notifyRoles(['admin', 'supervisor'], input);
}

export async function checkFollowPlanImports(): Promise<{
  checked: number;
  imported: number;
  resent: number;
  notImported: number;
  stuck: number;
}> {
  const out = { checked: 0, imported: 0, resent: 0, notImported: 0, stuck: 0 };
  if (!getLumosPushConfig()) return out;
  let plans: PlanRow[];
  try {
    plans = (await dbQuery<PlanRow>(pendingImportSql())).rows;
  } catch (e) {
    if (isUndefinedColumn(e)) return out;
    throw e;
  }
  let resyncBudget = MAX_RESYNC_PER_RUN;
  for (const p of plans) {
    let status: string;
    let error: string | null = null;
    try {
      const ev = await getEventStatus(p.event_id);
      status = ev.status;
      error = ev.error ?? null;
    } catch (e) {
      // 🔴 ถามไม่ได้ ≠ ล้ม — จดเวลาไว้ รอบหน้าถามใหม่
      await dbQuery(`update ${queueTable} set lumos_import_checked_at = now() where id = $1::bigint`, [p.qid]).catch(() => {});
      logWarn('follow.importCheck: ถามสถานะไม่ได้', { plan: p.plan, reason: errorSummaryText(e, 200) });
      continue;
    }
    out.checked += 1;
    if (status === 'imported') {
      await setImport(p.qid, status, null);
      out.imported += 1;
      continue;
    }
    const dead = status === 'failed' || status === 'discarded';
    if (!dead) {
      await setImport(p.qid, status, error);
      if (p.stuck) out.stuck += 1;
      continue;
    }
    const reason = `${status}${error ? ` · ${error}` : ''}`;
    await setImport(p.qid, status, reason);
    // ล้มจริงครั้งแรก → ส่งแผนใหม่ 1 ครั้ง · ส่งใหม่แล้วยังล้ม → ขึ้นจอ + แจ้งเตือน
    if (Number(p.retries) < 1 && resyncBudget > 0) {
      resyncBudget -= 1;
      try {
        // จดจำนวนครั้งที่ทุกแถวของแผนก่อน — แผนใหม่อาจเปลี่ยนหัวขบวน (สายแรกเลยเวลาไปแล้ว)
        const { rows: members } = await dbQuery<{ person_ref: string }>(
          `select person_ref from ${queueTable}
            where channel = 'reminder' and job_ref = 'follow' and status = 'pending' and coalesce(plan_ref, person_ref) = $1`,
          [p.plan],
        );
        await dbQuery(
          `update ${queueTable} set lumos_import_retries = lumos_import_retries + 1
            where channel = 'reminder' and job_ref = 'follow' and coalesce(plan_ref, person_ref) = $1`,
          [p.plan],
        );
        const res = await resyncFollowPlanWithLumos(p.entry_id, staffNameOfPhone);
        if (res.pushed) {
          // แผนใหม่ = event ใหม่ ⇒ ถามใหม่ตั้งแต่ต้น
          await dbQuery(
            `update ${queueTable} set lumos_import_status = null, lumos_import_error = null, lumos_import_checked_at = null
              where channel = 'reminder' and job_ref = 'follow' and person_ref = any($1::text[])`,
            [members.map((m) => m.person_ref)],
          );
          out.resent += 1;
          logInfo('follow.importCheck.resent', { plan: p.plan, status, rounds: res.rounds });
          continue;
        }
        logWarn('follow.importCheck: ส่งแผนใหม่ไม่ผ่าน', { plan: p.plan, reason: res.reason });
      } catch (e) {
        logError('follow.importCheck: ส่งแผนใหม่ล้ม', e, { plan: p.plan });
      }
    }
    await markNotImported(p.plan, reason);
    out.notImported += 1;
  }
  if (out.resent > 0 || out.notImported > 0) logInfo('follow.importCheck', out);
  if (out.stuck > 0) logWarn('follow.importCheck.stuck', { ...out, hint: `Lumos ยังไม่นำเข้าเกิน ${IMPORT_STUCK_MINUTES} นาที` });
  return out;
}

/**
 * สาย AI ที่เลยเวลานัด 15 นาทียังไม่มีผล และยังไม่เคยเตือน (ดูย้อนไม่เกิน 3 ชม. — ไม่เตือนของเก่าค้างระบบ)
 * วัด 7 วันก่อน 8 ต.ค. 2569: ผลกลับภายใน 15 นาที 681 จาก 685 สาย ⇒ เตือนพลาดราว 0.6%
 */
export function overdueAiSql(): string {
  return `
    select q.id::text as qid, f.created_by::text as created_by, f.recipient_name as name, f.scheduled_at as at
      from ${followTable} f
      join ${queueTable} q
        on q.channel = 'reminder' and q.job_ref = 'follow' and q.person_ref = 'follow-' || f.id::text
     where coalesce(f.call_mode, 'ai') = 'ai'
       and f.cancelled_at is null and f.completed_at is null
       and q.status in ('pending', 'delivered') and q.result is null and q.last_outcome is null
       and q.overdue_alerted_at is null
       -- แผนที่ Lumos ไม่รับ แจ้งไปแล้วจากชั้น 1
       and coalesce(f.dispatch_state, '') <> 'not_imported'
       and f.scheduled_at < now() - interval '${OVERDUE_ALERT_MINUTES} minutes'
       and f.scheduled_at > now() - interval '3 hours'
     order by f.scheduled_at
     limit 100`;
}

const TIME_TH = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });

export async function alertOverdueAiFollow(): Promise<{ alerted: number }> {
  const out = { alerted: 0 };
  if (!getLumosPushConfig()) return out;
  let rows: Array<{ qid: string; created_by: string | null; name: string; at: string | Date }>;
  try {
    rows = (await dbQuery<{ qid: string; created_by: string | null; name: string; at: string | Date }>(overdueAiSql())).rows;
  } catch (e) {
    if (isUndefinedColumn(e)) return out;
    throw e;
  }
  for (const r of rows) {
    // จดก่อนแจ้ง — แจ้งซ้ำหลายรอบแย่กว่าพลาดหนึ่งครั้ง (แจ้งเตือนกลืน error อยู่แล้ว)
    const { rows: claimed } = await dbQuery<{ id: string }>(
      `update ${queueTable} set overdue_alerted_at = now() where id = $1::bigint and overdue_alerted_at is null returning id::text`,
      [r.qid],
    );
    if (claimed.length === 0) continue;
    const input = {
      type: 'follow_ai_overdue',
      title: `AI ยังไม่โทร ${r.name} (นัด ${TIME_TH.format(new Date(r.at))})`,
      body: `เลยเวลา ${OVERDUE_ALERT_MINUTES} นาทีแล้วยังไม่มีผล · โทรเองได้ที่หน้าติดตาม`,
      link: '/follow',
      dedupeKey: `follow_ai_overdue:${r.qid}`,
    };
    if (r.created_by) await notifyUsers([r.created_by], input);
    await notifyRoles(['admin', 'supervisor'], input);
    out.alerted += 1;
  }
  if (out.alerted > 0) logInfo('follow.overdueAlert', out);
  return out;
}
