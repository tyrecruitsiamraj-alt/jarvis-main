/**
 * "ไม่ปล่อย + เหตุผล" — ตัวกลางของทะเบียน `job_release_skips` (migration 129 · 29 ก.ย. 2569)
 *
 * เจ้าของเลือกให้เพิ่มปุ่ม "ไม่ปล่อย + เหตุผล" ที่กล่องงาน เพื่อให้หน้าทีม Online ตอบได้ว่า
 * *"ไม่อนุมัติเพราะอะไร"* (ระบบไม่เคยมีข้อมูลนี้) · แพตเทิร์นเดียวกับทะเบียนปล่อย (`jobPublicReleases.ts`)
 *
 * ⚠️ ตารางยังไม่ migrate (42P01) — ฝั่งอ่านคืนรายการว่าง (หน้าทีม Online/กล่องงานยังเปิดได้ · ก้อน "ไม่อนุมัติ" = 0)
 *    ฝั่งเขียนโยน error ต่อ (ห้ามบอกว่าบันทึกแล้วทั้งที่ไม่มีที่เก็บ)
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { requestNoOf } from './jobPublicReleases.js';
import type { JobReleaseSkip, ReleaseSkipReason } from '../../src/lib/jobReleaseSkips.js';

const TABLE = tableInAppSchema('job_release_skips');
const COLS = 'job_id, request_no, reason, note, skipped_at, skipped_by_name';

const isMissingTable = (e: unknown) => (e as { code?: string })?.code === '42P01';

/** ทุกใบที่ตั้ง "ไม่ปล่อย" (ใหม่สุดก่อน) */
export async function listReleaseSkips(): Promise<JobReleaseSkip[]> {
  try {
    const { rows } = await dbQuery<JobReleaseSkip>(`select ${COLS} from ${TABLE} order by skipped_at desc`);
    return rows;
  } catch (e) {
    if (isMissingTable(e)) return [];
    throw e;
  }
}

/** ตั้ง "ไม่ปล่อย" (กดซ้ำ = เปลี่ยนเหตุผล + เวลา/คนกดล่าสุด) */
export async function markReleaseSkip(
  jobId: string,
  reason: ReleaseSkipReason,
  note: string | null,
  actor: { id?: string | null; name?: string | null },
): Promise<JobReleaseSkip> {
  const id = jobId.trim();
  const { rows } = await dbQuery<JobReleaseSkip>(
    `insert into ${TABLE} (job_id, request_no, reason, note, skipped_by, skipped_by_name)
     values ($1, $2, $3, $4, $5::uuid, $6)
     on conflict (job_id) do update
        set reason = excluded.reason,
            note = excluded.note,
            skipped_at = now(),
            skipped_by = excluded.skipped_by,
            skipped_by_name = excluded.skipped_by_name
     returning ${COLS}`,
    [id, requestNoOf(id), reason, note, actor.id ?? null, actor.name ?? null],
  );
  return rows[0];
}

/** ยกเลิก "ไม่ปล่อย" — กลับไปเป็นใบรอดำเนินการตามเดิม */
export async function clearReleaseSkip(jobId: string): Promise<number> {
  const { rows } = await dbQuery<{ job_id: string }>(`delete from ${TABLE} where job_id = $1 returning job_id`, [
    jobId.trim(),
  ]);
  return rows.length;
}
