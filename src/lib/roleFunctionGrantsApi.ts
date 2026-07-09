import { apiFetch } from '@/lib/apiFetch';
import type { RoleFunctionMatrix } from '@/lib/roleFunctions';

export async function fetchRolePermissions(): Promise<RoleFunctionMatrix> {
  const r = await apiFetch('/api/role-permissions', { cache: 'no-store' });
  if (!r.ok) throw new Error('โหลดสิทธิ์ฟังก์ชันไม่สำเร็จ');
  const data = (await r.json()) as { matrix?: RoleFunctionMatrix };
  if (!data.matrix) throw new Error('Invalid role permissions response');
  return data.matrix;
}

export async function patchRolePermission(
  role: keyof RoleFunctionMatrix,
  functionId: string,
  enabled: boolean,
): Promise<RoleFunctionMatrix> {
  const r = await apiFetch('/api/role-permissions', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, functionId, enabled }),
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string; error?: string } | null;
    throw new Error(err?.message || err?.error || 'บันทึกสิทธิ์ไม่สำเร็จ');
  }
  const data = (await r.json()) as { matrix?: RoleFunctionMatrix };
  if (!data.matrix) throw new Error('Invalid role permissions response');
  return data.matrix;
}
