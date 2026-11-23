/**
 * คิวแจ้งเตือน "ผู้สมัครส่งเอกสารแล้ว" → กระดิ่งของเจ้าหน้าที่ (เจ้าของ 22 พ.ย. 2569)
 *
 * แถวในคิวถูกเขียนในธุรกรรมเดียวกับชุดเอกสาร (ชุดสำเร็จ = มีคิวแน่นอน) แล้วตัวส่งค่อยเขียนลงกล่องแจ้งเตือน `app_notifications`
 * - เขียนแล้ว **อ่านกลับยืนยันว่ามีแถวจริง** ถึงจะนับว่าส่งแล้ว — ไม่ใช้ `notifyUsers` (ตัวนั้นกลืน error โดยตั้งใจ ใช้กับงานนี้ไม่ได้)
 * - ส่งไม่สำเร็จ = แถวยังอยู่ในคิว ลองใหม่แบบเว้นช่วงยาวขึ้น จดจำนวนครั้ง + เหตุล่าสุด · ผู้สมัครไม่ต้องส่งใหม่ ชุดไม่ถูกสร้างซ้ำ
 * - กันแจ้งซ้ำด้วย dedupe_key ของชุด ทั้งที่คิว (unique) และที่กล่องแจ้งเตือน (unique ต่อคน)
 * - ผู้รับ = คนสร้างลิงก์ · บัญชีถูกปิด/ไม่มีสิทธิ์ BU นั้นแล้ว = ส่งต่อหัวหน้างานของ BU เดียวกัน (ไม่มีจึงถึง admin) และจดเหตุไว้ — ไม่กระจายทุกคน
 * - แจ้งเตือนไม่ใช่ใบอนุญาตเปิดเอกสาร: หน้าปลายทางตรวจสิทธิ์ใหม่ทุกครั้ง
 */
import type { PoolClient } from 'pg';
import { dbQuery, dbTransaction, isPgUndefinedTable } from '../postgres.js';
import { logError, logInfo, logWarn } from '../logger.js';
import { T } from './core.js';
import { DOCUMENT_PACKET_NOTIFICATION_TYPE, type PlannedNotification } from '../../../src/lib/documents/documentNotification.js';

export const OUTBOX_STUCK_ATTEMPTS = 8;
const BACKOFF_BASE_SECONDS = 15;
const BACKOFF_MAX_SECONDS = 30 * 60;

/** เว้นช่วงก่อนลองใหม่ (วินาที) — 15 · 30 · 60 … สูงสุด 30 นาที */
export const outboxBackoffSeconds = (attempts: number): number =>
  Math.min(BACKOFF_MAX_SECONDS, BACKOFF_BASE_SECONDS * 2 ** Math.max(0, attempts - 1));

/** มีงานค้างในคิวไหม (ในโปรเซสนี้) — ตัวเฝ้าไม่ต้องถามฐานถ้ารู้ว่าว่าง */
let maybePending = true;

export async function enqueuePacketNotification(client: PoolClient, plan: PlannedNotification, packetId: string): Promise<void> {
  await client.query(
    `insert into ${T.outbox} (event_type, packet_id, dedupe_key, recipient_user_id, title, body, link)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (dedupe_key) do nothing`,
    [plan.type, packetId, plan.dedupeKey, plan.recipientUserId, plan.title, plan.body, plan.link],
  );
  maybePending = true;
}

type OutboxRow = {
  id: string;
  event_type: string;
  packet_id: string;
  dedupe_key: string;
  recipient_user_id: string | null;
  title: string;
  body: string | null;
  link: string;
  attempts: number;
};

export type Recipients = { userIds: string[]; fallback: 'no_creator' | 'creator_inactive' | 'creator_no_access' | null };

type UserRow = { id: string; role: string; is_active: boolean; department_code: string | null; extra_department_codes: string[] | null };
const codesOf = (u: UserRow): string[] =>
  [u.department_code, ...(u.extra_department_codes ?? [])].map((c) => (c || '').trim().toUpperCase()).filter(Boolean);
const canSeeBu = (u: UserRow, bu: string | null): boolean => u.role === 'admin' || !bu || codesOf(u).includes(bu);

/** ใครควรได้แจ้งเตือนของชุดนี้ */
export async function resolveRecipients(client: PoolClient, row: Pick<OutboxRow, 'packet_id' | 'recipient_user_id'>): Promise<Recipients> {
  const { rows: pk } = await client.query<{ department_code: string | null }>(`select department_code from ${T.packets} where id = $1`, [row.packet_id]);
  const bu = (pk[0]?.department_code || '').trim().toUpperCase() || null;
  let fallback: Recipients['fallback'] = 'no_creator';
  if (row.recipient_user_id) {
    const { rows } = await client.query<UserRow>(
      `select id, role, is_active, department_code, extra_department_codes from ${T.users} where id = $1`,
      [row.recipient_user_id],
    );
    const u = rows[0];
    if (u && u.is_active && canSeeBu(u, bu)) return { userIds: [u.id], fallback: null };
    fallback = u && u.is_active ? 'creator_no_access' : 'creator_inactive';
  }
  // ส่งต่อ: หัวหน้างานที่ดู BU นี้ได้ → ไม่มี = admin
  const { rows: staff } = await client.query<UserRow>(
    `select id, role, is_active, department_code, extra_department_codes from ${T.users}
      where is_active = true and role in ('supervisor', 'admin')`,
  );
  const supervisors = staff.filter((u) => u.role === 'supervisor' && bu !== null && codesOf(u).includes(bu));
  const picked = supervisors.length ? supervisors : staff.filter((u) => u.role === 'admin');
  return { userIds: picked.map((u) => u.id), fallback };
}

export type NotificationWriter = (client: PoolClient, userIds: string[], row: OutboxRow) => Promise<void>;

/** เขียนลงกล่องแจ้งเตือนแล้วอ่านกลับ — ไม่ครบทุกผู้รับ = โยน (คิวจะลองใหม่) */
export const strictNotificationWriter: NotificationWriter = async (client, userIds, row) => {
  await client.query(
    `insert into ${T.notifications} (recipient_user_id, type, title, body, link, dedupe_key)
     select uid, $2, $3, $4, $5, $6 from unnest($1::uuid[]) as uid
     on conflict (recipient_user_id, dedupe_key) where dedupe_key is not null do nothing`,
    [userIds, row.event_type, row.title, row.body, row.link, row.dedupe_key],
  );
  const { rows } = await client.query<{ recipient_user_id: string }>(
    `select recipient_user_id from ${T.notifications} where dedupe_key = $1 and recipient_user_id = any($2::uuid[])`,
    [row.dedupe_key, userIds],
  );
  const have = new Set(rows.map((r) => r.recipient_user_id));
  const missing = userIds.filter((id) => !have.has(id));
  if (missing.length) throw new Error(`notification rows missing for ${missing.length} recipient(s)`);
};

export type DispatchResult = { delivered: number; failed: number };

/**
 * ส่งแถวที่ถึงคิว — แถวละธุรกรรมย่อย (savepoint): แถวหนึ่งล้มไม่ลากแถวอื่น · ล็อกแถวแบบข้ามที่ถูกล็อกอยู่ กันสองรอบส่งชนกัน
 */
export async function dispatchDueOutbox(opts: { limit?: number; writer?: NotificationWriter } = {}): Promise<DispatchResult> {
  const writer = opts.writer ?? strictNotificationWriter;
  const result: DispatchResult = { delivered: 0, failed: 0 };
  await dbTransaction(async (client) => {
    const { rows } = await client.query<OutboxRow>(
      `select id, event_type, packet_id, dedupe_key, recipient_user_id, title, body, link, attempts
         from ${T.outbox}
        where status <> 'delivered' and next_attempt_at <= now()
        order by id
        limit $1
        for update skip locked`,
      [opts.limit ?? 20],
    );
    for (const row of rows) {
      await client.query('savepoint doc_outbox');
      try {
        const to = await resolveRecipients(client, row);
        if (to.userIds.length === 0) throw new Error('no active recipient');
        await writer(client, to.userIds, row);
        await client.query(
          `update ${T.outbox}
              set status = 'delivered', delivered_at = now(), attempts = attempts + 1, last_error = null,
                  delivered_to = $2::jsonb
            where id = $1`,
          [row.id, JSON.stringify({ userIds: to.userIds, fallback: to.fallback })],
        );
        await client.query(
          `insert into ${T.events} (application_id, packet_id, event_type, actor_type, detail)
           select application_id, id, 'notification_delivered', 'system', $2::jsonb from ${T.packets} where id = $1`,
          [row.packet_id, JSON.stringify({ recipients: to.userIds.length, fallback: to.fallback })],
        );
        await client.query('release savepoint doc_outbox');
        result.delivered++;
      } catch (e) {
        await client.query('rollback to savepoint doc_outbox');
        const attempts = row.attempts + 1;
        const message = (e instanceof Error ? e.message : String(e)).slice(0, 500);
        await client.query(
          `update ${T.outbox}
              set attempts = $2::int, last_error = $3,
                  status = case when $2::int >= $4::int then 'failed' else 'pending' end,
                  next_attempt_at = now() + make_interval(secs => $5::double precision)
            where id = $1`,
          [row.id, attempts, message, OUTBOX_STUCK_ATTEMPTS, outboxBackoffSeconds(attempts)],
        );
        result.failed++;
        // ครบเกณฑ์ = ร้องดัง ๆ ใน log (หน้าตั้งค่าโชว์จำนวนที่ค้าง) · ยังลองต่อทุก 30 นาที ไม่ทิ้ง
        if (attempts === OUTBOX_STUCK_ATTEMPTS) logError('documents.outbox.stuck', { outboxId: row.id, packetId: row.packet_id, attempts, message });
        else logWarn('documents.outbox.retry', { outboxId: row.id, attempts, message });
      }
    }
  });
  if (result.delivered || result.failed) logInfo('documents.outbox.dispatch', result);
  return result;
}

/** ลองส่งทันทีหลังชุดบันทึกสำเร็จ — ล้มก็ไม่กระทบคำตอบถึงผู้สมัคร (คิวยังอยู่ ตัวเฝ้ามาเก็บ) */
export async function dispatchOutboxSoon(): Promise<void> {
  try {
    await dispatchDueOutbox();
  } catch (e) {
    maybePending = true;
    logError('documents.outbox.dispatch_failed', e);
  }
}

export async function outboxBacklog(): Promise<{ pending: number; failed: number }> {
  try {
    const { rows } = await dbQuery<{ pending: string; failed: string }>(
      `select count(*) filter (where status = 'pending') as pending, count(*) filter (where status = 'failed') as failed from ${T.outbox}`,
    );
    return { pending: Number(rows[0]?.pending) || 0, failed: Number(rows[0]?.failed) || 0 };
  } catch (e) {
    if (isPgUndefinedTable(e)) return { pending: 0, failed: 0 };
    throw e;
  }
}

/**
 * ถึงเมื่อไหร่ที่หน้าของเจ้าหน้าที่คนนี้ควรถามกระดิ่งถี่ขึ้น — มีผู้สมัครเปิดลิงก์ของเขาอยู่และยังไม่ส่ง (ใน 3 ชม. ล่าสุด)
 * ไม่มี = null (ถามรอบปกติ) · ไม่ต้องลดรอบของทั้งระบบเพื่อให้เห็นแจ้งเตือนเร็ว
 */
export async function documentWatchUntil(userId: string): Promise<string | null> {
  try {
    const { rows } = await dbQuery<{ until: Date | null }>(
      `select max(least(i.expires_at, i.last_opened_at + interval '3 hours')) as until
         from ${T.invitations} i
        where i.created_by = $1 and i.revoked_at is null and i.expires_at > now()
          and i.last_opened_at > now() - interval '3 hours'
          and not exists (select 1 from ${T.packets} p where p.invitation_id = i.id)`,
      [userId],
    );
    return rows[0]?.until ? new Date(rows[0].until).toISOString() : null;
  } catch (e) {
    if (isPgUndefinedTable(e)) return null;
    throw e;
  }
}

let timer: ReturnType<typeof setInterval> | null = null;
let lastFullSweep = 0;
const SWEEP_MS = 30_000;
const FULL_SWEEP_MS = 10 * 60_000;

/**
 * ตัวเฝ้าคิว — ส่งปกติเกิดทันทีหลังชุดบันทึก ตัวนี้เก็บเฉพาะที่ค้าง (ส่งไม่ผ่าน/เซิร์ฟเวอร์ดับกลางคัน)
 * รู้ว่าคิวว่าง = ไม่ถามฐาน (ถามเต็มรอบทุก 10 นาทีเผื่อไว้) · ปิดด้วย DOCUMENT_OUTBOX_WORKER_ENABLED=false
 */
export function startDocumentOutboxWorker(): void {
  if (timer || (process.env.DOCUMENT_OUTBOX_WORKER_ENABLED || '').trim().toLowerCase() === 'false') return;
  timer = setInterval(() => {
    const now = Date.now();
    if (!maybePending && now - lastFullSweep < FULL_SWEEP_MS) return;
    lastFullSweep = now;
    void (async () => {
      try {
        const r = await dispatchDueOutbox();
        const backlog = await outboxBacklog();
        maybePending = r.failed > 0 || backlog.pending + backlog.failed > 0;
      } catch (e) {
        if (isPgUndefinedTable(e)) {
          maybePending = false; // ยังไม่รัน migration 195 — รอบเต็มค่อยดูใหม่
          return;
        }
        maybePending = true;
        logError('documents.outbox.worker_failed', e);
      }
    })();
  }, SWEEP_MS);
  timer.unref?.();
}

export function stopDocumentOutboxWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

export { DOCUMENT_PACKET_NOTIFICATION_TYPE };
