/**
 * ═══ ของที่การ์ดหน้างานสรรหาต้องบอกครบ (เจ้าของ 4 ต.ค. 2569 ข้อ 7) ═══
 *   1. จังหวัด + พื้นที่ (เขต/อำเภอ — Choice "เขต/อำเภอ" เช่น กรุงเทพมหานคร · ยานนาวา)
 *   2. รายได้ (ตัวเดิม `publicIncomeOf`) · 3. เพศ อายุ · 4. ชื่อหน่วยงาน
 *
 * ที่มา: จังหวัด = `boardProvinceOf` (ตัวเดียวกับตัวกรอง) · เขต/อำเภอ = ที่ทีม Online กรอก ไม่งั้นถอดจากที่อยู่ใบขอ ·
 * เพศ = ที่ทีม Online เลือก ไม่งั้นตามใบขอ · อายุ = ใบขอ (API ทับค่าที่แก้เองให้แล้ว)
 * ค่าที่ไม่รู้ = บอกว่า "ไม่ระบุ…" ตรง ๆ (ห้ามเดา · ห้ามหายจากการ์ด)
 */
import type { JobRequest } from '@/types';
import { boardProvinceOf } from '@/lib/boardFilters';
import { UNSPECIFIED } from '@/lib/facetEngine';
import { inferDistrictFromAddress } from '@/lib/parseThaiJobAddress';
import { erpGenderLabel, onlineGenderChoice } from '@/lib/genderRequirement';
import { jobBoardCardTitle } from '@/lib/unitRequestDisplay';

const DISTRICT_PREFIX = /^(?:อำเภอ|อ\.|เขต)\s*/u;

export function boardCardPlace(job: JobRequest): string {
  const province = boardProvinceOf(job);
  const typed = (job.override_district ?? '').trim();
  const district = (typed || inferDistrictFromAddress(job.location_address || '') || '').replace(DISTRICT_PREFIX, '').trim();
  if (province === UNSPECIFIED) return district ? district : 'ยังไม่ระบุสถานที่';
  return district ? `${province} · ${district}` : province;
}

export function boardCardGender(job: JobRequest): { text: string; known: boolean } {
  const g = onlineGenderChoice(job) ?? erpGenderLabel(job);
  if (g === 'ไม่ระบุ') return { text: 'ไม่ระบุเพศ', known: false };
  if (g === 'ไม่จำกัด') return { text: 'ไม่จำกัดเพศ', known: true };
  return { text: g, known: true };
}

export function boardCardAge(job: Pick<JobRequest, 'age_range_min' | 'age_range_max'>): string {
  const min = typeof job.age_range_min === 'number' && job.age_range_min > 0 ? job.age_range_min : null;
  const max = typeof job.age_range_max === 'number' && job.age_range_max > 0 ? job.age_range_max : null;
  if (min !== null && max !== null) return min === max ? `อายุ ${min} ปี` : `อายุ ${min}–${max} ปี`;
  if (min !== null) return `อายุ ${min} ปีขึ้นไป`;
  if (max !== null) return `อายุไม่เกิน ${max} ปี`;
  return 'ไม่ระบุอายุ';
}

/** ชื่อหน่วยงาน (นิติบุคคล) — โชว์เมื่อไม่ซ้ำกับหัวการ์ด (หัวการ์ด = จุดทำงาน) */
export function boardCardUnitName(job: JobRequest): string | null {
  const unit = (job.unit_name ?? '').trim();
  if (!unit) return null;
  return unit === jobBoardCardTitle(job).trim() ? null : unit;
}
