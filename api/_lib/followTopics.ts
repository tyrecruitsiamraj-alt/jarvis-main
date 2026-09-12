/**
 * "เรื่องที่จะให้โทรติดตาม" (migration 100 · เจ้าของสั่ง 18 ส.ค. 2569)
 *
 * ⚠️ **นี่คือตัวช่วยกรอก ไม่ใช่ตัวบังคับค่า** — `follow_entries.topic` ยังเป็น text อิสระ
 * ไม่ผูก FK เพราะเจ้าหน้าที่ยังต้องพิมพ์เรื่องใหม่เองได้ และรายการเก่าที่มีอยู่แล้ว
 * ใช้ข้อความอิสระ ผูก FK เมื่อไหร่ของเก่ากลายเป็นข้อมูลผิดกติกาทันที
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';

const topicsTable = tableInAppSchema('follow_topics');

export type FollowTopic = {
  id: string;
  name: string;
  sort_order: number;
  created_by_name: string | null;
  created_at: string;
  /** คำอธิบายสั้นว่าใช้ตอนไหน (migration 120) — `undefined` = ฐานยังไม่มีคอลัมน์ */
  description?: string | null;
};

/** ตรวจ body ของ POST — pure เพื่อคุมด้วย unit test */
export function parseTopicInput(raw: unknown): { error: string | null; value: { name: string } | null } {
  if (typeof raw !== 'object' || raw === null) return { error: 'Invalid JSON body', value: null };
  const body = raw as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return { error: 'กรุณากรอกชื่อเรื่องที่จะให้โทรติดตาม', value: null };
  // ยาวเกินไปแปลว่าคนเผลอวางทั้งประโยคลงมา — บทพูดจะอ่านไม่รู้เรื่อง
  if (name.length > 120) return { error: 'ชื่อเรื่องยาวเกินไป (ไม่เกิน 120 ตัวอักษร)', value: null };
  return { error: null, value: { name } };
}

/** เรียงตาม sort_order แล้วชื่อ — ชุดตั้งต้นของระบบจึงอยู่บนสุดตามที่ตั้งไว้ */
/** 42703 undefined_column — โค้ดใหม่ขึ้นก่อน migration 120 */
function isUndefinedColumn(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42703';
}

export async function listFollowTopics(): Promise<FollowTopic[]> {
  const { rows } = await dbQuery<FollowTopic>(
    /**
     * `description` = คำอธิบายสั้นว่าเรื่องนี้ใช้ตอนไหน (migration 120)
     * ⚠️ ฐานที่ยังไม่ migrate ไม่มีคอลัมน์นี้ ⇒ ถอยไป select ชุดเดิม
     * (ตัวเลือกต้องขึ้นให้ได้เสมอ ขาดคำอธิบายดีกว่า dropdown ว่าง)
     */
    `select id, name, sort_order, created_by_name, created_at, description
       from ${topicsTable}
      order by sort_order asc, name asc`,
  ).catch(async (e) => {
    if (!isUndefinedColumn(e)) throw e;
    return dbQuery<FollowTopic>(
      `select id, name, sort_order, created_by_name, created_at
         from ${topicsTable}
        order by sort_order asc, name asc`,
    );
  });
  return rows;
}

export async function createFollowTopic(
  name: string,
  by: { sub: string; email: string | null },
): Promise<FollowTopic> {
  const { rows } = await dbQuery<FollowTopic>(
    `insert into ${topicsTable} (name, created_by, created_by_name)
     values ($1, $2, $3)
     returning id, name, sort_order, created_by_name, created_at`,
    [name, by.sub, by.email],
  );
  return rows[0];
}
