/**
 * ═══ "ไม่ปล่อย + เหตุผล" — ทีม Online บอกว่าใบนี้ไม่ปล่อยประกาศเพราะอะไร (migration 129 · 29 ก.ย. 2569) ═══
 *
 * เจ้าของ (หน้าทีม Online รอบ 5): อัตราที่ขอเข้ามาต้องแยก *"Approve แล้ว · รอดำเนินการ · ไม่อนุมัติ …
 * พอเอาเม้าไปจี้ขึ้นบอกว่า ไม่อนุมัติเพราะอะไร"* — ระบบไม่เคยมีข้อมูลนี้ (ใบขอจาก ERP เป็นสถานะอนุมัติทั้งหมด
 * ไม่มีช่องเหตุผล) → Choice **"เพิ่มปุ่ม ไม่ปล่อย + เหตุผล ที่กล่องงาน"** ⇒ ตัวเลขเริ่มนับตั้งแต่วันที่เริ่มกด
 *
 * pure — ใช้ได้ทั้งหน้าเว็บ (ป๊อปไล่งาน · การ์ดกล่องงาน · หน้าทีม Online) และ server (ตรวจค่าก่อนบันทึก)
 * 🔴 ไม่ใส่ CHECK บนคอลัมน์ `reason` (บ้านนี้โดน CHECK ล็อกค่าใหม่มาสองรอบ) — ตรวจที่ `validateReleaseSkip` ที่เดียว
 * 🔴 คีย์ด้วย **id เต็มของใบ** (`siamraj-sql:` / `siamraj-pre:`) แบบเดียวกับทะเบียนปล่อย · อ่านด้วย `buildSkipIndex` สองคีย์
 */
import { buildJobKeyIndex, type JobKeyIndex } from '@/lib/jobKeyIndex';

/** เหตุผลที่เลือกได้ — แก้ป้าย/เพิ่มเหตุผลที่นี่ที่เดียว (ห้ามเปลี่ยน `key` ของเดิม: ข้อมูลที่บันทึกแล้วอ้างคีย์นี้) */
export const RELEASE_SKIP_REASONS = [
  { key: 'incomplete', label: 'ข้อมูลใบขอไม่ครบ' },
  { key: 'unit_hold', label: 'หน่วยงานให้รอ' },
  { key: 'filled', label: 'ได้คนแล้ว' },
  { key: 'other', label: 'อื่น ๆ' },
] as const;

export type ReleaseSkipReason = (typeof RELEASE_SKIP_REASONS)[number]['key'];

export const RELEASE_SKIP_LABEL: Record<ReleaseSkipReason, string> = Object.fromEntries(
  RELEASE_SKIP_REASONS.map((r) => [r.key, r.label]),
) as Record<ReleaseSkipReason, string>;

export const RELEASE_SKIP_NOTE_MAX = 300;

export function isReleaseSkipReason(v: unknown): v is ReleaseSkipReason {
  return typeof v === 'string' && RELEASE_SKIP_REASONS.some((r) => r.key === v);
}

/** แถวของทะเบียน `job_release_skips` ตามที่ API ส่งมา */
export type JobReleaseSkip = {
  job_id: string;
  request_no: string | null;
  reason: string;
  note: string | null;
  skipped_at: string;
  skipped_by_name: string | null;
};

/** คำอ่านสั้น ๆ ของเหตุผล — "อื่น ๆ" ใช้ข้อความที่พิมพ์ · เหตุผลอื่นต่อหมายเหตุท้าย (ถ้ามี) */
export function releaseSkipText(s: Pick<JobReleaseSkip, 'reason' | 'note'>): string {
  const note = (s.note ?? '').trim();
  const label = isReleaseSkipReason(s.reason) ? RELEASE_SKIP_LABEL[s.reason] : s.reason;
  if (s.reason === 'other') return note || label;
  return note ? `${label} · ${note}` : label;
}

/**
 * ค่าที่ส่งมาบันทึกได้ไหม — ตัวเดียวทั้งฟอร์มและ server
 * "อื่น ๆ" ต้องพิมพ์เหตุผลเสมอ (ไม่งั้นจี้แล้วเห็นแค่ "อื่น ๆ" ซึ่งไม่ตอบคำถาม "ไม่อนุมัติเพราะอะไร")
 */
export function validateReleaseSkip(input: {
  reason: unknown;
  note: unknown;
}): { ok: true; reason: ReleaseSkipReason; note: string | null } | { ok: false; message: string } {
  if (!isReleaseSkipReason(input.reason)) return { ok: false, message: 'เลือกเหตุผลที่ไม่ประกาศก่อน' };
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (note.length > RELEASE_SKIP_NOTE_MAX) {
    return { ok: false, message: `เหตุผลยาวได้ไม่เกิน ${RELEASE_SKIP_NOTE_MAX} ตัวอักษร` };
  }
  if (input.reason === 'other' && !note) return { ok: false, message: 'เลือก “อื่น ๆ” ต้องพิมพ์เหตุผลด้วย' };
  return { ok: true, reason: input.reason, note: note || null };
}

/**
 * หาแถว "ไม่ปล่อย" ของใบ — 🔴 สองคีย์แบบประกาศ/ทะเบียนปล่อย (id เต็มก่อน แล้วถอยไปเลขที่ใบ · เลขชนกัน = ไม่จับ)
 * (ใบขอล่วงหน้า `siamraj-pre:X` ถูกกดจากป๊อป · หน้าทีม Online อ่านใบจาก ERP เป็น `siamraj-sql:X`)
 */
export function buildSkipIndex(skips: readonly JobReleaseSkip[]): JobKeyIndex<JobReleaseSkip> {
  return buildJobKeyIndex(skips.map((s) => [s.job_id, s] as const));
}
