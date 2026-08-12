import { apiFetch } from '@/lib/apiFetch';
import { readErrorMessage, readJsonSafe } from '@/lib/api';
import type { RecruitJobTitle } from '@/lib/recruitJobTitles';

/**
 * โหลด master ตำแหน่งงาน (RM) — อ่านอย่างเดียว ไม่มีเส้นเขียน
 * ดู `src/lib/recruitJobTitles.ts` (ตรรกะเลือก) และ `api/_lib/recruitJobTitles.ts` (ที่เก็บ)
 */
export async function fetchRecruitJobTitles(
  options: { includeInactive?: boolean; departmentCode?: string | null } = {},
): Promise<RecruitJobTitle[]> {
  const params = new URLSearchParams();
  if (options.includeInactive) params.set('all', '1');
  if (options.departmentCode) params.set('department', options.departmentCode);
  const qs = params.toString();
  const r = await apiFetch(`/api/recruit/job-titles${qs ? `?${qs}` : ''}`);
  if (!r.ok) throw new Error(await readErrorMessage(r, 'โหลดตำแหน่งงานไม่สำเร็จ'));
  const data = await readJsonSafe<RecruitJobTitle[]>(r);
  return Array.isArray(data) ? data : [];
}
