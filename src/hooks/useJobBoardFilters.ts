import { useCallback, useEffect, useMemo, useState } from 'react';
import type { JobRequest } from '@/types';
import { publicJobPositionLabel } from '@/lib/unitRequestDisplay';
import { sumJobPositionUnits } from '@/lib/jobPositionUnits';
import { extractJobSubtypeLabel } from '@/lib/siamrajUnitFilters';
import { inferProvinceFromAddress } from '@/lib/parseThaiJobAddress';
import { districtMatchesFilter } from '@/lib/districtMatch';
import { getDistrictOptionsForProvince } from '@/lib/thaiDistricts';
import { THAI_PROVINCE_NAMES_SORTED } from '@/lib/thaiProvinces';
import { isBoardVisibleJob } from '@/lib/jobBoardSearch';
import { DRIVING_POSITION_LABEL, jobMatchesPositionFilter } from '@/lib/jobBoardPositionPreset';
import { filterJobBoardRows, type JobBoardRowFilterState } from '@/lib/jobBoardRowFilter';

export type JobBoardFilterOptions = {
  /** ค่าเริ่มต้นตำแหน่งจากลิงก์ เช่น งานขับรถ */
  initialPosition?: string;
  /** ล็อกไม่ให้เปลี่ยน/ล้างตำแหน่ง */
  lockPosition?: boolean;
  /** กรองแบบกลุ่มงานขับรถ (พขร / ขับรถ / valet) */
  drivingPositionGroup?: boolean;
};

export function useJobBoardFilters(jobs: JobRequest[], options?: JobBoardFilterOptions) {
  const initialPosition = options?.initialPosition ?? '';
  const lockPosition = Boolean(options?.lockPosition && initialPosition);
  const drivingPositionGroup = Boolean(options?.drivingPositionGroup);

  const [search, setSearch] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState(initialPosition);
  const [subtypeFilter, setSubtypeFilter] = useState('');
  /**
   * ตัวกรองที่เจ้าของขอเพิ่ม 13 ส.ค. 2569 — **ฝั่งเจ้าหน้าที่เท่านั้น**
   * (หน้าสาธารณะไม่ส่งมาแสดง · ชื่อเจ้าหน้าที่เป็นข้อมูลภายใน)
   * วัดกับฐานจริง 292 ใบ: recruiter_name กรอกมา 179 ใบ (9 คน) ·
   * contract_type_name กรอกครบ 292 ใบ (คนอย่างเดียว 216 · คน+รถ 76)
   */
  const [recruiterFilter, setRecruiterFilter] = useState('');
  const [contractTypeFilter, setContractTypeFilter] = useState('');

  useEffect(() => {
    if (!initialPosition) return;
    setPositionFilter(initialPosition);
  }, [initialPosition]);

  const visible = useMemo(() => jobs.filter(isBoardVisibleJob), [jobs]);

  const provinceOptions = THAI_PROVINCE_NAMES_SORTED;

  const districtOptions = useMemo(() => {
    if (!provinceFilter) return [];
    return [...getDistrictOptionsForProvince(provinceFilter)];
  }, [provinceFilter]);

  const positionOptions = useMemo(() => {
    const set = new Set(visible.map((j) => publicJobPositionLabel(j)));
    if (drivingPositionGroup || positionFilter === DRIVING_POSITION_LABEL) {
      set.add(DRIVING_POSITION_LABEL);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'th'));
  }, [visible, drivingPositionGroup, positionFilter]);

  const subtypeOptions = useMemo(() => {
    const scope = positionFilter
      ? visible.filter((j) =>
          jobMatchesPositionFilter(j, positionFilter, {
            isDrivingGroup: drivingPositionGroup || positionFilter === DRIVING_POSITION_LABEL,
          }),
        )
      : visible;
    const set = new Set(scope.map((j) => extractJobSubtypeLabel(j)));
    return [...set].sort((a, b) => a.localeCompare(b, 'th'));
  }, [visible, positionFilter, drivingPositionGroup]);

  /** ⚠️ เอาเฉพาะค่าที่มีจริงในใบขอที่มองเห็น — ใบที่ไม่ได้กรอกชื่อไม่สร้างตัวเลือกว่าง */
  const recruiterOptions = useMemo(() => {
    const set = new Set(
      visible.map((j) => (j.recruiter_name || '').trim()).filter(Boolean),
    );
    return [...set].sort((a, b) => a.localeCompare(b, 'th'));
  }, [visible]);

  const contractTypeOptions = useMemo(() => {
    const set = new Set(
      visible.map((j) => (j.contract_type_name || '').trim()).filter(Boolean),
    );
    return [...set].sort((a, b) => a.localeCompare(b, 'th'));
  }, [visible]);

  useEffect(() => {
    if (!districtFilter) return;
    if (!districtOptions.includes(districtFilter)) setDistrictFilter('');
  }, [districtFilter, districtOptions]);

  useEffect(() => {
    if (recruiterFilter && !recruiterOptions.includes(recruiterFilter)) setRecruiterFilter('');
  }, [recruiterFilter, recruiterOptions]);

  useEffect(() => {
    if (contractTypeFilter && !contractTypeOptions.includes(contractTypeFilter)) {
      setContractTypeFilter('');
    }
  }, [contractTypeFilter, contractTypeOptions]);

  useEffect(() => {
    if (!positionFilter) return;
    if (lockPosition) return;
    if (positionFilter === DRIVING_POSITION_LABEL) return;
    if (!positionOptions.includes(positionFilter)) setPositionFilter('');
  }, [positionFilter, positionOptions, lockPosition]);

  useEffect(() => {
    if (!subtypeFilter) return;
    if (!subtypeOptions.includes(subtypeFilter)) setSubtypeFilter('');
  }, [subtypeFilter, subtypeOptions]);

  /**
   * สถานะตัวกรองก้อนเดียว — ส่งต่อให้ตัวกรอง pure ได้ตรง ๆ
   * (ใช้กับชุดใบปิด/ยกเลิกด้วย ผ่าน `filterRows` ข้างล่าง)
   */
  const rowFilterState = useMemo<JobBoardRowFilterState>(
    () => ({
      search,
      provinceFilter,
      districtFilter,
      positionFilter,
      subtypeFilter,
      recruiterFilter,
      contractTypeFilter,
      drivingPositionGroup,
    }),
    [
      search,
      provinceFilter,
      districtFilter,
      positionFilter,
      subtypeFilter,
      recruiterFilter,
      contractTypeFilter,
      drivingPositionGroup,
    ],
  );

  const { filtered, usedRelatedFallback } = useMemo(
    () => filterJobBoardRows(visible, rowFilterState),
    [visible, rowFilterState],
  );

  /**
   * เอาตัวกรองชุดเดียวกันไปใช้กับ**อีกชุดข้อมูล** (ใบที่ปิดแล้ว/ยกเลิก ซึ่งมาจากอีก feed)
   * 🔴 ต้องเป็นตัวเดียวกับที่กรองใบเปิด — เขียนกรองรอบสองเมื่อไหร่คือรอวันที่สองกล่องไม่ตรงกัน
   */
  const filterRows = useCallback(
    (rows: readonly JobRequest[]) => filterJobBoardRows(rows, rowFilterState).filtered,
    [rowFilterState],
  );

  const onProvinceFilterChange = useCallback((next: string) => {
    setProvinceFilter(next);
    setDistrictFilter('');
  }, []);

  const onPositionFilterChange = useCallback(
    (next: string) => {
      if (lockPosition) return;
      setPositionFilter(next);
    },
    [lockPosition],
  );

  return {
    search,
    setSearch,
    provinceFilter,
    districtFilter,
    setDistrictFilter,
    positionFilter,
    setPositionFilter: onPositionFilterChange,
    subtypeFilter,
    setSubtypeFilter,
    recruiterFilter,
    setRecruiterFilter,
    contractTypeFilter,
    setContractTypeFilter,
    recruiterOptions,
    contractTypeOptions,
    provinceOptions,
    districtOptions,
    positionOptions,
    subtypeOptions,
    onProvinceFilterChange,
    filtered,
    usedRelatedFallback,
    filterRows,
    visibleCount: visible.length,
    /** อัตรารวมของชุดที่มองเห็น (ก่อนกรอง) — หน่วยเดียวกับ Dashboard ที่นับ "อัตรา" */
    visiblePositions: sumJobPositionUnits(visible),
    lockPosition,
  };
}
