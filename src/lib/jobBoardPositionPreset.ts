import type { JobRequest } from '@/types';
import { publicJobPositionLabel } from '@/lib/unitRequestDisplay';

/** ป้ายกลุ่มตำแหน่งงานขับรถ (ใช้ในลิงก์แคมเปญ /apply?pos=…) */
export const DRIVING_POSITION_LABEL = 'งานขับรถ';

const DRIVING_ALIASES = new Set(
  ['งานขับรถ', 'ขับรถ', 'พขร', 'พขร.', 'driver', 'driving', 'valet'].map((s) =>
    s.normalize('NFC').toLowerCase(),
  ),
);

export function normalizePositionPresetQuery(raw: string | null | undefined): string {
  return (raw || '').normalize('NFC').trim();
}

export function isDrivingPositionPreset(raw: string | null | undefined): boolean {
  const q = normalizePositionPresetQuery(raw).toLowerCase();
  if (!q) return false;
  if (DRIVING_ALIASES.has(q)) return true;
  return /พขร|ขับรถ|driver|chauffeur|valet/i.test(q);
}

/** ตำแหน่งบนการ์ดถือว่างานขับรถไหม */
export function isDrivingJobPosition(job: JobRequest): boolean {
  const label = publicJobPositionLabel(job);
  return /พขร|ขับรถ|driver|chauffeur|valet/i.test(label);
}

/**
 * อ่าน ?pos= จาก URL
 * - pos=ขับรถ / งานขับรถ / พขร → ล็อกกลุ่มงานขับรถ
 * - ค่าอื่น → ใช้เป็นชื่อตำแหน่งตรงๆ
 */
export function resolveApplyPositionPreset(posRaw: string | null | undefined): {
  positionFilter: string;
  locked: boolean;
  isDrivingGroup: boolean;
} | null {
  const pos = normalizePositionPresetQuery(posRaw);
  if (!pos) return null;
  if (isDrivingPositionPreset(pos)) {
    return {
      positionFilter: DRIVING_POSITION_LABEL,
      locked: true,
      isDrivingGroup: true,
    };
  }
  return {
    positionFilter: pos,
    locked: true,
    isDrivingGroup: false,
  };
}

export function jobMatchesPositionFilter(
  job: JobRequest,
  positionFilter: string,
  opts?: { isDrivingGroup?: boolean },
): boolean {
  if (!positionFilter) return true;
  if (opts?.isDrivingGroup || positionFilter === DRIVING_POSITION_LABEL) {
    return isDrivingJobPosition(job);
  }
  return publicJobPositionLabel(job) === positionFilter;
}
