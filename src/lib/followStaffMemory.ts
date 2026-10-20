import type { FollowStaffContact } from '@/lib/followStaffContactsApi';
import type { StaffDirectoryEntry } from '@/lib/jobStaffRemote';

/**
 * **ความจำ ชื่อ→เบอร์ ของเจ้าหน้าที่ที่ติดตาม** บนหน้า Follow
 * (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-9: *"เอาชื่อมาจากเจ้าหน้าที่คัดสรร เบอร์โทรให้เขาพิมพ์เอง
 * แล้วมันจำไว้ว่าเคยเลือกชื่อใครแล้วเบอร์ไหน ให้มันขึ้นมาเอง"*)
 *
 * ชื่อ = จาก roster คัดสรร (ที่ `jobStaffNames.buildScreenerNameOptions`)
 * เบอร์ = พิมพ์เอง · ความจำเก็บใน `follow_staff_contacts` (name, phone) เดิม
 * — เลือกชื่อที่เคยใช้ → เบอร์ล่าสุดของชื่อนั้น prefill ให้เอง (แก้ทับได้)
 *
 * 🔴 **23 ก.ย. 2569 — ตัวจริงย้ายไปหน้าผู้ใช้งาน** (เจ้าของเคาะเอง ย้ำคำสั่ง 1 ก.ย.
 * *"กำหนดทั้ง Role คัดสรร ชื่อเล่น และเบอร์โทรทีเดียว"*) · สมุดเบอร์ (`directory`)
 * จาก `users` **ชนะความจำเดิมเสมอ**
 *
 * เหตุที่ต้องชนะ: ความจำเดิมพิมพ์เองล้วน ๆ จึงปนกันจริง (วัด 23 ก.ย.: "ครีม" 3 เบอร์ ·
 * "กุ้งนาง" 2 เบอร์ · เบอร์ 0614073657 ผูกอยู่ 3 ชื่อ) แล้วโค้ด "เอาอันที่จำล่าสุด"
 * ⇒ เบอร์ผิดชนะเงียบ ๆ · ตั้งค่าในหน้าผู้ใช้งานเมื่อไหร่ ของเก่าของคนนั้นก็เลิกถูกใช้
 *
 * ⚠️ **ความจำเดิมยังไม่ถอดทิ้ง** — วันนี้หน้าผู้ใช้งานยังกรอกเบอร์ไม่ครบ (วัด 23 ก.ย.:
 * 58 บัญชี มีเบอร์ 0) ถอดทันทีคือช่องนี้ว่างเปล่าใช้งานไม่ได้ · ปล่อยเป็นทางถอย
 * ให้ชื่อที่ยังไม่ได้ตั้งค่ายังทำงานเหมือนเดิม แล้วหายไปเองทีละคนเมื่อกรอกครบ
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
/**
 * เทียบเบอร์ด้วยตัวเลข 9 หลักท้าย (20 ต.ค. 2569) — หน้าผู้ใช้งานเก็บ "+66633235024" แต่รายการติดตามเก็บ "0633235024"
 * เดิมเทียบตัวอักษรตรง ๆ ⇒ เปิดแก้แล้วช่องชื่อว่าง ทั้งที่เป็นเบอร์ของคนในสมุดเบอร์ (เจ้าของทัก "กดเข้าไปก็ไม่ขึ้นชื่อที่แก้ไป")
 * เบอร์สั้น (ต่อภายใน ฯลฯ ไม่ถึง 9 หลัก) = เทียบทั้งสตริงเหมือนเดิม
 */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = (a ?? '').trim();
  const y = (b ?? '').trim();
  if (!x || !y) return false;
  if (x === y) return true;
  const dx = x.replace(/\D/g, '');
  const dy = y.replace(/\D/g, '');
  return dx.length >= 9 && dy.length >= 9 && dx.slice(-9) === dy.slice(-9);
}

export function nameForPhone(phone: string, contacts: FollowStaffContact[]): string | null {
  const key = (phone ?? '').trim();
  if (!key) return null;
  for (const c of contacts) {
    if (samePhone(c.phone, key) && c.name.trim()) return c.name.trim();
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

/** เบอร์จากสมุดเบอร์ (หน้าผู้ใช้งาน) — null = ชื่อนี้ยังไม่ได้ตั้งเบอร์ไว้ที่นั่น */
export function directoryPhoneForName(
  name: string,
  directory: readonly StaffDirectoryEntry[],
): string | null {
  const key = nameKey(name);
  if (!key) return null;
  for (const d of directory) {
    if (nameKey(d.name) === key && d.phone.trim()) return d.phone.trim();
  }
  return null;
}

/** ชื่อนี้ถูกตั้งค่าไว้ในหน้าผู้ใช้งานแล้วหรือยัง — แล้ว = ห้ามจำทับด้วยค่าที่พิมพ์เอง */
export function isDirectoryName(
  name: string,
  directory: readonly StaffDirectoryEntry[],
): boolean {
  return directoryPhoneForName(name, directory) !== null;
}

/**
 * เบอร์ของชื่อนี้ — **สมุดเบอร์ก่อน แล้วค่อยความจำเดิม**
 * (ที่เดียวที่ตัดสินลำดับ · ห้ามไล่เรียงเองซ้ำในไฟล์จอ)
 */
export function phoneForStaffName(
  name: string,
  directory: readonly StaffDirectoryEntry[],
  contacts: FollowStaffContact[],
): string | null {
  return directoryPhoneForName(name, directory) ?? rememberedPhoneForName(name, contacts);
}

/** ชื่อที่จับคู่กับเบอร์นี้ — สมุดเบอร์ก่อน แล้วค่อยความจำเดิม (ใช้ตอนเปิดแก้รายการเก่า) */
export function staffNameForPhone(
  phone: string,
  directory: readonly StaffDirectoryEntry[],
  contacts: FollowStaffContact[],
): string | null {
  const key = (phone ?? '').trim();
  if (!key) return null;
  for (const d of directory) {
    if (samePhone(d.phone, key) && d.name.trim()) return d.name.trim();
  }
  return nameForPhone(key, contacts);
}

/**
 * ตัวเลือกชื่อทั้งหมด = สมุดเบอร์ (หน้าผู้ใช้งาน) + ชื่อคัดสรร + ชื่อที่เคยจำไว้
 * unique ไม่สนตัวพิมพ์ · เรียง ก-ฮ — ชื่อที่ตั้งค่าแล้วกับชื่อเดิมที่สะกดเหมือนกันนับเป็นชื่อเดียว
 */
export function staffNameOptionsAll(
  directory: readonly StaffDirectoryEntry[],
  screenerNames: string[],
  contacts: FollowStaffContact[],
): string[] {
  return staffNameOptions([...directory.map((d) => d.name), ...screenerNames], contacts);
}

/**
 * ชุดที่ช่อง "เจ้าหน้าที่ที่ติดตาม" ใช้ได้จริง — กรองจากสมุดรายชื่อเต็ม
 *
 * 🔴 **ต้องกรองที่นี่ ไม่ใช่ที่ API** — API ส่งชุดเดียวให้ทั้งระบบ (ใบขอใช้แค่ชื่อ
 * จึงต้องได้คนที่ยังไม่มีเบอร์ด้วย) ถ้าแตกเป็นสองเส้นตามผู้ใช้ นิยาม "ใครอยู่สายไหน"
 * จะเพี้ยนสองที่ (บทเรียนเดิม: หนึ่งเมตริกหนึ่งนิยาม)
 *
 * - ต้อง **มีเบอร์** — จุดประสงค์ของช่องนี้คือ "เลือกชื่อแล้วได้เบอร์"
 * - เอาเฉพาะสาย **สรรหา/คัดสรร/ส่งคนแทน** (23 ก.ย. 2569 · ส่งคนแทนเพิ่ม 11 ต.ค. 2569) ไม่รวม opl/online
 */
export function followStaffDirectory(
  all: readonly StaffDirectoryEntry[],
): StaffDirectoryEntry[] {
  return all.filter(
    (d) =>
      d.phone.trim() !== '' &&
      (d.lanes.includes('recruiter') || d.lanes.includes('screener') || d.lanes.includes('replacement')),
  );
}
