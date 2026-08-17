/**
 * แจ้งเตือนในแอป — กล่องขาเข้าของแต่ละคน (ตาราง app_notifications · migration 072)
 *
 * กติกาสำคัญ: **ตัวสร้างห้ามทำให้งานหลักล้ม** — แจ้งเตือนเป็นของแถม
 * ingest ผลโทร/สร้างชุดส่ง ต้องสำเร็จแม้ตารางแจ้งเตือนยังไม่ migrate
 * ทุกตัวสร้างจึงกลืน error เงียบ (ต่างจากฝั่งอ่าน ที่กลืนเฉพาะ 42P01)
 */
import { dbQuery, isPgUndefinedTable } from './postgres.js';
import { tableInAppSchema } from './schema.js';

const notifTable = tableInAppSchema('app_notifications');
const usersTable = tableInAppSchema('users');

export type AppNotification = {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: string;
  readAt: string | null;
};

type CreateInput = {
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  /** กันซ้ำต่อคน — เหตุการณ์เดิมยิงซ้ำ (เช่น Lumos ส่งผลเดิมมาอีกรอบ) จะไม่งอกแถวใหม่ */
  dedupeKey?: string | null;
};

/** แจ้งรายคน — สร้างหนึ่งแถวต่อผู้รับ · ล้มเงียบ ไม่กระทบงานหลัก */
export async function notifyUsers(userIds: string[], input: CreateInput): Promise<void> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return;
  try {
    await dbQuery(
      `insert into ${notifTable} (recipient_user_id, type, title, body, link, dedupe_key)
       select uid, $2, $3, $4, $5, $6 from unnest($1::uuid[]) as uid
       on conflict (recipient_user_id, dedupe_key) where dedupe_key is not null do nothing`,
      [ids, input.type, input.title, input.body ?? null, input.link ?? null, input.dedupeKey ?? null],
    );
  } catch {
    /* ของแถม — ตารางยังไม่ migrate / DB สะดุด ก็ปล่อยผ่าน */
  }
}

/** แจ้งทุกคนใน role ที่ระบุ (fan-out ตอนสร้าง — ผู้ใช้ภายในหลักสิบคน) */
export async function notifyRoles(roles: string[], input: CreateInput): Promise<void> {
  if (roles.length === 0) return;
  try {
    const { rows } = await dbQuery<{ id: string }>(
      `select id from ${usersTable} where role = any($1::text[]) and is_active = true`,
      [roles],
    );
    await notifyUsers(rows.map((r) => r.id), input);
  } catch {
    /* ของแถม */
  }
}

/** กล่องขาเข้าของฉัน — ใหม่→เก่า · ตารางยังไม่ migrate = ว่าง */
export async function listMyNotifications(
  userId: string,
  limit = 30,
): Promise<{ items: AppNotification[]; unread: number }> {
  try {
    const { rows } = await dbQuery<{
      id: number;
      type: string;
      title: string;
      body: string | null;
      link: string | null;
      created_at: string;
      read_at: string | null;
    }>(
      `select id, type, title, body, link, created_at, read_at
         from ${notifTable}
        where recipient_user_id = $1
        order by created_at desc
        limit $2`,
      [userId, Math.min(Math.max(limit, 1), 100)],
    );
    const items = rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      link: r.link,
      createdAt: r.created_at,
      readAt: r.read_at,
    }));
    return { items, unread: items.filter((i) => !i.readAt).length };
  } catch (e) {
    if (isPgUndefinedTable(e)) return { items: [], unread: 0 };
    throw e;
  }
}

/** ทำเครื่องหมายอ่านแล้ว — ids ว่าง = อ่านหมดทุกแถวของฉัน */
export async function markNotificationsRead(userId: string, ids?: number[]): Promise<void> {
  try {
    if (ids && ids.length > 0) {
      await dbQuery(
        `update ${notifTable} set read_at = now()
          where recipient_user_id = $1 and id = any($2::bigint[]) and read_at is null`,
        [userId, ids],
      );
    } else {
      await dbQuery(
        `update ${notifTable} set read_at = now()
          where recipient_user_id = $1 and read_at is null`,
        [userId],
      );
    }
  } catch (e) {
    if (!isPgUndefinedTable(e)) throw e;
  }
}
