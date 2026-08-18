import { apiFetch } from '@/lib/apiFetch';

/**
 * "เรื่องที่จะให้โทรติดตาม" (migration 100 · เจ้าของสั่ง 18 ส.ค. 2569)
 * — dropdown บนฟอร์ม Follow · เพิ่มเรื่องใหม่ได้เฉพาะ supervisor ขึ้นไป
 *
 * ⚠️ เป็น **ตัวช่วยกรอก ไม่ใช่ค่าบังคับ** — ช่อง topic ยังพิมพ์เองได้เสมอ
 */
export type FollowTopic = {
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

export async function listFollowTopics(): Promise<FollowTopic[]> {
  const r = await apiFetch('/api/follow-topics');
  if (!r.ok) throw new Error(await readError(r));
  const data = (await r.json()) as { items: FollowTopic[] };
  return data.items ?? [];
}

/** โหลดครั้งเดียวแล้วแชร์กัน (ฟอร์มเพิ่มกับกล่องแก้ไขเปิดพร้อมกันได้) */
let cached: Promise<FollowTopic[]> | null = null;

export function listFollowTopicsCached(): Promise<FollowTopic[]> {
  cached ??= listFollowTopics().catch((e) => {
    cached = null;
    throw e;
  });
  return cached;
}

export function invalidateFollowTopicsCache(): void {
  cached = null;
}

export async function createFollowTopic(name: string): Promise<FollowTopic> {
  const r = await apiFetch('/api/follow-topics', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  if (!r.ok) throw new Error(await readError(r));
  invalidateFollowTopicsCache();
  return (await r.json()) as FollowTopic;
}
