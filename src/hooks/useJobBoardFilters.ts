import { useCallback, useEffect, useMemo, useState } from 'react';
import type { JobRequest } from '@/types';
import { publicJobPositionLabel } from '@/lib/unitRequestDisplay';
import { extractJobSubtypeLabel } from '@/lib/siamrajUnitFilters';
import { inferProvinceFromAddress } from '@/lib/parseThaiJobAddress';
import { districtMatchesFilter } from '@/lib/districtMatch';
import { getDistrictOptionsForProvince } from '@/lib/thaiDistricts';
import { THAI_PROVINCE_NAMES_SORTED } from '@/lib/thaiProvinces';
import {
  boardSearchTokens,
  isBoardVisibleJob,
  jobBoardSearchBlob,
  normBoardSearch,
} from '@/lib/jobBoardSearch';

export type JobBoardUrgencyChip = 'all' | 'urgent';

export function useJobBoardFilters(jobs: JobRequest[]) {
  const [search, setSearch] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [subtypeFilter, setSubtypeFilter] = useState('');
  const [chip, setChip] = useState<JobBoardUrgencyChip>('all');

  const visible = useMemo(() => jobs.filter(isBoardVisibleJob), [jobs]);

  const provinceOptions = THAI_PROVINCE_NAMES_SORTED;

  const districtOptions = useMemo(() => {
    if (!provinceFilter) return [];
    return [...getDistrictOptionsForProvince(provinceFilter)];
  }, [provinceFilter]);

  const positionOptions = useMemo(() => {
    const set = new Set(visible.map((j) => publicJobPositionLabel(j)));
    return [...set].sort((a, b) => a.localeCompare(b, 'th'));
  }, [visible]);

  const subtypeOptions = useMemo(() => {
    const set = new Set(visible.map((j) => extractJobSubtypeLabel(j)));
    return [...set].sort((a, b) => a.localeCompare(b, 'th'));
  }, [visible]);

  useEffect(() => {
    if (!districtFilter) return;
    if (!districtOptions.includes(districtFilter)) setDistrictFilter('');
  }, [districtFilter, districtOptions]);

  useEffect(() => {
    if (!positionFilter) return;
    if (!positionOptions.includes(positionFilter)) setPositionFilter('');
  }, [positionFilter, positionOptions]);

  useEffect(() => {
    if (!subtypeFilter) return;
    if (!subtypeOptions.includes(subtypeFilter)) setSubtypeFilter('');
  }, [subtypeFilter, subtypeOptions]);

  const { filtered, usedRelatedFallback } = useMemo(() => {
    const q = normBoardSearch(search);
    const baseRows = visible
      .filter((j) => {
        if (chip === 'urgent') return j.urgency === 'urgent';
        return true;
      })
      .filter((j) => {
        const jobProv = inferProvinceFromAddress(j.location_address);
        if (provinceFilter && jobProv !== provinceFilter) return false;
        if (districtFilter && !districtMatchesFilter(j.location_address, districtFilter)) return false;
        if (positionFilter && publicJobPositionLabel(j) !== positionFilter) return false;
        if (subtypeFilter && extractJobSubtypeLabel(j) !== subtypeFilter) return false;
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
  }, [visible, search, chip, provinceFilter, districtFilter, positionFilter, subtypeFilter]);

  const onProvinceFilterChange = useCallback((next: string) => {
    setProvinceFilter(next);
    setDistrictFilter('');
  }, []);

  return {
    search,
    setSearch,
    provinceFilter,
    districtFilter,
    setDistrictFilter,
    positionFilter,
    setPositionFilter,
    subtypeFilter,
    setSubtypeFilter,
    chip,
    setChip,
    provinceOptions,
    districtOptions,
    positionOptions,
    subtypeOptions,
    onProvinceFilterChange,
    filtered,
    usedRelatedFallback,
    visibleCount: visible.length,
  };
}
