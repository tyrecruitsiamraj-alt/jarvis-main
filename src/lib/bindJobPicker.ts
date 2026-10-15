/**
 * ═══ เลือกใบขอให้ใบที่ยังไม่ผูก ตอนส่ง AI โทร (เจ้าของ 15 ต.ค. 2569) ═══
 * > *"งานที่ไม่ได้ผูกใบขอ … ก็เลือกผูกใบขอได้ด้วยดิ่ตอนส่ง Ai"*
 *
 * ใช้กับรายชื่อ iRecruit / นำเข้าไม่ผูกงาน — AI โทรได้เฉพาะใบที่มีใบขอ (บทต้องมีงาน · รายได้ · พื้นที่)
 * 3 กลุ่ม: ตรงจังหวัดและตำแหน่ง · ตรงจังหวัด · ใบขออื่น (ตรงตำแหน่งขึ้นก่อน) — ในกลุ่มคงลำดับเดิมของฟีด
 * ตรงตำแหน่งอย่างเดียวไม่นับว่าตรง (ตรวจจริง 15 ต.ค.: "ขับรถ" ตรงใบขับรถทั้งประเทศ 259 ใบ — ไปทำงานไม่ได้ก็ไม่มีประโยชน์)
 * จังหวัดใบขอ = `boardProvinceOf` ตัวเดียวกับตัวกรองกล่องงาน (ไม่เดาจากจังหวัดไซต์) · ไม่รู้จังหวัด = ไม่ใส่ในป้าย
 */
import type { JobRequest } from '@/types';
import { boardProvinceOf } from '@/lib/boardFilters';
import { canonProvinceName } from '@/lib/thaiProvinces';
import { jobBoardCardTitle, publicJobPositionLabel } from '@/lib/unitRequestDisplay';

export type BindJobApplicant = { province?: string | null; position_interest?: string | null };

export type BindJobOption = {
  value: string;
  label: string;
  keywords: string;
};

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, '').toLowerCase();

/** ตำแหน่งตรงกัน = คำหนึ่งอยู่ในอีกคำ (เช่น "รปภ." กับ "รปภ.ชาย") · ว่างฝั่งใดฝั่งหนึ่ง = ไม่ตรง */
function positionMatches(job: string, want: string): boolean {
  const a = norm(job);
  const b = norm(want);
  return Boolean(a && b && (a.includes(b) || b.includes(a)));
}

export function bindJobOptions(
  jobs: readonly JobRequest[],
  applicants: readonly BindJobApplicant[],
): { both: BindJobOption[]; province: BindJobOption[]; others: BindJobOption[] } {
  const provinces = new Set(
    applicants.map((a) => canonProvinceName(a.province ?? '')).filter((p): p is string => Boolean(p)),
  );
  const positions = applicants.map((a) => a.position_interest ?? '').filter((p) => p.trim());
  const both: BindJobOption[] = [];
  const province: BindJobOption[] = [];
  const posOnly: BindJobOption[] = [];
  const rest: BindJobOption[] = [];
  for (const job of jobs) {
    // "ไม่ระบุ" ของตัวกรองกล่องงานไม่ใช่ชื่อจังหวัด — canon แล้วไม่เจอ = ไม่รู้
    const jobProvince = canonProvinceName(boardProvinceOf(job));
    const position = publicJobPositionLabel(job);
    const provinceHit = jobProvince !== null && provinces.has(jobProvince);
    const positionHit = positions.some((p) => positionMatches(position, p));
    const option: BindJobOption = {
      value: job.id,
      label: [jobBoardCardTitle(job), position, jobProvince].filter(Boolean).join(' · '),
      keywords: [job.request_no, job.unit_name].filter(Boolean).join(' '),
    };
    (provinceHit ? (positionHit ? both : province) : positionHit ? posOnly : rest).push(option);
  }
  return { both, province, others: [...posOnly, ...rest] };
}
