/**
 * หน้าการติดต่อของจับคู่งาน (20 ต.ค. 2569 · เจ้าของ Choice "ทำตามนี้") — ชิปชุดเดียวกับแท็บการติดต่อของงานสรรหา
 * ทั้งหมด · ยังไม่โทร · โทรแล้ว · สำเร็จ · ไม่สำเร็จ (โทรแล้ว = สำเร็จ + ไม่สำเร็จ · ยังไม่โทร + โทรแล้ว = ทั้งหมด)
 */
import { apiFetch } from '@/lib/apiFetch';
import type { CallResultOutcome } from '@/lib/callHoldsApi';

export type SelectionContactRow = {
  id: string;
  cardId: number | null;
  name: string | null;
  phone: string | null;
  age: number | null;
  sex: string | null;
  area: string | null;
  jobId: string;
  requestNo: string | null;
  jobLabel: string | null;
  heldAt: string;
  expiresAt: string;
  open: boolean;
  expired: boolean;
  result: CallResultOutcome | null;
  resultAt: string | null;
};

export type SelectionChip = 'all' | 'uncalled' | 'called' | 'ok' | 'fail';

export const SELECTION_CHIPS: readonly { id: SelectionChip; label: string }[] = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'uncalled', label: 'ยังไม่โทร' },
  { id: 'called', label: 'โทรแล้ว' },
  { id: 'ok', label: 'สำเร็จ' },
  { id: 'fail', label: 'ไม่สำเร็จ' },
];

/** สำเร็จ = ตอบสนใจ · ไม่สำเร็จ = ลงผลอื่น (ไม่สนใจ · นัดโทรใหม่ · ไม่รับสาย · เบอร์ผิด) */
export function isInSelectionChip(r: Pick<SelectionContactRow, 'result'>, chip: SelectionChip): boolean {
  if (chip === 'all') return true;
  if (chip === 'uncalled') return r.result == null;
  if (chip === 'called') return r.result != null;
  if (chip === 'ok') return r.result === 'confirmed';
  return r.result != null && r.result !== 'confirmed';
}

export async function fetchSelectionContacts(): Promise<SelectionContactRow[]> {
  const r = await apiFetch('/api/matching/call-holds?view=selection');
  if (!r.ok) throw new Error('โหลดรายชื่อไม่สำเร็จ');
  const data = (await r.json()) as { rows?: SelectionContactRow[] };
  return data.rows ?? [];
}
