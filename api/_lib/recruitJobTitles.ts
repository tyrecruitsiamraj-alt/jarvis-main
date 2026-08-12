/**
 * master "ตำแหน่งงาน" ของงานสรรหา (RM) — ที่เก็บข้อมูล (อ่านอย่างเดียว)
 *
 * ยกมาจาก `recruit_master_job` ของ iRecruit ด้วย `scripts/import-recruit-job-titles.mts`
 * ดู `migrations/078_recruit_job_titles.sql` · ความหมาย/ตรรกะเลือกอยู่ที่
 * `src/lib/recruitJobTitles.ts` ที่เดียว (ใช้ร่วมสองฝั่ง)
 *
 * ⚠️ **ไม่มีทางเขียนจาก API** โดยตั้งใจ — เจ้าของสั่งเอาปุ่ม "ตำแหน่งงาน" ออกจากแถบ
 * เครื่องมือแล้ว (11 ส.ค. 2569) จึงไม่มีหน้าจอจัดการ master นี้ · ตำแหน่งที่ไม่มีใน
 * master ยังพิมพ์ลงช่องกรอกได้ตามปกติ (เก็บเป็นข้อความในใบสมัคร/ประกาศเหมือนเดิม)
 * จะเปิดทางเขียนต้องเพิ่มหน้าจอพร้อมกัน ไม่ใช่เปิด endpoint ทิ้งไว้เฉย ๆ
 */
import { dbQuery, isPgUndefinedTable } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { APP_DEPARTMENT_CODES } from './departmentScope.js';
import type { RecruitJobTitle } from '../../src/lib/recruitJobTitles.js';

const titlesTable = tableInAppSchema('recruit_job_titles');

type TitleRow = {
  id: string;
  name: string;
  name_en: string | null;
  department_code: string | null;
  sort_order: number;
  is_active: boolean;
};

function mapTitle(r: TitleRow): RecruitJobTitle {
  return {
    id: r.id,
    name: r.name,
    nameEn: r.name_en ?? null,
    departmentCode: r.department_code ?? null,
    sortOrder: Number(r.sort_order) || 0,
    isActive: !!r.is_active,
  };
}

/** รหัส BU ที่ระบบเรารู้จัก — ค่าอื่นถือว่าไม่ได้กรอง (ไม่ใช่ "กรองจนไม่เหลืออะไร") */
function knownDepartmentCode(value: unknown): string | null {
  const s = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return (APP_DEPARTMENT_CODES as readonly string[]).includes(s) ? s : null;
}

/**
 * รายชื่อตำแหน่งงาน — เรียง `sort_order` แล้วชื่อ (หน้าเว็บคงลำดับนี้ ไม่เรียงใหม่)
 *
 * ⚠️ ตารางยังไม่ migrate = คืนลิสต์ว่าง **ไม่โยน error** — ช่องตำแหน่งเป็นช่องพิมพ์อิสระ
 * อยู่แล้ว ฟอร์มจึงยังกรอกจบได้ ต่างจากฟอร์ม "เพิ่มผู้สมัคร" ที่ต้องคืน 503
 * (ที่นั่นบันทึกแล้วข้อมูลหาย ที่นี่แค่ไม่มีตัวช่วยเติมคำ) · กลืนเฉพาะ 42P01 ที่เหลือโยนต่อ
 */
export async function listRecruitJobTitles(
  options: { includeInactive?: boolean; departmentCode?: unknown } = {},
): Promise<RecruitJobTitle[]> {
  const params: unknown[] = [];
  const where: string[] = [];
  if (!options.includeInactive) where.push('is_active = true');
  const dept = knownDepartmentCode(options.departmentCode);
  if (dept) {
    params.push(dept);
    // ตำแหน่งที่ไม่ระบุ BU ต้องติดมาด้วย — null = "ต้นทางไม่ได้บอก" ไม่ใช่ "ใช้ไม่ได้"
    where.push(`(department_code = $${params.length} or department_code is null)`);
  }
  try {
    const { rows } = await dbQuery<TitleRow>(
      `SELECT id, name, name_en, department_code, sort_order, is_active
         FROM ${titlesTable}
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY sort_order, lower(name)`,
      params,
    );
    return rows.map(mapTitle);
  } catch (e) {
    if (isPgUndefinedTable(e)) return [];
    throw e;
  }
}
