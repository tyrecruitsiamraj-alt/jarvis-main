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
/**
 * น้ำหนักที่ใช้จริง + ค่ากลาง + ใบนี้ตั้งเองไว้ไหม
 * (เจ้าของสั่ง 17 ส.ค. 2569: ค่าที่ตั้งไว้เป็น Default · แต่ละใบแก้เองได้)
 */
export type MatchPriorityState = {
  /** ค่าที่ใช้จริงกับใบนี้ (ของใบถ้ามี ไม่มีก็ค่ากลาง) */
  config: PriorityConfig;
  /** ค่ากลางจากหน้า Settings — ไว้โชว์ว่าค่าเริ่มต้นคือเท่าไร */
  defaultConfig: PriorityConfig;
  /** ใบนี้ตั้งน้ำหนักเองไว้ไหม — **ไม่ได้เดาจากการเทียบค่า** (ตั้งเท่ากันก็ยังนับว่าตั้งเอง) */
  overridden: boolean;
};

const FALLBACK: MatchPriorityState = {
  config: DEFAULT_PRIORITY_CONFIG,
  defaultConfig: DEFAULT_PRIORITY_CONFIG,
  overridden: false,
};

/** `requestNo` = id เต็มของใบขอ (`siamraj-sql:` / `siamraj-pre:`) · ไม่ส่ง = อ่านค่ากลาง */
export async function fetchMatchPriorityState(requestNo?: string): Promise<MatchPriorityState> {
  try {
    const qs = requestNo?.trim() ? `?request_no=${encodeURIComponent(requestNo.trim())}` : '';
    const r = await apiFetch(`/api/match-priority-weights${qs}`);
    if (!r.ok) return FALLBACK;
    const data = await readJsonSafe<{
      config: unknown;
      defaultConfig?: unknown;
      overridden?: unknown;
    }>(r);
    return {
      config: normalizePriorityConfig(data?.config ?? null),
      defaultConfig: normalizePriorityConfig(data?.defaultConfig ?? null),
      overridden: data?.overridden === true,
    };
  } catch {
    return FALLBACK;
  }
}

/** ค่าที่ใช้จริงของใบนั้น — ตัวย่อสำหรับที่ที่ต้องการแค่ config */
export async function fetchMatchPriorityConfig(requestNo?: string): Promise<PriorityConfig> {
  return (await fetchMatchPriorityState(requestNo)).config;
}

export async function saveMatchPriorityConfig(
  config: PriorityConfig,
  requestNo?: string,
): Promise<PriorityConfig> {
  const qs = requestNo?.trim() ? `?request_no=${encodeURIComponent(requestNo.trim())}` : '';
  const r = await apiFetch(`/api/match-priority-weights${qs}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config }),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'บันทึกน้ำหนักไม่สำเร็จ'));
  const data = await readJsonSafe<{ config: unknown }>(r);
  return normalizePriorityConfig(data?.config ?? config);
}

/** รีเซ็ตน้ำหนักของใบนั้น → กลับไปใช้ค่ากลาง (ค่ากลางลบไม่ได้) */
export async function resetMatchPriorityConfig(requestNo: string): Promise<void> {
  const r = await apiFetch(
    `/api/match-priority-weights?request_no=${encodeURIComponent(requestNo.trim())}`,
    { method: 'DELETE' },
  );
  if (!r.ok) throw new Error(await readErrorMessage(r, 'รีเซ็ตน้ำหนักไม่สำเร็จ'));
}
