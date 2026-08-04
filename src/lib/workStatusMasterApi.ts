import { apiFetch } from '@/lib/apiFetch';
import {
  UNIT_REQUEST_WORK_STATUS_LABELS,
  UNIT_REQUEST_WORK_STATUS_DATE_LABELS,
  UNIT_REQUEST_WORK_STATUS_OPTIONS,
} from '@/lib/unitRequestWorkStatus';

/** สถานะทำงานหนึ่งรายการจาก master (DB) — Admin แก้ได้ในหน้าตั้งค่า */
export type WorkStatusMasterItem = {
  code: string;
  label: string;
  date_label: string;
  sort_order: number;
  is_builtin: boolean;
  is_active: boolean;
  /** จำนวนใบขอที่ใช้สถานะนี้อยู่ (ลบไม่ได้ถ้ามีคนใช้) */
  usage?: number;
};

/** ค่า built-in จากโค้ด — ใช้ตอน API ล่ม/ยังไม่ได้รัน migration เพื่อไม่ให้ dropdown ว่าง */
export function builtinWorkStatusItems(): WorkStatusMasterItem[] {
  return UNIT_REQUEST_WORK_STATUS_OPTIONS.map((code, i) => ({
    code,
    label: UNIT_REQUEST_WORK_STATUS_LABELS[code],
    date_label: UNIT_REQUEST_WORK_STATUS_DATE_LABELS[code],
    sort_order: (i + 1) * 10,
    is_builtin: true,
    is_active: true,
    usage: 0,
  }));
}

async function readError(r: Response, fallback: string): Promise<string> {
  const body = (await r.json().catch(() => ({}))) as { message?: string; detail?: string; error?: string };
  return body.message || body.detail || body.error || fallback;
}

export async function listWorkStatusMaster(): Promise<WorkStatusMasterItem[]> {
  const r = await apiFetch('/api/work-status-master');
  if (!r.ok) throw new Error(await readError(r, `โหลดสถานะทำงานไม่สำเร็จ (HTTP ${r.status})`));
  const d = (await r.json()) as { items?: WorkStatusMasterItem[] };
  return d.items ?? [];
}

export async function createWorkStatus(input: {
  code: string;
  label: string;
  date_label?: string;
  sort_order?: number;
}): Promise<WorkStatusMasterItem> {
  const r = await apiFetch('/api/work-status-master', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error(await readError(r, 'เพิ่มสถานะไม่สำเร็จ'));
  const d = (await r.json()) as { item: WorkStatusMasterItem };
  return d.item;
}

export async function updateWorkStatus(
  code: string,
  patch: { label?: string; date_label?: string; sort_order?: number; is_active?: boolean },
): Promise<WorkStatusMasterItem> {
  const r = await apiFetch('/api/work-status-master', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, ...patch }),
  });
  if (!r.ok) throw new Error(await readError(r, 'บันทึกไม่สำเร็จ'));
  const d = (await r.json()) as { item: WorkStatusMasterItem };
  return d.item;
}

export async function deleteWorkStatus(code: string): Promise<void> {
  const r = await apiFetch(`/api/work-status-master?code=${encodeURIComponent(code)}`, {
    method: 'DELETE',
  });
  if (!r.ok) throw new Error(await readError(r, 'ลบไม่สำเร็จ'));
}
