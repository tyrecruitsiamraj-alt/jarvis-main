/**
 * ═══ ถาม Lumos ว่า "รับสายเข้าจริงไหม" — ใบสมัคร · เลน Match (เจ้าของ Choice 14 ต.ค. 2569 "บอกครบ + แก้คนที่ตกหล่น") ═══
 *
 * ไล่พบ 14 ต.ค.: ใบสมัคร 8 ใบส่งถึง Lumos (ตอบ 202) แต่ไม่เคยมีผลโทรกลับ · ระบบรู้ตัวตอนเงียบครบ 24 ชม. เท่านั้น
 * ต้นเหตุฝั่งเรา: คำตอบ 202 = "ได้รับคำขอ" ยังไม่ใช่ "นำเข้าสำเร็จ" · งานติดตามถาม `GET /events/{id}` อยู่แล้ว
 * (`followLumosWatch.ts` 8 ต.ค.) แต่ช่องใบสมัคร/Match ไม่เคยจดเลข event ไว้ถามเลย
 * ⇒ `pushQueueRowsTracked` จด `push_event_id` ทุกครั้งแล้ว · ตัวนี้ถามต่อทุกนาที (ในรอบของ `lumosPushRetryWorker`)
 *
 * - imported → จดไว้ จบ
 * - failed / discarded → จด + แจ้ง admin/supervisor ครั้งเดียวต่อสาย · ป้ายแท็บผู้สมัครขึ้น "Lumos ไม่รับสาย"
 *   🔴 **ไม่ส่งใหม่เอง ไม่ย้ายให้คน** (เจ้าของ 9 ต.ค. 2569 "ส่ง Ai โทรก็ต้อง Ai โทร … ไม่แก้ชุ่ยๆ")
 * - pending/processing ค้าง → จด log (รู้ตอนเงียบครบ 24 ชม. ตามเดิม)
 * 🔴 ถามไม่ได้ (เน็ต/404/คีย์) = ไม่ทำอะไร รอบหน้าถามใหม่ — ห้ามตีความว่าล้ม
 * ไม่แตะงานติดตาม (`job_ref = 'follow'` มีตัวถามของตัวเอง) · ไม่มีคีย์ push = ไม่ทำอะไร · ยังไม่ migrate 138 = ข้ามเงียบ ๆ
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { getEventStatus, getLumosPushConfig } from './lumosPushClient.js';
import { notifyRoles } from './appNotifications.js';
import { errorSummaryText, logInfo, logWarn } from './logger.js';

/** ค่าเดียวกับงานติดตาม (`followLumosWatch.ts`) — ไม่ import ตรงเพราะไฟล์นั้นพ่วง lumosDispatch (วนกลับมาตัวส่งซ้ำ) */
const IMPORT_CHECK_AFTER_MINUTES = 2;
const IMPORT_STUCK_MINUTES = 30;
const queueTable = tableInAppSchema('lumos_dispatch_queue');
const CHECK_LIMIT = 50;

function isUndefinedColumn(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42703';
}

/** สายที่ส่งถึงแล้วแต่ยังไม่รู้ว่า Lumos นำเข้าสำเร็จ — ช่องใบสมัคร/Match เท่านั้น */
export function pendingQueueImportSql(): string {
  return `
    select q.id::text as qid, q.push_event_id as event_id, q.person_ref,
           coalesce(q.payload->>'candidate_name', q.payload->>'recipient_name', '') as name,
           (q.push_accepted_at < now() - interval '${IMPORT_STUCK_MINUTES} minutes') as stuck
      from ${queueTable} q
     where q.job_ref <> 'follow'
       and q.status = 'pending' and q.result is null
       and q.push_state = 'pushed'
       and q.push_event_id is not null
       and q.push_accepted_at < now() - interval '${IMPORT_CHECK_AFTER_MINUTES} minutes'
       and q.push_accepted_at > now() - interval '3 days'
       and coalesce(q.lumos_import_status, 'pending') in ('pending', 'processing')
       and (q.lumos_import_checked_at is null or q.lumos_import_checked_at < now() - interval '1 minute')
     order by q.push_accepted_at
     limit ${CHECK_LIMIT}`;
}

type Row = { qid: string; event_id: string; person_ref: string; name: string; stuck: boolean };

export async function checkQueueImports(): Promise<{ checked: number; imported: number; notImported: number; stuck: number }> {
  const out = { checked: 0, imported: 0, notImported: 0, stuck: 0 };
  if (!getLumosPushConfig()) return out;
  let rows: Row[];
  try {
    rows = (await dbQuery<Row>(pendingQueueImportSql())).rows;
  } catch (e) {
    if (isUndefinedColumn(e)) return out;
    throw e;
  }
  for (const r of rows) {
    let status: string;
    let error: string | null = null;
    try {
      const ev = await getEventStatus(r.event_id);
      status = ev.status;
      error = ev.error ?? null;
    } catch (e) {
      await dbQuery(`update ${queueTable} set lumos_import_checked_at = now() where id = $1::bigint`, [r.qid]).catch(() => {});
      logWarn('lumos.importCheck: ถามสถานะไม่ได้', { queueId: r.qid, reason: errorSummaryText(e, 200) });
      continue;
    }
    out.checked += 1;
    const dead = status === 'failed' || status === 'discarded';
    const reason = dead ? `${status}${error ? ` · ${error}` : ''}`.slice(0, 300) : error;
    await dbQuery(
      `update ${queueTable} set lumos_import_status = $2, lumos_import_error = $3, lumos_import_checked_at = now()
        where id = $1::bigint`,
      [r.qid, status, reason],
    );
    if (status === 'imported') {
      out.imported += 1;
      continue;
    }
    if (!dead) {
      if (r.stuck) out.stuck += 1;
      continue;
    }
    out.notImported += 1;
    await notifyRoles(['admin', 'supervisor'], {
      type: 'queue_not_imported',
      title: `AI จะไม่โทร ${r.name || 'ผู้สมัคร'} — Lumos ไม่รับสาย`,
      body: 'ให้เจ้าหน้าที่โทรแทน หรือส่ง AI ใหม่',
      link: '/jobs/board?view=list&list=ai_at_risk',
      dedupeKey: `queue_not_imported:${r.qid}:${r.event_id}`,
    });
  }
  if (out.notImported > 0) logInfo('lumos.importCheck', out);
  if (out.stuck > 0) logWarn('lumos.importCheck.stuck', { ...out, hint: `Lumos ยังไม่นำเข้าเกิน ${IMPORT_STUCK_MINUTES} นาที` });
  return out;
}
