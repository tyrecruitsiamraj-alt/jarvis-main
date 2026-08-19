/**
 * ตัวกรองแถวของบอร์ดงาน — **ตรรกะล้วน** (แยกออกมาจาก `useJobBoardFilters` 19 ส.ค. 2569)
 *
 * เหตุที่ต้องแยก: เจ้าของสั่งให้กล่อง "ปิดแล้ว/ยกเลิก" บนหน้ากล่องงานกดแล้ว**ดูในหน้าเดิม**
 * เหมือนกล่องอื่น (*"กดแล้วเด้งไปหน้าอื่นทำไม ทำไมไม่ทำให้มันเหมือนกัน"*) — ใบปิดมาจาก
 * อีก feed จึงต้องเอา**ตัวกรองชุดเดียวกัน** (จังหวัด/อำเภอ/ตำแหน่ง/ลักษณะงานย่อย/
 * เจ้าหน้าที่/ประเภทสัญญา/คำค้น) ไปใช้กับอีกชุดข้อมูลด้วย ถ้าปล่อยตรรกะไว้ใน hook
 * ก็ต้องก๊อปโค้ดกรองรอบสอง = รอวันที่สองชุดกรองไม่เหมือนกัน
 */
import type { JobRequest } from '@/types';
import { extractJobSubtypeLabel } from './siamrajUnitFilters';
import { inferProvinceFromAddress } from './parseThaiJobAddress';
import { districtMatchesFilter } from './districtMatch';
import { boardSearchTokens, jobBoardSearchBlob, normBoardSearch } from './jobBoardSearch';
import {
  DRIVING_POSITION_LABEL,
  jobMatchesPositionFilter,
  jobMatchesStaffFilters,
} from './jobBoardPositionPreset';

export type JobBoardRowFilterState = {
  search: string;
  /** 'urgent' = ชิปด่วนบนแถบตัวกรอง */
  chip: 'all' | 'urgent';
  provinceFilter: string;
  districtFilter: string;
  positionFilter: string;
  subtypeFilter: string;
  recruiterFilter: string;
  contractTypeFilter: string;
  drivingPositionGroup: boolean;
};

export type JobBoardRowFilterOptions = {
  /**
   * ข้ามชิป "ด่วน" — ใช้กับชุดใบปิด/ยกเลิก
   * 🔴 ใบปิดไม่ได้ผ่าน `enrichJobsWithUrgency` (มีแต่ feed ใบเปิด) ถ้าไม่ข้าม
   * กดชิปด่วนค้างไว้แล้วเปิดกล่องปิดแล้วจะได้ 0 ใบทุกครั้ง ทั้งที่ของมีอยู่
   */
  skipUrgencyChip?: boolean;
};

/**
 * กรองแถวตามสถานะตัวกรองปัจจุบัน
 * `usedRelatedFallback` = ไม่เจอที่ตรงคำค้นเป๊ะ จึงคืนของใกล้เคียงให้ (พฤติกรรมเดิมของบอร์ด)
 */
export function filterJobBoardRows(
  rows: readonly JobRequest[],
  state: JobBoardRowFilterState,
  options?: JobBoardRowFilterOptions,
): { filtered: JobRequest[]; usedRelatedFallback: boolean } {
  const {
    search,
    chip,
    provinceFilter,
    districtFilter,
    positionFilter,
    subtypeFilter,
    recruiterFilter,
    contractTypeFilter,
    drivingPositionGroup,
  } = state;
  const skipUrgencyChip = options?.skipUrgencyChip ?? false;
  const q = normBoardSearch(search);

  const baseRows = rows
    .filter((j) => {
      if (skipUrgencyChip) return true;
      if (chip === 'urgent') return j.urgency === 'urgent';
      return true;
    })
    .filter((j) => {
      const jobProv = inferProvinceFromAddress(j.location_address);
      if (provinceFilter && jobProv !== provinceFilter) return false;
      if (districtFilter && !districtMatchesFilter(j.location_address, districtFilter)) return false;
      if (
        !jobMatchesPositionFilter(j, positionFilter, {
          isDrivingGroup: drivingPositionGroup || positionFilter === DRIVING_POSITION_LABEL,
        })
      ) {
        return false;
      }
      if (subtypeFilter && extractJobSubtypeLabel(j) !== subtypeFilter) return false;
      // กติกาของสองตัวกรองนี้อยู่ที่ lib ที่เดียว (เทสต์คุมที่นั่น)
      if (!jobMatchesStaffFilters(j, { recruiter: recruiterFilter, contractType: contractTypeFilter })) {
        return false;
      }
      return true;
    });

  if (!q) return { filtered: baseRows, usedRelatedFallback: false };

  const exact = baseRows.filter((j) => jobBoardSearchBlob(j).includes(q));
  if (exact.length > 0) return { filtered: exact, usedRelatedFallback: false };

  const tokens = boardSearchTokens(search);
  if (tokens.length === 0) return { filtered: baseRows, usedRelatedFallback: false };

  const related = baseRows.filter((j) => {
    const blob = jobBoardSearchBlob(j);
    return tokens.some((t) => blob.includes(t) || t.includes(blob));
  });
  if (related.length > 0) return { filtered: related, usedRelatedFallback: true };

  return { filtered: baseRows, usedRelatedFallback: true };
}
