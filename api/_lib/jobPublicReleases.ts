/**
 * "ปล่อยใบขอขึ้นหน้าสาธารณะ" — ตัวกลางของทะเบียน `job_public_releases` (migration 103)
 *
 * 🔴 เจ้าของเคาะ 22 ส.ค. 2569: **กลับด้านหมด — ทุกใบต้องกดปล่อย**
 * ก่อนหน้านี้ใบขอที่เปิดอยู่ขึ้นหน้า `/apply` เองทุกใบ (วัดจริง 283 ใบ) ทีมไม่มีทางเลือก
 * และไม่มีจังหวะแก้รายได้/สวัสดิการก่อนคนนอกเห็น
 *
 * ทุกเส้นที่ตัดสินว่า "ใบนี้คนนอกเห็นได้ไหม" ต้องผ่านไฟล์นี้ที่เดียว
 * (ตอนนี้มี 2 เส้น: `/api/public/jobs` ที่หน้า /apply ใช้ · `/api/lumos/positions` ที่ AI ใช้)
 * ถ้าใครเพิ่มเส้นที่สามแล้วไม่เรียกที่นี่ = ใบที่ยังไม่ปล่อยรั่วออกไปเงียบ ๆ
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';

const TABLE = tableInAppSchema('job_public_releases');

export type JobReleaseRow = {
  job_id: string;
  released_at: string;
  released_by_name: string | null;
  request_no: string | null;
  note: string | null;
};

/**
 * id ของใบขอที่ปล่อยแล้วทั้งหมด (Set เพื่อให้ผู้เรียกกรองเร็ว)
 *
 * ⚠️ **ต้องเก็บทั้ง id เต็มและเลขที่ใบขอ** — feed ของ ERP ให้ใบล่วงหน้าเป็น `siamraj-pre:XXX`
 * แต่ประกาศ/ของฝั่งเราบางที่เก็บ `siamraj-sql:XXX` (กับดักเดิมของโปรเจกต์)
 * จึงเทียบด้วยเลขที่ใบขอด้วย ไม่ใช่ id เต็มอย่างเดียว ไม่งั้นใบล่วงหน้าที่ปล่อยแล้วจะไม่ขึ้น
 */
export async function loadReleasedJobKeys(): Promise<{ ids: Set<string>; requestNos: Set<string> }> {
  const { rows } = await dbQuery<{ job_id: string; request_no: string | null }>(
    `select job_id, request_no from ${TABLE}`,
  );
  const ids = new Set<string>();
  const requestNos = new Set<string>();
  for (const r of rows) {
    ids.add(r.job_id);
    const no = (r.request_no || requestNoOf(r.job_id)).trim();
    if (no) requestNos.add(no);
  }
  return { ids, requestNos };
}

/** `siamraj-sql:OPL6908001` → `OPL6908001` (ไม่มี prefix ก็คืนค่าเดิม) */
export function requestNoOf(jobId: string): string {
  const i = jobId.lastIndexOf(':');
  return i >= 0 ? jobId.slice(i + 1) : jobId;
}

/**
 * ใบนี้ถูกปล่อยแล้วไหม — เทียบ **ทั้ง id เต็มและเลขที่ใบขอ**
 * (เหตุผลอยู่ที่คอมเมนต์ของ `loadReleasedJobKeys`)
 */
export function isReleased(
  keys: { ids: Set<string>; requestNos: Set<string> },
  jobId: string,
): boolean {
  if (keys.ids.has(jobId)) return true;
  return keys.requestNos.has(requestNoOf(jobId));
}

/** ปล่อยใบขอ (กดซ้ำได้ — อัปเดตเวลา/คนกดล่าสุด) */
export async function releaseJobs(
  jobIds: string[],
  actor: { id?: string | null; name?: string | null },
  note?: string | null,
): Promise<number> {
  const ids = [...new Set(jobIds.map((s) => s.trim()).filter(Boolean))];
  if (ids.length === 0) return 0;
  // แยกเลขที่ใบขอที่ฝั่ง JS (อ่านง่ายกว่าเขียน split_part ซ้อนใน SQL)
  const requestNos = ids.map((id) => requestNoOf(id));
  // ⚠️ `dbQuery` ของโปรเจกต์นี้คืนแค่ `{ rows }` (ไม่มี rowCount) → ต้องใช้ RETURNING
  const { rows } = await dbQuery<{ job_id: string }>(
    `insert into ${TABLE} (job_id, request_no, released_by, released_by_name, note)
     select t.job_id, t.request_no, $3::uuid, $4, $5
       from unnest($1::text[], $2::text[]) as t(job_id, request_no)
     on conflict (job_id) do update
        set released_at = now(),
            released_by = excluded.released_by,
            released_by_name = excluded.released_by_name,
            note = coalesce(excluded.note, ${TABLE}.note)
     returning job_id`,
    [ids, requestNos, actor.id ?? null, actor.name ?? null, note ?? null],
  );
  return rows.length;
}

/** ดึงใบขอลงจากหน้าสาธารณะ */
export async function unreleaseJobs(jobIds: string[]): Promise<number> {
  const ids = [...new Set(jobIds.map((s) => s.trim()).filter(Boolean))];
  if (ids.length === 0) return 0;
  const { rows } = await dbQuery<{ job_id: string }>(
    `delete from ${TABLE} where job_id = any($1::text[]) returning job_id`,
    [ids],
  );
  return rows.length;
}

/** รายการที่ปล่อยแล้ว (ใหม่สุดก่อน) — บอร์ดใช้โชว์ว่าใครปล่อยเมื่อไหร่ */
export async function listReleases(limit = 500): Promise<JobReleaseRow[]> {
  const { rows } = await dbQuery<JobReleaseRow>(
    `select job_id, released_at, released_by_name, request_no, note
       from ${TABLE} order by released_at desc limit $1`,
    [Math.min(Math.max(limit, 1), 2000)],
  );
  return rows;
}
