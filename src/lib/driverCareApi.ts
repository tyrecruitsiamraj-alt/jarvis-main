import { apiFetch } from '@/lib/apiFetch';
import { readErrorMessage, readJsonSafe } from '@/lib/api';
import type {
  DriverActionLogInput,
  DriverActionTrackingItem,
  DriverActionUpdateInput,
  DriverCareOverviewResponse,
  DriverRiskListItem,
} from '@/types/driverCare';

function buildDriverCareUrl(
  view: string,
  params: Record<string, string | undefined> = {},
): string {
  const sp = new URLSearchParams({ view });
  Object.entries(params).forEach(([k, v]) => {
    if (v) sp.set(k, v);
  });
  return `/api/driver-care?${sp.toString()}`;
}

export async function fetchDriverCareOverview(): Promise<DriverCareOverviewResponse> {
  const r = await apiFetch(buildDriverCareUrl('overview'));
  if (!r.ok) throw new Error(await readErrorMessage(r, 'โหลดภาพรวม Driver Care ไม่สำเร็จ'));
  return readJsonSafe<DriverCareOverviewResponse>(r);
}

export async function fetchDriverRiskList(filters: {
  riskLevel?: string;
  site?: string;
  supervisor?: string;
  actionStatus?: string;
  search?: string;
}): Promise<DriverRiskListItem[]> {
  const r = await apiFetch(buildDriverCareUrl('risk-list', filters));
  if (!r.ok) throw new Error(await readErrorMessage(r, 'โหลดรายชื่อความเสี่ยงไม่สำเร็จ'));
  return readJsonSafe<DriverRiskListItem[]>(r);
}

export async function fetchDriverActions(filters: {
  status?: string;
  riskLevel?: string;
  actionBy?: string;
  overdueOnly?: boolean;
}): Promise<DriverActionTrackingItem[]> {
  const r = await apiFetch(
    buildDriverCareUrl('actions', {
      status: filters.status,
      riskLevel: filters.riskLevel,
      actionBy: filters.actionBy,
      overdueOnly: filters.overdueOnly ? '1' : undefined,
    }),
  );
  if (!r.ok) throw new Error(await readErrorMessage(r, 'โหลด Action Tracking ไม่สำเร็จ'));
  return readJsonSafe<DriverActionTrackingItem[]>(r);
}

export async function recalculateDriverCareRisk(): Promise<number> {
  const r = await apiFetch('/api/driver-care?action=recalculate', { method: 'POST' });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'คำนวณความเสี่ยงใหม่ไม่สำเร็จ'));
  const data = await readJsonSafe<{ recalculated?: number }>(r);
  return data.recalculated ?? 0;
}

export async function logDriverAction(input: DriverActionLogInput): Promise<string> {
  const r = await apiFetch('/api/driver-care?action=log', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'บันทึก Action ไม่สำเร็จ'));
  const data = await readJsonSafe<{ id: string }>(r);
  return data.id;
}

export async function updateDriverAction(input: DriverActionUpdateInput): Promise<void> {
  const r = await apiFetch('/api/driver-care?action=update-action', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'อัปเดต Action ไม่สำเร็จ'));
}
