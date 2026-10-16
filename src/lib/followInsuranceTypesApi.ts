import { apiFetch } from '@/lib/apiFetch';

/**
 * "ประเภทประกัน" (migration 149 · เจ้าของสั่ง 16 ต.ค. 2569) — dropdown ขั้น 4 ฟอร์มเพิ่มคนติดตาม
 * > *"ประเภทประกัน ทำเป็น Dropdown ดังนี้ ขอหน้า Ui ไว้เพิ่มในอนาคตด้วย ณ ตอนนี้เอาแค่นี้"*
 * เพิ่มได้ที่ ตั้งค่าตัวเลือก › เพิ่มประเภทประกัน (supervisor ขึ้นไป) · แพตเทิร์นเดียวกับ `followTopicsApi`
 */
export type FollowInsuranceType = {
  id: string;
  name: string;
  sort_order: number;
  created_by_name: string | null;
  created_at: string;
};

async function readError(r: Response): Promise<string> {
  const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
  return data.message || data.error || `ไม่สำเร็จ (HTTP ${r.status})`;
}

export async function listFollowInsuranceTypes(): Promise<FollowInsuranceType[]> {
  const r = await apiFetch('/api/follow-insurance-types');
  if (!r.ok) throw new Error(await readError(r));
  const data = (await r.json()) as { items: FollowInsuranceType[] };
  return data.items ?? [];
}

export async function createFollowInsuranceType(name: string): Promise<FollowInsuranceType> {
  const r = await apiFetch('/api/follow-insurance-types', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  if (!r.ok) throw new Error(await readError(r));
  return (await r.json()) as FollowInsuranceType;
}

/**
 * ตัวเลือกที่โชว์ใน dropdown — ค่าที่บันทึกไว้แล้วแต่ไม่อยู่ในลิสต์ (เช่นบรรทัดยาวที่เคยดึงจาก ERP) ยังต้องเลือกค้างได้
 * ห้ามล้างค่าเดิมเงียบ ๆ เพียงเพราะไม่อยู่ในลิสต์
 */
export function insuranceTypeOptions(types: readonly { name: string }[], current: string): string[] {
  const names = types.map((t) => t.name);
  const cur = current.trim();
  return cur && !names.includes(cur) ? [...names, cur] : names;
}
