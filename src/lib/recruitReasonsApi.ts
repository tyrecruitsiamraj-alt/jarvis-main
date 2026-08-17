import { apiFetch } from '@/lib/apiFetch';
import { readErrorMessage, readJsonSafe } from '@/lib/api';
import type { RecruitReason } from '@/lib/recruitReasons';

export async function fetchRecruitReasons(
  options: { includeInactive?: boolean; processCode?: string; outcomeCode?: string } = {},
): Promise<RecruitReason[]> {
  const params = new URLSearchParams();
  if (options.includeInactive) params.set('all', '1');
  if (options.processCode) params.set('process', options.processCode);
  if (options.outcomeCode) params.set('outcome', options.outcomeCode);
  const qs = params.toString();
  const r = await apiFetch(`/api/recruit/reasons${qs ? `?${qs}` : ''}`);
  if (!r.ok) throw new Error(await readErrorMessage(r, 'โหลดเหตุผลไม่สำเร็จ'));
  const data = await readJsonSafe<RecruitReason[]>(r);
  return Array.isArray(data) ? data : [];
}

export async function createRecruitReason(input: {
  processCode: string;
  outcomeCode: string;
  name: string;
}): Promise<RecruitReason> {
  const r = await apiFetch('/api/recruit/reasons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'เพิ่มเหตุผลไม่สำเร็จ'));
  return (await readJsonSafe<RecruitReason>(r)) as RecruitReason;
}

export async function updateRecruitReason(
  id: string,
  patch: { name?: string; isActive?: boolean },
): Promise<void> {
  const r = await apiFetch('/api/recruit/reasons', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...patch }),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'แก้เหตุผลไม่สำเร็จ'));
}

/** ปิดการใช้งาน — ไม่ใช่ลบทิ้ง (เหตุผลถูกอ้างจากผลติดต่อย้อนหลัง) */
export async function deactivateRecruitReason(id: string): Promise<void> {
  const r = await apiFetch(`/api/recruit/reasons?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'ปิดเหตุผลไม่สำเร็จ'));
}
