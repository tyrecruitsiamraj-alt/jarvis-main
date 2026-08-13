import { dbQuery, isPgUndefinedTable } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { normalizeDepartmentCode } from './departmentScope.js';

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
