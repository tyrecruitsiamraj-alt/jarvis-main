/**
 * "ใบขอนี้อยู่หน่วยงานไหน" — ตัวกลางเดียว (Phase 6.8 · migration 106)
 *
 * ใช้กันเสนอคนซ้ำ **ระดับหน่วยงาน**: เดิมกันแค่ระดับใบขอ (เบอร์ + job_ref) → คนที่บอก
 * "ไม่เอา" กับไซต์หนึ่งไปแล้ว ยังถูกเสนอไซต์เดิมซ้ำเรื่อย ๆ ผ่านใบขอใบอื่นของไซต์นั้น
 *
 * 🔴 ทำไมต้องมีตารางแมป: คิว/ล็อกเก็บแค่ `job_ref` · หน่วยงานจริงอยู่บน ERP (MSSQL)
 * ซึ่งเรียกตอน enqueue ไม่ได้ (คอขวดเข้าคิวต้องเร็วและไม่พึ่ง ERP)
 * ⚠️ **ทุกฟังก์ชันที่นี่กลืน error ทั้งหมด** — ของนี้เป็น "ตัวช่วยกันซ้ำ" ห้ามทำให้
 * การเข้าคิว/การดึง feed ล้มเพราะมันเอง (fail-safe = ถอยไปกันระดับใบขอเหมือนเดิม)
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { logError } from './logger.js';

const TABLE = tableInAppSchema('job_site_map');

function str(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
}

/**
 * จำหน่วยงานของใบขอชุดนี้ — เรียกตอนระบบดึง feed ใบขออยู่แล้ว (ราคาถูก 1 คิวรี)
 * ⚠️ ล้มเงียบเสมอ · ใบที่ไม่มี `site_code` ก็ยังจดไว้ (ค่า null) เพื่อรู้ว่า "เคยเห็นแล้ว"
 */
export async function rememberJobSites(
  jobs: Array<{ id?: unknown; site_code?: unknown; unit_name?: unknown }>,
): Promise<void> {
  const rows = jobs
    .map((j) => ({ id: str(j.id), site: str(j.site_code), unit: str(j.unit_name) }))
    .filter((r): r is { id: string; site: string | null; unit: string | null } => !!r.id);
  if (rows.length === 0) return;
  try {
    await dbQuery(
      `insert into ${TABLE} (job_id, site_code, unit_name, updated_at)
       select t.job_id, t.site_code, t.unit_name, now()
         from unnest($1::text[], $2::text[], $3::text[]) as t(job_id, site_code, unit_name)
       on conflict (job_id) do update
          set site_code = coalesce(excluded.site_code, ${TABLE}.site_code),
              unit_name = coalesce(excluded.unit_name, ${TABLE}.unit_name),
              updated_at = now()`,
      [rows.map((r) => r.id), rows.map((r) => r.site), rows.map((r) => r.unit)],
    );
  } catch (e) {
    // ตารางยังไม่ migrate / ฐานสะดุด — ห้ามทำให้ feed ใบขอพัง
    logError('jobSiteMap.remember.skipped', e, { count: rows.length });
  }
}

/**
 * ใบขอทั้งหมดที่อยู่ **หน่วยงานเดียวกัน** กับใบนี้ (รวมใบนี้เอง)
 * คืน `[jobId]` เมื่อไม่รู้หน่วยงาน — ผู้เรียกจะได้กันระดับใบขอต่อไปโดยไม่ต้องเช็คอะไรเพิ่ม
 */
export async function jobIdsInSameSite(jobId: string): Promise<string[]> {
  const id = (jobId || '').trim();
  if (!id) return [];
  try {
    const { rows } = await dbQuery<{ job_id: string }>(
      `select m2.job_id
         from ${TABLE} m1
         join ${TABLE} m2 on m2.site_code = m1.site_code
        where m1.job_id = $1 and m1.site_code is not null`,
      [id],
    );
    const ids = new Set<string>([id]);
    for (const r of rows) ids.add(r.job_id);
    return [...ids];
  } catch (e) {
    logError('jobSiteMap.sameSite.skipped', e, { jobId: id });
    return [id];
  }
}

/** ชื่อหน่วยงานของใบขอ (ไว้เขียนเหตุผลให้คนอ่าน) — ไม่รู้ = null */
export async function unitNameOfJob(jobId: string): Promise<string | null> {
  const id = (jobId || '').trim();
  if (!id) return null;
  try {
    const { rows } = await dbQuery<{ unit_name: string | null }>(
      `select unit_name from ${TABLE} where job_id = $1 limit 1`,
      [id],
    );
    return rows[0]?.unit_name ?? null;
  } catch {
    return null;
  }
}
