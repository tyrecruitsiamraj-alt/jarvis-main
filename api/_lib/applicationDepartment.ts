import { dbQuery, isPgUndefinedTable } from './postgres.js';
import { logError, logInfo } from './logger.js';
import { tableInAppSchema } from './schema.js';
import { normalizeDepartmentCode } from './departmentScope.js';
import { trendBuFromSiteCode } from '../../src/lib/trends/bu.js';

/**
 * หา "แผนกเจ้าของงาน" ของใบสมัคร เพื่อเก็บติดตัวใบไว้ (migration 082)
 *
 * เจ้าของเคาะ 13 ส.ค. 2569 ว่าใบขอปิดแล้ว **รายชื่อต้องไม่หาย** ("เก็บคนไว้ที่คลังกลาง")
 * ของเดิมสิทธิ์เห็นใบสมัครคำนวณจากรายการ **ใบขอที่เปิดอยู่** — ใบขอปิดเมื่อไหร่
 * คนที่ถูกล็อก BU มองไม่เห็นใบสมัครนั้นอีกเลย · เก็บรหัสแผนกไว้กับใบตั้งแต่แรก
 * แล้วสิทธิ์เทียบจากคอลัมน์นี้ได้ตรง ๆ ไม่ต้องพึ่งว่าใบขอยังเปิดอยู่ไหม
 *
 * ⚠️ **ห้ามยิง ERP จากเส้นนี้** — `/api/public/apply` เป็น endpoint สาธารณะ (ไม่ล็อกอิน
 * และ rate-limit อยู่) การไปถาม SQL Server ตอนคนกดส่งใบสมัครทำให้ฟอร์มช้าและพัง
 * ตาม ERP · ประกาศรับสมัครฝั่งเรา (`recruit_postings`) มี `department_code` อยู่แล้ว
 * ซึ่งมาจากใบขอตอนสร้างประกาศ — พอสำหรับใบที่สมัครผ่านลิงก์ประกาศ
 *
 * คืน null = ไม่รู้แผนก (ใบเก่า / ใบที่ไม่ได้มาจากประกาศ) — ฝั่งอ่านต้องถอยไปเทียบ
 * `job_id` เหมือนเดิม จะได้ไม่มีใครมองไม่เห็นของที่เคยเห็น
 */
export async function resolveApplicationDepartment(input: {
  postingId?: string | null;
  jobId?: string | null;
}): Promise<string | null> {
  const postingId = (input.postingId || '').trim();
  const jobId = (input.jobId || '').trim();
  if (!postingId && !jobId) return null;

  const postings = tableInAppSchema('recruit_postings');
  try {
    /**
     * BU จากรหัสไซต์ของใบขอมาก่อน (เจ้าของ 19 พ.ย. 2569 Choice "แก้ให้ตาม BU ของใบขอ") — ตัวเดียวกับที่ภาพรวมกรอง BU (`appBuSql`)
     * เดิมอ่านจากประกาศอย่างเดียว ⇒ ใบขอที่ไม่มีประกาศได้แผนกคนคีย์ (LMO6911010 ติด LBD · หัวหน้า LBD เก็บไปได้)
     * `job_site_map` อยู่ใน Postgres — ไม่ยิง ERP
     */
    if (jobId) {
      const { rows } = await dbQuery<{ site_code: string | null }>(`select site_code from ${tableInAppSchema('job_site_map')} where job_id = $1 limit 1`, [jobId]);
      const bu = trendBuFromSiteCode(rows[0]?.site_code ?? null);
      if (bu) return bu;
    }
    if (postingId) {
      const { rows } = await dbQuery<{ department_code: string | null }>(
        `select department_code from ${postings} where id = $1 limit 1`,
        [postingId],
      );
      const code = normalizeDepartmentCode(rows[0]?.department_code);
      if (code) return code;
    }
    if (jobId) {
      // ใบขอเดียวกันอาจมีหลายประกาศ — เอาอันที่ระบุแผนกไว้ล่าสุด
      const { rows } = await dbQuery<{ department_code: string | null }>(
        `select department_code from ${postings}
          where job_id = $1 and department_code is not null
          order by created_at desc limit 1`,
        [jobId],
      );
      return normalizeDepartmentCode(rows[0]?.department_code);
    }
  } catch (e) {
    // ตารางประกาศยังไม่ migrate = ไม่รู้แผนก · **ห้ามทำให้การรับใบสมัครล้ม**
    // (เสียใบสมัครของคนจริงเจ็บกว่าไม่รู้แผนก ซึ่งยังถอยไปเทียบ job_id ได้)
    if (!isPgUndefinedTable(e)) return null;
  }
  return null;
}

/**
 * แผนกของใบที่เจ้าหน้าที่คีย์/นำเข้า/เก็บจาก Scrap (เจ้าของ 18 พ.ย. 2569 "ติดตามใบขอ")
 * ผูกใบขอ = แผนกของใบขอ (จากประกาศของใบนั้น) · ไม่ผูก/ไม่รู้แผนกใบขอ = แผนกของคนคีย์ (`staffEntryDepartment`)
 * เดิมใช้แผนกคนคีย์เสมอ ⇒ คน LBD คีย์ให้ใบขอ LBA 515 ใบ ติด LBD หมด หัวหน้า LBD เห็น/เก็บงาน LBA ได้
 */
export async function staffEntryDepartmentFor(jobId: string | null | undefined, fallback: string | null): Promise<string | null> {
  if (!jobId?.trim()) return fallback;
  return (await resolveApplicationDepartment({ jobId })) ?? fallback;
}

/**
 * ═══ ตัวเทียบรอบ ๆ: BU ของใบสมัครที่ผูกใบขอ = BU ของใบขอเสมอ (เจ้าของ 27 พ.ย. 2569 Choice "แก้ทั้งคู่") ═══
 * เจอจริง: LAO6911033 (สถาปนิก โตโยต้า · LBA) — เจมส์ (LBD) คีย์ 26 พ.ย. ตอนระบบยังไม่มีรหัสไซต์ของใบนี้
 * ⇒ `staffEntryDepartmentFor` ถอยไปแผนกคนคีย์ ได้ LBD · ฝั่ง LBD เห็นชื่อของใบ LBA (ทั้งระบบ 133 ชื่อ)
 * กติกา "เขียนครั้งเดียวแล้วจบไม่ได้" ⇒ ทุกครั้งที่จดรหัสไซต์ของใบขอ (`rememberJobSites`) ปรับใบที่ BU ไม่ตรงให้ตรง
 * แตะเฉพาะใบที่ผูกใบขอที่รู้ BU แล้ว และค่าไม่ตรงจริง · ล้มเงียบ (ห้ามทำให้ feed ใบขอพัง)
 */
export async function realignApplicationDepartments(jobs: ReadonlyArray<{ jobId: string; siteCode: string | null }>): Promise<number> {
  const pairs = jobs
    .map((j) => ({ jobId: j.jobId.trim(), bu: trendBuFromSiteCode(j.siteCode) }))
    .filter((p): p is { jobId: string; bu: string } => Boolean(p.jobId && p.bu));
  if (pairs.length === 0) return 0;
  try {
    const { rows } = await dbQuery<{ id: string }>(
      `update ${tableInAppSchema('public_job_applications')} a
          set department_code = t.bu, updated_at = now()
         from unnest($1::text[], $2::text[]) as t(job_id, bu)
        where a.job_id = t.job_id and a.department_code is distinct from t.bu
        returning a.id::text as id`,
      [pairs.map((p) => p.jobId), pairs.map((p) => p.bu)],
    );
    if (rows.length > 0) logInfo('applicationDepartment.realigned', { count: rows.length });
    return rows.length;
  } catch (e) {
    logError('applicationDepartment.realign.skipped', e, { jobs: pairs.length });
    return 0;
  }
}
