import { apiFetch } from '@/lib/apiFetch';
import { clearRuntimeDemoFlag, isRuntimeDemoFallback } from '@/lib/demoMode';

type HealthPayload = {
  ok?: boolean;
  db?: { enabled?: boolean; reachable?: boolean | null };
};

/** ลองออกจากโหมดตัวอย่างชั่วคราวเมื่อ API/DB พร้อมแล้ว */
export async function tryRecoverFromRuntimeDemo(): Promise<'recovered' | 'still_offline' | 'no_flag'> {
  if (!isRuntimeDemoFallback()) return 'no_flag';

  try {
    const r = await apiFetch('/api/health', { cache: 'no-store' });
    const data = (await r.json().catch(() => ({}))) as HealthPayload;
    if (!r.ok || !data.ok) return 'still_offline';
    if (data.db?.enabled && data.db.reachable === false) return 'still_offline';

    clearRuntimeDemoFlag();
    return 'recovered';
  } catch {
    return 'still_offline';
  }
}

export function reloadForLiveData(): void {
  window.location.reload();
}
