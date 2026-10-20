/**
 * ═══ ลูกค้าของแผนติดตาม (ขั้น 4 ของฟอร์มเพิ่มคน · 145) — การ์ด "จบแล้ว" แท็บตอบว่าไป (เจ้าของ 19 ต.ค. 2569) ═══
 * > *"ต้องการให้โชว์ชื่อลูกค้า และปุ่มโทร ในช่องงานที่จบแล้ว เจ้าของแผนต้องโทรติดต่อลูกค้ากรณีพนักงานเริ่มงานครั้งแรก"*
 * กรอกครั้งเดียวตอนเพิ่มคน ⇒ เอาค่าแรกที่มีจากสายไหนก็ได้ของชุด · ไม่มีเลย = null
 */
import type { FollowEntry } from '@/lib/followApi';

/** ไม่มี "ผู้ติดต่อ" แล้ว (ถอดช่องทั้งช่อง 20 ต.ค. 2569) */
export type FollowCustomer = { name: string | null; phone: string | null; tel: string | null };

const clean = (v: string | null | undefined) => (v ?? '').trim() || null;

export function followCustomerOf(
  rounds: readonly Pick<FollowEntry, 'customer_name' | 'customer_phone'>[],
): FollowCustomer | null {
  const first = (k: 'customer_name' | 'customer_phone') => rounds.map((r) => clean(r[k])).find(Boolean) ?? null;
  const name = first('customer_name');
  const phone = first('customer_phone');
  if (!name && !phone) return null;
  const digits = (phone ?? '').replace(/[^\d+]/g, '');
  return { name, phone, tel: digits.replace(/\D/g, '').length >= 9 ? digits : null };
}
