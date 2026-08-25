/**
 * ขั้นในกระบวนการจ้าง "ชุดเดียว" — ฝั่งหน้าเว็บ (Phase 6.1-6.2)
 *
 * 🔴 มีสองเส้นโดยตั้งใจ ใช้คนละกรณี:
 *   1. คนที่ **มีใบสมัคร** → `saveSelectionProgress()` ใน `publicApplicationsApi.ts`
 *      (`PATCH /api/job-applications {id, ...}`) · server dual-write ให้เอง
 *   2. คนที่ **ยังไม่มีใบสมัคร** (คนจาก match บอร์ด/iRecruit) → ไฟล์นี้
 *      (`PATCH /api/selection-progress {jobId, phone, ...}`)
 *
 * ⚠️ ทั้งสองเส้นลงตารางกลางเดียวกัน คีย์ **(job_id, phone_e164)** — คนคนเดียวกัน
 * ที่โผล่ทั้งสองทางจึงเห็นขั้นเดียวกัน (นี่คือหัวใจของ "ชุดเดียว" ที่เจ้าของสั่ง)
 */
import { apiFetch } from '@/lib/apiFetch';
import type { PrepChecklist, SelectionStatus } from '@/lib/selectionProgress';

export type SelectionProgressEntry = {
  job_id: string;
  phone_e164: string;
  selection_status: SelectionStatus | null;
  prep_checklist: PrepChecklist;
  /** หน่วยงานที่กำลังพิจารณา (Phase 6.6) */
  unit_site_code: string | null;
  unit_name: string | null;
  updated_by_name: string | null;
};

/** อ่านขั้นของคนหลายคนในใบขอเดียว — คืน Map คีย์ **เบอร์ E.164 ที่ server ส่งกลับ** */
export async function fetchSelectionProgress(
  jobId: string,
  phones: string[],
): Promise<Map<string, SelectionProgressEntry>> {
  const out = new Map<string, SelectionProgressEntry>();
  const clean = [...new Set(phones.map((p) => (p || '').trim()).filter(Boolean))];
  if (!jobId.trim() || clean.length === 0) return out;
  const qs = new URLSearchParams({ jobId, phones: clean.join(',') });
  const r = await apiFetch(`/api/selection-progress?${qs.toString()}`);
  // อ่านไม่ได้ = ไม่มีข้อมูลขั้น (ของเสริม ห้ามทำให้หน้าหลักพัง)
  if (!r.ok) return out;
  const body = (await r.json()) as { items?: SelectionProgressEntry[] };
  for (const it of body.items ?? []) out.set(it.phone_e164, it);
  return out;
}

export type SaveSelectionProgressInput = {
  jobId: string;
  phone: string;
  /** ไม่ส่ง = ไม่แตะของเดิม · `null` = ล้างขั้น */
  selection_status?: SelectionStatus | null;
  prep_checklist?: PrepChecklist;
  unit_site_code?: string | null;
  unit_name?: string | null;
};

export async function saveSelectionProgressByPhone(
  input: SaveSelectionProgressInput,
): Promise<SelectionProgressEntry> {
  const r = await apiFetch('/api/selection-progress', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if (!r.ok) {
    const body = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message || 'บันทึกขั้นไม่สำเร็จ');
  }
  const body = (await r.json()) as { item: SelectionProgressEntry };
  return body.item;
}
