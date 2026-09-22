/**
 * ═══ หน้าสาธารณะเห็นช่องไหนบ้าง — ตัวตัดสินที่เดียวของทั้งระบบ ═══
 *
 * เจ้าของเคาะ 22 ก.ย. 2569 (นิยามกล่องงานข้อ 3): ทีม Online ติ๊กได้ว่าจะให้หน้าสมัคร
 * สาธารณะเห็นช่องไหน (ฐานเงินเดือน · สวัสดิการ · โอที · สัญชาตินาย · วันที่ต้องการ)
 *
 * 🔴 กติกา: **ไม่มีการตั้งค่า = โชว์** — ประกาศเก่าทุกใบไม่เปลี่ยนพฤติกรรม
 * เก็บเฉพาะช่องที่ถูก "ติ๊กออก" (ค่า `false`) · `true`/ไม่มีคีย์ = โชว์เหมือนเดิม
 *
 * 🔴 คุมเฉพาะ **การแสดงผลหน้าสาธารณะ** — ไม่แตะข้อมูลในฐาน และไม่แตะข้อมูลที่ส่งให้ AI โทร
 *
 * ⚠️ ต้องใช้ตัวนี้ทุกจุดที่ render หน้าสาธารณะ (การ์ดฝั่ง !isStaff ใน JobBoardView ·
 * PublicPostingApplyPage · PublicApplyDialog) ไม่งั้นติ๊กซ่อนที่หนึ่งแต่ยังโผล่อีกที่
 */

import type { JobRequest } from '@/types';

/** ช่องที่ติ๊กโชว์/ซ่อนได้ */
export const PUBLIC_TOGGLE_FIELDS = [
  'income',
  'benefits',
  'ot',
  'boss_nationality',
  'required_date',
] as const;

export type PublicToggleField = (typeof PUBLIC_TOGGLE_FIELDS)[number];

/** ป้ายคำของแต่ละช่อง — โชว์ข้าง checkbox ในป๊อป */
export const PUBLIC_FIELD_LABEL: Record<PublicToggleField, string> = {
  income: 'ฐานเงินเดือน / รายได้',
  benefits: 'สวัสดิการ',
  ot: 'โอที',
  boss_nationality: 'สัญชาตินายจ้าง',
  required_date: 'วันที่ต้องการ',
};

type VisibilityMap = NonNullable<
  NonNullable<JobRequest['field_overrides']>['public_visibility']
>;

/**
 * ช่องนี้โชว์บนหน้าสาธารณะไหม — `false` เฉพาะเมื่อถูกติ๊กออกไว้จริง
 * ทุกกรณีอื่น (ไม่ตั้ง / ตั้ง true / ไม่มี field_overrides) = โชว์
 */
export function publicFieldVisible(job: JobRequest, field: PublicToggleField): boolean {
  const vis = job.field_overrides?.public_visibility as VisibilityMap | null | undefined;
  if (!vis) return true;
  return vis[field] !== false;
}

/** ค่าที่ป๊อปเอาไปตั้ง checkbox — true = โชว์ (ค่าเริ่มของทุกช่อง) */
export function readPublicVisibility(
  vis: VisibilityMap | null | undefined,
): Record<PublicToggleField, boolean> {
  const out = {} as Record<PublicToggleField, boolean>;
  for (const f of PUBLIC_TOGGLE_FIELDS) out[f] = vis?.[f] !== false;
  return out;
}
