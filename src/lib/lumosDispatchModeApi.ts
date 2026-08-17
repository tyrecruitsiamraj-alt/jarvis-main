import { apiFetch } from '@/lib/apiFetch';
import { readErrorMessage, readJsonSafe } from '@/lib/api';
import {
  DEFAULT_LUMOS_DISPATCH_MODE,
  normalizeLumosDispatchMode,
  type LumosDispatchModeConfig,
} from '@/lib/lumosDispatchMode';

/**
 * โหมดส่งงานให้ Lumos — อ่านได้ทุก role · เปลี่ยนได้เฉพาะ admin
 * โหลดพลาด/ยังไม่ migrate = manual ทุกจุด (fail-safe เดียวกับฝั่ง server)
 */
export async function fetchLumosDispatchMode(): Promise<LumosDispatchModeConfig> {
  try {
    const r = await apiFetch('/api/lumos/dispatch-mode');
    if (!r.ok) return DEFAULT_LUMOS_DISPATCH_MODE;
    const data = await readJsonSafe<{ config: unknown }>(r);
    return normalizeLumosDispatchMode(data?.config ?? null);
  } catch {
    return DEFAULT_LUMOS_DISPATCH_MODE;
  }
}

export async function saveLumosDispatchMode(
  config: LumosDispatchModeConfig,
): Promise<LumosDispatchModeConfig> {
  const r = await apiFetch('/api/lumos/dispatch-mode', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config }),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'บันทึกโหมดส่งงานไม่สำเร็จ'));
  const data = await readJsonSafe<{ config: unknown }>(r);
  return normalizeLumosDispatchMode(data?.config ?? null);
}
