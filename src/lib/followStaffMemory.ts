import type { FollowStaffContact } from '@/lib/followStaffContactsApi';

/**
 * **ความจำ ชื่อ→เบอร์ ของเจ้าหน้าที่ที่ติดตาม** บนหน้า Follow
 * (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-9: *"เอาชื่อมาจากเจ้าหน้าที่คัดสรร เบอร์โทรให้เขาพิมพ์เอง
 * แล้วมันจำไว้ว่าเคยเลือกชื่อใครแล้วเบอร์ไหน ให้มันขึ้นมาเอง"*)
 *
 * ชื่อ = จาก roster คัดสรร (ที่ `jobStaffNames.buildScreenerNameOptions`)
 * เบอร์ = พิมพ์เอง · ความจำเก็บใน `follow_staff_contacts` (name, phone) เดิม
 * — เลือกชื่อที่เคยใช้ → เบอร์ล่าสุดของชื่อนั้น prefill ให้เอง (แก้ทับได้)
 *
 * ⚠️ `follow_staff_contacts` API คืนเรียง **name asc, created_at asc** — วนแล้ว
 * "ตัวหลังชนะ" จึงได้เบอร์ที่จำล่าสุดของชื่อนั้น (คนเปลี่ยนเบอร์แล้วอยากได้เบอร์ใหม่)
 */

function nameKey(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase();
}

/** เบอร์ที่จำไว้ล่าสุดของชื่อนี้ — null = ยังไม่เคยจำเบอร์ของชื่อนี้ */
export function rememberedPhoneForName(
  name: string,
  contacts: FollowStaffContact[],
): string | null {
  const key = nameKey(name);
  if (!key) return null;
  let latest: string | null = null;
  for (const c of contacts) {
    if (nameKey(c.name) === key && c.phone.trim()) latest = c.phone.trim();
  }
  return latest;
}

/** ชื่อที่จับคู่กับเบอร์นี้ (เทียบตรงตัว) — ใช้ย้อนหาชื่อตอนเปิดแก้รายการเก่าที่มีแต่เบอร์ */
export function nameForPhone(phone: string, contacts: FollowStaffContact[]): string | null {
  const key = (phone ?? '').trim();
  if (!key) return null;
  for (const c of contacts) {
    if (c.phone.trim() === key && c.name.trim()) return c.name.trim();
  }
  return null;
}

/**
 * ตัวเลือกชื่อใน dropdown = ชื่อคัดสรร (หลัก) + ชื่อที่เคยจำไว้ในความจำ (เผื่อคนที่
 * ไม่ได้อยู่ roster แล้วแต่เคยใช้) · unique + เรียง ก-ฮ
 */
export function staffNameOptions(
  screenerNames: string[],
  contacts: FollowStaffContact[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of [...screenerNames, ...contacts.map((c) => c.name)]) {
    const t = (n ?? '').trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out.sort((a, b) => a.localeCompare(b, 'th'));
}
