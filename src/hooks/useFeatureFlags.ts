import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { readErrorMessage, readJsonSafe } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  buildFeatureFlagMap,
  isFeatureVisible,
  type FeatureFlag,
  type FeatureFlagMap,
  type FeatureId,
} from '@/lib/featureFlags';

/**
 * cache ระดับ module — สวิตช์ฟีเจอร์ถูกถามจากหลายหน้า
 * ไม่ยิงซ้ำทุกครั้งที่ mount (แพตเทิร์นเดียวกับ useWorkStatusOptions)
 */
let cached: FeatureFlagMap | null = null;
let inflight: Promise<FeatureFlagMap> | null = null;
const listeners = new Set<(m: FeatureFlagMap) => void>();

async function load(): Promise<FeatureFlagMap> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const r = await apiFetch('/api/feature-flags');
      if (!r.ok) throw new Error('load failed');
      const data = await readJsonSafe<FeatureFlag[]>(r);
      cached = buildFeatureFlagMap(Array.isArray(data) ? data : []);
    } catch {
      // API ล่ม / ยังไม่ migrate → ถือว่าเปิดทุกฟีเจอร์ ไม่ให้ระบบใช้งานไม่ได้ทั้งระบบ
      cached = buildFeatureFlagMap([]);
    } finally {
      inflight = null;
    }
    for (const fn of listeners) fn(cached!);
    return cached!;
  })();
  return inflight;
}

export function invalidateFeatureFlags(): void {
  cached = null;
}

export function useFeatureFlags() {
  const { user } = useAuth();
  const [flags, setFlags] = useState<FeatureFlagMap | null>(cached);

  useEffect(() => {
    let alive = true;
    const onChange = (m: FeatureFlagMap) => {
      if (alive) setFlags(m);
    };
    listeners.add(onChange);
    void load().then((m) => {
      if (alive) setFlags(m);
    });
    return () => {
      alive = false;
      listeners.delete(onChange);
    };
  }, []);

  const isVisible = useCallback(
    (featureId: FeatureId) => isFeatureVisible(featureId, flags, user?.role),
    [flags, user?.role],
  );

  const refresh = useCallback(async () => {
    invalidateFeatureFlags();
    const m = await load();
    setFlags(m);
    return m;
  }, []);

  return { flags, isVisible, refresh };
}

export async function setFeatureEnabled(featureId: string, enabled: boolean): Promise<void> {
  const r = await apiFetch('/api/feature-flags', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ featureId, enabled }),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'เปลี่ยนสวิตช์ฟีเจอร์ไม่สำเร็จ'));
  invalidateFeatureFlags();
}
