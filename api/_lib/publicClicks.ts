import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';

/**
 * **นับคลิกบนหน้าสาธารณะ** (เจ้าของถาม 3 ก.ย. 2569: *"แท็กจำนวนคลิกได้ไหม ในหน้าสาธารณะ"*)
 *
 * ของที่มีอยู่ก่อนแล้ว: `recruit_posting_links.hit_count` = **คลิกเปิดลิงก์ช่องทาง**
 * (วัดจริง 3 ก.ย.: 24 ลิงก์ · 103 คลิก) — บอกว่า *มีคนกดลิงก์เข้ามา* แต่ไม่รู้ว่าเข้ามาแล้วทำอะไร
 *
 * ไฟล์นี้เก็บของที่ยังไม่มี: **กดดูงานใบไหน · กดปุ่มสมัครใบไหน · มาจากช่องทางไหน**
 *
 * 🔴 **ยอดรายวัน ไม่ใช่รายคน** — ไม่เก็บ IP / user-agent / คุกกี้
 * (คำถามธุรกิจคือ "ประกาศไหนมีคนสนใจ" ไม่ใช่ "ใครเข้ามาดู")
 * 🔴 **นับพลาดห้ามทำให้หน้าสาธารณะล้ม** — ทุกจุดเรียกแบบ fire-and-forget
 */
const clicksTable = tableInAppSchema('public_page_clicks');

/** การกระทำที่นับ — ค่าอื่นก็รับ (ห้ามใส่ CHECK · ของเดิมโดนมาสองรอบ) */
export const PUBLIC_CLICK_ACTIONS = ['open_job', 'open_apply', 'submit'] as const;
export type PublicClickAction = (typeof PUBLIC_CLICK_ACTIONS)[number];

export type PublicClickInput = {
  action: string;
  jobRef?: string | null;
  postingId?: string | null;
  linkCode?: string | null;
  embedded?: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ตัดความยาว + ช่องว่าง — กันคนยิงข้อความยาวมาถมตาราง */
function clean(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

/**
 * เพิ่มยอดคลิกหนึ่งครั้ง — upsert เข้าแถวของวันนั้น
 * ⚠️ วันไทยคิดที่ฐาน (`now() at time zone 'Asia/Bangkok'`) ไม่ใช่เวลาเครื่องผู้ใช้
 * — ไม่งั้นคนตั้งเวลาเครื่องเพี้ยนจะไปโป่งยอดของวันอื่น
 */
export async function recordPublicClick(input: PublicClickInput): Promise<void> {
  const action = clean(input.action, 40);
  if (!action) return;
  const jobRef = clean(input.jobRef, 120);
  const postingRaw = clean(input.postingId, 40);
  const postingId = postingRaw && UUID_RE.test(postingRaw) ? postingRaw : null;
  const linkCode = clean(input.linkCode, 40);
  // ไม่มีเป้าหมายเลย = นับไม่ได้ว่าใครถูกกด ทิ้งไป (กันแถวขยะ)
  if (!jobRef && !postingId && !linkCode) return;

  await dbQuery(
    `insert into ${clicksTable} (day, action, job_ref, posting_id, link_code, embedded, hits, updated_at)
     values ((now() at time zone 'Asia/Bangkok')::date, $1, $2, $3::uuid, $4, $5, 1, now())
     on conflict (day, action, coalesce(job_ref, ''),
                  coalesce(posting_id, '00000000-0000-0000-0000-000000000000'::uuid),
                  coalesce(link_code, ''), embedded)
     do update set hits = ${clicksTable}.hits + 1, updated_at = now()`,
    [action, jobRef, postingId, linkCode, Boolean(input.embedded)],
  );
}

export type PublicClickStatRow = {
  jobRef: string | null;
  action: string;
  hits: number;
};

/**
 * ยอดคลิกรายใบขอ (ย้อนหลัง N วัน) — ให้หน้ากล่องงานเอาไปโชว์ข้างประกาศ
 * ⚠️ ไม่มีข้อมูลเลย ⇒ คืน `[]` · **ฝั่งจอห้ามแปลงเป็น 0 แล้วโชว์เหมือนวัดแล้วได้ศูนย์**
 */
export async function listPublicClicksByJob(days = 30): Promise<PublicClickStatRow[]> {
  const span = Math.min(Math.max(Math.trunc(days) || 30, 1), 365);
  const { rows } = await dbQuery<{ job_ref: string | null; action: string; hits: string }>(
    `select job_ref, action, sum(hits)::text as hits
       from ${clicksTable}
      where day >= (now() at time zone 'Asia/Bangkok')::date - ($1::int - 1)
      group by job_ref, action`,
    [span],
  );
  return rows.map((r) => ({
    jobRef: r.job_ref,
    action: r.action,
    hits: Number(r.hits) || 0,
  }));
}
