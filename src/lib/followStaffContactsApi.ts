import { apiFetch } from '@/lib/apiFetch';

/**
 * รายชื่อ+เบอร์เจ้าหน้าที่ผู้ติดตาม (migration 099 · เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ)
 * — dropdown แทนช่องพิมพ์เบอร์เองบนหน้า Follow · เพิ่มชื่อได้เฉพาะ supervisor ขึ้นไป
 */
export type FollowStaffContact = {
  id: string;
  name: string;
  phone: string;
  created_by_name: string | null;
  created_at: string;
};

async function readError(r: Response): Promise<string> {
  const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
  return data.message || data.error || `ไม่สำเร็จ (HTTP ${r.status})`;
}

export async function listStaffContacts(): Promise<FollowStaffContact[]> {
  const r = await apiFetch('/api/follow-staff-contacts');
  if (!r.ok) throw new Error(await readError(r));
  const data = (await r.json()) as { items: FollowStaffContact[] };
  return data.items ?? [];
}

export async function createStaffContact(name: string, phone: string): Promise<FollowStaffContact> {
  const r = await apiFetch('/api/follow-staff-contacts', {
    method: 'POST',
    body: JSON.stringify({ name, phone }),
  });
  if (!r.ok) throw new Error(await readError(r));
  return (await r.json()) as FollowStaffContact;
}

/**
 * หา contact ที่ตรงกับค่า staff_phone ที่เก็บไว้ — เทียบแบบ trim ตรงตัว
 *
 * ⚠️ ตั้งใจ**ไม่ใช้ phoneKey (เลข 9 ตัวท้าย)** แบบเบอร์ผู้สมัคร — เบอร์เจ้าหน้าที่
 * เป็นเบอร์บ้าน/เบอร์ต่อภายในได้ ("021234567 ต่อ 101") เลขท้ายของเบอร์+ต่อ
 * ไม่ใช่ตัวระบุที่เชื่อได้ · ค่าที่เก็บมาจาก dropdown ตัวเดียวกันอยู่แล้ว จึงตรงตัวเสมอ
 */
export function matchStaffContact(
  staffPhone: string | null | undefined,
  contacts: FollowStaffContact[],
): FollowStaffContact | null {
  const key = (staffPhone || '').trim();
  if (!key) return null;
  return contacts.find((c) => c.phone.trim() === key) ?? null;
}
