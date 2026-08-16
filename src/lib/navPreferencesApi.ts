import { apiFetch } from '@/lib/apiFetch';
import { normalizeNavPreferences, type NavPreferences } from '@/lib/navPreferences';

/**
 * เมนูที่แอดมินจัดเอง (migration 093)
 * ⚠️ อ่านไม่ได้ = ใช้เมนูตั้งต้น **ห้าม throw** — เมนูพังทั้งแอปเพราะค่าเสริมไม่ได้
 */
export async function fetchNavPreferences(): Promise<NavPreferences> {
  try {
    const r = await apiFetch('/api/app-nav-preferences');
    if (!r.ok) return {};
    const data = (await r.json()) as { preferences?: unknown };
    return normalizeNavPreferences(data.preferences);
  } catch {
    return {};
  }
}

/** บันทึก — เฉพาะ admin (server กันอีกชั้น) */
export async function saveNavPreferences(preferences: NavPreferences): Promise<NavPreferences> {
  const r = await apiFetch('/api/app-nav-preferences', {
    method: 'PUT',
    body: JSON.stringify({ preferences }),
  });
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(data.message || data.error || `บันทึกไม่สำเร็จ (HTTP ${r.status})`);
  }
  const data = (await r.json()) as { preferences?: unknown };
  return normalizeNavPreferences(data.preferences);
}
