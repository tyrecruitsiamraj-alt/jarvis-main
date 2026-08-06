import { apiFetch } from '@/lib/apiFetch';
import { readErrorMessage, readJsonSafe } from '@/lib/api';
import {
  DEFAULT_PRIORITY_CONFIG,
  normalizePriorityConfig,
  type PriorityConfig,
} from '@/lib/candidatePriority';

/**
 * น้ำหนักเกณฑ์เรียงผู้สมัคร — เก็บที่ server ทีมทั้งทีมจึงเห็นลำดับเดียวกัน
 * โหลดพลาด (ยังไม่รัน migration / เน็ตหลุด) = ใช้ค่าเริ่มต้นในโค้ด ไม่ให้หน้า Matching พัง
 */
export async function fetchMatchPriorityConfig(): Promise<PriorityConfig> {
  try {
    const r = await apiFetch('/api/match-priority-weights');
    if (!r.ok) return DEFAULT_PRIORITY_CONFIG;
    const data = await readJsonSafe<{ config: unknown }>(r);
    return normalizePriorityConfig(data?.config ?? null);
  } catch {
    return DEFAULT_PRIORITY_CONFIG;
  }
}

export async function saveMatchPriorityConfig(config: PriorityConfig): Promise<PriorityConfig> {
  const r = await apiFetch('/api/match-priority-weights', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config }),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'บันทึกน้ำหนักไม่สำเร็จ'));
  const data = await readJsonSafe<{ config: unknown }>(r);
  return normalizePriorityConfig(data?.config ?? config);
}
